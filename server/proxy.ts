import { createProxyMiddleware } from "http-proxy-middleware";
import type { Express } from "express";
import type { IncomingMessage, ServerResponse } from "http";

export function setupProxy(app: Express, backendUrl: string) {
  const proxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    pathFilter: "/api/*",
    pathRewrite: { "^/api": "" },
    ws: true,
    on: {
      error(err, _req, res) {
        const response = (res ?? {}) as ServerResponse;
        if (response && !response.headersSent) {
          response.writeHead(502, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "后端服务不可用", detail: err.message }));
        }
      },
    },
  });

  app.use("/api", proxy);
  return proxy;
}
