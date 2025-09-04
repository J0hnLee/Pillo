from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import cv2
import numpy as np
import asyncio
import threading
import time
from datetime import datetime
import uvicorn
import io
import base64
from typing import Optional

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

app = FastAPI(title="輪廓偵測 API", version="1.0.0")

# 允許跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應該限制具體域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 請求模型


class AlgorithmRequest(BaseModel):
    algorithm: str


class DeviceSessionRequest(BaseModel):
    device_type: str  # "desktop", "mobile", "tablet"
    user_agent: str
    device_id: str = None


class CameraController:
    def __init__(self):
        self.cap = None
        self.is_streaming = False
        self.detection_active = False
        self.current_count = 0
        self.algorithm = "algorithm2"
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        self.yolo_model = None
        self.device_sessions = {}  # 存儲不同設備的會話
        self.session_counter = 0

    def create_device_session(self, device_type: str, user_agent: str, device_id: str = None):
        """創建設備會話"""
        if not device_id:
            device_id = f"device_{self.session_counter}_{int(time.time())}"

        session = {
            "device_id": device_id,
            "device_type": device_type,
            "user_agent": user_agent,
            "created_at": time.time(),
            "last_activity": time.time(),
            "camera_index": self._get_camera_index_for_device(device_type),
            "is_active": True
        }

        self.device_sessions[device_id] = session
        self.session_counter += 1
        return device_id

    def _get_camera_index_for_device(self, device_type: str):
        """根據設備類型返回攝影機索引"""
        if device_type == "mobile":
            return 0  # 手機通常使用前置攝影機
        elif device_type == "tablet":
            return 0  # 平板電腦
        else:  # desktop
            return 1  # 桌面電腦通常使用外接攝影機

    def get_device_session(self, device_id: str):
        """獲取設備會話"""
        if device_id in self.device_sessions:
            self.device_sessions[device_id]["last_activity"] = time.time()
            return self.device_sessions[device_id]
        return None

    def cleanup_inactive_sessions(self, timeout: int = 300):
        """清理不活躍的會話（5分鐘超時）"""
        current_time = time.time()
        inactive_sessions = []

        for device_id, session in self.device_sessions.items():
            if current_time - session["last_activity"] > timeout:
                inactive_sessions.append(device_id)

        for device_id in inactive_sessions:
            del self.device_sessions[device_id]
            print(f"清理不活躍會話: {device_id}")

    def get_active_sessions_count(self):
        """獲取活躍會話數量"""
        self.cleanup_inactive_sessions()
        return len(self.device_sessions)

    def start_camera(self, camera_index=0, device_id=None):
        try:
            # 先停止現有的攝影機
            if self.cap:
                self.cap.release()
                self.cap = None

            # 如果有設備ID，使用設備特定的攝影機索引
            if device_id:
                session = self.get_device_session(device_id)
                if session:
                    camera_index = session["camera_index"]
                    print(f"使用設備 {device_id} 的攝影機索引: {camera_index}")

            # 嘗試不同的攝影機索引和後端
            camera_configs = [
                (camera_index, cv2.CAP_DSHOW),  # DirectShow (Windows)
                (camera_index, cv2.CAP_MSMF),   # Media Foundation (Windows)
                (camera_index, cv2.CAP_ANY),    # 自動選擇
                (0, cv2.CAP_DSHOW),  # 備用選項
                (1, cv2.CAP_DSHOW),
                (0, cv2.CAP_MSMF),
                (1, cv2.CAP_MSMF),
                (0, cv2.CAP_ANY),
                (1, cv2.CAP_ANY),
            ]

            for idx, backend in camera_configs:
                try:
                    self.cap = cv2.VideoCapture(idx, backend)
                    if self.cap.isOpened():
                        # 測試是否能讀取一幀
                        ret, test_frame = self.cap.read()
                        if ret and test_frame is not None:
                            print(f"成功使用攝影機索引 {idx} 和後端 {backend}")
                            break
                        else:
                            self.cap.release()
                            self.cap = None
                except Exception as e:
                    print(f"嘗試攝影機索引 {idx} 後端 {backend} 失敗: {e}")
                    if self.cap:
                        self.cap.release()
                        self.cap = None

            if not self.cap or not self.cap.isOpened():
                return False, "無法開啟任何攝影機，請檢查攝影機是否被其他應用程式使用"

            # 設定攝影機參數
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)
            self.cap.set(cv2.CAP_PROP_FPS, 30)

            # 減少內部緩衝避免延遲累積
            try:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass

            self.is_streaming = True

            # 啟動攝影機執行緒
            self.camera_thread = threading.Thread(
                target=self._camera_loop, daemon=True)
            self.camera_thread.start()

            return True, "攝影機啟動成功"
        except Exception as e:
            return False, f"攝影機啟動失敗: {str(e)}"

    def _camera_loop(self):
        """攝影機主循環"""
        consecutive_failures = 0
        max_failures = 10

        while self.is_streaming and self.cap:
            try:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures >= max_failures:
                        print("攝影機連續讀取失敗，嘗試重新初始化...")
                        self._reinitialize_camera()
                        consecutive_failures = 0
                    time.sleep(0.1)
                    continue

                consecutive_failures = 0  # 重置失敗計數
                display_frame = frame.copy()

                if self.detection_active:
                    try:
                        if self.algorithm == "yolo11":
                            count = self.process_yolo(frame, display_frame)
                        else:
                            count = self.process_contours(frame, display_frame)
                        self.current_count = count
                    except Exception as e:
                        print(f"處理錯誤: {e}")
                        self.current_count = 0
                else:
                    self.current_count = 0

                # 更新最新幀
                with self.frame_lock:
                    self.latest_frame = display_frame.copy()

                # 控制幀率（30 FPS）
                time.sleep(1/30)

            except Exception as e:
                print(f"攝影機循環錯誤: {e}")
                consecutive_failures += 1
                if consecutive_failures >= max_failures:
                    print("攝影機循環連續錯誤，停止攝影機")
                    self.is_streaming = False
                    break
                time.sleep(0.1)

    def _reinitialize_camera(self):
        """重新初始化攝影機"""
        try:
            if self.cap:
                self.cap.release()
                self.cap = None
            time.sleep(1)  # 等待攝影機釋放

            # 嘗試重新啟動攝影機
            success, message = self.start_camera()
            if not success:
                print(f"重新初始化攝影機失敗: {message}")
                self.is_streaming = False
        except Exception as e:
            print(f"重新初始化攝影機時發生錯誤: {e}")
            self.is_streaming = False

    def stop_camera(self):
        self.is_streaming = False
        self.detection_active = False
        if self.cap:
            self.cap.release()
            self.cap = None
        with self.frame_lock:
            self.latest_frame = None
        return True, "攝影機已停止"

    def get_frame_as_base64(self):
        """獲取當前幀的 base64 編碼"""
        with self.frame_lock:
            if self.latest_frame is None:
                return None
            frame = self.latest_frame.copy()

        # 編碼為 JPEG（降低品質減小傳輸與編碼負載）
        ret, buffer = cv2.imencode(
            '.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        if ret:
            # 轉換為 base64
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{img_base64}"
        return None

    def process_contours(self, frame, display_frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (7, 7), 0)

        if self.algorithm == "algorithm1":
            # 算法一：Otsu 二值化
            _, thresh = cv2.threshold(
                blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        else:
            # 算法二：Canny 邊緣偵測
            canny = cv2.Canny(blur, 100, 150, 3)
            dilated = cv2.dilate(canny, (1, 1), iterations=0)
            contours, _ = cv2.findContours(
                dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

        count = len(contours)

        # 畫出輪廓
        cv2.drawContours(display_frame, contours, -1, (0, 255, 0), 2)

        # 顯示數量
        cv2.putText(display_frame, f"Count: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)

        return count

    def ensure_yolo_loaded(self):
        if self.yolo_model is None:
            if YOLO is None:
                raise RuntimeError(
                    "Ultralytics YOLO 未安裝，請在後端安裝 ultralytics 套件")
            # 載入本地模型檔
            self.yolo_model = YOLO("my_model.pt")

    def process_yolo(self, frame, display_frame):
        # 確保模型已載入
        self.ensure_yolo_loaded()
        # BGR -> RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # 推論（設定較快的參數）
        results = self.yolo_model.predict(source=rgb, verbose=False, imgsz=640, conf=0.25,
                                          iou=0.45, device=0 if cv2.cuda.getCudaEnabledDeviceCount() > 0 else 'cpu')
        # 取第一張結果
        r = results[0]
        boxes = r.boxes
        count = 0
        if boxes is not None:
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu().numpy()
                             ) if box.conf is not None else 0.0
                cls_id = int(box.cls[0].cpu().numpy()
                             ) if box.cls is not None else -1
                count += 1
                # 畫框與標籤
                cv2.rectangle(display_frame, (x1, y1),
                              (x2, y2), (0, 255, 0), 2)
                label = f"ID{cls_id} {conf:.2f}"
                cv2.putText(display_frame, label, (x1, max(y1-5, 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        # 顯示數量
        cv2.putText(display_frame, f"YOLO Count: {count}", (
            20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        return count


# 創建攝影機控制器實例
camera_controller = CameraController()


@app.get("/")
async def root():
    return {"message": "輪廓偵測 API 服務運行中"}


@app.post("/api/device/register")
async def register_device(request: DeviceSessionRequest):
    """註冊設備會話"""
    device_id = camera_controller.create_device_session(
        request.device_type,
        request.user_agent,
        request.device_id
    )
    return {
        "success": True,
        "device_id": device_id,
        "message": f"設備 {request.device_type} 註冊成功"
    }


@app.post("/api/camera/start")
async def start_camera(device_id: str = None):
    success, message = camera_controller.start_camera(device_id=device_id)
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)


@app.post("/api/camera/stop")
async def stop_camera():
    success, message = camera_controller.stop_camera()
    return {"success": success, "message": message}


@app.post("/api/detection/start")
async def start_detection():
    camera_controller.detection_active = True
    return {"success": True, "message": "開始輪廓偵測"}


@app.post("/api/detection/stop")
async def stop_detection():
    camera_controller.detection_active = False
    return {"success": True, "message": "停止輪廓偵測"}


@app.post("/api/algorithm/change")
async def change_algorithm(request: AlgorithmRequest):
    camera_controller.algorithm = request.algorithm
    return {"success": True, "message": "算法已更換"}


@app.get("/api/status")
async def get_status(device_id: str = None):
    timestamp = datetime.now().strftime('%H:%M:%S')
    return {
        "count": camera_controller.current_count,
        "timestamp": timestamp,
        "is_streaming": camera_controller.is_streaming,
        "detection_active": camera_controller.detection_active,
        "algorithm": camera_controller.algorithm,
        "active_sessions": camera_controller.get_active_sessions_count(),
        "device_id": device_id
    }


@app.get("/api/device/sessions")
async def get_device_sessions():
    """獲取所有活躍設備會話"""
    camera_controller.cleanup_inactive_sessions()
    return {
        "sessions": list(camera_controller.device_sessions.values()),
        "total_count": len(camera_controller.device_sessions)
    }


@app.get("/api/video/frame")
async def get_video_frame():
    """獲取當前視訊幀"""
    frame_data = camera_controller.get_frame_as_base64()
    # 即使暫時沒有幀也回 200 並給予 null，避免前端把連線標記為錯誤
    return {"frame": frame_data if frame_data else None}

if __name__ == "__main__":
    print("🚀 啟動 FastAPI 後端服務")
    print("📱 API 文檔: http://localhost:8000/docs")
    print("🌐 局域網存取: http://[您的IP地址]:8000")
    print("💡 按 Ctrl+C 停止服務")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
