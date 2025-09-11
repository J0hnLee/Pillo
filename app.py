# # 前後端混合式開發
# from flask import Flask, render_template_string, Response, request, jsonify
# import cv2
# import numpy as np
# import threading
# import time
# from datetime import datetime

# app = Flask(__name__)

# # 全域變數
# camera = None
# is_streaming = False
# detection_active = False
# current_count = 0
# selected_algorithm = "algorithm2"  # 預設使用算法二

# # HTML 模板
# HTML_TEMPLATE = '''
# <!DOCTYPE html>
# <html lang="zh-TW">
# <head>
#     <meta charset="UTF-8">
#     <meta name="viewport" content="width=device-width, initial-scale=1.0">
#     <title>即時輪廓偵測系統</title>
#     <style>
#         body {
#             font-family: 'Microsoft YaHei', Arial, sans-serif;
#             margin: 0;
#             padding: 20px;
#             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
#             color: white;
#             min-height: 100vh;
#         }

#         .container {
#             max-width: 1200px;
#             margin: 0 auto;
#             background: rgba(255, 255, 255, 0.1);
#             border-radius: 15px;
#             padding: 30px;
#             backdrop-filter: blur(10px);
#             box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
#         }

#         h1 {
#             text-align: center;
#             margin-bottom: 30px;
#             font-size: 2.5em;
#             text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
#         }

#         .controls {
#             display: flex;
#             justify-content: center;
#             gap: 20px;
#             margin-bottom: 30px;
#             flex-wrap: wrap;
#         }

#         button {
#             padding: 12px 24px;
#             font-size: 16px;
#             border: none;
#             border-radius: 8px;
#             cursor: pointer;
#             transition: all 0.3s ease;
#             font-weight: bold;
#             min-width: 120px;
#         }

#         .start-btn {
#             background: linear-gradient(45deg, #4CAF50, #45a049);
#             color: white;
#         }

#         .stop-btn {
#             background: linear-gradient(45deg, #f44336, #d32f2f);
#             color: white;
#         }

#         .toggle-btn {
#             background: linear-gradient(45deg, #2196F3, #1976D2);
#             color: white;
#         }

#         button:hover {
#             transform: translateY(-2px);
#             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
#         }

#         button:disabled {
#             background: #cccccc;
#             cursor: not-allowed;
#             transform: none;
#         }

#         .video-container {
#             display: flex;
#             justify-content: center;
#             margin-bottom: 20px;
#         }

#         .video-feed {
#             border: 3px solid rgba(255, 255, 255, 0.3);
#             border-radius: 10px;
#             max-width: 100%;
#             height: auto;
#         }

#         .info-panel {
#             display: grid;
#             grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
#             gap: 20px;
#             margin-top: 20px;
#         }

#         .info-card {
#             background: rgba(255, 255, 255, 0.15);
#             padding: 20px;
#             border-radius: 10px;
#             text-align: center;
#             backdrop-filter: blur(5px);
#         }

#         .info-card h3 {
#             margin: 0 0 10px 0;
#             color: #FFD700;
#         }

#         .count-display {
#             font-size: 2em;
#             font-weight: bold;
#             color: #00ff00;
#             text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
#         }

#         .algorithm-selector {
#             margin: 20px 0;
#             text-align: center;
#         }

#         .algorithm-selector select {
#             padding: 10px;
#             font-size: 16px;
#             border-radius: 5px;
#             border: none;
#             background: rgba(255, 255, 255, 0.9);
#             color: #333;
#         }

#         .status {
#             text-align: center;
#             font-size: 1.2em;
#             margin: 20px 0;
#         }

#         .status.active {
#             color: #00ff00;
#         }

#         .status.inactive {
#             color: #ff6b6b;
#         }

#         @media (max-width: 768px) {
#             .controls {
#                 flex-direction: column;
#                 align-items: center;
#             }

#             button {
#                 width: 200px;
#             }
#         }
#     </style>
# </head>
# <body>
#     <div class="container">
#         <h1>🎥 即時輪廓偵測系統</h1>

#         <div class="algorithm-selector">
#             <label for="algorithm">選擇偵測算法：</label>
#             <select id="algorithm" onchange="changeAlgorithm()">
#                 <option value="algorithm1">算法一 (Otsu 二值化)</option>
#                 <option value="algorithm2" selected>算法二 (Canny 邊緣偵測)</option>
#             </select>
#         </div>

