import cv2
import numpy as np
text = 'Hello'
org = (20,90)
fontFace = cv2.FONT_HERSHEY_SIMPLEX
fontScale = 2.5
color = (0,0,255)
thickness = 5
lineType = cv2.LINE_AA


# 初始化攝影機（0 為內建攝影機，如有外接可改成 1）
cap = cv2.VideoCapture(1)
if not cap.isOpened():
    print("❌ 無法開啟攝影機")
    exit()

print("📸 開始即時偵測，按 q 離開")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 使用全畫面進行處理
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)

    # Otsu 二值化
    _, thresh = cv2.threshold(blur, 80, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 邊緣偵測（可選用來 debug）
    edges = cv2.Canny(thresh, 50, 150)

    # 找輪廓
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = len(contours)

    # 畫出所有輪廓（綠色）
    display = frame.copy()
    cv2.drawContours(display, contours, -1, (0, 255, 0), 2)


    # 顯示數量
    cv2.putText(display, f"count: {count}", org,
               fontFace, fontScale, color, thickness, lineType)

    # 顯示畫面
    cv2.imshow('original', display)
    #cv2.imshow('邊緣偵測', edges)

    # 按 q 離開
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# 結束
cap.release()
cv2.destroyAllWindows()
