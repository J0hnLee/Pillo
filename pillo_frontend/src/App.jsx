import { useState, useEffect, useCallback } from "react";
import "./App.css";
import React from "react";
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
  // 在開發環境中，如果前端運行在局域網地址，後端也應該使用相同的 IP
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
    active_sessions: 0,
    device_id: null,
  });
  const [videoFrame, setVideoFrame] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [deviceInfo, setDeviceInfo] = useState({
    device_id: null,
    device_type: "desktop",
    user_agent: "",
  });
  const [mobileCameraStream, setMobileCameraStream] = useState(null);
  const [cameraMode, setCameraMode] = useState("auto"); // "auto", "desktop", "mobile"

  // 設備檢測函數
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

  // 註冊設備
  const registerDevice = useCallback(async () => {
    try {
      const device = detectDevice();
      const response = await fetch(`${API_BASE_URL}/api/device/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(device),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDeviceInfo({
            device_id: data.device_id,
            device_type: device.device_type,
            user_agent: device.user_agent,
          });
          console.log(
            `設備註冊成功: ${device.device_type} (${data.device_id})`
          );
        }
      }
    } catch (error) {
      console.error("設備註冊失敗:", error);
    }
  }, [detectDevice]);

  // 手機攝影機捕獲功能
  const startMobileCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode:
            deviceInfo.device_type === "mobile" ? "user" : "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setMobileCameraStream(stream);
      return stream;
    } catch (error) {
      console.error("無法訪問手機攝影機:", error);
      throw error;
    }
  }, [deviceInfo.device_type]);

  const stopMobileCamera = useCallback(() => {
    if (mobileCameraStream) {
      mobileCameraStream.getTracks().forEach((track) => track.stop());
      setMobileCameraStream(null);
    }
  }, [mobileCameraStream]);

  // 捕獲手機攝影機畫面
  const captureMobileFrame = useCallback(() => {
    if (!mobileCameraStream) return null;

    const video = document.createElement("video");
    video.srcObject = mobileCameraStream;
    video.play();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 640;
    canvas.height = 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.8);
  }, [mobileCameraStream]);

  // 檢查連接狀態
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/`);
      if (response.ok) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("error");
      }
    } catch {
      setConnectionStatus("error");
    }
  }, []);

  // 獲取狀態更新
  const fetchStatus = useCallback(async () => {
    try {
      const params = deviceInfo.device_id
        ? `?device_id=${deviceInfo.device_id}`
        : "";
      const response = await fetch(`${API_BASE_URL}/api/status${params}`);
      if (response.ok) {
        const statusData = await response.json();
        setStatus(statusData);
        setConnectionStatus("connected");
      }
    } catch (error) {
      console.error("獲取狀態失敗:", error);
    }
  }, [deviceInfo.device_id]);

  // 獲取視訊幀
  const [isFetchingFrame, setIsFetchingFrame] = useState(false);
  const fetchVideoFrame = useCallback(async () => {
    if (!status.is_streaming || isFetchingFrame) return;

    try {
      setIsFetchingFrame(true);

      if (mobileCameraStream) {
        // 使用手機攝影機
        const frameData = captureMobileFrame();
        if (frameData) {
          setVideoFrame(frameData);
        }
      } else {
        // 使用電腦攝影機（通過後端）
        const response = await fetch(`${API_BASE_URL}/api/video/frame`);
        if (response.ok) {
          const frameData = await response.json();
          if (frameData && frameData.frame) {
            setVideoFrame(frameData.frame);
          }
        }
      }
    } catch (error) {
      // 不要把取幀錯誤視為連線錯誤，僅記錄
      console.debug("取幀中斷或逾時:", error?.message || error);
    } finally {
      setIsFetchingFrame(false);
    }
  }, [
    status.is_streaming,
    isFetchingFrame,
    mobileCameraStream,
    captureMobileFrame,
  ]);

  // 攝影機控制
  const handleStartCamera = async () => {
    setIsLoading(true);
    try {
      // 根據設備類型和攝影機模式決定使用哪種攝影機
      if (deviceInfo.device_type === "mobile" && cameraMode !== "desktop") {
        // 使用手機攝影機
        await startMobileCamera();
        setStatus((prev) => ({ ...prev, is_streaming: true }));
      } else {
        // 使用電腦攝影機（通過後端）
        const params = deviceInfo.device_id
          ? `?device_id=${deviceInfo.device_id}`
          : "";
        const response = await fetch(
          `${API_BASE_URL}/api/camera/start${params}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          await fetchStatus();
        } else {
          const errorData = await response.json();
          alert("無法啟動電腦攝影機: " + errorData.detail);
        }
      }
    } catch (error) {
      alert("無法啟動攝影機: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCamera = async () => {
    setIsLoading(true);
    try {
      if (mobileCameraStream) {
        // 停止手機攝影機
        stopMobileCamera();
        setStatus((prev) => ({ ...prev, is_streaming: false }));
        setVideoFrame(null);
      } else {
        // 停止電腦攝影機
        const response = await fetch(`${API_BASE_URL}/api/camera/stop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          await fetchStatus();
          setVideoFrame(null);
        }
      }
    } catch (error) {
      alert("停止攝影機失敗: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 偵測控制
  const handleToggleDetection = async () => {
    setIsLoading(true);
    try {
      const endpoint = status.detection_active
        ? "/api/detection/stop"
        : "/api/detection/start";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        await fetchStatus();
      }
    } catch (error) {
      alert("切換偵測狀態失敗: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 算法切換
  const handleAlgorithmChange = async (algorithm) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/algorithm/change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ algorithm }),
      });

      if (response.ok) {
        await fetchStatus();
      }
    } catch (error) {
      alert("切換算法失敗: " + error.message);
    }
  };

  // 初始化和定時更新
  useEffect(() => {
    const initializeApp = async () => {
      await checkConnection();
      await registerDevice(); // 註冊設備
    };

    initializeApp();
    const connectionInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(connectionInterval);
  }, [checkConnection, registerDevice]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchStatus();
      const statusInterval = setInterval(fetchStatus, 1000);
      return () => clearInterval(statusInterval);
    }
  }, [connectionStatus, fetchStatus]);

  useEffect(() => {
    if (status.is_streaming) {
      const frameInterval = setInterval(fetchVideoFrame, 33); // ~30 FPS
      return () => clearInterval(frameInterval);
    }
  }, [status.is_streaming, fetchVideoFrame]);

  const getStatusText = () => {
    if (connectionStatus === "error") return "無法連接到服務器";
    if (connectionStatus === "connecting") return "正在連接...";
    if (!status.is_streaming) return "攝影機未啟動";
    if (status.detection_active) return "正在進行輪廓偵測...";
    return "攝影機運行中，偵測已暫停";
  };

  const getStatusColor = () => {
    if (connectionStatus === "error") return "text-red-400";
    if (connectionStatus === "connecting") return "text-yellow-400";
    if (status.detection_active) return "text-green-400";
    return "text-blue-400";
  };

  // 如果連接失敗，顯示調試信息
  if (connectionStatus === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-pink-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
              <Camera size={40} />
              連接錯誤
            </h1>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h2 className="text-2xl font-semibold mb-4">
                無法連接到後端服務
              </h2>
              <div className="space-y-4 text-left">
                <p>
                  <strong>API 地址:</strong> {API_BASE_URL}
                </p>
                <p>
                  <strong>設備類型:</strong> {deviceInfo.device_type}
                </p>
                <p>
                  <strong>設備 ID:</strong> {deviceInfo.device_id || "未註冊"}
                </p>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    可能的解決方案:
                  </h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>確保後端服務正在運行 (python main.py)</li>
                    <li>檢查後端是否在端口 8000 上運行</li>
                    <li>確認防火牆沒有阻擋連接</li>
                    <li>嘗試重新啟動後端服務</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    checkConnection();
                    registerDevice();
                  }}
                  className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
                >
                  重新連接
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-2 md:p-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題區域 */}
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4 flex items-center justify-center gap-2 md:gap-3">
            <Camera size={deviceInfo.device_type === "mobile" ? 24 : 40} />
            即時輪廓偵測系統
          </h1>
          <div
            className={`flex items-center justify-center gap-2 text-lg ${getStatusColor()}`}
          >
            <Wifi size={20} />
            {getStatusText()}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-300 mt-2">
            <span>設備類型: {deviceInfo.device_type}</span>
            <span>活躍會話: {status.active_sessions}</span>
            {deviceInfo.device_id && (
              <span>ID: {deviceInfo.device_id.slice(-8)}</span>
            )}
          </div>
        </div>

        {/* 控制面板 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6 mb-4 md:mb-8">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {/* 攝影機模式選擇 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera size={20} />
                <h3 className="text-lg font-semibold">攝影機模式</h3>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="cameraMode"
                    value="auto"
                    checked={cameraMode === "auto"}
                    onChange={(e) => setCameraMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>
                    自動選擇 (
                    {deviceInfo.device_type === "mobile"
                      ? "手機攝影機"
                      : "電腦攝影機"}
                    )
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="cameraMode"
                    value="mobile"
                    checked={cameraMode === "mobile"}
                    onChange={(e) => setCameraMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>強制使用手機攝影機</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="cameraMode"
                    value="desktop"
                    checked={cameraMode === "desktop"}
                    onChange={(e) => setCameraMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>強制使用電腦攝影機</span>
                </label>
              </div>
            </div>

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
                    onChange={(e) => handleAlgorithmChange(e.target.value)}
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
                    onChange={(e) => handleAlgorithmChange(e.target.value)}
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
                    onChange={(e) => handleAlgorithmChange(e.target.value)}
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
                  onClick={handleStartCamera}
                  disabled={
                    status.is_streaming ||
                    isLoading ||
                    connectionStatus !== "connected"
                  }
                  className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-sm md:text-base"
                >
                  <Play size={18} />
                  開始攝影
                </button>

                <button
                  onClick={handleStopCamera}
                  disabled={!status.is_streaming || isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-sm md:text-base"
                >
                  <Square size={18} />
                  停止攝影
                </button>

                <button
                  onClick={handleToggleDetection}
                  disabled={!status.is_streaming || isLoading}
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
            </div>
          </div>
        </div>

        {/* 視訊顯示區域 */}
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6">
              <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">
                攝影機畫面
              </h3>
              <div className="flex justify-center">
                {videoFrame ? (
                  <img
                    src={videoFrame}
                    alt="攝影機畫面"
                    className="max-w-full h-auto rounded-lg border-2 border-white/20"
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Camera
                        size={48}
                        className="mx-auto mb-2 text-gray-500"
                      />
                      <p className="text-gray-400">
                        {status.is_streaming
                          ? "正在載入畫面..."
                          : "攝影機未啟動"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 資訊面板 */}
          <div className="space-y-4 md:space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6">
              <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">
                偵測資訊
              </h3>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-300">偵測數量</p>
                  <p className="text-4xl font-bold text-green-400">
                    {status.count}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-300">最後更新</p>
                  <p className="text-lg">{status.timestamp}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-300">當前算法</p>
                  <p className="text-lg">
                    {status.algorithm === "algorithm1" ? "算法一" : "算法二"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-6">
              <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">
                系統狀態
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>連接狀態:</span>
                  <span
                    className={
                      connectionStatus === "connected"
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {connectionStatus === "connected" ? "已連接" : "未連接"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>設備類型:</span>
                  <span className="text-blue-400">
                    {deviceInfo.device_type === "mobile"
                      ? "手機"
                      : deviceInfo.device_type === "tablet"
                      ? "平板"
                      : "電腦"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>攝影機模式:</span>
                  <span className="text-purple-400">
                    {cameraMode === "auto"
                      ? "自動"
                      : cameraMode === "mobile"
                      ? "手機攝影機"
                      : "電腦攝影機"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>活躍會話:</span>
                  <span className="text-yellow-400">
                    {status.active_sessions} 個設備
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>攝影機:</span>
                  <span
                    className={
                      status.is_streaming ? "text-green-400" : "text-gray-400"
                    }
                  >
                    {status.is_streaming ? "運行中" : "已停止"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>偵測狀態:</span>
                  <span
                    className={
                      status.detection_active
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {status.detection_active ? "進行中" : "已暫停"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
