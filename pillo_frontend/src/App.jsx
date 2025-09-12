"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 動態檢測 API 基礎 URL
const getApiBaseUrl = () => {
  return `http://${window.location.hostname}:8000`;
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
  const [preferredFacingMode, setPreferredFacingMode] = useState("environment"); // 預設為後置鏡頭
  // const [retryCount, setRetryCount] = useState(0) // 暫時未使用
  const [cameraError, setCameraError] = useState(null); // 新增錯誤狀態追蹤

  // 環境與能力檢查
  const isSecureContext =
    typeof window !== "undefined" && window.isSecureContext;
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const hasEnumerateDevices =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === "function";

  // 攝影機支援檢查：必須在安全上下文或 localhost 環境下
  const cameraSupported = hasGetUserMedia && (isSecureContext || isLocalhost);

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

  const getVideoConstraints = useCallback(() => {
    const constraints = {
      width: { ideal: 640, min: 320 },
      height: { ideal: 480, min: 240 },
    };

    // 優先使用 facingMode，這在行動裝置上更可靠
    if (preferredFacingMode && !selectedDeviceId) {
      // 改為 ideal 而非 exact，避免約束過於嚴格
      constraints.facingMode = { ideal: preferredFacingMode };
    } else if (selectedDeviceId) {
      constraints.deviceId = { exact: selectedDeviceId };
    } else if (detectDevice().device_type === "mobile") {
      // 行動裝置預設使用後置鏡頭，但使用 ideal 而非 exact
      constraints.facingMode = { ideal: "environment" };
    }

    console.log("攝影機約束條件:", constraints);
    return constraints;
  }, [preferredFacingMode, selectedDeviceId, detectDevice]);

  // 檢查連接狀態
  const checkConnection = useCallback(async () => {
    try {
      console.log("檢查連接狀態:", API_BASE_URL);
      const response = await fetch(`/`);

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
      const response = await fetch(`/api/status`);

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
        const response = await fetch(`/api/process-image`, {
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
      console.log("更改算法:", `${API_BASE_URL}/api/algorithm/change`);
      const response = await fetch(`/api/algorithm/change`, {
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

  const startCamera = useCallback(() => {
    if (!cameraSupported) {
      const reason = !hasGetUserMedia
        ? "瀏覽器不支援 getUserMedia。請更換支援的瀏覽器。"
        : "攝影機功能不可用。";
      setDebugInfo(`無法啟動攝影機：${reason}`);
      setCameraError(reason);
      return;
    }

    console.log("正在啟動攝影機...");
    setCameraError(null);
    setCameraReady(false);
    setCameraStarted(true);
    setDebugInfo("正在啟動攝影機...");
  }, [cameraSupported, hasGetUserMedia]);

  const changeFacingMode = useCallback(
    (mode) => {
      console.log(`切換鏡頭方向: ${mode}`);
      setPreferredFacingMode(mode);
      setSelectedDeviceId(null);
      setCameraError(null);
      setDebugInfo(
        `正在切換到${mode === "environment" ? "後置" : "前置"}鏡頭...`
      );

      if (cameraStarted) {
        // 停止當前攝影機
        setCameraReady(false);
        setCameraStarted(false);

        // 停止偵測
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current);
          processingIntervalRef.current = null;
        }
        setStatus((prev) => ({ ...prev, detection_active: false }));

        // 延遲重新啟動以確保資源釋放
        setTimeout(() => {
          startCamera();
        }, 1000); // 增加延遲時間確保資源完全釋放
      }
    },
    [cameraStarted, startCamera]
  );

  // 切換攝影機
  const changeCamera = useCallback(
    (deviceId) => {
      setSelectedDeviceId(deviceId);
      setPreferredFacingMode(null);
      setCameraError(null);
      setDebugInfo(
        `攝影機已切換為: ${
          videoDevices.find((d) => d.deviceId === deviceId)?.friendlyLabel ||
          "未知攝影機"
        }`
      );

      // 如果攝影機正在運行，需要重新啟動
      if (cameraStarted) {
        setCameraStarted(false);
        setCameraReady(false);
        setStatus((prev) => ({ ...prev, detection_active: false }));

        // 停止偵測
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current);
          processingIntervalRef.current = null;
        }

        // 延遲重新啟動攝影機
        setTimeout(() => {
          startCamera();
        }, 1000); // 增加延遲時間確保資源完全釋放
      }
    },
    [videoDevices, cameraStarted, startCamera]
  );

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

      // 為每個攝影機添加更友善的標籤
      const enhancedDevices = videoInputs.map((device, index) => {
        let friendlyLabel = device.label || `攝影機 ${index + 1}`;

        // 檢測攝影機類型
        const isRearCamera = /back|rear|environment/i.test(device.label);
        const isFrontCamera = /front|user|facing/i.test(device.label);

        if (isRearCamera) {
          friendlyLabel = `📷 後置鏡頭 (${device.label})`;
        } else if (isFrontCamera) {
          friendlyLabel = `🤳 前置鏡頭 (${device.label})`;
        } else if (device.label) {
          friendlyLabel = `📹 ${device.label}`;
        } else {
          friendlyLabel = `📹 攝影機 ${index + 1}`;
        }

        return {
          ...device,
          friendlyLabel,
          isRearCamera,
          isFrontCamera,
        };
      });

      // 只在設備列表實際改變時更新狀態
      const currentDeviceIds = videoDevices
        .map((d) => d.deviceId)
        .sort()
        .join(",");
      const newDeviceIds = enhancedDevices
        .map((d) => d.deviceId)
        .sort()
        .join(",");

      if (currentDeviceIds !== newDeviceIds) {
        setVideoDevices(enhancedDevices);
        console.log(
          "可用攝影機已更新:",
          enhancedDevices.map((d) => d.friendlyLabel)
        );
      }

      if (enhancedDevices.length === 0) {
        if (selectedDeviceId) {
          setSelectedDeviceId(null);
        }
        return;
      }

      const deviceType = detectDevice().device_type;

      // 優先選擇後置鏡頭（手機環境）
      let preferred = null;
      if (deviceType === "mobile") {
        preferred = enhancedDevices.find((d) => d.isRearCamera);
      }

      // 如果沒有後置鏡頭，選擇第一個
      const chosen = preferred || enhancedDevices[0];

      // 只在沒有選擇設備時才自動選擇
      if (!selectedDeviceId && !preferredFacingMode && chosen.deviceId) {
        setSelectedDeviceId(chosen.deviceId);
        console.log("自動選擇攝影機:", chosen.friendlyLabel);
      }
    } catch (err) {
      console.error("列舉裝置失敗:", err);
      setVideoDevices([]);
      setSelectedDeviceId(null);
    }
  }, [
    detectDevice,
    hasEnumerateDevices,
    selectedDeviceId,
    preferredFacingMode,
    videoDevices,
  ]);

  // 停止攝影
  const stopCamera = useCallback(() => {
    setCameraStarted(false);
    setCameraReady(false);
    setCameraError(null);
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

  const onUserMedia = useCallback(
    (stream) => {
      console.log("攝影機已準備就緒", stream);
      setCameraReady(true);
      setCameraError(null);
      setDebugInfo("攝影機已準備就緒");

      // 移除自動重新列舉，避免頻繁更新
      // enumerateAndSelectCamera()
    },
    [] // 移除 enumerateAndSelectCamera 依賴
  );

  const onUserMediaError = useCallback(
    (error) => {
      console.error("攝影機錯誤:", error);

      let errorMessage = error.message || error.name;

      // 處理特定的錯誤類型
      if (error.name === "OverconstrainedError") {
        errorMessage = "攝影機約束條件無法滿足，請嘗試切換鏡頭或選擇其他攝影機";
        if (preferredFacingMode === "environment") {
          setTimeout(() => {
            setDebugInfo("後置鏡頭無法使用，正在嘗試前置鏡頭...");
            changeFacingMode("user");
          }, 1000);
          return;
        }
      } else if (error.name === "NotAllowedError") {
        errorMessage = "攝影機權限被拒絕，請允許攝影機存取";
      } else if (error.name === "NotFoundError") {
        errorMessage = "找不到攝影機，請檢查攝影機連接";
      } else if (error.name === "NotReadableError") {
        errorMessage = "攝影機被其他應用程式使用中";
      }

      setDebugInfo(`攝影機錯誤: ${errorMessage}`);
      setCameraError(errorMessage);
      setCameraReady(false);
      setCameraStarted(false);
      // setRetryCount(0) // 暫時未使用
    },
    [preferredFacingMode, changeFacingMode]
  );

  // 初始化：檢查連線、狀態、並自動請求攝影機權限與啟動
  useEffect(() => {
    const initializeApp = async () => {
      await checkConnection();
      await fetchStatus();

      if (!cameraSupported) {
        let reason = "";
        if (!hasGetUserMedia) {
          reason = "瀏覽器不支援 getUserMedia。請更換支援的瀏覽器。";
        } else if (!isSecureContext && !isLocalhost) {
          reason =
            "攝影機功能需要 HTTPS 連線。在區域網環境下，請使用 HTTPS 或 localhost。";
        } else {
          reason = "攝影機功能不可用。";
        }
        setDebugInfo(`攝影機不可用：${reason}`);
        setCameraError(reason);
        return;
      }

      // 只有在安全上下文或 localhost 下才嘗試請求權限
      try {
        // 先行請求權限，確保 enumerateDevices 取得完整 label
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err) {
        console.warn("預請求攝影機權限失敗，但仍嘗試啟動:", err);
        setDebugInfo(`攝影機權限請求失敗: ${err.message}`);
      }

      await enumerateAndSelectCamera();
      startCamera();
    };

    initializeApp();

    const connectionInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(connectionInterval);
  }, [
    checkConnection,
    fetchStatus,
    cameraSupported,
    isSecureContext,
    isLocalhost,
    enumerateAndSelectCamera,
    startCamera,
    hasGetUserMedia,
    hasEnumerateDevices,
  ]);

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener)
      return;
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
      if (!isSecureContext && !isLocalhost) {
        return "攝影機需要 HTTPS 連線（區域網環境）";
      }
      return "攝影機功能不可用";
    }
    if (cameraError) return `攝影機錯誤: ${cameraError}`;
    if (!cameraStarted) return "正在請求攝影機權限/啟動中...";
    if (!cameraReady) return "攝影機初始化中...";
    if (status.detection_active) return "正在進行偵測...";
    return "攝影機運行中，偵測已暫停";
  };

  const getStatusColor = () => {
    if (connectionStatus === "error" || cameraError) return "text-red-400";
    if (connectionStatus === "connecting" || (!cameraReady && cameraStarted))
      return "text-yellow-400";
    if (status.detection_active) return "text-green-400";
    return "text-blue-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-0 md:p-4">
      <div className="w-full md:max-w-6xl md:mx-auto">
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
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-4 md:mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Settings size={20} />
              <CardTitle className="text-lg">系統控制與設定</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {/* 演算法選擇（改用 Select，行動裝置更友善） */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-100">
                  偵測算法
                </h3>
                <Select
                  value={status.algorithm}
                  onValueChange={(val) => changeAlgorithm(val)}
                >
                  <SelectTrigger className="w-full bg-white/10 border-white/20 text-black">
                    <SelectValue placeholder="選擇偵測算法" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 text-black">
                    <SelectItem
                      value="algorithm1"
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      算法一 (Otsu 二值化)
                    </SelectItem>
                    <SelectItem
                      value="algorithm2"
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      算法二 (Canny 邊緣偵測)
                    </SelectItem>
                    <SelectItem
                      value="yolo11"
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      算法三 (YOLOv11)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 控制按鈕與攝影機選擇 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">系統控制</h3>

                {videoDevices.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-gray-200">選擇攝影機</Label>
                    <Select
                      value={selectedDeviceId || ""}
                      onValueChange={(val) => changeCamera(val)}
                    >
                      <SelectTrigger className="w-full bg-white/10 border-white/20 text-black">
                        <SelectValue placeholder="選擇攝影機" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 text-white">
                        {videoDevices.map((device) => (
                          <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                            className="text-white hover:bg-gray-700 focus:bg-gray-700"
                          >
                            {device.friendlyLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col md:flex-row flex-wrap gap-2 md:gap-3">
                  <Button
                    onClick={startCamera}
                    disabled={!cameraSupported || cameraStarted}
                    className="bg-green-600 hover:bg-green-700 text-black border-green-600 disabled:bg-gray-600 disabled:text-gray-300"
                  >
                    <Play size={18} />
                    開始攝影
                  </Button>
                  <Button
                    onClick={stopCamera}
                    disabled={!cameraStarted}
                    className="bg-red-600 hover:bg-red-700 text-black border-red-600 disabled:bg-gray-600 disabled:text-gray-300"
                  >
                    <Square size={18} />
                    停止攝影
                  </Button>
                  <Button
                    onClick={testCapture}
                    disabled={!cameraReady}
                    className="bg-purple-600 hover:bg-purple-700 text-black border-purple-600 disabled:bg-gray-600 disabled:text-gray-300"
                  >
                    <Camera size={18} />
                    測試捕獲
                  </Button>
                  <Button
                    onClick={toggleDetection}
                    className={`${
                      status.detection_active
                        ? "bg-orange-600 hover:bg-orange-700 border-orange-600"
                        : "bg-blue-600 hover:bg-blue-700 border-blue-600"
                    } text-black disabled:bg-gray-600 disabled:text-gray-300`}
                  >
                    {status.detection_active ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                    {status.detection_active ? "停止偵測" : "開始偵測"}
                  </Button>
                </div>

                {videoDevices.length > 0 && (
                  <div className="text-sm text-gray-200 space-y-1">
                    <div>可用攝影機：{videoDevices.length} 台</div>
                    {(selectedDeviceId || preferredFacingMode) && (
                      <div className="text-blue-300">
                        當前使用：
                        {selectedDeviceId
                          ? videoDevices.find(
                              (d) => d.deviceId === selectedDeviceId
                            )?.friendlyLabel
                          : `${
                              preferredFacingMode === "environment"
                                ? "後置"
                                : "前置"
                            }鏡頭`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 視訊顯示區域 */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-4 md:mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg md:text-xl text-center">
              {cameraStarted ? "即時影像偵測" : "攝影機初始化中"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative">
                {/* 原始攝影機畫面 - 僅在支援時渲染 */}
                <p>{console.log(cameraSupported)}</p>
                {cameraSupported && cameraStarted && (
                  <div className="block">
                    <Webcam
                      key={`${
                        selectedDeviceId || preferredFacingMode || "default"
                      }`}
                      ref={webcamRef}
                      audio={false}
                      width={640}
                      height={480}
                      onUserMedia={onUserMedia}
                      onUserMediaError={onUserMediaError}
                      className="max-w-full h-auto rounded-lg border-2 border-white/20"
                      videoConstraints={getVideoConstraints()}
                      playsInline
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.8}
                    />

                    {/* 處理後的畫面疊加層 - 只在偵測時顯示 */}
                    {status.detection_active && processedFrame && (
                      <img
                        src={processedFrame || "/placeholder.svg"}
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
                      {status.detection_active
                        ? "偵測中"
                        : cameraReady
                        ? "攝影中"
                        : "初始化中"}
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
                {(!cameraStarted || !cameraSupported) && (
                  <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Camera
                        size={48}
                        className="mx-auto mb-2 text-gray-500"
                      />
                      {cameraSupported ? (
                        <p className="text-gray-400">
                          {cameraError
                            ? `錯誤: ${cameraError}`
                            : "正在請求攝影機權限..."}
                        </p>
                      ) : (
                        <div className="text-center">
                          <p className="text-gray-400 mb-2">
                            {!hasGetUserMedia
                              ? "瀏覽器不支援攝影機功能"
                              : !isSecureContext && !isLocalhost
                              ? "攝影機需要 HTTPS 連線"
                              : "攝影機功能不可用"}
                          </p>
                          {!hasGetUserMedia && (
                            <p className="text-sm text-gray-500">
                              請使用現代瀏覽器（Chrome、Firefox、Safari、Edge）
                            </p>
                          )}
                          {!isSecureContext &&
                            !isLocalhost &&
                            hasGetUserMedia && (
                              <div className="text-sm text-gray-500">
                                <p className="mb-1">解決方案：</p>
                                <p>• 使用 localhost 或 127.0.0.1</p>
                                <p>• 或設定 HTTPS 連線</p>
                              </div>
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
          </CardContent>
        </Card>

        {/* 資訊面板 */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg md:text-xl">偵測資訊</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