#         <div class="controls">
#             <button id="startBtn" class="start-btn" onclick="startCamera()">🎬 開始攝影</button>
#             <button id="stopBtn" class="stop-btn" onclick="stopCamera()" disabled>⏹️ 停止攝影</button>
#             <button id="toggleBtn" class="toggle-btn" onclick="toggleDetection()" disabled>🔍 開始偵測</button>
#         </div>

#         <div class="status" id="status">系統待機中...</div>

#         <div class="video-container">
#             <img id="videoFeed" class="video-feed" src="" alt="攝影機畫面" style="display: none;">
#         </div>

#         <div class="info-panel">
#             <div class="info-card">
#                 <h3>📊 偵測數量</h3>
#                 <div class="count-display" id="countDisplay">0</div>
#             </div>
#             <div class="info-card">
#                 <h3>🕒 最後更新</h3>
#                 <div id="lastUpdate">尚未開始</div>
#             </div>
#             <div class="info-card">
#                 <h3>⚙️ 當前算法</h3>
#                 <div id="currentAlgorithm">算法二</div>
#             </div>
#         </div>
#     </div>

#     <script>
#         let isStreaming = false;
#         let isDetecting = false;

#         function startCamera() {
#             fetch('/start_camera', {method: 'POST'})
#                 .then(response => response.json())
#                 .then(data => {
#                     if (data.success) {
#                         document.getElementById('videoFeed').src = '/video_feed';
#                         document.getElementById('videoFeed').style.display = 'block';
#                         document.getElementById('startBtn').disabled = true;
#                         document.getElementById('stopBtn').disabled = false;
#                         document.getElementById('toggleBtn').disabled = false;
#                         document.getElementById('status').textContent = '攝影機已啟動';
#                         document.getElementById('status').className = 'status active';
#                         isStreaming = true;
#                         startCountUpdate();
#                     } else {
#                         alert('無法開啟攝影機：' + data.message);
#                     }
#                 });
#         }

#         function stopCamera() {
#             fetch('/stop_camera', {method: 'POST'})
#                 .then(response => response.json())
#                 .then(data => {
#                     document.getElementById('videoFeed').style.display = 'none';
#                     document.getElementById('startBtn').disabled = false;
#                     document.getElementById('stopBtn').disabled = true;
#                     document.getElementById('toggleBtn').disabled = true;
#                     document.getElementById('toggleBtn').textContent = '🔍 開始偵測';
#                     document.getElementById('status').textContent = '攝影機已停止';
#                     document.getElementById('status').className = 'status inactive';
#                     isStreaming = false;
#                     isDetecting = false;
#                     stopCountUpdate();
#                 });
#         }

#         function toggleDetection() {
#             const action = isDetecting ? 'stop_detection' : 'start_detection';
#             fetch('/' + action, {method: 'POST'})
#                 .then(response => response.json())
#                 .then(data => {
#                     if (data.success) {
#                         isDetecting = !isDetecting;
#                         const btn = document.getElementById('toggleBtn');
#                         if (isDetecting) {
#                             btn.textContent = '⏹️ 停止偵測';
#                             btn.className = 'stop-btn';
#                             document.getElementById('status').textContent = '正在進行輪廓偵測...';
#                         } else {
#                             btn.textContent = '🔍 開始偵測';
#                             btn.className = 'toggle-btn';
#                             document.getElementById('status').textContent = '攝影機運行中，偵測已暫停';
#                         }
#                     }
#                 });
#         }

#         function changeAlgorithm() {
#             const algorithm = document.getElementById('algorithm').value;
#             fetch('/change_algorithm', {
#                 method: 'POST',
#                 headers: {'Content-Type': 'application/json'},
#                 body: JSON.stringify({algorithm: algorithm})
#             })
#             .then(response => response.json())
#             .then(data => {
#                 if (data.success) {
#                     const algorithmName = algorithm === 'algorithm1' ? '算法一' : '算法二';
#                     document.getElementById('currentAlgorithm').textContent = algorithmName;
#                 }
#             });
#         }

#         let countUpdateInterval;

#         function startCountUpdate() {
#             countUpdateInterval = setInterval(() => {
#                 if (isStreaming) {
#                     fetch('/get_count')
#                         .then(response => response.json())
#                         .then(data => {
#                             document.getElementById('countDisplay').textContent = data.count;
#                             document.getElementById('lastUpdate').textContent = data.timestamp;
#                         });
#                 }
#             }, 500); // 每 0.5 秒更新一次
#         }

#         function stopCountUpdate() {
#             if (countUpdateInterval) {
#                 clearInterval(countUpdateInterval);
#             }
#         }
#     </script>
# </body>
# </html>
# '''


