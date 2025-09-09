import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import React from "react";
import Webcam from "react-webcam";
import {
  Camera,
  Play,
  Square,
  Eye,
  EyeOff,
  Settings,
  Wifi,
} from "lucide-react";

// 動態檢測 API 基礎 URL
const getApiBaseUrl = () => {
  if (
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

function App() {
  const [status, setStatus] = useState({
    count: 0,
    timestamp: "尚未開始",
    is_streaming: false,
    detection_active: false,
    algorithm: "algorithm2",
  });
  const [processedFrame, setProcessedFrame] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  // Webcam 相關狀態
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const webcamRef = useRef(null);
  const processingIntervalRef = useRef(null);

  // 新增：裝置列舉與選擇
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // 環境與能力檢查
  const isSecureContext =
    (typeof window !== "undefined" && window.isSecureContext) ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname?.startsWith("192.168.") ||
        window.location.hostname?.startsWith("10.") ||
        window.location.hostname?.startsWith("172.")));
  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  
  const hasEnumerateDevices =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === "function";
  
  // 對於區域網使用，放寬安全上下文要求，但需要檢查 API 支援
  const cameraSupported = !!hasGetUserMedia;

  // 設備檢測
  const detectDevice = useCallback(() => {
    const userAgent = navigator.userAgent;
    let deviceType = "desktop";

    if (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    ) {
      if (/iPad/i.test(userAgent)) {
        deviceType = "tablet";
      } else {
        deviceType = "mobile";
      }
    }

    return {
      device_type: deviceType,
      user_agent: userAgent,
    };
  }, []);

  // 檢查連接狀態
  const checkConnection = useCallback(async () => {
    try {
      console.log("檢查連接狀態:", API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/`);

      if (response.ok) {
        setConnectionStatus("connected");
        return true;
      } else {
        setConnectionStatus("error");
        return false;
      }
    } catch {
      setConnectionStatus("error");
      return false;
    }
  }, []);

  // 獲取狀態更新
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/status`);
      console.log("獲取狀態:", response);
      if (response.ok) {
        const statusData = await response.json();
        setStatus((prev) => ({
          ...prev,
          algorithm: statusData.algorithm,
          timestamp: statusData.timestamp,
        }));
        setConnectionStatus("connected");
      }
    } catch (error) {
      console.error("獲取狀態失敗:", error);
    }
  }, []);

  // 處理影像
  const processImage = useCallback(
    async (imageData) => {
      if (!imageData || isProcessing) return;

      try {
        setIsProcessing(true);
        const response = await fetch(`${API_BASE_URL}/api/process-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_data: imageData,
            algorithm: status.algorithm,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setProcessedFrame(result.processed_image);
            setStatus((prev) => ({
              ...prev,
              count: result.count,
              timestamp: new Date().toLocaleTimeString(),
            }));
          } else {
            console.error("影像處理失敗:", result.error);
            setDebugInfo(`處理失敗: ${result.error}`);
          }
        } else {
          console.error("影像處理請求失敗:", response.status);
          setDebugInfo(`請求失敗: ${response.status}`);
        }
      } catch (error) {
        console.error("影像處理請求失敗:", error);
        setDebugInfo(`網路錯誤: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [status.algorithm, isProcessing]
  );

  // 捕獲畫面
  const captureFrame = useCallback(() => {
    if (!webcamRef.current) {
      console.log("Webcam ref 不存在");
      return null;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      console.log("捕獲畫面成功，數據長度:", imageSrc.length);
      return imageSrc;
    } else {
      console.log("捕獲畫面失敗");
      return null;
    }
  }, []);

  // 測試捕獲畫面
  const testCapture = useCallback(() => {
    console.log("測試捕獲畫面...");
    const frame = captureFrame();
    if (frame) {
      console.log("捕獲成功，開始處理...");
      setDebugInfo("捕獲成功，正在處理...");
      processImage(frame);
    } else {
      console.log("捕獲失敗");
      setDebugInfo("捕獲失敗，請檢查攝影機狀態");
    }
  }, [captureFrame, processImage]);

  // 開始/停止偵測
  const toggleDetection = useCallback(() => {
    if (status.detection_active) {
      // 停止偵測
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      setStatus((prev) => ({ ...prev, detection_active: false }));
      setDebugInfo("偵測已停止");
    } else {
      // 開始偵測
      if (cameraReady) {
        setDebugInfo("開始偵測...");
        processingIntervalRef.current = setInterval(() => {
          const frame = captureFrame();
          if (frame) {
            processImage(frame);
          }
        }, 200); // 5 FPS
        setStatus((prev) => ({ ...prev, detection_active: true }));
      } else {
        setDebugInfo("無法開始偵測：攝影機未準備好");
      }
    }
  }, [status.detection_active, cameraReady, captureFrame, processImage]);

  // 更改算法
  const changeAlgorithm = useCallback(async (algorithm) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/algorithm/change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ algorithm }),
      });

      if (response.ok) {
        setStatus((prev) => ({ ...prev, algorithm }));
        setDebugInfo(`算法已更改為: ${algorithm}`);
        console.log(`算法已更改為: ${algorithm}`);
      }
    } catch (error) {
      console.error("更改算法失敗:", error);
      setDebugInfo(`更改算法失敗: ${error.message}`);
    }
  }, []);

  // 新增：列舉裝置並選擇最佳攝影機
  const enumerateAndSelectCamera = useCallback(async () => {
    if (!hasEnumerateDevices) {
      console.warn("瀏覽器不支援 enumerateDevices API");
      setVideoDevices([]);
      setSelectedDeviceId(null);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);

      if (videoInputs.length === 0) {
        setSelectedDeviceId(null);
        return;
      }

      const deviceType = detectDevice().device_type;

      // 嘗試優先選擇後鏡頭（從 label 推斷；需先取得權限才會有 label）
      let preferred = null;
      if (deviceType === "mobile") {
        preferred =
          videoInputs.find((d) => /back|rear|environment/i.test(d.label)) ||
          null;
      }

      // 桌機或找不到後鏡頭就用第一個
      const chosen = preferred || videoInputs[0];
      setSelectedDeviceId(chosen.deviceId || null);
    } catch (err) {
      console.error("列舉裝置失敗:", err);
      setVideoDevices([]);
      setSelectedDeviceId(null);
    }
  }, [detectDevice, hasEnumerateDevices]);

  // 開始攝影（可重用）
  const startCamera = useCallback(() => {
    if (!cameraSupported) {
      const reason = !hasGetUserMedia
        ? "瀏覽器不支援 getUserMedia。請更換支援的瀏覽器。"
        : "攝影機功能不可用。";
      setDebugInfo(`無法啟動攝影機：${reason}`);
      return;
    }
    setCameraStarted(true);
    setDebugInfo("攝影機已啟動");
    console.log("攝影機已啟動");
  }, [cameraSupported, hasGetUserMedia]);

  // 停止攝影
  const stopCamera = useCallback(() => {
    setCameraStarted(false);
    setStatus((prev) => ({ ...prev, detection_active: false }));
    setProcessedFrame(null);

    // 停止偵測
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    setDebugInfo("攝影機已停止");
    console.log("攝影機已停止");
  }, []);

  // Webcam 事件處理
  const onUserMedia = useCallback(() => {
    console.log("攝影機已準備就緒");
    setCameraReady(true);
    setDebugInfo("攝影機已準備就緒");

    // 取得權限後，labels 會可用，再次列舉以挑選最佳裝置
    enumerateAndSelectCamera();
  }, [enumerateAndSelectCamera]);

  const onUserMediaError = useCallback((error) => {
    console.error("攝影機錯誤:", error);
    setDebugInfo(`攝影機錯誤: ${error.message || error.name}`);
    setCameraReady(false);
    setCameraStarted(false);
  }, []);

  // 初始化：檢查連線、狀態、並自動請求攝影機權限與啟動
  useEffect(() => {
    const initializeApp = async () => {
      await checkConnection();
      await fetchStatus();

      if (!cameraSupported) {
        const reason = !hasGetUserMedia
          ? "瀏覽器不支援 getUserMedia。請更換支援的瀏覽器。"
          : "攝影機功能不可用。";
        setDebugInfo(`攝影機不可用：${reason}`);
        return;
      }

      // 只有在支援 getUserMedia 時才嘗試請求權限
      if (hasGetUserMedia) {
        try {
          // 先行請求權限，確保 enumerateDevices 取得完整 label
          await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err) {
          console.warn("預請求攝影機權限失敗，但仍嘗試啟動:", err);
        }
      }

      await enumerateAndSelectCamera();
      startCamera();
    };

    initializeApp();

    const connectionInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(connectionInterval);
  }, [checkConnection, fetchStatus, cameraSupported, isSecureContext, enumerateAndSelectCamera, startCamera, hasGetUserMedia, hasEnumerateDevices]);

  // 清理
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
    };
  }, []);

  // 監聽裝置變更（熱插拔）
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) return;
    const handler = () => enumerateAndSelectCamera();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handler);
    };
  }, [enumerateAndSelectCamera]);

  const getStatusText = () => {
    if (connectionStatus === "error") return "無法連接到服務器";
    if (connectionStatus === "connecting") return "正在連接...";
    if (!cameraSupported) {
      if (!hasGetUserMedia) return "瀏覽器不支援攝影機功能";
      return "攝影機功能不可用";
    }
    if (!cameraStarted) return "正在請求攝影機權限/啟動中...";
    if (status.detection_active) return "正在進行偵測...";
    return "攝影機運行中，偵測已暫停";
  };

  const getStatusColor = () => {
    if (connectionStatus === "error") return "text-red-400";
    if (connectionStatus === "connecting") return "text-yellow-400";
    if (status.detection_active) return "text-green-400";
    return "text-blue-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-2 md:p-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題區域 */}
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4 flex items-center justify-center gap-2 md:gap-3">
            <Camera size={24} />
            即時影像偵測系統
          </h1>
          <div
            className={`flex items-center justify-center gap-2 text-lg ${getStatusColor()}`}
          >
            <Wifi size={20} />
            {getStatusText()}
          </div>

          {!isSecureContext && (
            <div className="mt-2 text-sm text-blue-300">
              區域網模式：此應用程式已配置為在區域網環境下使用 HTTP 協議。
            </div>
          )}
        </div>

        {/* 控制面板 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6 mb-4 md:mb-8">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* 算法選擇 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings size={20} />
                <h3 className="text-lg font-semibold">偵測算法</h3>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="algorithm"
                    value="algorithm1"
                    checked={status.algorithm === "algorithm1"}
                    onChange={(e) => changeAlgorithm(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>算法一 (Otsu 二值化)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="algorithm"
                    value="algorithm2"
                    checked={status.algorithm === "algorithm2"}
                    onChange={(e) => changeAlgorithm(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>算法二 (Canny 邊緣偵測)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="algorithm"
                    value="yolo11"
                    checked={status.algorithm === "yolo11"}
                    onChange={(e) => changeAlgorithm(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>算法三 (YOLOv11)</span>
                </label>
              </div>
            </div>

            {/* 控制按鈕 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">系統控制</h3>
              <div className="flex flex-col md:flex-row flex-wrap gap-2 md:gap-3">
                <button
                  onClick={startCamera}
                  disabled={!cameraSupported || cameraStarted}
                  className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-sm md:text-base"
                >
                  <Play size={18} />
                  開始攝影
                </button>

                <button
                  onClick={stopCamera}
                  disabled={!cameraStarted}
                  className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-sm md:text-base"
                >
                  <Square size={18} />
                  停止攝影
                </button>

                <button
                  onClick={testCapture}
                  disabled={!cameraStarted}
                  className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-sm md:text-base"
                >
                  <Camera size={18} />
                  測試捕獲
                </button>

                <button
                  onClick={toggleDetection}
                  disabled={!cameraStarted}
                  className={`flex items-center justify-center gap-2 px-4 py-3 md:py-2 rounded-lg transition-colors text-white font-medium text-sm md:text-base ${
                    status.detection_active
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  {status.detection_active ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                  {status.detection_active ? "停止偵測" : "開始偵測"}
                </button>
              </div>

              {/* 顯示目前可用攝影機 */}
              {videoDevices.length > 0 && (
                <div className="text-sm text-gray-200">
                  可用攝影機：{videoDevices.length} 台
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 視訊顯示區域 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6 mb-4 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-center">
            {cameraStarted ? "即時影像偵測" : "攝影機初始化中"}
          </h3>
          <div className="flex justify-center">
            <div className="relative">
              {/* 原始攝影機畫面 - 僅在支援時渲染 */}
              {cameraSupported && (
                <div className={cameraStarted ? "block" : "hidden"}>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    width={640}
                    height={480}
                    onUserMedia={onUserMedia}
                    onUserMediaError={onUserMediaError}
                    className="max-w-full h-auto rounded-lg border-2 border-white/20"
                    videoConstraints={{
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      // 先用 deviceId，若尚未選擇則以 facingMode 作為後備
                      deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                      facingMode:
                        !selectedDeviceId && detectDevice().device_type === "mobile"
                          ? { ideal: "environment" }
                          : undefined,
                    }}
                    playsInline
                  />

                  {/* 處理後的畫面疊加層 - 只在偵測時顯示 */}
                  {status.detection_active && processedFrame && (
                    <img
                      src={processedFrame}
                      alt="處理後的畫面"
                      className="absolute top-0 left-0 max-w-full h-auto rounded-lg border-2 border-green-400 opacity-80"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* 狀態指示器 */}
                  <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    {status.detection_active ? "偵測中" : "攝影中"}
                  </div>

                  {/* 偵測數量顯示 */}
                  {status.count > 0 && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-lg font-bold">
                      {status.count}
                    </div>
                  )}
                </div>
              )}

              {/* 預覽畫面 - 當攝影機未開始時顯示 */}
              {!cameraStarted && (
                <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2 text-gray-500" />
                    {cameraSupported ? (
                      <p className="text-gray-400">正在請求攝影機權限...</p>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-400 mb-2">
                          {!hasGetUserMedia 
                            ? "瀏覽器不支援攝影機功能" 
                            : "攝影機功能不可用"}
                        </p>
                        {!hasGetUserMedia && (
                          <p className="text-sm text-gray-500">
                            請使用現代瀏覽器（Chrome、Firefox、Safari、Edge）
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 說明文字 */}
          <div className="mt-4 text-center text-sm text-gray-300">
            {!status.detection_active ? (
              <p>點擊「開始偵測」查看處理後的影像結果</p>
            ) : (
              <p>綠色邊框顯示處理後的偵測結果</p>
            )}
          </div>
        </div>

        {/* 資訊面板 */}
        <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6">
          <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">
            偵測資訊
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-300">偵測數量</p>
              <p className="text-4xl font-bold text-green-400">
                {status.count}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">最後更新</p>
              <p className="text-lg">{status.timestamp}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">當前算法</p>
              <p className="text-lg">
                {status.algorithm === "algorithm1"
                  ? "算法一"
                  : status.algorithm === "algorithm2"
                  ? "算法二"
                  : "算法三"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">處理狀態</p>
              <p className="text-lg text-blue-400">
                {isProcessing ? "處理中..." : "待機"}
              </p>
            </div>
            {debugInfo && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-sm text-gray-300">調試信息</p>
                <p className="text-sm text-yellow-400">{debugInfo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
