from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import uvicorn
import base64
from typing import Optional
import json
from datetime import datetime
from utils import get_local_ip,get_all_ips
try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

app = FastAPI(title="影像處理 API", version="2.0.0")

# 允許跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 請求模型


class ImageProcessingRequest(BaseModel):
    image_data: str  # base64 編碼的影像
    algorithm: str = "algorithm2"  # algorithm1, algorithm2, yolo11


class AlgorithmRequest(BaseModel):
    algorithm: str


class ImageProcessor:
    def __init__(self):
        self.algorithm = "algorithm2"
        self.yolo_model = None

    def ensure_yolo_loaded(self):
        if self.yolo_model is None:
            if YOLO is None:
                raise RuntimeError("Ultralytics YOLO 未安裝，請安裝 ultralytics 套件")
            self.yolo_model = YOLO("my_model.pt")

    def process_image(self, image_data: str, algorithm: str = None):
        """處理影像並回傳結果"""
        try:
            # 解碼 base64 影像
            image_bytes = base64.b64decode(image_data.split(
                ',')[1] if ',' in image_data else image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                raise ValueError("無法解碼影像")

            # 創建顯示用的影像副本
            display_frame = frame.copy()

            # 根據算法處理影像
            if algorithm == "yolo11":
                count = self.process_yolo(frame, display_frame)
            elif algorithm == "algorithm1":
                count = self.process_contours_otsu(frame, display_frame)
            else:  # algorithm2
                count = self.process_contours_canny(frame, display_frame)

            # 編碼處理後的影像
            ret, buffer = cv2.imencode('.jpg', display_frame, [
                                       cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                processed_image = base64.b64encode(buffer).decode('utf-8')
                return {
                    "success": True,
                    "processed_image": f"data:image/jpeg;base64,{processed_image}",
                    "count": count,
                    "algorithm": algorithm
                }
            else:
                raise ValueError("無法編碼處理後的影像")

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "count": 0
            }

    def process_contours_otsu(self, frame, display_frame):
        """Otsu 二值化輪廓偵測"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (7, 7), 0)
        _, thresh = cv2.threshold(
            blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        count = len(contours)
        cv2.drawContours(display_frame, contours, -1, (0, 255, 0), 2)
        cv2.putText(display_frame, f"Otsu Count: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        return count

    def process_contours_canny(self, frame, display_frame):
        """Canny 邊緣偵測輪廓"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (7, 7), 0)
        canny = cv2.Canny(blur, 100, 150, 3)
        dilated = cv2.dilate(canny, (1, 1), iterations=0)
        contours, _ = cv2.findContours(
            dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

        count = len(contours)
        cv2.drawContours(display_frame, contours, -1, (0, 255, 0), 2)
        cv2.putText(display_frame, f"Canny Count: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        return count

    def process_yolo(self, frame, display_frame):
        """YOLO 物件偵測"""
        self.ensure_yolo_loaded()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.yolo_model.predict(source=rgb, verbose=False, imgsz=640,
                                          conf=0.25, iou=0.45, device='cpu')

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

                cv2.rectangle(display_frame, (x1, y1),
                              (x2, y2), (0, 255, 0), 2)
                label = f"ID{cls_id} {conf:.2f}"
                cv2.putText(display_frame, label, (x1, max(y1-5, 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        cv2.putText(display_frame, f"YOLO Count: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)
        return count


# 創建影像處理器實例
processor = ImageProcessor()


@app.get("/")
async def root():
    return {"message": "影像處理 API 服務運行中", "version": "2.0.0"}


@app.post("/api/process-image")
async def process_image(request: ImageProcessingRequest):
    """處理影像並回傳結果"""
    result = processor.process_image(request.image_data, request.algorithm)
    return result


@app.post("/api/algorithm/change")
async def change_algorithm(request: AlgorithmRequest):
    """更改處理算法"""
    processor.algorithm = request.algorithm
    return {"success": True, "message": f"算法已更改為 {request.algorithm}"}


@app.get("/api/status")
async def get_status():
    """獲取服務狀態"""
    return {
        "status": "running",
        "algorithm": processor.algorithm,
        "yolo_available": YOLO is not None,
        "timestamp": datetime.now().strftime('%H:%M:%S')
    }

if __name__ == "__main__":
    local_ip = get_local_ip()
    print(f"🌐 本機IP: {local_ip}")
    print("🚀 啟動影像處理 API 服務")
    print("📱 API 文檔:")
    print(f"   - http://localhost:8000/docs")
    print(f"   - http://127.0.0.1:8000/docs")
    print(f"   - http://{local_ip}:8000/docs")
    print("💡 按 Ctrl+C 停止服務")

    # 測試端口是否正確監聽
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', 8000))
    if result == 0:
        print("✅ localhost:8000 可以連接")
    sock.close()

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
