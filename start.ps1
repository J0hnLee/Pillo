# Pillo 輪廓偵測系統啟動腳本 (PowerShell 版本)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Pillo 輪廓偵測系統啟動腳本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Python 環境
Write-Host "正在檢查 Python 環境..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python 已安裝: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 錯誤: 未找到 Python，請先安裝 Python" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 檢查 Node.js 環境
Write-Host "正在檢查 Node.js 環境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Node.js 已安裝: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 錯誤: 未找到 Node.js，請先安裝 Node.js" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 檢查 pnpm
Write-Host "正在檢查 pnpm..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version 2>&1
    Write-Host "✓ pnpm 已安裝: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 錯誤: 未找到 pnpm，請先安裝 pnpm" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host ""
Write-Host "正在安裝後端依賴..." -ForegroundColor Yellow
Set-Location "pillo_backend"
try {
    pip install -r requirements.txt
    Write-Host "✓ 後端依賴安裝完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 錯誤: 後端依賴安裝失敗" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host ""
Write-Host "正在安裝前端依賴..." -ForegroundColor Yellow
Set-Location "..\pillo_frontend"
try {
    pnpm install
    Write-Host "✓ 前端依賴安裝完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 錯誤: 前端依賴安裝失敗" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "啟動服務..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 獲取當前目錄
$currentDir = Get-Location

Write-Host "正在啟動後端服務 (端口 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$currentDir\pillo_backend'; python main.py" -WindowStyle Normal

Write-Host "等待後端啟動..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "正在啟動前端服務 (端口 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$currentDir\pillo_frontend'; pnpm run dev --host" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "服務啟動完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "本機訪問地址:" -ForegroundColor Cyan
Write-Host "  前端: http://localhost:5173" -ForegroundColor White
Write-Host "  後端: http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "局域網訪問地址 (手機可連接):" -ForegroundColor Cyan
Write-Host "  前端: http://[您的IP地址]:5173" -ForegroundColor White
Write-Host "  後端: http://[您的IP地址]:8000" -ForegroundColor White
Write-Host ""
Write-Host "提示: 請確保防火牆允許這些端口的訪問" -ForegroundColor Yellow
Write-Host ""

Read-Host "按 Enter 鍵關閉此窗口"
