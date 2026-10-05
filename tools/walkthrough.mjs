#!/usr/bin/env node
/**
 * 落地页状态走查 —— 产出各个交互态的截图，用于人工比对。
 *
 *   node tools/walkthrough.mjs
 *
 * 刻意在 4s 处按一次方向键"按住"自动巡览：
 * 空闲 5s 后空闲逻辑会接管，自己推进会把初始态拍花。
 */
import { launch, openPage, route, shot, activeTitle } from "./lib.mjs";

const browser = await launch();
const { page, errors } = await openPage(browser);

await page.goto(route("/"), { waitUntil: "load" });
await page.waitForTimeout(4000);

const titles = ["经济运行监测", "智慧城市数据大脑", "电力全景感知平台", "3D 模型展示"];

for (let i = 1; i <= 4; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1800);
  // 第四步是 04 → 01 的回绕，最容易暴露"角度与索引不同步"的 bug
  const tag = i === 4 ? "landing-01wrap" : `landing-0${i + 1}`;
  await shot(page, tag);
  console.log(`${tag}  →  ${await activeTitle(page)}`);
}

// 悬停侧翼展台
await page.mouse.move(300, 620);
await page.waitForTimeout(800);
await shot(page, "landing-hover");

// 点底部进度条直达
await page.getByRole("button", { name: /电力全景感知平台/ }).click();
await page.waitForTimeout(1800);
await shot(page, "landing-rail");

console.log(
  errors.length
    ? `\nERRORS:\n${[...new Set(errors)].slice(0, 6).join("\n")}`
    : "\nno console errors"
);
await browser.close();

export { titles };