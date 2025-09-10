# Caddy HTTPS 開發環境設定腳本
# PowerShell 腳本

Write-Host "=== Caddy HTTPS 開發環境設定 ===" -ForegroundColor Green

# 檢查 Caddy 是否已安裝
if (!(Get-Command caddy -ErrorAction SilentlyContinue)) {
    Write-Host "Caddy 未安裝，正在安裝..." -ForegroundColor Yellow
    
    # 使用 Chocolatey 安裝 Caddy
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install caddy -y
    }
    else {
        Write-Host "請先安裝 Chocolatey 或手動安裝 Caddy" -ForegroundColor Red
        Write-Host "下載地址: https://caddyserver.com/download" -ForegroundColor Yellow
        exit 1
    }
}

# 檢查 Caddy 版本
$caddyVersion = caddy version
Write-Host "Caddy 版本: $caddyVersion" -ForegroundColor Green

# 建立開發目錄
if (!(Test-Path "dev-certs")) {
    New-Item -ItemType Directory -Name "dev-certs"
    Write-Host "已建立 dev-certs 目錄" -ForegroundColor Green
}

# 啟動 Caddy
Write-Host "啟動 Caddy HTTPS 代理服務..." -ForegroundColor Green
Write-Host "前端 HTTPS: https://localhost:3000" -ForegroundColor Cyan
Write-Host "後端 HTTPS: https://localhost:8000" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服務" -ForegroundColor Yellow

# 啟動 Caddy
caddy run --config Caddyfile --adapter caddyfile
