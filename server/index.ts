import express from "express";
import http from "http";
import { Socket } from "node:net";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "./config";
import { isBackendPath, setupProxy } from "./proxy";
import { requestLogger } from "./middleware/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "..", "dist");

const config = loadConfig();

const app = express();
app.use(requestLogger);

// API + WebSocket proxy
const proxy = setupProxy(app, config.backendUrl);

// Static files
app.use(express.static(distPath));

// SPA fallback
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const server = http.createServer(app);

// WebSocket upgrade forwarding
server.on("upgrade", (req, socket, head) => {
  if (!(socket instanceof Socket) || !isBackendPath(req.url ?? "/")) {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    return;
  }
  proxy.upgrade!(req, socket, head);
});

server.listen(config.port, config.host, () => {
  console.log(`turntf-web server on http://${config.host}:${config.port}`);
  console.log(`Proxying to ${config.backendUrl}`);
});
