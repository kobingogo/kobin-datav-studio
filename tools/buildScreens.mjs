/**
 * 生成三屏 UI 设计稿。
 *
 *   node tools/buildScreens.mjs
 *
 * 三屏共用设计语言，但构图刻意不同：
 *   s0 经济运行监测   3 / map / 3  + 底部 sparkline 墙
 *   s1 智慧城市数据大脑 2 / map / 3  无底部，右侧通高（事件流需要纵向空间）
 *   s2 电力全景感知   4 / map / 2  + 底部墙
 *
 * 数据取自 mockup/data.json —— 那是 tools/dumpData.mjs 通过 Vite import 产品
 * TS 模块导出的，与真机同一份数字。
 */
import { writeFileSync } from "node:fs";
import {
  lineChart, columnChart, heatMatrix, scatter, deck, rankRows, diverging,
  bullets, table, sparkWall, stage, page, GOODS, PARTNERS, EVENTS, ALARMS,
  prov, D, num, big, yi, wan, pct, cls, CITIES, heatOf, by, ramp,
} from "./lib/screens-lib.mjs";

const OUT = new URL("../mockup/", import.meta.url).pathname;

/* ── 派生量（全部从真实数据算，不另写死） ── */
const P = D.province;
const SURPLUS = P.exportValue - P.importValue;
const DEPEND = (((P.exportValue + P.importValue) * 1e8) / P.gdp) * 100;
const DENSITY = ((P.population * 1e4) / P.area) | 0;
const ENERGY_INT = (P.energy * 1e8) / P.gdp; // 万吨标煤→吨 ×1e4；元→万元 ÷1e4 ⇒ ×1e8
const powerY = prov("power").values.slice(-12);
const PEAK = Math.max(...powerY) - Math.min(...powerY);
const FAULTY = CITIES.reduce((a, c) => a + c.faults, 0);