# class CameraController:
#     def __init__(self):
#         self.cap = None
#         self.is_streaming = False
#         self.detection_active = False
#         self.current_count = 0
#         self.algorithm = "algorithm2"

#     def start_camera(self, camera_index=1):
#         try:
#             self.cap = cv2.VideoCapture(camera_index)
#             if not self.cap.isOpened():
#                 # 嘗試其他攝影機索引
#                 for i in range(1, 4):
#                     self.cap = cv2.VideoCapture(i)
#                     if self.cap.isOpened():
#                         break

#             if not self.cap.isOpened():
#                 return False, "無法開啟任何攝影機"

#             # 設定攝影機參數
#             self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
#             self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
#             self.is_streaming = True
#             return True, "攝影機啟動成功"
#         except Exception as e:
#             return False, f"攝影機啟動失敗: {str(e)}"

#     def stop_camera(self):
#         self.is_streaming = False
#         self.detection_active = False
#         if self.cap:
#             self.cap.release()
#             self.cap = None
#         return True, "攝影機已停止"

#     def generate_frames(self):
#         while self.is_streaming and self.cap:
#             ret, frame = self.cap.read()
#             if not ret:
#                 break

#             display_frame = frame.copy()

#             if self.detection_active:
#                 try:
#                     count = self.process_contours(frame, display_frame)
#                     self.current_count = count
#                 except Exception as e:
#                     print(f"處理錯誤: {e}")
#                     self.current_count = 0
#             else:
#                 self.current_count = 0

#             # 編碼圖片
#             ret, buffer = cv2.imencode('.jpg', display_frame)
#             if ret:
#                 frame_bytes = buffer.tobytes()
#                 yield (b'--frame\r\n'
#                        b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

#     def process_contours(self, frame, display_frame):
#         gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
#         blur = cv2.GaussianBlur(gray, (7, 7), 0)

#         if self.algorithm == "algorithm1":
#             # 算法一：Otsu 二值化
#             _, thresh = cv2.threshold(
#                 blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
#             contours, _ = cv2.findContours(
#                 thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
#         else:
#             # 算法二：Canny 邊緣偵測
#             canny = cv2.Canny(blur, 100, 150, 3)
#             dilated = cv2.dilate(canny, (1, 1), iterations=0)
#             contours, _ = cv2.findContours(
#                 dilated.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

#         count = len(contours)

#         # 畫出輪廓
#         cv2.drawContours(display_frame, contours, -1, (0, 255, 0), 2)

#         # 顯示數量
#         cv2.putText(display_frame, f"Count: {count}", (20, 50),
#                     cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3, cv2.LINE_AA)

#         return count


# # 創建攝影機控制器實例
# camera_controller = CameraController()


# @app.route('/')
# def index():
#     return render_template_string(HTML_TEMPLATE)


# @app.route('/start_camera', methods=['POST'])
# def start_camera():
#     success, message = camera_controller.start_camera()
#     return jsonify({'success': success, 'message': message})


# @app.route('/stop_camera', methods=['POST'])
# def stop_camera():
#     success, message = camera_controller.stop_camera()
#     return jsonify({'success': success, 'message': message})


# @app.route('/start_detection', methods=['POST'])
# def start_detection():
#     camera_controller.detection_active = True
#     return jsonify({'success': True, 'message': '開始輪廓偵測'})


# @app.route('/stop_detection', methods=['POST'])
# def stop_detection():
#     camera_controller.detection_active = False
#     return jsonify({'success': True, 'message': '停止輪廓偵測'})


# @app.route('/change_algorithm', methods=['POST'])
# def change_algorithm():
#     data = request.get_json()
#     camera_controller.algorithm = data.get('algorithm', 'algorithm2')
#     return jsonify({'success': True, 'message': '算法已更換'})


# @app.route('/get_count')
# def get_count():
#     timestamp = datetime.now().strftime('%H:%M:%S')
#     return jsonify({
#         'count': camera_controller.current_count,
#         'timestamp': timestamp
#     })


# @app.route('/video_feed')
# def video_feed():
#     return Response(camera_controller.generate_frames(),
#                     mimetype='multipart/x-mixed-replace; boundary=frame')


# if __name__ == '__main__':
#     print("🚀 啟動輪廓偵測網頁應用程式")
#     print("📱 本機存取: http://localhost:5001")
#     print("🌐 局域網存取: http://[您的IP地址]:5001")
#     print("💡 按 Ctrl+C 停止服務")

#     # 允許局域網存取
#     app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
