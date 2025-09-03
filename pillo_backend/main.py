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

class CameraController:
    def __init__(self):
        self.cap = None
        self.is_streaming = False
        self.detection_active = False
        self.current_count = 0
        self.algorithm = "algorithm2"
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        self.yolo_model: Optional["YOLO"] = None
        
    def start_camera(self, camera_index=0):
        try:
            # 嘗試不同的攝影機索引
            camera_indices = [camera_index, 0, 1, 2, 3]
            for idx in camera_indices:
                self.cap = cv2.VideoCapture(idx)
                if self.cap.isOpened():
                    break
                    
            if not self.cap.isOpened():
                return False, "無法開啟任何攝影機"
                
            # 設定攝影機參數
            # 設定 30 FPS 與解析度
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            # 減少內部緩衝避免延遲累積（若相機驅動支援）
            try:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
            
            self.is_streaming = True
            
            # 啟動攝影機執行緒
            self.camera_thread = threading.Thread(target=self._camera_loop, daemon=True)
            self.camera_thread.start()
            
            return True, "攝影機啟動成功"
        except Exception as e:
            return False, f"攝影機啟動失敗: {str(e)}"
    
    def _camera_loop(self):
        """攝影機主循環"""
        while self.is_streaming and self.cap:
            ret, frame = self.cap.read()
            if not ret:
                continue
                
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
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
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
            _, thresh = cv2.threshold(blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        else:
            # 算法二：Canny 邊緣偵測
            canny = cv2.Canny(blur, 100, 150, 3)
            dilated = cv2.dilate(canny, (1, 1), iterations=0)
            contours, _ = cv2.findContours(dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        
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
                raise RuntimeError("Ultralytics YOLO 未安裝，請在後端安裝 ultralytics 套件")
            # 載入本地模型檔
            self.yolo_model = YOLO("my_model.pt")

    def process_yolo(self, frame, display_frame):
        # 確保模型已載入
        self.ensure_yolo_loaded()
        # BGR -> RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # 推論（設定較快的參數）
        results = self.yolo_model.predict(source=rgb, verbose=False, imgsz=640, conf=0.25, iou=0.45, device=0 if cv2.cuda.getCudaEnabledDeviceCount() > 0 else 'cpu')
        # 取第一張結果
        r = results[0]
        boxes = r.boxes
        count = 0
        if boxes is not None:
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu().numpy()) if box.conf is not None else 0.0
                cls_id = int(box.cls[0].cpu().numpy()) if box.cls is not None else -1
                count += 1
                # 畫框與標籤
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f"ID{cls_id} {conf:.2f}"
                cv2.putText(display_frame, label, (x1, max(y1-5, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        # 顯示數量
        cv2.putText(display_frame, f"YOLO Count: {count}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        return count

# 創建攝影機控制器實例
camera_controller = CameraController()

@app.get("/")
async def root():
    return {"message": "輪廓偵測 API 服務運行中"}

@app.post("/api/camera/start")
async def start_camera():
    success, message = camera_controller.start_camera()
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
async def get_status():
    timestamp = datetime.now().strftime('%H:%M:%S')
    return {
        "count": camera_controller.current_count,
        "timestamp": timestamp,
        "is_streaming": camera_controller.is_streaming,
        "detection_active": camera_controller.detection_active,
        "algorithm": camera_controller.algorithm
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