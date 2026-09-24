import { existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createMessageProbeHandler, createMessageTraceHandler, createTopologyStatusHandler } from "./server/topologyStatus";

const localSdkEntry = path.resolve(__dirname, "../../sdk/turntf-web-sdk/src/index.ts");
const sdkAlias: Record<string, string> = process.env.TURNTF_USE_LOCAL_SDK === "1" && existsSync(localSdkEntry)
  ? { "@tursom/turntf-web-sdk": localSdkEntry }
  : {};

export default defineConfig({
  plugins: [react(), {
    name: "topology-status-dev",
    configureServer(server) {
      const topologyStatus = createTopologyStatusHandler(process.env.TURNTF_NODE_STATUS_URLS);
      const messageTrace = createMessageTraceHandler(process.env.TURNTF_NODE_STATUS_URLS);
      const messageProbe = createMessageProbeHandler(process.env.TURNTF_NODE_STATUS_URLS);
      server.middlewares.use("/ui-api/topology/", (req, res) => {
        void topologyStatus(req, res, (req.url ?? "").split("?", 1)[0].replace(/^\//, ""));
      });
      server.middlewares.use("/ui-api/traces/", (req, res) => {
        void messageTrace(req, res, (req.url ?? "").split("?", 1)[0].replace(/^\//, ""));
      });
      server.middlewares.use("/ui-api/probes/", (req, res) => {
        void messageProbe(req, res, (req.url ?? "").split("?", 1)[0].replace(/^\//, ""));
      });
    },
  }],
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
