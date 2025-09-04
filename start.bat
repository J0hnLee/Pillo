@echo off
echo ========================================
echo    Pillo 輪廓偵測系統啟動腳本
echo ========================================
echo.

echo 正在檢查 Python 環境...
python --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到 Python，請先安裝 Python
    pause
    exit /b 1
)

echo 正在檢查 Node.js 環境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到 Node.js，請先安裝 Node.js
    pause
    exit /b 1
)

echo 正在檢查 pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未找到 pnpm，請先安裝 pnpm
    pause
    exit /b 1
)

echo.
echo 正在安裝後端依賴...
cd pillo_backend
pip install -r requirements.txt
if errorlevel 1 (
    echo 錯誤: 後端依賴安裝失敗
    pause
    exit /b 1
)

echo.
echo 正在安裝前端依賴...
cd ..\pillo_frontend
pnpm install
if errorlevel 1 (
    echo 錯誤: 前端依賴安裝失敗
    pause
    exit /b 1
)

echo.
echo ========================================
echo 啟動服務...
echo ========================================
echo.

echo 正在啟動後端服務 (端口 8000)...
start "Pillo Backend" cmd /k "cd /d %~dp0pillo_backend && python main.py"

echo 等待後端啟動...
timeout /t 3 /nobreak >nul

echo 正在啟動前端服務 (端口 5173)...
start "Pillo Frontend" cmd /k "cd /d %~dp0pillo_frontend && pnpm run dev --host"

echo.
echo ========================================
echo 服務啟動完成！
echo ========================================
echo.
echo 本機訪問地址:
echo   前端: http://localhost:5173
echo   後端: http://localhost:8000
echo.
echo 局域網訪問地址 (手機可連接):
echo   前端: http://[您的IP地址]:5173
echo   後端: http://[您的IP地址]:8000
echo.
echo 按任意鍵關閉此窗口...
pause >nul
