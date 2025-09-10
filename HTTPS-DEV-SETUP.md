# HTTPS 開發環境設定指南

本指南說明如何在本地開發環境中設定 HTTPS，以支援區域網攝影機功能。

## 問題背景

現代瀏覽器的安全政策要求攝影機 API (`getUserMedia`) 必須在安全上下文（HTTPS）中執行。只有 `localhost` 和 `127.0.0.1` 可以在 HTTP 下使用攝影機 API，其他 IP 地址（如 `192.168.x.x`）必須使用 HTTPS。

## 解決方案

### 方案一：使用 Caddy（推薦）

Caddy 自動處理 SSL 憑證，配置簡單，非常適合開發環境。

#### 安裝 Caddy

**使用 Chocolatey（推薦）：**
```powershell
choco install caddy
```

**手動安裝：**
1. 前往 [Caddy 官網](https://caddyserver.com/download)
2. 下載 Windows 版本
3. 解壓到 PATH 目錄

#### 啟動 HTTPS 開發環境

1. **執行設定腳本：**
   ```powershell
   .\caddy-setup.ps1
   ```
   或
   ```cmd
   caddy-setup.bat
   ```

2. **或手動啟動：**
   ```powershell
   caddy run --config Caddyfile --adapter caddyfile
   ```

3. **訪問應用程式：**
   - 前端：https://localhost:3000
   - 後端：https://localhost:8000

### 方案二：使用 Nginx

如果您偏好使用 Nginx，需要手動生成 SSL 憑證。

#### 安裝 Nginx

**使用 Chocolatey：**
```powershell
choco install nginx
```

**手動安裝：**
1. 前往 [Nginx 官網](http://nginx.org/en/download.html)
2. 下載 Windows 版本
3. 解壓到適當目錄

#### 生成 SSL 憑證

1. **安裝 OpenSSL：**
   ```powershell
   choco install openssl
   ```

2. **生成憑證：**
   ```powershell
   .\generate-ssl-cert.ps1
   ```
   或
   ```cmd
   generate-ssl-cert.bat
   ```

3. **啟動 Nginx：**
   ```powershell
   nginx -c nginx-dev.conf -p .
   ```

## 快速啟動

使用一鍵啟動腳本：

```powershell
.\start-https-dev.ps1
```
或
```cmd
start-https-dev.bat
```

## 配置說明

### Caddy 配置 (Caddyfile)

- `:3000` - 前端 HTTPS 服務（代理到 localhost:5173）
- `:8000` - 後端 HTTPS 服務（代理到 localhost:8001）
- 自動處理 CORS
- 自動生成和更新 SSL 憑證

### Nginx 配置 (nginx-dev.conf)

- `listen 3000 ssl` - 前端 HTTPS 服務
- `listen 8000 ssl` - 後端 HTTPS 服務
- 使用自簽憑證
- 配置 CORS 標頭

## 區域網訪問

要支援區域網訪問，需要修改配置檔案：

### Caddy 配置

在 `Caddyfile` 中取消註釋並修改 IP 地址：

```
192.168.1.100:3000 {
    reverse_proxy localhost:5173
    # ... 其他配置
}
```

### Nginx 配置

在 `nginx-dev.conf` 中添加新的 server 區塊：

```nginx
server {
    listen 192.168.1.100:3000 ssl;
    # ... 其他配置
}
```

## 瀏覽器憑證警告

使用自簽憑證時，瀏覽器會顯示安全警告：

1. 點擊「進階」
2. 點擊「繼續前往 localhost（不安全）」
3. 或將憑證添加到瀏覽器信任列表

## 故障排除

### 常見問題

1. **Caddy 無法啟動**
   - 檢查端口是否被占用
   - 確認 Caddy 已正確安裝

2. **Nginx 無法啟動**
   - 檢查 SSL 憑證是否存在
   - 確認 nginx-dev.conf 路徑正確

3. **攝影機仍無法使用**
   - 確認使用 HTTPS 訪問
   - 檢查瀏覽器控制台錯誤訊息
   - 確認攝影機權限已授予

### 端口衝突

如果端口被占用，可以修改配置檔案中的端口號：

- Caddy：修改 `Caddyfile` 中的端口
- Nginx：修改 `nginx-dev.conf` 中的 `listen` 指令

## 注意事項

1. 這些配置僅用於開發環境，不適用於生產環境
2. 自簽憑證會導致瀏覽器安全警告
3. 區域網訪問需要修改防火牆設定
4. 建議使用 Caddy 以獲得更好的開發體驗
