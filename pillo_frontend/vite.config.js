import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: "0.0.0.0", // 允許局域網訪問
    port: 5173,
    strictPort: true,
    proxy: {
      // 將同源下的 /api/* 代理到後端 8000
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // 不重寫路徑，保持 /api 前綴
        // rewrite: (path) => path,
      },
    },
  },
});
