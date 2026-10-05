#!/usr/bin/env node
/**
 * 任意路由截图。
 *
 *   node tools/shot.mjs "/demo1:demo1:9000" "/:landing:8000"
 *   node tools/shot.mjs "/demo2:demo2"            # 默认等 6s
 *
 * 参数格式  route:name[:等待毫秒]
 * 产物写入 shots/
 */
import { launch, openPage, route, shot } from "./lib.mjs";

const args = process.argv.slice(2);
if (!args.length) {
  console.error('用法: node tools/shot.mjs "/demo1:demo1:9000" "/:landing"');
  process.exit(1);
}

const browser = await launch();
const { page, errors } = await openPage(browser);

for (const a of args) {
  const [r, name, wait] = a.split(":");
  await page.goto(route(r), { waitUntil: "load" });
  await page.waitForTimeout(Number(wait ?? 6000));
  await shot(page, name);
  console.log(`saved shots/${name}.png`);
}

if (errors.length) {
  console.log("\nERRORS:");
  for (const e of [...new Set(errors)].slice(0, 10)) console.log("  " + e);
} else {
  console.log("\nno console errors");
}

await browser.close();