@echo off
REM Docker 化 Pillo 專案啟動腳本
REM Windows Batch 腳本

echo === Docker 化 Pillo 專案啟動 ===

REM 檢查 Docker 是否安裝
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo Docker 未安裝，請先安裝 Docker Desktop
    echo 下載地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM 檢查 Docker Compose 是否可用
docker compose version >nul 2>nul
if %errorlevel% neq 0 (
    echo Docker Compose 不可用，請檢查 Docker Desktop 安裝
    pause
    exit /b 1
)

echo 建構並啟動所有服務...
docker compose up --build -d

echo.
echo 服務已啟動！
echo 前端 HTTPS: https://localhost:3001
echo 後端 API: http://localhost:8000
echo.
echo 查看服務狀態: docker compose ps
echo 查看日誌: docker compose logs -f
echo 停止服務: docker compose down
echo.

pause
