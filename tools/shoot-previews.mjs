#!/usr/bin/env node
/**
 * 为外挂大屏生成落地页预览图（public/demo_N.jpg，1920×1080）。
 *
 * 预览图是 Station 里 useTexture 的硬依赖：缺图会让整个 <Suspense> 挂起，
 * 落地页渲染成一圈空展台（不是报错，是白屏），很难联想到是图片缺失。
 * 所以每个 DEMOS 条目的 img 必须真实存在。
 *
 * 产物本身要入库（每张 ~200KB，与 demo_0..3.jpg 同规格），
 * 但它是「生成物」：嵌入页改了版式就得重跑一次。
 *
 *   node tools/shoot-previews.mjs
 *
 * 前置：node tools/build-embedded.mjs 已经把产物拷进 sc-datav/public/
 * 需要 dev server 跑在 5180（或用 BASE_URL 覆盖）。
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { launch, openPage, ROOT } from "./lib.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:5180/kobin-dataviz";

/** 与 store.ts 里 DEMOS 的 img 字段一一对应，顺序即 demo_N 的 N */
const SHOTS = [
  { n: 4, dir: "kobin-datav-hangzhou", settle: 9000 },
  { n: 5, dir: "kobin-datav-smart", settle: 9000 },
];

const browser = await launch();
const { page, errors } = await openPage(browser);

for (const { n, dir, settle } of SHOTS) {
  // 必须写显式 index.html：目录形式（/dir/）在 vite dev 下会被 SPA fallback
  // 吃掉，返回 sc-datav 自己的 index.html —— 表现为"截图拍到落地页"，
  // 而不是报错。静态托管与 dev 对目录 URL 的处理也不一致，显式写最稳。
  const url = `${BASE}/${dir}/index.html`;
  process.stdout.write(`${url} … `);
  await page.goto(url, { waitUntil: "load" });
  // 这类大屏首屏要拉 geojson + 起 echort，固定等一会儿比轮询稳
  await page.waitForTimeout(settle);

  const png = path.join(ROOT, "shots", `_preview_${dir}.png`);
  await page.screenshot({ path: png });

  const jpg = path.join(ROOT, "sc-datav", "public", `demo_${n}.jpg`);
  // sips 是 macOS 自带的，quality 参数与 demo_0..3.jpg 观感一致
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "72", png, "--out", jpg], {
    stdio: "ignore",
  });
  console.log(`→ public/demo_${n}.jpg`);
}

console.log(errors.length ? `\nERRORS:\n${[...new Set(errors)].slice(0, 8).join("\n")}` : "\nno console errors");
await browser.close();