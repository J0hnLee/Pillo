import cv2
# 嘗試所有常見的 index（0~4），找出哪個是 Camo 虛擬鏡頭
for i in range(5):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        print(f"✅ 攝影機 index {i} 可用")
        ret, frame = cap.read()
        if ret:
            cv2.imshow(f"攝影機 {i}", frame)
            cv2.waitKey(1000)  # 顯示 1 秒
        cap.release()
