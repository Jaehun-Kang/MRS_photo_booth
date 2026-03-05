import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import {
  uploadImageToFirebase,
  generateUniqueFileName,
} from '../firebase/storage.js';
import FilterScreen from './FilterScreen.jsx';
import Overlay from './Overlay.jsx';
import { createScreenSketch } from '../filters/createScreenSketch.js';
import { filters } from '../filters';
import backIcon from '../assets/arrow_left.svg';
import homeIcon from '../assets/home.svg';
import '../styles/FilterScreenRender.css';
import {
  getCameraCapabilities,
  getFullScreenResolution,
} from '../utils/cameraUtils.js';

function FilterScreenRender({
  filterIndex,
  onBack,
  onHome,
  selectedDeviceId,
  onError,
}) {
  const [video, setVideo] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [showFlash, setShowFlash] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [showResult, setShowResult] = useState(false);

  // 컴포넌트 언마운트 시 html2canvas-container 정리
  useEffect(() => {
    return () => {
      // html2canvas가 생성한 컨테이너들 정리
      const containers = document.querySelectorAll(
        '[class*="html2canvas-container"]'
      );
      containers.forEach((container) => {
        console.log(
          '🧹 FilterScreenRender 언마운트: html2canvas-container 정리:',
          container
        );
        container.remove();
      });

      // 추가로 html2canvas가 생성할 수 있는 다른 임시 요소들도 정리
      const canvasElements = document.querySelectorAll(
        'canvas[style*="position: absolute"]'
      );
      canvasElements.forEach((canvas) => {
        if (canvas.parentElement && canvas.parentElement !== document.body) {
          console.log(
            '🧹 FilterScreenRender 언마운트: 임시 canvas 요소 정리:',
            canvas
          );
          canvas.remove();
        }
      });
    };
  }, []);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        // 카메라 정보 가져오기 (캐시 사용)
        const cameraInfo = await getCameraCapabilities(selectedDeviceId);
        const fullScreenResolution = getFullScreenResolution(cameraInfo);

        console.log(
          `[FullScreen] 최대 해상도 사용: ${fullScreenResolution.width}x${fullScreenResolution.height}`
        );

        const p5video = document.createElement('video');
        navigator.mediaDevices
          .getUserMedia({
            video: {
              deviceId: selectedDeviceId
                ? { exact: selectedDeviceId }
                : undefined,
              width: { ideal: fullScreenResolution.width },
              height: { ideal: fullScreenResolution.height },
            },
          })
          .then((stream) => {
            p5video.srcObject = stream;
            p5video.play();

            const onLoadedMetadata = () => {
              console.log(
                'Video size:',
                p5video.videoWidth,
                p5video.videoHeight
              );
              setVideo(p5video);
              setVideoReady(true);
              p5video.removeEventListener('loadedmetadata', onLoadedMetadata);
            };

            if (p5video.readyState >= 2) {
              onLoadedMetadata();
            } else {
              p5video.addEventListener('loadedmetadata', onLoadedMetadata);
            }
          })
          .catch((err) => {
            console.error('웹캠 접근 오류:', err);
            onError && onError(err);
          });

        return () => {
          if (p5video && p5video.srcObject) {
            p5video.srcObject.getTracks().forEach((track) => track.stop());
          }
        };
      } catch (err) {
        console.error('카메라 설정 오류:', err);
        onError && onError(err);
      }
    };

    setupCamera();
  }, [selectedDeviceId, onError]);

  // video와 videoReady 상태가 바뀌면 메모이제이션된 sketchFactory 반환
  const getSketchFactory = useCallback(
    (filter) => (w, h, onReady) => {
      return createScreenSketch({
        video,
        width: w,
        height: h,
        filter,
        onReady,
      });
    },
    [video]
  );

  // video가 준비되면 모든 필터에 대한 sketchFactory 배열 생성
  const sketchFactories = useMemo(() => {
    if (!videoReady) return [];
    return filters.map((filter) => getSketchFactory(filter));
  }, [videoReady, getSketchFactory]);

  // 필터 오류 시 반환
  if (
    typeof filterIndex !== 'number' ||
    filterIndex < 0 ||
    filterIndex >= filters.length
  ) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p>유효하지 않은 필터입니다.</p>
        <div className="btn_container">
          <button className="btn_container-back" onClick={onBack}>
            <img
              className="btn_container-back--img"
              src={backIcon}
              alt="Back"
            />
          </button>
        </div>
      </div>
    );
  }

  if (!videoReady) {
    return <p>loading...</p>;
  }

  // 촬영 n번 반복
  const handleCaptureStart = async () => {
    setCapturedImages([]);

    setCaptureProgress(0);
    for (let i = 0; i < 4; i++) {
      await runSingleCapture();
      setCaptureProgress(i + 1);
    }
    setCaptureProgress(null);
    setShowResult(true);
  };

  // 촬영 함수
  function runSingleCapture() {
    return new Promise((resolve) => {
      let count = 8;
      setCountdown(count);

      const interval = setInterval(() => {
        count--;
        if (count >= 1) {
          setCountdown(count);
        } else {
          clearInterval(interval);
          setCountdown(null);
          setShowFlash(true);
          setTimeout(() => {
            setShowFlash(false);

            // 개별 이미지 저장 로직
            const canvas = document.querySelector('canvas');
            if (canvas) {
              const imageData = canvas.toDataURL('image/png');
              setCapturedImages((prev) => [...prev, imageData]);
            }

            resolve();
          }, 200);
        }
      }, 1000);
    });
  }

  function CaptureResult({ images, onBack, onHome }) {
    const resultRef = useRef();
    const displayContainerRef = useRef();
    const [printCopies, setPrintCopies] = useState(1); // 출력 매수
    const [isPrinting, setIsPrinting] = useState(false); // 프린트 진행 상태
    const [qrCodeUrl, setQrCodeUrl] = useState(''); // QR코드 이미지 URL
    const [qrTargetUrl, setQrTargetUrl] = useState(''); // QR코드가 가리키는 실제 URL

    // 화면 크기에 따른 반응형 스케일링
    useEffect(() => {
      const updateScale = () => {
        if (!displayContainerRef.current) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // result-container의 기본 크기
        const baseWidth = 400;
        const baseHeight = 1200;

        // 여백을 고려한 스케일 계산 (여백 40px)
        const scaleX = (vw - 40) / baseWidth;
        const scaleY = (vh - 40) / baseHeight;
        const scale = Math.min(scaleX, scaleY, 1); // 최대 1배까지만 허용

        console.log(`반응형 스케일: ${vw}x${vh} -> scale(${scale.toFixed(3)})`);

        // translate(-50%, -50%)와 scale()을 함께 적용하여 중앙 정렬 유지
        displayContainerRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;

        if (scale < 1) {
          console.log(`중앙 정렬 유지: translate(-50%, -50%) scale(${scale})`);
        }
      };

      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }, []);

    // QR코드는 사용자가 버튼을 클릭할 때 생성
    // useEffect 제거 - 자동 생성하지 않음

    // QR코드 생성 버튼 클릭 핸들러
    const handleQRCodeGenerate = async () => {
      if (!resultRef.current) return;

      console.log('QR코드용 이미지 저장 시작...');

      // 폰트 로드 대기
      try {
        await document.fonts.load('300 38px PyeongChangPeace-Light');
        await document.fonts.load('400 16px sans-serif');
        console.log('🔤 폰트 로드 완료');
      } catch (error) {
        console.warn('폰트 로드 실패:', error);
      }

      await Promise.all(
        Array.from(resultRef.current.querySelectorAll('img')).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
        })
      );

      // 저장용 요소를 활성화 (화면에는 보이지 않음)
      resultRef.current.classList.add('saving');

      console.log('저장용 요소 활성화 중...');

      // 잠시 대기 (DOM 업데이트 완료 + 폰트 렌더링)
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(resultRef.current, {
        scale: 2, // 고해상도로 캡처 (기존 방식)
        width: 800,
        height: 1200,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        removeContainer: false,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          console.log('문서 클론 중...');

          // 폰트 스타일을 명시적으로 적용
          const style = clonedDoc.createElement('style');
          style.textContent = `
            @font-face {
              font-family: 'PyeongChangPeace-Light';
              src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2206-02@1.0/PyeongChangPeace-Light.woff2') format('woff2');
              font-weight: 300;
              font-style: normal;
            }
            .result-logo-text {
              font-family: 'PyeongChangPeace-Light', 'Malgun Gothic', sans-serif !important;
              font-weight: 600 !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          // 이미지 품질 향상
          const imgs = clonedDoc.querySelectorAll('img');
          imgs.forEach((img) => {
            img.style.imageRendering = 'high-quality';
          });
        },
      });

      // 저장용 요소를 다시 비활성화
      resultRef.current.classList.remove('saving');

      console.log(`저장 완료: ${canvas.width}x${canvas.height}px`);

      // 고품질 PNG로 저장 (기존 방식)
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      // 현재 시간을 기반으로 고유 ID 생성
      const imageId = Date.now().toString();

      // 단일 이미지 생성 및 저장 (뷰어용)
      const singleImageCanvas = document.createElement('canvas');
      const singleCtx = singleImageCanvas.getContext('2d');

      // result-container들의 실제 레이아웃 찾기
      const resultContainers =
        resultRef.current.querySelectorAll('.result-container');
      const firstContainer = resultContainers[0];

      if (firstContainer) {
        const containerRect = firstContainer.getBoundingClientRect();
        const resultRect = resultRef.current.getBoundingClientRect();

        // 실제 컨테이너의 위치와 크기 계산 (스케일 고려)
        const scale = 2; // html2canvas scale
        const containerX = (containerRect.left - resultRect.left) * scale;
        const containerY = (containerRect.top - resultRect.top) * scale;
        const containerWidth = containerRect.width * scale;
        const containerHeight = containerRect.height * scale;

        console.log(
          `첫 번째 컨테이너 위치: x=${containerX}, y=${containerY}, w=${containerWidth}, h=${containerHeight}`
        );

        // 단일 이미지 캔버스 크기 설정 (비율 유지)
        const targetWidth = 400;
        const targetHeight = Math.round(
          targetWidth * (containerHeight / containerWidth)
        );
        singleImageCanvas.width = targetWidth;
        singleImageCanvas.height = targetHeight;

        // 흰색 배경
        singleCtx.fillStyle = '#ffffff';
        singleCtx.fillRect(0, 0, targetWidth, targetHeight);

        // 정확한 위치에서 첫 번째 이미지 영역 추출
        singleCtx.drawImage(
          canvas,
          containerX,
          containerY,
          containerWidth,
          containerHeight, // 소스 영역
          0,
          0,
          targetWidth,
          targetHeight // 대상 영역
        );

        console.log(`단일 이미지 생성: ${targetWidth}x${targetHeight}px`);
      } else {
        // fallback: 기존 방식 사용
        singleImageCanvas.width = 400;
        singleImageCanvas.height = 600;
        singleCtx.fillStyle = '#ffffff';
        singleCtx.fillRect(0, 0, 400, 600);
        singleCtx.drawImage(canvas, 0, 0, 800, 1200, 0, 0, 400, 600);
        console.log('컨테이너를 찾지 못해 기존 방식 사용');
      }

      // 이미지를 고품질 PNG로 변환 (Firebase 업로드용 - 무손실 압축)
      const singleImageDataUrl = singleImageCanvas.toDataURL('image/png');

      console.log(
        `Firebase 업로드용 이미지 생성: ${Math.round(
          singleImageDataUrl.length / 1024
        )}KB`
      );

      try {
        // Firebase Storage에 업로드
        const fileName = generateUniqueFileName('photobooth');
        console.log('Firebase Storage 업로드 시작...');

        const downloadURL = await uploadImageToFirebase(
          singleImageDataUrl,
          fileName
        );
        console.log('Firebase 업로드 완료:', downloadURL);

        // 이미지 뷰어 페이지 URL 생성 (Base64로 안전하게 인코딩)
        const currentOrigin = window.location.origin;
        const currentPath = window.location.pathname;

        // Firebase URL을 Base64로 인코딩해서 안전하게 전달
        const encodedFirebaseUrl = btoa(downloadURL);
        const imageViewerUrl = `${currentOrigin}${currentPath}?view=image&firebaseUrl=${encodedFirebaseUrl}`;

        console.log('생성된 이미지 뷰어 URL:', imageViewerUrl);
        console.log('Firebase 다운로드 URL:', downloadURL);
        console.log('Base64 인코딩된 Firebase URL:', encodedFirebaseUrl);

        // QR 코드 생성
        const qrCodeDataUrl = await QRCode.toDataURL(imageViewerUrl, {
          width: 150,
          margin: 2,
          color: {
            dark: '#1647C1',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'L',
        });

        setQrCodeUrl(qrCodeDataUrl);
        setQrTargetUrl(imageViewerUrl);
        console.log('QR코드 생성 완료 (웹 URL 방식)');
      } catch (qrError) {
        console.error('모든 방식 실패:', qrError);
        alert(
          '이미지가 너무 커서 QR코드로 변환할 수 없습니다. 이미지 크기를 줄여주세요.'
        );
      }
    };

    // QR코드 클릭 핸들러
    const handleQRCodeClick = () => {
      if (qrTargetUrl) {
        console.log('QR코드 클릭, 이동할 URL:', qrTargetUrl);
        window.open(qrTargetUrl, '_blank');
      } else {
        console.warn('QR코드 클릭됐지만 타겟 URL이 없음');
      }
    };

    const handlePrint = async () => {
      if (!resultRef.current || isPrinting) return;

      console.log(`프린트 시작: ${printCopies}매 출력`);
      setIsPrinting(true);

      try {
        // 폰트 로드 대기
        await document.fonts.load('300 38px PyeongChangPeace-Light');
        await document.fonts.load('400 16px sans-serif');

        // 이미지 로드 대기
        await Promise.all(
          Array.from(resultRef.current.querySelectorAll('img')).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((res) => {
              img.onload = res;
              img.onerror = res;
            });
          })
        );

        // 저장용 요소를 활성화
        resultRef.current.classList.add('saving');
        await new Promise((resolve) => setTimeout(resolve, 300));

        const canvas = await html2canvas(resultRef.current, {
          scale: 2,
          width: 800,
          height: 1200,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          removeContainer: false,
          foreignObjectRendering: false,
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            const style = clonedDoc.createElement('style');
            style.textContent = `
              @font-face {
                font-family: 'PyeongChangPeace-Light';
                src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2206-02@1.0/PyeongChangPeace-Light.woff2') format('woff2');
                font-weight: 300;
                font-style: normal;
              }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        resultRef.current.classList.remove('saving');

        // 캐논 프린터 호환 형식으로 프린트 준비
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Photo Print</title>
              <style>
                @page {
                  size: 4in 6in;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
                .print-page {
                  width: 4in;
                  height: 6in;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  page-break-after: always; /* 각 이미지를 별도 페이지로 프린트 */
                }
                .print-page:last-child {
                  page-break-after: auto; /* 마지막 페이지는 페이지 나누기 안함 */
                }
                img {
                  width: 4in;
                  height: 6in;
                  object-fit: cover;
                }
              </style>
            </head>
            <body>
              ${Array(printCopies)
                .fill()
                .map(
                  (_, index) =>
                    `<div class="print-page">
                  <img src="${canvas.toDataURL(
                    'image/png',
                    1.0
                  )}" alt="Photo Print ${index + 1}" />
                </div>`
                )
                .join('')}
            </body>
          </html>
        `);

        printWindow.document.close();

        // 프린트 다이얼로그 실행
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 1000);

        console.log(`프린트 완료: ${printCopies}매`);
      } catch (error) {
        console.error('프린트 오류:', error);
        alert('프린트 중 오류가 발생했습니다.');
      } finally {
        setIsPrinting(false);
      }
    };

    return (
      <div className="result">
        <div ref={displayContainerRef} className="result-container">
          <div className="result-frame">
            {images.map((src, idx) => (
              <img key={idx} src={src} alt={`촬영 ${idx + 1}`} />
            ))}
          </div>
          <div className="result-logo">
            <InlineLogoSVG className="result-logo-svg" />
            <div className="result-logo-text">
              마법연구회
              <div className="result-logo-text-date">
                {`${new Date().getFullYear()}.${String(
                  new Date().getMonth() + 1
                ).padStart(2, '0')}.${String(new Date().getDate()).padStart(
                  2,
                  '0'
                )}`}
              </div>
            </div>
          </div>
        </div>
        {/* 저장용 : 2개 가로 배치 (원본 크기 유지) */}
        <div className="forSave" ref={resultRef}>
          <div className="result-container">
            <div className="result-frame">
              {images.map((src, idx) => (
                <img key={idx} src={src} alt={`촬영 ${idx + 1}`} />
              ))}
            </div>
            <div className="result-logo">
              <InlineLogoSVG className="result-logo-svg" />
              <div className="result-logo-text">
                마법연구회
                <div className="result-logo-text-date">
                  {`${new Date().getFullYear()}.${String(
                    new Date().getMonth() + 1
                  ).padStart(2, '0')}.${String(new Date().getDate()).padStart(
                    2,
                    '0'
                  )}`}
                </div>
              </div>
            </div>
          </div>
          <div className="result-container">
            <div className="result-frame">
              {images.map((src, idx) => (
                <img key={idx} src={src} alt={`촬영 ${idx + 1}`} />
              ))}
            </div>
            <div className="result-logo">
              <InlineLogoSVG className="result-logo-svg" />
              <div className="result-logo-text">
                마법연구회
                <div className="result-logo-text-date">
                  {`${new Date().getFullYear()}.${String(
                    new Date().getMonth() + 1
                  ).padStart(2, '0')}.${String(new Date().getDate()).padStart(
                    2,
                    '0'
                  )}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 프린트 컨트롤 */}
        <div className="print-controls">
          {/* QR코드 생성 버튼 */}
          <div className="qr-code-section">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code for download"
                className="qr-code"
                onClick={handleQRCodeClick}
                style={{ cursor: 'pointer' }}
                title="클릭하여 이미지 보기"
              />
            ) : (
              <button
                className="qr-generate-btn"
                onClick={handleQRCodeGenerate}
                title="QR코드를 생성하여 이미지를 공유하세요"
              >
                QR 코드 생성
              </button>
            )}
          </div>
          <div className="print-copies">
            <div className="copies-control">
              <button
                className="copies-btn minus"
                onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                disabled={isPrinting || printCopies <= 1}
              >
                -
              </button>
              <span className="copies-display">{printCopies}매</span>
              <button
                className="copies-btn plus"
                onClick={() => setPrintCopies(Math.min(10, printCopies + 1))}
                disabled={isPrinting || printCopies >= 10}
              >
                +
              </button>
            </div>
          </div>
          <button
            className="print-button"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? '프린트 중...' : '프린트'}
          </button>
        </div>

        <div className="btn_container">
          <button
            className="btn_container-home"
            onClick={() => {
              // html2canvas 컨테이너 정리
              const containers = document.querySelectorAll(
                '[class*="html2canvas-container"]'
              );
              containers.forEach((container) => {
                console.log(
                  '🧹 홈 버튼: html2canvas-container 정리:',
                  container
                );
                container.remove();
              });

              // 추가로 html2canvas가 생성할 수 있는 다른 임시 요소들도 정리
              const canvasElements = document.querySelectorAll(
                'canvas[style*="position: absolute"]'
              );
              canvasElements.forEach((canvas) => {
                if (
                  canvas.parentElement &&
                  canvas.parentElement !== document.body
                ) {
                  console.log('🧹 홈 버튼: 임시 canvas 요소 정리:', canvas);
                  canvas.remove();
                }
              });

              onHome();
            }}
          >
            <img
              className="btn_container-home--img"
              src={homeIcon}
              alt="Home"
            />
          </button>
          <button
            className="btn_container-back"
            onClick={() => {
              // html2canvas 컨테이너 정리
              const containers = document.querySelectorAll(
                '[class*="html2canvas-container"]'
              );
              containers.forEach((container) => {
                console.log(
                  '🧹 뒤로가기 버튼: html2canvas-container 정리:',
                  container
                );
                container.remove();
              });

              // 추가로 html2canvas가 생성할 수 있는 다른 임시 요소들도 정리
              const canvasElements = document.querySelectorAll(
                'canvas[style*="position: absolute"]'
              );
              canvasElements.forEach((canvas) => {
                if (
                  canvas.parentElement &&
                  canvas.parentElement !== document.body
                ) {
                  console.log(
                    '🧹 뒤로가기 버튼: 임시 canvas 요소 정리:',
                    canvas
                  );
                  canvas.remove();
                }
              });

              onBack();
            }}
          >
            <img
              className="btn_container-back--img"
              src={backIcon}
              alt="Back"
            />
          </button>
        </div>
      </div>
    );
  }

  return showResult ? (
    <CaptureResult
      images={capturedImages}
      onBack={() => {
        setShowResult(false);
        setCapturedImages([]);
      }}
      onHome={onHome}
    />
  ) : (
    <div>
      {captureProgress === null && (
        <div className="btn_container">
          <button className="btn_container-back" onClick={onBack}>
            <img
              className="btn_container-back--img"
              src={backIcon}
              alt="Back"
            />
          </button>
        </div>
      )}
      <div className="cam_screen--section">
        <div className="cam_screen--section--container">
          <FilterScreen
            sketchFactory={sketchFactories[filterIndex]}
            video={video}
          />
        </div>
      </div>
      <Overlay
        onStartCapture={handleCaptureStart}
        countdown={countdown}
        showFlash={showFlash}
        captureProgress={captureProgress}
      />
    </div>
  );
}

function InlineLogoSVG(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" {...props}>
      <g id="logo1">
        {/* 십자형 두 패스를 정확히 하나로 합침 */}
        <path
          fill="rgb(0.21, 50.42, 225.59)"
          d="
            M500,927c0-477-5-495-113-495,108,0,113,0,113-360
            M500,927c0-477,5-495,113-495-108,0-113,0-113-360
          "
        />
        <path
          fill="rgb(0.21, 50.42, 225.59)"
          d="M178.72,549,19,434A2.5,2.5,0,0,1,19,430L178.72,315c-39.34,35.29-61.42,75-61.42,117S139.38,513.71,178.72,549Z"
        />
        <path
          fill="rgb(0.21, 50.42, 225.59)"
          d="M820.28,549,980,434a2.5,2.5,0,0,0,0-4.06L820.28,315c39.34,35.29,61.42,75,61.42,117S859.62,513.71,820.28,549Z"
        />
      </g>
    </svg>
  );
}

export default FilterScreenRender;
