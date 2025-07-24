import cv2
import numpy as np

# 初始化攝影機
cap = cv2.VideoCapture(1)
if not cap.isOpened():
    print("❌ 無法開啟攝影機")
    exit()

# 設定 ROI 區域 (x, y, w, h)
roi = (100, 100, 400, 300)  # 你可以依實際畫面調整

print("📸 開始即時偵測，按 q 離開")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    x, y, w, h = roi
    roi_img = frame[y:y+h, x:x+w]

    # 灰階
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)

    # 模糊
    blur = cv2.GaussianBlur(gray, (7, 7), 0)

    # 自動二值化（Otsu）
    _, thresh = cv2.threshold(
        blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 邊緣偵測
    edges = cv2.Canny(thresh, 50, 150)

    # 找輪廓來計數
    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = len(contours)

    # 顯示邊框和結果文字
    display = frame.copy()
    cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 0), 2)
    cv2.putText(display, f"數量: {count}", (x, y-10),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    # 顯示畫面
    cv2.imshow('即時辨識 - 原始畫面', display)
    cv2.imshow('ROI - 邊緣偵測', edges)

    # 按 q 離開
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# 結束
cap.release()
cv2.destroyAllWindows()
