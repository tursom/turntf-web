import { createProxyMiddleware } from "http-proxy-middleware";
import type { Express } from "express";
import { ServerResponse } from "node:http";

const backendRoots = ["/api", "/auth", "/users", "/nodes", "/cluster", "/events", "/ops", "/metrics", "/healthz", "/internal", "/ws"];

export function isBackendPath(url: string): boolean {
  const pathname = url.split("?", 1)[0];
  return backendRoots.some((root) => pathname === root || pathname.startsWith(root + "/"));
}

export function setupProxy(app: Express, backendUrl: string) {
  const respondedSockets = new WeakSet<object>();
  const proxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    pathFilter: isBackendPath,
    pathRewrite: (path) => {
      const rewritten = path.replace(/^\/api(?=\/|\?|$)/, "");
      return rewritten === "" || rewritten.startsWith("?") ? "/" + rewritten : rewritten;
    },
    // index.ts owns the only upgrade listener, including upgrades before HTTP traffic.
    ws: false,
    on: {
      proxyReqWs(proxyReq, _req, socket) {
        // Once a response starts, errors must close the stream, not append HTTP bytes.
        const markResponded = () => { respondedSockets.add(socket); };
        proxyReq.once("upgrade", markResponded);
        proxyReq.once("response", markResponded);
      },
      error(_err, _req, res) {
        if (res instanceof ServerResponse) {
          if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "后端服务不可用" }));
        } else if (res && !res.destroyed) {
          if (respondedSockets.has(res)) {
            res.destroy();
            return;
          }
          res.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
        }
      },
    },
  });

  // Mount at the root so Express cannot strip /api before path matching/rewriting.
  app.use(proxy);
  return proxy;
}
