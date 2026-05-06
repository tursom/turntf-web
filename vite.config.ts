import { existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const localSdkEntry = path.resolve(__dirname, "../../sdk/turntf-web-sdk/src/index.ts");
const sdkAlias = existsSync(localSdkEntry)
  ? { "@tursom/turntf-web-sdk": localSdkEntry }
  : {};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...sdkAlias,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      // 开发模式下 /api 同时承载 HTTP 和 WebSocket 代理。
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
