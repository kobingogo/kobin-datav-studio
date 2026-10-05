import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* 部署基路径 —— 改部署位置只需要改这里（或设 BASE_PATH 环境变量）。
   *
   * 为什么用环境变量而不是写死：
   *   本地 dev 与 tools/ 里的默认 BASE_URL 都按 /kobin-dataviz/ 走，保持既有 URL；
   *   Vercel 生产环境把 dist/ 挂在域名根路径，此时 base 必须是 "/"。
   *
   * 这里踩过的坑：base 写死 /kobin-dataviz/ 直接上 Vercel，页面能打开
   *（返回的就是 dist/index.html），但 HTML 里所有资源都指向
   * /kobin-dataviz/assets/… 而实际文件在 /assets/… —— 应用壳在、全部资源
   * 404，表现为白屏加一片 404，而构建过程不会有任何错误。 */
  base: process.env.BASE_PATH ?? "/kobin-dataviz/",
  resolve: {
    alias: {
      "@": resolve("src"),
    },
  },
});