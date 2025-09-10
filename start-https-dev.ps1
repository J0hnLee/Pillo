# HTTPS 開發環境啟動腳本
# PowerShell 腳本

Write-Host "=== HTTPS 開發環境啟動 ===" -ForegroundColor Green

# 檢查必要的工具
$tools = @("node", "python")
$missingTools = @()

foreach ($tool in $tools) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        $missingTools += $tool
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host "缺少必要工具: $($missingTools -join ', ')" -ForegroundColor Red
    exit 1
}

# 選擇代理服務器
Write-Host "選擇 HTTPS 代理服務器:" -ForegroundColor Yellow
Write-Host "1. Caddy (推薦 - 自動 SSL)" -ForegroundColor Cyan
Write-Host "2. Nginx (需要手動生成 SSL 憑證)" -ForegroundColor Cyan
$choice = Read-Host "請選擇 (1 或 2)"

# 啟動後端服務
Write-Host "啟動後端服務..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "app.py" -WindowStyle Minimized
Start-Sleep -Seconds 3

# 啟動前端服務
Write-Host "啟動前端服務..." -ForegroundColor Yellow
Set-Location "pillo_frontend"
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Minimized
Set-Location ".."
Start-Sleep -Seconds 5

# 根據選擇啟動代理服務器
switch ($choice) {
    "1" {
        if (!(Get-Command caddy -ErrorAction SilentlyContinue)) {
            Write-Host "Caddy 未安裝，請先執行 caddy-setup.ps1" -ForegroundColor Red
            exit 1
        }
        Write-Host "啟動 Caddy HTTPS 代理..." -ForegroundColor Green
        Write-Host "前端 HTTPS: https://localhost:3000" -ForegroundColor Cyan
        Write-Host "後端 HTTPS: https://localhost:8000" -ForegroundColor Cyan
        caddy run --config Caddyfile --adapter caddyfile
    }
    "2" {
        if (!(Test-Path "dev-certs/localhost.crt")) {
            Write-Host "SSL 憑證不存在，請先執行 generate-ssl-cert.ps1" -ForegroundColor Red
            exit 1
        }
        if (!(Get-Command nginx -ErrorAction SilentlyContinue)) {
            Write-Host "Nginx 未安裝，請先安裝 Nginx" -ForegroundColor Red
            exit 1
        }
        Write-Host "啟動 Nginx HTTPS 代理..." -ForegroundColor Green
        Write-Host "前端 HTTPS: https://localhost:3000" -ForegroundColor Cyan
        Write-Host "後端 HTTPS: https://localhost:8000" -ForegroundColor Cyan
        nginx -c "$PWD/nginx-dev.conf" -p "$PWD"
    }
    default {
        Write-Host "無效選擇" -ForegroundColor Red
        exit 1
    }
}
