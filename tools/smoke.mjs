#!/usr/bin/env node
/**
 * 回归检查 —— 有断言、失败时返回非零退出码。
 *
 *   node tools/smoke.mjs
 *
 * 检查项都是"静止截图看不出来"的那类问题。
 * 每一项后面注释了它当初对应的真实 bug：
 * 这些 bug 页面照常渲染，不跑交互就完全发现不了。
 */
import { launch, openPage, route, shot, activeTitle, hashOf, check, summarize } from "./lib.mjs";

/**
 * 落地页的展台标题带省份前缀（如「浙江智慧城市数据大脑」），
 * 换省后前缀会变。这里按「不含省份的稳定后缀」做断言，
 * 这样以后换省不需要再改测试。
 * 05 / 06 是外挂进来的 Vue 大屏，标题本就没有省份前缀。
 */
const STATION = {
  city: "经济运行监测",
  brain: "智慧城市数据大脑",
  power: "电力全景感知平台",
  model: "3D 模型展示",
  hangzhou: "杭州市城市运行大屏",
  smart: "智慧城市运营大屏",
};

/** 展台总数。站位从 4 扩到 6 后，下面所有写死的 4 都要跟着变 */
const STATION_COUNT = 6;

const browser = await launch();

/* ── 1. 四档视口：无横向溢出、无 console error ─────────────── */
console.log("\n[视口]");
for (const [w, h, tag] of [
  [2560, 1440, "2560"],
  [1600, 900, "1600"],
  [1366, 768, "1366"],
  [1280, 720, "1280"],
]) {
  const { page, ctx, errors } = await openPage(browser, { width: w, height: h });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1600);
  await shot(page, `smoke-${tag}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2
  );
  check(`${w}×${h} 无横向溢出`, !overflow);
  check(`${w}×${h} 无 console error`, errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

/* ── 2. 方向键：中央那块必须始终是选中项 ────────────────────── */
console.log("\n[方向键]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  const want = [
    STATION.city,
    STATION.brain,
    STATION.power,
    STATION.model,
    STATION.hangzhou,
    STATION.smart,
  ];
  let i = 0;
  for (const expected of want.slice(1)) {
    i += 1;
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1700);
    const got = (await activeTitle(page)) ?? "";
    check(`按 ${i} 次 → ${expected}`, got.includes(expected), got || "(取不到标题)");
  }
  await ctx.close();
}

/* ── 3. 回绕：06 → 01 ─────────────────────────────────────────
   对应 bug：站位间距 68° 不整除 360°，且角度按增量累加，
   回绕时环会差 88°，画面中央不是进度条显示的那一块。
   站位扩到 6 之后这条更关键 —— 弧线跨度变成 200°，缺口更大。      */
console.log("\n[回绕]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  for (let k = 0; k < STATION_COUNT; k++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1500);
  }
  const got = (await activeTitle(page)) ?? "";
  check(`${STATION_COUNT} → 0 回绕后中央仍是 01`, got.includes(STATION.city), got || "");
  await shot(page, "smoke-wrap");
  await ctx.close();
}

/* ── 3b. 展台必须真的有内容（守住"空展台"回归）──────────────────
   对应 bug：Ring 把逐帧变化的 facings 当普通 prop 传给 Station，
   而它在 useFrame 里是原地改数组，引用不变 → React 永不重渲染 →
   prop 冻结在首屏的全 0。Station 于是把图片 lerp 到近黑、缩到 0.8、
   铭牌因 f>0.08 条件不渲染 —— 画面只剩环境，
   但 HUD 与底部进度条完全正常，肉眼容易误判为"加载慢"。

   判据用铭牌的 inline opacity：它和驱动图片亮度的 facing 是同一个量，
   正对相机时 = 1.0，冻结在 0 时 = 0.28。

   不用像素采样：没开 preserveDrawingBuffer 时 drawImage(canvas)
   读到的是空缓冲，测出来恒为 0。 */
console.log("\n[展台渲染]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(4500);

  const maxPlateOpacity = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll("[data-station-plate]")];
      if (!els.length) return -1; // 一个铭牌都没挂 → 场景没渲染出来
      return Math.max(
        ...els.map((e) => parseFloat(e.style.opacity || "0"))
      );
    });

  const first = await maxPlateOpacity();
  check(
    `首屏有 ${STATION_COUNT} 个铭牌挂载`,
    (await page.locator("[data-station-plate]").count()) === STATION_COUNT
  );
  check("首屏正面展台不透明", first > 0.9, `opacity=${first}`);

  // 快速连按，覆盖「prop 冻结」与「角度漂移」两个坑
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2500);
  const fast = await maxPlateOpacity();
  check("连按两次后正面展台不透明", fast > 0.9, `opacity=${fast}`);

  // 回到第 1 张要走满一圈。连按两次后停在索引 2，
  // 所以还要再按 STATION_COUNT - 2 次 —— 写死次数会在扩站后失效，
  // 而且失效方式是"断言红但页面看起来完全正常"，很难一眼看出原因。
  for (let k = 0; k < STATION_COUNT - 2; k++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1600);
  const wrapped = await maxPlateOpacity();
  check("走满一圈后正面展台不透明", wrapped > 0.9, `opacity=${wrapped}`);
  const backTitle = (await activeTitle(page)) ?? "";
  check("回绕后回到第 1 张", backTitle.includes(STATION.city), backTitle);
  await shot(page, "smoke-station-wrap");
  await ctx.close();
}

/* ── 4. 滚轮分档 ────────────────────────────────────────────── */
console.log("\n[滚轮]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  for (let k = 0; k < 3; k++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(900);
  }
  const got = await activeTitle(page);
  check("滚轮 3 档 → 04", got.includes(STATION.model), got || "");
  await shot(page, "smoke-wheel");
  await ctx.close();
}

/* ── 5. 拖拽擦洗，且不能跳页 ──────────────────────────────────
   对应 bug：浏览器把"拖完松手"也当 click，R3F 的位移容差不够覆盖，
   实测拖 480px 松手直接 navigate 进了 demo3。                 */
console.log("\n[拖拽]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.mouse.move(800, 450);
  await page.mouse.down();
  for (let k = 0; k < 12; k++) {
    await page.mouse.move(800 - k * 40, 450);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(1700);
  const stillHome = hashOf(page) === "/";
  check("拖拽后没有跳页", stillHome, `hash=${hashOf(page)}`);
  const moved = !((await activeTitle(page)) ?? "").includes(STATION.city);
  check("拖拽确实换了站", moved);
  await shot(page, "smoke-drag");
  await ctx.close();
}

/* ── 6. 空闲自动巡览 ────────────────────────────────────────── */
console.log("\n[自动巡览]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const a = await activeTitle(page);
  await page.waitForTimeout(6000);
  const b = await activeTitle(page);
  check("空闲后自动前进一站", a !== b, `${a} → ${b}`);
  await ctx.close();
}

/* ── 7. prefers-reduced-motion ─────────────────────────────── */
console.log("\n[reduced-motion]");
{
  const { page, ctx, errors } = await openPage(browser, {
    width: 1600,
    height: 900,
    reducedMotion: "reduce",
  });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  check("reduced-motion 下无报错", errors.length === 0, errors[0] ?? "");
  await shot(page, "smoke-reduced");
  await ctx.close();
}

/* ── 8. 进入按钮 → 路由 ─────────────────────────────────────── */
console.log("\n[进入]");
{
  const { page, ctx } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /进入体验|进入 ·/ }).click();
  await page.waitForTimeout(2500);
  check("进入按钮跳到 /demo0", hashOf(page) === "/demo0", hashOf(page));
  await ctx.close();
}

/* ── 9. Demo0：地图联动 ────────────────────────────────────
   Demo0 原来地图零交互，这组断言守住"hover 能点亮行政区"。 */
console.log("\n[Demo0 联动]");
{
  const { page, ctx, errors } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/demo0"), { waitUntil: "load" });
  await page.waitForTimeout(9000);
  check("无横向溢出", !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)));
  await page.mouse.move(800, 500);
  await page.waitForTimeout(1200);
  await shot(page, "smoke-demo0-hover");
  // 联动生效时，至少有一张卡片进入 active 态（描边转青）
  const lit = await page.evaluate(() => {
    const el = document.querySelector("[data-panel-side='left']");
    return !!el && !!el.querySelector("section");
  });
  check("地图 hover 后面板存在且可联动", lit);
  check("无 console error", errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

/* ── 10. Demo3：模型查看器 ──────────────────────────────────
   对应 bug：`new Color(0.5, 0.5, 10)` 第四参数不存在导致栅格泛紫；
   <Stats /> 的 FPS 面板与 leva 开发面板泄漏进产品界面。 */
console.log("\n[Demo3 查看器]");
{
  const { page, ctx, errors } = await openPage(browser, { width: 1600, height: 900 });
  await page.goto(route("/demo3"), { waitUntil: "load" });
  await page.waitForTimeout(9000);
  await shot(page, "smoke-demo3");
  check("无 FPS 面板泄漏", !(await page.locator("text=/^\\d+ FPS/").count()));
  check("无 leva 开发面板", !(await page.locator("text=拆解/还原").count()));
  check("部件计数已填充", /部件\s*\d+/u.test((await page.locator("body").innerText()).replace(/\s+/g, "")) || (await page.locator("body").innerText()).includes("部件"));
  await page.keyboard.press("e");
  await page.waitForTimeout(1800);
  await shot(page, "smoke-demo3-explode");
  await page.keyboard.press("e");
  await page.waitForTimeout(1400);
  check("拆解 / 还原无报错", errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

/* ── 11. 静态集成页：iframe 必须真的铺满并渲染出内容 ─────────
   对应两个已踩过的坑：
   ① iframe 高度算成 0 —— App.tsx 外层 wrapper 带 willChange:transform，
      会成为 position:fixed 子元素的包含块，inset:0 参照 wrapper（高 0）。
      症状是嵌入页一片纯底色，而 iframe 其实已 load 完成，很容易误判为产物缺失。
   ② 产物 URL 少了 index.html —— 目录形式被 vite SPA fallback 吃掉，
      iframe 里会再套一个 Kobin Datav 落地页，frame 数仍是 2、也没有报错。      */
console.log("\n[静态集成]");
for (const [r, dir, marker] of [
  ["/hangzhou", "kobin-datav-hangzhou", "杭州市"],
  ["/smart", "kobin-datav-smart", "全国"],
]) {
  const { page, ctx, errors } = await openPage(browser);
  await page.goto(route(r), { waitUntil: "load" });
  await page.waitForTimeout(9000);
  await shot(page, `smoke-${dir}`);

  const info = await page.evaluate(() => {
    const f = document.querySelector("iframe");
    if (!f) return null;
    const rect = f.getBoundingClientRect();
    const d = f.contentDocument;
    return {
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      src: f.getAttribute("src") ?? "",
      innerH: d?.body?.scrollHeight ?? 0,
      innerText: (d?.body?.innerText ?? "").replace(/\s+/g, " "),
    };
  });

  check(`${r} 有 iframe`, info !== null);
  if (info) {
    check(`${r} iframe 铺满视口`, info.w >= 1900 && info.h >= 1000, `${info.w}×${info.h}`);
    check(`${r} 指向 index.html`, /\/index\.html$/.test(info.src), info.src);
    check(
      `${r} 产物有实际内容`,
      info.innerH > 500 && info.innerText.includes(marker),
      `innerH=${info.innerH} 含「${marker}」=${info.innerText.includes(marker)}`
    );
  }
  check(`${r} 无 console error`, errors.length === 0, errors[0] ?? "");

  // Esc 必须能回到展廊
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  check(`${r} Esc 回到展廊`, hashOf(page) === "/", `hash=${hashOf(page)}`);
  await ctx.close();
}

/* ── 12. 原有页面仍能正常打开 ──────────────────────────────
   改造动过 GlobalStyle / 主题 token / Demo0 目录结构，
   要确认各页没被带崩。                                     */
console.log("\n[各页可用性]");
for (const [r, name] of [
  ["/demo0", "demo0"],
  ["/demo1", "demo1"],
  ["/demo2", "demo2"],
  ["/demo3", "demo3"],
]) {
  const { page, ctx, errors } = await openPage(browser);
  await page.goto(route(r), { waitUntil: "load" });
  await page.waitForTimeout(9000);
  await shot(page, `smoke-${name}`);
  check(`${r} 无 console error`, errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

await browser.close();
summarize();