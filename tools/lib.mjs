/**
 * 验证工具的公共部分。
 *
 * 之前三个脚本各自硬编码了 `/Users/bingo/workspace/w3-dataV/shots` 和
 * `http://localhost:5180`，换台机器或换个端口就全部失效。
 * 这里统一从脚本自身位置推导路径，URL 允许用 BASE_URL 覆盖。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** tools/ 的上一级就是仓库根（Kobin Datav 仓库） */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SHOTS = path.join(ROOT, "shots");

/** 产物目录随项目 base 走，所以按 dev server 的 base 解析路由 */
export const BASE = process.env.BASE_URL ?? "http://localhost:5180/kobin-datav/#";

export const route = (r) => `${BASE}${r}`;

/**
 * launch —— 优先用已安装的 chromium channel。
 * 纯 `chromium.launch()` 在这台机器上会去找 chrome-headless-shell，
 * 而 ms-playwright 缓存里只有完整 chromium，会直接报
 * "Executable doesn't exist"。
 */
export async function launch() {
  mkdirSync(SHOTS, { recursive: true });
  try {
    return await chromium.launch({ channel: "chromium" });
  } catch {
    return await chromium.launch();
  }
}

/** 开一个页面并收集 console error / pageerror */
export async function openPage(browser, { width = 1920, height = 1080, reducedMotion } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE ${m.text()}`);
  });
  return { page, ctx, errors };
}

export const shot = (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

/** 落地页当前展台的标题 —— 用来断言"中央那块是不是选中的那块" */
export const activeTitle = (page) =>
  page.locator("h2").first().textContent();

/**
 * 当前路由（hash，去掉前导 #）。
 * 注意 `new URL(...).hash` 返回的是带 `#` 的原始值，
 * 不剥掉的话断言里得写成 "#/demo0" 这种，和人读的路径对不上。
 */
export const hashOf = (page) => {
  const h = new URL(page.url()).hash;
  return h ? h.replace(/^#/, "") || "/" : "/";
};

/* ── 极简断言累加器：让脚本失败时能返回非零退出码 ─────────────── */

const results = [];

export function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

export function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} 通过` +
      (failed.length ? `，失败：${failed.map((f) => f.name).join("、")}` : "")
  );
  // 有失败就以非零码退出，便于日后接 CI
  process.exitCode = failed.length ? 1 : 0;
}