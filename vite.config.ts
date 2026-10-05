import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* 部署基路径。改这里 = 改部署子路径；
   改成 "./" 则可用相对路径部署到任意位置（推荐，除非必须固定子路径）。 */
  base: "/kobin-dataviz/",
  resolve: {
    alias: {
      "@": resolve("src"),
    },
  },
});
