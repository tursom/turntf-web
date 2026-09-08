import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// npm SDK 的 ESM 产物使用无扩展名导入，由 Vite 按浏览器构建方式解析。
// 此配置不使用 monorepo 源码别名，确保验证实际安装的 SDK 包。
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    server: { deps: { inline: ["@tursom/turntf-web-sdk"] } },
  },
});
