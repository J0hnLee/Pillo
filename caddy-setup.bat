@echo off
REM Caddy HTTPS 開發環境設定腳本
REM Windows Batch 腳本

echo === Caddy HTTPS 開發環境設定 ===

REM 檢查 Caddy 是否已安裝
where caddy >nul 2>nul
if %errorlevel% neq 0 (
    echo Caddy 未安裝，請先安裝 Caddy
    echo 下載地址: https://caddyserver.com/download
    echo 或使用 Chocolatey: choco install caddy
    pause
    exit /b 1
)

REM 檢查 Caddy 版本
caddy version
echo.

REM 建立開發目錄
if not exist "dev-certs" (
    mkdir dev-certs
    echo 已建立 dev-certs 目錄
)

REM 啟動 Caddy
echo 啟動 Caddy HTTPS 代理服務...
echo 前端 HTTPS: https://localhost:3000
echo 後端 HTTPS: https://localhost:8000
echo 按 Ctrl+C 停止服務
echo.

REM 啟動 Caddy
caddy run --config Caddyfile --adapter caddyfile
