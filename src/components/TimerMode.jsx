import React, { useState, useEffect, useRef, useCallback } from "react";
import { filters } from "../filters";
import FilterScreen from "./FilterScreen";
import { createScreenSketch } from "../filters/createScreenSketch";
import {
  getCameraCapabilities,
  getFullScreenResolution,
} from "../utils/cameraUtils";
import leftArrowIcon from "../assets/arrow_left.svg";
import rightArrowIcon from "../assets/arrow_right.svg";
import "../styles/TimerMode.css";

// /timer 모드에서는 필터 5를 제외
const timerModeFilters = filters.filter((_, index) => index !== 4);

function TimerMode() {
  const [currentFilterIndex, setCurrentFilterIndex] = useState(0);
  const [video, setVideo] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const countdownRef = useRef(60);
  const progressCircleRef = useRef(null);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const cameraInfo = await getCameraCapabilities(selectedDeviceId);
        const fullScreenResolution = getFullScreenResolution(cameraInfo);

        console.log(
          `[TimerMode] 최대 해상도: ${fullScreenResolution.width}x${fullScreenResolution.height}`,
        );

        const p5video = document.createElement("video");
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
              console.log("[TimerMode] Video ready:", p5video.videoWidth);
              setVideo(p5video);
              setVideoReady(true);
              p5video.removeEventListener("loadedmetadata", onLoadedMetadata);
            };

            p5video.addEventListener("loadedmetadata", onLoadedMetadata);
          })
          .catch((error) => {
            console.error("[TimerMode] 카메라 오류:", error);
            navigator.mediaDevices
              .getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              })
              .then((stream) => {
                p5video.srcObject = stream;
                p5video.play();

                const onLoadedMetadata = () => {
                  console.log(
                    "[TimerMode] Video ready (fallback):",
                    p5video.videoWidth,
                  );
                  setVideo(p5video);
                  setVideoReady(true);
                  p5video.removeEventListener(
                    "loadedmetadata",
                    onLoadedMetadata,
                  );
                };

                p5video.addEventListener("loadedmetadata", onLoadedMetadata);
              })
              .catch((fallbackError) => {
                console.error("[TimerMode] 기본 해상도도 실패:", fallbackError);
              });
          });

        return () => {
          if (p5video && p5video.srcObject) {
            p5video.srcObject.getTracks().forEach((track) => track.stop());
          }
        };
      } catch (error) {
        console.error("[TimerMode] 카메라 설정 오류:", error);
      }
    };

    setupCamera();
  }, [selectedDeviceId]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    countdownRef.current = 60;
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, 60 - elapsedSeconds);
      countdownRef.current = remaining;
      updateProgressCircle();

      if (remaining <= 0) {
        setCurrentFilterIndex((prev) => (prev + 1) % timerModeFilters.length);
        countdownRef.current = 60;
        startTimeRef.current = Date.now(); // 새 사이클 시작
        updateProgressCircle();
      }
    }, 50); // 50ms마다 업데이트 (부드러운 애니메이션)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        setCurrentFilterIndex(
          (prev) =>
            (prev - 1 + timerModeFilters.length) % timerModeFilters.length,
        );
        countdownRef.current = 60;
        startTimeRef.current = Date.now();
      } else if (event.key === "ArrowRight") {
        setCurrentFilterIndex((prev) => (prev + 1) % timerModeFilters.length);
        countdownRef.current = 60;
        startTimeRef.current = Date.now();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const updateProgressCircle = () => {
    if (progressCircleRef.current) {
      const progress = (60 - countdownRef.current) / 60;
      const degrees = progress * 360;
      progressCircleRef.current.style.background = `conic-gradient(
        rgb(22.71, 69.44, 193.6) 0deg ${degrees}deg,
        rgba(22.71, 69.44, 193.6, 0.3) ${degrees}deg 360deg
      )`;
    }
  };

  const handlePrevFilter = () => {
    setCurrentFilterIndex(
      (prev) => (prev - 1 + timerModeFilters.length) % timerModeFilters.length,
    );
    countdownRef.current = 60;
    startTimeRef.current = Date.now();
    updateProgressCircle();
  };

  const handleNextFilter = () => {
    setCurrentFilterIndex((prev) => (prev + 1) % timerModeFilters.length);
    countdownRef.current = 60;
    startTimeRef.current = Date.now();
    updateProgressCircle();
  };

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
    [video],
  );

  const currentFilter = timerModeFilters[currentFilterIndex];
  const sketchFactory = useCallback(
    (w, h, onReady) => {
      if (!currentFilter) return null;
      return createScreenSketch({
        video,
        width: w,
        height: h,
        filter: currentFilter,
        onReady,
      });
    },
    [video, currentFilter],
  );

  return (
    <div className="timer-mode-container">
      <div className="timer-filter-viewer">
        {videoReady && sketchFactory && (
          <FilterScreen
            key={currentFilterIndex}
            sketchFactory={sketchFactory}
            video={video}
          />
        )}
      </div>

      <button
        className="timer-arrow-btn timer-arrow-left"
        onClick={handlePrevFilter}
        aria-label="Previous filter"
      >
        <img src={leftArrowIcon} alt="Previous" />
      </button>

      <button
        className="timer-arrow-btn timer-arrow-right"
        onClick={handleNextFilter}
        aria-label="Next filter"
      >
        <div className="timer-progress-ring" ref={progressCircleRef}></div>
        <img src={rightArrowIcon} alt="Next" />
      </button>

      <div className="timer-info">
        <div className="timer-filter-number">
          필터 {currentFilterIndex + 1} / {filters.length}
        </div>
        <div className="timer-countdown">
          다음 필터: {countdownRef.current}초
        </div>
      </div>
    </div>
  );
}

export default TimerMode;
