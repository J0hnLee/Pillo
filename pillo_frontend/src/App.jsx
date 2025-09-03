import { useState,useEffect, useCallback } from 'react'
import './App.css'
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

const API_BASE_URL = "http://localhost:8000";
function App() {
  const [status, setStatus] = useState({
    count: 0,
    timestamp: "尚未開始",
    is_streaming: false,
    detection_active: false,
    algorithm: "algorithm2",
  });
  const [videoFrame, setVideoFrame] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  // API 調用函數（useCallback 以穩定依賴）
  const apiCall = useCallback(async (endpoint, method = "GET", body = null) => {
    try {
      const config = {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      if (body) {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API 調用錯誤:", error);
      setConnectionStatus("error");
      throw error;
    }
  }, []);

  // 檢查連接狀態
  const checkConnection = useCallback(async () => {
    try {
      await apiCall("/");
      setConnectionStatus("connected");
    } catch {
      setConnectionStatus("error");
    }
  }, [apiCall]);

  // 獲取狀態更新
  const fetchStatus = useCallback(async () => {
    try {
      const statusData = await apiCall("/api/status");
      setStatus(statusData);
      setConnectionStatus("connected");
    } catch (error) {
      console.error("獲取狀態失敗:", error);
    }
  }, [apiCall]);

  // 獲取視訊幀
  const [isFetchingFrame, setIsFetchingFrame] = useState(false);
  const fetchVideoFrame = useCallback(async () => {
    if (!status.is_streaming || isFetchingFrame) return;

    try {
      setIsFetchingFrame(true);
      const frameData = await apiCall("/api/video/frame");
      if (frameData && frameData.frame) {
        setVideoFrame(frameData.frame);
      }
      // 若為 null，跳過更新，避免誤判為錯誤
    } catch (error) {
      // 不要把取幀錯誤視為連線錯誤，僅記錄
      console.debug("取幀中斷或逾時:", error?.message || error);
    } finally {
      setIsFetchingFrame(false);
    }
  }, [status.is_streaming, isFetchingFrame, apiCall]);

  // 攝影機控制
  const handleStartCamera = async () => {
    setIsLoading(true);
    try {
      await apiCall("/api/camera/start", "POST");
      await fetchStatus();
    } catch (error) {
      alert("無法啟動攝影機: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCamera = async () => {
    setIsLoading(true);
    try {
      await apiCall("/api/camera/stop", "POST");
      await fetchStatus();
      setVideoFrame(null);
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
      await apiCall(endpoint, "POST");
      await fetchStatus();
    } catch (error) {
      alert("切換偵測狀態失敗: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 算法切換
  const handleAlgorithmChange = async (algorithm) => {
    try {
      await apiCall("/api/algorithm/change", "POST", { algorithm });
      await fetchStatus();
    } catch (error) {
      alert("切換算法失敗: " + error.message);
    }
  };

  // 初始化和定時更新
  useEffect(() => {
    checkConnection();
    const connectionInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(connectionInterval);
  }, [checkConnection]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題區域 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Camera size={40} />
            即時輪廓偵測系統
          </h1>
          <div
            className={`flex items-center justify-center gap-2 text-lg ${getStatusColor()}`}
          >
            <Wifi size={20} />
            {getStatusText()}
          </div>
        </div>

        {/* 控制面板 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
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
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleStartCamera}
                  disabled={
                    status.is_streaming ||
                    isLoading ||
                    connectionStatus !== "connected"
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Play size={18} />
                  開始攝影
                </button>

                <button
                  onClick={handleStopCamera}
                  disabled={!status.is_streaming || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Square size={18} />
                  停止攝影
                </button>

                <button
                  onClick={handleToggleDetection}
                  disabled={!status.is_streaming || isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
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
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">攝影機畫面</h3>
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
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">偵測資訊</h3>
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

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">系統狀態</h3>
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

export default App
