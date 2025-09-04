@echo off
echo ========================================
echo    Pillo 系統診斷工具
echo ========================================
echo.

echo 檢查 Python 環境...
python --version
if errorlevel 1 (
    echo ❌ Python 未安裝或不在 PATH 中
) else (
    echo ✅ Python 已安裝
)

echo.
echo 檢查 Node.js 環境...
node --version
if errorlevel 1 (
    echo ❌ Node.js 未安裝或不在 PATH 中
) else (
    echo ✅ Node.js 已安裝
)

echo.
echo 檢查 pnpm...
pnpm --version
if errorlevel 1 (
    echo ❌ pnpm 未安裝
) else (
    echo ✅ pnpm 已安裝
)

echo.
echo 檢查後端依賴...
cd pillo_backend
if exist requirements.txt (
    echo ✅ requirements.txt 存在
    pip list | findstr fastapi >nul
    if errorlevel 1 (
        echo ❌ FastAPI 未安裝
    ) else (
        echo ✅ FastAPI 已安裝
    )
    pip list | findstr opencv >nul
    if errorlevel 1 (
        echo ❌ OpenCV 未安裝
    ) else (
        echo ✅ OpenCV 已安裝
    )
) else (
    echo ❌ requirements.txt 不存在
)

echo.
echo 檢查前端依賴...
cd ..\pillo_frontend
if exist package.json (
    echo ✅ package.json 存在
    if exist node_modules (
        echo ✅ node_modules 存在
    ) else (
        echo ❌ node_modules 不存在，請運行 pnpm install
    )
) else (
    echo ❌ package.json 不存在
)

echo.
echo 檢查端口使用情況...
netstat -an | findstr :8000
if errorlevel 1 (
    echo ❌ 端口 8000 未被使用 (後端可能未啟動)
) else (
    echo ✅ 端口 8000 正在使用
)

netstat -an | findstr :5173
if errorlevel 1 (
    echo ❌ 端口 5173 未被使用 (前端可能未啟動)
) else (
    echo ✅ 端口 5173 正在使用
)

echo.
echo 檢查網路連接...
ping -n 1 127.0.0.1 >nul
if errorlevel 1 (
    echo ❌ 本地網路連接有問題
) else (
    echo ✅ 本地網路連接正常
)

echo.
echo ========================================
echo 診斷完成
echo ========================================
echo.
echo 如果發現問題，請：
echo 1. 安裝缺失的依賴
echo 2. 運行 start.bat 啟動服務
echo 3. 檢查防火牆設定
echo.
pause