/* ── 环形图 ── */
function donut(items, centerValue, centerLabel) {
  const total = items.reduce((a, b) => a + b.v, 0);
  const R = 42;
  const r = 27;
  let a0 = -Math.PI / 2;
  const arcs = items
    .map((it, i) => {
      const a1 = a0 + (it.v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = [
        `M ${(50 + R * Math.cos(a0)).toFixed(2)} ${(50 + R * Math.sin(a0)).toFixed(2)}`,
        `A ${R} ${R} 0 ${big} 1 ${(50 + R * Math.cos(a1)).toFixed(2)} ${(50 + R * Math.sin(a1)).toFixed(2)}`,
        `L ${(50 + r * Math.cos(a1)).toFixed(2)} ${(50 + r * Math.sin(a1)).toFixed(2)}`,
        `A ${r} ${r} 0 ${big} 0 ${(50 + r * Math.cos(a0)).toFixed(2)} ${(50 + r * Math.sin(a0)).toFixed(2)}`,
        "Z",
      ].join(" ");
      const mid = (a0 + a1) / 2;
      const s = `<path d="${p}" fill="var(--${it.c || ["cyan", "indigo", "teal", "violet", "amber"][i]})" fill-opacity=".78"/>` +
        `<text x="${(50 + 34 * Math.cos(mid)).toFixed(2)}" y="${(50 + 34 * Math.sin(mid) + 3).toFixed(2)}" fill="#04060D" font-size="8.5" font-weight="700" text-anchor="middle" font-family="ui-monospace,monospace">${((it.v / total) * 100).toFixed(0)}%</text>`;
      a0 = a1;
      return s;
    })
    .join("");
  return `<div class="dn">
  <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(122,160,220,.1)" stroke-width="${R - r}"/>${arcs}</svg>
  <div class="dn-c"><b class="num">${centerValue}</b><span>${centerLabel}</span></div>
</div>`;
}

/* ── 顶栏构件 ── */
const hero = (kicker, value, unit, yoy, series) => `<div class="hero">
  <div class="hero-k">${kicker}</div>
  <div class="hero-v num">${value}<u>${unit}</u></div>
  <div class="hero-f"><span class="pill num">${pct(yoy)}</span>
    ${lineChart({ series: [series], labels: [], w: 108, h: 26, padT: 2, padB: 2, padL: 0, padR: 0, area: true })
      .replace('class="chart"', 'style="height:24px"')}
  </div>
</div>`;

const kpi = (label, value, unit, yoy, key, color, n) => `<div class="kpi" style="--ac:var(--${color})">
  <div class="kpi-k"><i></i>${label}</div>
  <div class="kpi-v num">${value}<u>${unit}</u></div>
  ${lineChart({
    series: [{ values: prov(key).values, color: `var(--${color})` }],
    labels: [], w: 108, h: 18, padT: 2, padB: 2, padL: 0, padR: 0, area: false,
  }).replace('class="chart"', `style="height:18px"${n ? ` data-d="${n}"` : ""}`)}
</div>`;

const clock = (left) => `<div class="clk">
  <div class="clk-t num">20:47:33 <s>UTC+8</s></div>
  <div class="clk-m">数据截至 ${D.asOf}<br/>${left}</div>
</div>`;

const topRow = (h, kpis, left) => `<div class="top" style="grid-template-columns:286px repeat(${kpis.length},1fr) 196px">
  ${h}${kpis.join("")}${clock(left)}
</div>`;

/* ══════════════ 屏 0 · 经济运行监测 ══════════════ */
const S0 = () => {
  const treemap = (() => {
    const scale = 10000 / GOODS.reduce((a, x) => a + x.v, 0);
    const items = [...GOODS].sort((a, b) => b.v - a.v).map((i) => ({ ...i, a: i.v * scale }));
    const worst = (row, side) => {
      const ra = row.reduce((s, r) => s + r.a, 0);
      return Math.max(...row.map((r) => { const s = (side * side * r.a) / (ra * ra); return Math.max(s, 1 / s); }));
    };
    const out = [];
    let rx = 0, ry = 0, rw = 100, rh = 100, i = 0;
    const total = items.reduce((a, x) => a + x.a, 0);
    while (i < items.length) {
      const vertical = rw >= rh;
      const side = vertical ? rh : rw;
      let j = i + 1;
      while (j < items.length && (j === i + 1 || worst(items.slice(i, j + 1), side) <= worst(items.slice(i, j), side))) j++;
      const row = items.slice(i, j);
      const ra = row.reduce((s, r) => s + r.a, 0);
      const thick = ra / side;
      let off = 0;
      row.forEach((it) => {
        const len = (it.a / ra) * side;
        out.push(vertical ? { ...it, x: rx, y: ry + off, w: thick, h: len } : { ...it, x: rx + off, y: ry, w: len, h: thick });
        off += len;
      });
      if (vertical) { rx += thick; rw -= thick; } else { ry += thick; rh -= thick; }
      i = j;
    }
    return out
      .map((r) => `<div class="tm" style="--x:${r.x.toFixed(2)}%;--y:${r.y.toFixed(2)}%;--w:${r.w.toFixed(2)}%;--h:${r.h.toFixed(2)}%;--c:var(--${r.c})">
      <div class="tm-in"><b>${r.n}</b><span class="num">${num(r.v)}</span><em class="num">${((r.v * (10000 / total)) / 100).toFixed(1)}%</em></div>
    </div>`)
      .join("");
  })();

  const expColor = heatOf("exportValue");

  return page(
    "Kobin · 浙江经济运行监测",
    `${topRow(
      hero("GDP · Zhejiang", yi(P.gdp).replace(/[万亿]/g, ""), "亿元", prov("gdp").yoy, { values: prov("gdp").values, color: "url(#g0)" }),
      [
        kpi("出口总额", num(P.exportValue), "亿元", prov("exportValue").yoy, "exportValue", "cyan"),
        kpi("进口总额", num(P.importValue), "亿元", prov("importValue").yoy, "importValue", "indigo"),
        kpi("贸易顺差", (SURPLUS >= 0 ? "+" : "−") + num(Math.abs(SURPLUS)), "亿元", 12.4, "exportValue", "teal"),
        kpi("贸易依存度", DEPEND.toFixed(1), "%", -1.2, "importValue", "amber"),
        kpi("出口企业", num(P.enterprises), "家", prov("enterprises").yoy, "enterprises", "violet"),
      ],
      "11 地市 · 6 类商品 · 演示数据",
    )}
  <div class="mid" style="grid-template-columns:300px 1fr 340px;height:834px;margin-top:12px">
    <div class="rail" style="grid-template-rows:1.06fr .94fr 1fr">
      ${deck("01", "商品出口结构", "Goods Mix", {
        ac: "var(--indigo)", fill: "76%", right: num(GOODS.reduce((a, x) => a + x.v, 0)), body: `<div class="tm-g">${treemap}</div>`,
      })}
      ${deck("02", "主要贸易伙伴", "Partners", {
        ac: "var(--teal)", fill: "64%", right: "TOP 5",
        body: donut(PARTNERS, num(PARTNERS[0].v), "东盟 出口额"),
      })}
      ${deck("03", "出口月度走势", "Export Trend", {
        ac: "var(--cyan)", fill: "82%", right: pct(prov("exportValue").yoy), bdStyle: "padding:8px 10px 6px",
        body: lineChart({
          series: [{ values: prov("exportValue").values, color: "var(--cyan)" }],
          labels: D.months, w: 260, h: 150,
        }),
      })}
    </div>
    ${stage("04", "浙江省 · 出口空间分布", "Export Spatial", "exportValue")}
    <div class="rail" style="grid-template-rows:1fr .84fr .82fr">
      ${deck("05", "地市出口排名", "City Ranking", {
        ac: "var(--cyan)", fill: "82%", right: big(P.exportValue), bdStyle: "gap:0;padding:4px 13px 8px",
        body: rankRows("exportValue", "亿元", 8, (c) => expColor(c.name)),
      })}
      ${deck("06", "进出口双线对比", "Export vs Import", {
        ac: "var(--violet)", fill: "70%", right: "形状反相", bdStyle: "padding:8px 10px 6px",
        body: lineChart({
          series: [
            { name: "出口", values: prov("exportValue").values, color: "var(--cyan)" },
            { name: "进口", values: prov("importValue").values, color: "var(--indigo)" },
          ],
          labels: D.months, w: 300, h: 158,
        }),
      })}
      ${deck("07", "年度贸易差额", "Trade Balance", {
        ac: "var(--gold)", fill: "58%", right: "年度", bdStyle: "gap:0;padding:4px 13px 8px",
        body: diverging("exportValue", 6),
      })}
    </div>
  </div>
  <div class="bot" style="grid-template-columns:repeat(11,1fr)">${sparkWall("exportValue")}</div>`,
  );
};

/* ══════════════ 屏 1 · 智慧城市数据大脑 ══════════════ */
const S1 = () => {
  const densityOf = (n) => (D.cities[n].population * 1e4) / D.cities[n].area;
  const perCap = (n) => wan(D.cities[n].gdp / (D.cities[n].population * 1e4)); // 元/人 → 万元/人
  const pts = CITIES.map((c) => ({
    n: c.short, x: densityOf(c.name), y: perCap(c.name), r: c.population, // 半径 = 人口
    c: ramp(Math.max(0, Math.min(1, (c.score - 55) / 40))),
  }));

  /* 单位 GDP 能耗的目标达成率 —— 按能耗强度排布，设计出红黄绿分布 */
  const inten = CITIES.map((c) => ({
    n: c.short,
    e: (c.energy * 1e8) / c.gdp,
  }))
    .map((x, i, a) => {
      const rank = [...a].sort((p, q) => p.e - q.e).findIndex((z) => z.n === x.n);
      const p = Math.round(104 - (rank / (a.length - 1)) * 34); // 92~104
      return { n: x.n, p, tone: p >= 100 ? "good" : p >= 97 ? "warn" : "crit" };
    })
    .sort((a, b) => b.p - a.p);

  return page(
    "Kobin · 浙江智慧城市数据大脑",
    `${topRow(
      hero("GDP · Zhejiang", yi(P.gdp).replace(/[万亿]/g, ""), "亿元", prov("gdp").yoy, { values: prov("gdp").values, color: "url(#g0)" }),
      [
        kpi("常住人口", num(P.population), "万人", prov("population").yoy, "population", "cyan"),
        kpi("人口密度", num(DENSITY), "人/km²", 0.8, "population", "indigo"),
        kpi("规上企业", num(P.enterprises), "家", prov("enterprises").yoy, "enterprises", "teal"),
        kpi("单位GDP能耗", ENERGY_INT.toFixed(2), "吨标煤/万元", -2.4, "energy", "amber"),
        kpi("综合活跃度", String(P.score), "/ 100", 1.3, "gdp", "violet"),
      ],
      "11 地市 · 24 月 · 演示数据",
    )}
  <div class="mid" style="grid-template-columns:344px 1fr 384px;height:976px;margin-top:12px">
    <div class="rail" style="grid-template-rows:1.12fr .88fr">
      ${deck("01", "人均产出 × 人口密度", "Productivity Matrix", {
        ac: "var(--indigo)", fill: "78%", right: "11 市分布", bdStyle: "padding:8px 10px 4px",
        body: scatter({ pts, w: 320, h: 452, xlab: "人口密度（人/km²）", ylab: "人均 GDP（万元）" }),
      })}
      ${deck("02", "单位 GDP 能耗达成", "Energy Intensity", {
        ac: "var(--amber)", fill: "88%", right: `${inten.filter((x) => x.p >= 100).length} / 11 达标`,
        rightCls: "pl-v", rightStyle: 'style="--ac:var(--amber)"',
        bdStyle: "gap:0;padding:6px 13px", body: bullets(inten, ""),
      })}
    </div>
    ${stage("03", "浙江省 · 城市运行态势", "City Operations", "score", "悬停高亮 · 点击下钻")}
    <div class="rail" style="grid-template-rows:.8fr 1.02fr 1.2fr">
      ${deck("04", "GDP 月度走势", "GDP Trend", {
        ac: "var(--cyan)", fill: "76%", right: pct(prov("gdp").yoy), bdStyle: "padding:8px 10px 6px",
        body: lineChart({ series: [{ values: prov("gdp").values, color: "var(--cyan)" }], labels: D.months, w: 340, h: 148 }),
      })}
      ${deck("05", "GDP × 人口 双线", "GDP vs Population", {
        ac: "var(--violet)", fill: "72%", right: "形状不同", bdStyle: "padding:8px 10px 6px",
        body: lineChart({
          series: [
            { name: "GDP", values: prov("gdp").values, color: "var(--cyan)" },
            { name: "人口", values: prov("population").values, color: "var(--amber)" },
          ],
          labels: D.months, w: 340, h: 190, index: true,
        }),
      })}
      ${deck("06", "实时感知事件", "Live Feed", {
        ac: "var(--gold)", fill: "91%", right: "LIVE", rightCls: "pl-v", rightStyle: 'style="--ac:var(--gold)"',
        bdStyle: "gap:0;padding:4px 13px 8px",
        body: `<div class="fd">${EVENTS.map((e) => `<div class="fd-r">
      <span class="fd-t num">${e.t}</span><i class="fd-d ${e.s}"></i>
      <span class="fd-c">${e.c}</span><span class="fd-k num">${e.k}</span><span class="fd-v">${e.v}</span></div>`).join("")}</div>`,
      })}
    </div>
  </div>`,
  );
};

/* ══════════════ 屏 2 · 电力全景感知 ══════════════ */
const S2 = () => {
  const power12 = prov("power").values.slice(-12);
  const labels12 = D.months.slice(-12);
  const pv = power12.map((v) => +((v - Math.min(...power12)) / (Math.max(...power12) - Math.min(...power12)) * 100).toFixed(1));
  const peakMax = Math.max(...pv);
  const outColor = heatOf("faults");

  return page(
    "Kobin · 浙江电力全景感知平台",
    `${topRow(
      hero("POWER · Zhejiang", big(P.power), "亿kWh", prov("power").yoy, { values: prov("power").values, color: "url(#g0)" }),
      [
        kpi("发电量", num(P.output), "亿kWh", prov("output").yoy, "output", "cyan"),
        kpi("峰谷差", PEAK.toFixed(0), "亿kWh", -3.1, "power", "indigo"),
        kpi("装机设备", num(P.enterprises * 12), "台", 1.8, "output", "teal"),
        kpi("设备故障", num(P.faults), "次", prov("faults").yoy, "faults", "amber"),
        kpi("告警记录", num(P.penalties), "条", prov("faults").yoy, "faults", "violet"),
      ],
      "11 地市 · 24 月 · 演示数据",
    )}
  <div class="mid" style="grid-template-columns:360px 1fr 300px;height:834px;margin-top:12px">
    <div class="rail" style="grid-template-rows:1fr .78fr 1.06fr 1fr">
      ${deck("01", "全社会用电负荷", "Power Load", {
        ac: "var(--cyan)", fill: "82%", right: pct(prov("power").yoy), bdStyle: "padding:8px 10px 6px",
        body: lineChart({ series: [{ values: prov("power").values, color: "var(--cyan)" }], labels: D.months, w: 330, h: 132 }),
      })}
      ${deck("02", "月度峰谷差", "Peak–Valley Spread", {
        ac: "var(--amber)", fill: "74%", right: `峰值 ${peakMax}%`, bdStyle: "padding:8px 10px 6px",
        body: columnChart({ values: pv, labels: labels12, color: "var(--amber)", w: 330, h: 108, highlight: pv.indexOf(peakMax) }),
      })}
      ${deck("03", "地市供电缺口", "Supply Gap", {
        ac: "var(--magenta)", fill: "61%", right: "月 × 市", bdStyle: "gap:6px;padding:8px 12px 10px",
        body: heatMatrix({
          rows: CITIES.map((c) => c.short).slice(0, 8),
          cols: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
          labels: labels12,
          value: (r, j) => {
            const c = CITIES.find((x) => x.short === r);
            const s = c.series.power.values;
            const prev = j === 0 ? s[11] : s[11 + j];
            return c.series.output.values[12 + j] - s[12 + j];
          },
        }),
      })}
      ${deck("04", "设备故障排名", "Fault Ranking", {
        ac: "var(--violet)", fill: "68%", right: "次", bdStyle: "gap:0;padding:4px 13px 8px",
        body: rankRows("faults", "次", 6, (c) => outColor(c.name)),
      })}
    </div>
    ${stage("05", "浙江省 · 负荷空间分布", "Load Spatial", "power")}
    <div class="rail" style="grid-template-rows:1.14fr .86fr">
      ${deck("06", "发电量 × 用电量", "Generation vs Demand", {
        ac: "var(--violet)", fill: "72%", right: "形状不同", bdStyle: "padding:8px 10px 6px",
        body: lineChart({
          series: [
            { name: "用电", values: prov("power").values, color: "var(--cyan)" },
            { name: "发电", values: prov("output").values, color: "var(--amber)" },
          ],
          labels: D.months, w: 262, h: 190, index: true,
        }),
      })}
      ${deck("07", "电网实时告警", "Grid Alarms", {
        ac: "var(--gold)", fill: "91%", right: "LIVE", rightCls: "pl-v", rightStyle: 'style="--ac:var(--gold)"',
        bdStyle: "gap:0;padding:4px 13px 8px",
        body: `<div class="fd">${ALARMS.map((a) => `<div class="al-r">
      <i class="al-g ${a.g}"></i><span class="al-c">${a.c}</span>
      <span class="al-d">${a.d}</span><span class="al-t">${a.ts}</span></div>`).join("")}</div>`,
      })}
    </div>
  </div>
  <div class="bot" style="grid-template-columns:repeat(11,1fr)">${sparkWall("power")}</div>`,
  );
};

/* ── 输出 ── */
const screens = [
  ["s0-trade.html", S0],
  ["s1-city.html", S1],
  ["s2-power.html", S2],
];
for (const [file, fn] of screens) {
  const html = fn();
  writeFileSync(OUT + file, html);
  console.log(`✓ mockup/${file}  ${(html.length / 1024).toFixed(0)}KB`);
}
console.log(`\n数据 ${CITIES.length} 市 · ${Object.keys(D.metrics).length} 指标 · ${D.months.length} 月（全部真实导出）`);
console.log(`派生  顺差 ${num(SURPLUS)} 亿 · 依存度 ${DEPEND.toFixed(1)}% · 密度 ${num(DENSITY)} 人/km² · 峰谷差 ${PEAK.toFixed(0)} 亿kWh`);