/**
 * 从运行中的 app 里导出真实数据，供 mockup 生成器使用。
 *
 *   node tools/dumpData.mjs
 *
 * 为什么要这一步：mockup 必须和 app 看到同一份数字。
 * 如果在 mockup 里另写一份假数据，设计图上好看、真机上是另一套，
 * 设计就没有意义了。
 *
 * 做法是通过 Vite 直接 import 产品的 TS 模块 —— 不复制逻辑，
 * 所以 series.ts 一改，这里导出的就是新的。
 */
import { writeFileSync } from "node:fs";
import { launch, openPage } from "./lib.mjs";

const BASE = process.env.BASE_URL || "http://localhost:5180/kobin-datav/#";
const OUT = new URL("../mockup/data.json", import.meta.url).pathname;

const b = await launch();
const { page, ctx } = await openPage(b, { width: 1280, height: 800 });
await page.goto(BASE.replace(/#+$/, "").replace(/\/$/, "/"), { waitUntil: "load" });
await page.waitForTimeout(2500);

const payload = await page.evaluate(async () => {
  const s = await import("/kobin-datav/src/console/series.ts");
  const d = await import("/kobin-datav/src/console/data.ts");
  const g = await import("/kobin-datav/src/geo/index.ts");

  const metrics = {};
  for (const k of s.METRIC_KEYS) {
    const spec = s.METRIC_SPECS[k];
    metrics[k] = {
      label: spec.label,
      unit: spec.unit,
      kind: spec.kind,
      province: s.provinceSeries(k),
    };
  }

  const cities = Object.fromEntries(
    Object.entries(d.cityMetrics).map(([name, m]) => [
      name,
      { ...m, series: s.series[name] },
    ]),
  );

  const geo = g.PROVINCE;
  return {
    asOf: d.DATA_AS_OF,
    source: d.DATA_SOURCE,
    province: d.province,
    cities,
    provinceShort: geo.short,
    metrics,
    months: s.MONTH_LABELS,
  };
});

await ctx.close();
await b.close();

writeFileSync(OUT, JSON.stringify(payload));
console.log(`✓ mockup/data.json  ${(JSON.stringify(payload).length / 1024).toFixed(0)}KB`);
console.log(`  ${Object.keys(payload.cities).length} 市 × ${Object.keys(payload.metrics).length} 指标 × ${payload.months.length} 月`);