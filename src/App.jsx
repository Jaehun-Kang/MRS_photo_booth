import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import FilterPreviewRender from "./components/FilterPreviewRender";
import FilterScreenRender from "./components/FilterScreenRender";
import WebcamErrorHandler from "./components/WebcamErrorHandler";
import ImageViewer from "./components/ImageViewer";
import TimerMode from "./components/TimerMode";
import "./styles/App.css";

function App() {
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(
    window.devicePixelRatio || 1,
  );

  // DPR 변화 감지 (디바이스 확대 시에 재렌더)
  useEffect(() => {
    const handleDPRChange = () => {
      const newDPR = window.devicePixelRatio || 1;
      console.log("DPR changed:", devicePixelRatio, "->", newDPR);
      setDevicePixelRatio(newDPR);
    };

    // DPR 변화 감지를 위한 MediaQuery 사용
    const mediaQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    mediaQuery.addEventListener("change", handleDPRChange);

    return () => {
      mediaQuery.removeEventListener("change", handleDPRChange);
    };
  }, [devicePixelRatio]);

  const handleDeviceSelect = (deviceId) => {
    console.log("Device selected:", deviceId);
    setSelectedDeviceId(deviceId);
    setIsVideoReady(false);
    setWebcamError(null);
  };

  const handleWebcamError = (error) => {
    console.error("Webcam error:", error);
    setWebcamError(error);
  };

  if (webcamError) {
    return <WebcamErrorHandler error={webcamError} />;
  }

  const basename = window.location.hostname.includes("github.io")
    ? "/MRS_photo_booth"
    : "";

  return (
    <HashRouter basename={basename}>
      <Routes>
        {/* 타이머 모드 */}
        <Route path="/timer" element={<TimerMode />} />

        {/* 일반 필터뷰 모드 */}
        <Route
          path="*"
          element={
            <div className="App">
              {/* 이미지 뷰 또는 필터 선택 뷰 */}
              {new URLSearchParams(window.location.search).get("view") ===
              "image" ? (
                <ImageViewer />
              ) : selectedFilter === null ? (
                <FilterPreviewRender
                  onSelectFilter={setSelectedFilter}
                  selectedDeviceId={selectedDeviceId}
                  onDeviceSelect={handleDeviceSelect}
                  onVideoReady={() => setIsVideoReady(true)}
                  onError={handleWebcamError}
                />
              ) : (
                <FilterScreenRender
                  filterIndex={selectedFilter}
                  onBack={() => setSelectedFilter(null)}
                  onHome={() => setSelectedFilter(null)}
                  selectedDeviceId={selectedDeviceId}
                  onError={handleWebcamError}
                />
              )}
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;
