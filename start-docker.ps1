# Docker 化 Pillo 專案啟動腳本
# PowerShell 腳本

Write-Host "=== Docker 化 Pillo 專案啟動 ===" -ForegroundColor Green

# 檢查 Docker 是否安裝
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker 未安裝，請先安裝 Docker Desktop" -ForegroundColor Red
    Write-Host "下載地址: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 檢查 Docker Compose 是否可用
try {
    docker compose version | Out-Null
}
catch {
    Write-Host "Docker Compose 不可用，請檢查 Docker Desktop 安裝" -ForegroundColor Red
    exit 1
}

Write-Host "建構並啟動所有服務..." -ForegroundColor Yellow
docker compose up --build -d

Write-Host ""
Write-Host "服務已啟動！" -ForegroundColor Green
Write-Host "前端 HTTPS: https://localhost:3001" -ForegroundColor Cyan
Write-Host "後端 API: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "查看服務狀態: docker compose ps" -ForegroundColor Yellow
Write-Host "查看日誌: docker compose logs -f" -ForegroundColor Yellow
Write-Host "停止服務: docker compose down" -ForegroundColor Yellow
Write-Host ""

Read-Host "按 Enter 鍵繼續"
