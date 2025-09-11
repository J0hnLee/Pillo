# 前端 Dockerfile
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安裝 pnpm
RUN npm install -g pnpm

# 安裝依賴
RUN pnpm install

# 複製源代碼
COPY . .

# 建構應用
RUN pnpm run build

# 暴露端口
EXPOSE 5173

# 啟動開發服務器（用於開發）
# 生產環境建議使用 nginx 或其他靜態文件服務器
CMD ["pnpm", "run", "preview", "--host", "0.0.0.0", "--port", "5173"]
