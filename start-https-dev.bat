@echo off
REM HTTPS 開發環境啟動腳本
REM Windows Batch 腳本

echo === HTTPS 開發環境啟動 ===

REM 檢查必要的工具
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js 未安裝
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python 未安裝
    pause
    exit /b 1
)

REM 選擇代理服務器
echo 選擇 HTTPS 代理服務器:
echo 1. Caddy (推薦 - 自動 SSL)
echo 2. Nginx (需要手動生成 SSL 憑證)
set /p choice=請選擇 (1 或 2):

REM 啟動後端服務
echo 啟動後端服務...
start /min python app.py
timeout /t 3 /nobreak >nul

REM 啟動前端服務
echo 啟動前端服務...
cd pillo_frontend
start /min npm run dev
cd ..
timeout /t 5 /nobreak >nul

REM 根據選擇啟動代理服務器
if "%choice%"=="1" (
    where caddy >nul 2>nul
    if %errorlevel% neq 0 (
        echo Caddy 未安裝，請先執行 caddy-setup.bat
        pause
        exit /b 1
    )
    echo 啟動 Caddy HTTPS 代理...
    echo 前端 HTTPS: https://localhost:3000
    echo 後端 HTTPS: https://localhost:8000
    caddy run --config Caddyfile --adapter caddyfile
) else if "%choice%"=="2" (
    if not exist "dev-certs/localhost.crt" (
        echo SSL 憑證不存在，請先執行 generate-ssl-cert.bat
        pause
        exit /b 1
    )
    where nginx >nul 2>nul
    if %errorlevel% neq 0 (
        echo Nginx 未安裝，請先安裝 Nginx
        pause
        exit /b 1
    )
    echo 啟動 Nginx HTTPS 代理...
    echo 前端 HTTPS: https://localhost:3000
    echo 後端 HTTPS: https://localhost:8000
    nginx -c "%CD%/nginx-dev.conf" -p "%CD%"
) else (
    echo 無效選擇
    pause
    exit /b 1
)
