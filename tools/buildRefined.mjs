/**
 * 面板视觉语言升级稿 —— 借鉴参考图的仪表语言，落到地图主导的版式上。
 *
 *   node tools/buildRefined.mjs
 *
 * 输出 mockup/refined-panels.html（1920×1080 固定舞台）
 *
 * 借鉴：图标化 KPI · 标题竖条+图标 · 行式模块图标 · 状态 pill
 *       右侧图例列表 · 柱线双 Y 轴 · 更明确的亮蓝边框
 * 不借鉴：中心换成 3D 孪生场景（我们的中心是地图，是产品核心）
 */
import { writeFileSync } from "node:fs";
import { D, CITIES, prov, num, big, yi, pct, cls, ramp, heatOf, by, REGIONS, VW, VH, pj } from "./lib/screens-lib.mjs";

const P = D.province;
const OUT = new URL("../mockup/", import.meta.url).pathname;

/* ══════════════ 语义图标集（24×24 线性） ══════════════ */
const ICONS = {
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 14l4-4"/><circle cx="12" cy="18" r="1.6"/>',
  building: '<path d="M4 21V7l7-4v18"/><path d="M11 21V10l9 3v8"/><path d="M2 21h20"/><path d="M7 10h1M7 14h1M7 18h1M15 14h1M15 18h1"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.5A6 6 0 0 1 21 20"/>',
  warn: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.4l3.4 2"/>',
  pin: '<path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  swap: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19c2-5 5-8 9-10"/>',
};
const icon = (n, size = 16, cls = "") =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;

const pill = (text, tone) => `<i class="pl-tag ${tone}">${text}</i>`;

/* ══════════════ 派生 ══════════════ */
const powerY = prov("power").values.slice(-12);
const PEAK = (Math.max(...powerY) - Math.min(...powerY)).toFixed(0);
const ENERGY_INT = ((P.energy * 1e8) / P.gdp).toFixed(2);
const SURPLUS = P.exportValue - P.importValue;
const DENSITY = Math.round((P.population * 1e4) / P.area);
const FAULTS = by("faults");
const OUT_M = Object.values(D.cities).reduce((a, m) => Math.max(a, m.series.output.values.at(-1) - m.series.power.values.at(-1)), 0);

/* ══════════════ 组件 ══════════════ */

/** 面板：标题左侧亮色竖条 + 图标 */
function dk(ic, title, en, opts = {}) {
  return `<section class="dk" style="--ac:${opts.ac || "var(--cyan)"}">
  <header class="hd"><i class="hd-bar"></i>${icon(ic, 14, "hd-ic")}<h3>${title}</h3><span class="hd-en">${en}</span>
    ${opts.right ? `<span class="hd-r">${opts.right}</span>` : ""}</header>
  <div class="bd" style="${opts.bdStyle || ""}">${opts.body || ""}</div>
</section>`;
}

/** KPI：图标 + 数字 + 语义色 */
const kpi = (ic, label, value, unit, delta, tone) => `<div class="kpi ${tone || ""}">
  <i class="kpi-ic">${icon(ic, 17)}</i>
  <div class="kpi-b"><span class="kpi-k">${label}</span>
    <div class="kpi-v num">${value}${unit ? `<u>${unit}</u>` : ""}</div></div>
  <span class="kpi-d num ${(delta || "").startsWith("-") || (delta || "").startsWith("−") ? "dn" : "up"}">${delta || ""}</span>
</div>`;

/** 行式计量：图标 + 名称 + 条 + 百分比 */
const gaugeRows = (items) =>
  items
    .map(
      (it) => `<div class="gr">
    <i class="gr-ic" style="color:${it.c}">${icon(it.ic, 13)}</i>
    <span class="gr-n">${it.n}</span>
    <span class="gr-t"><i style="width:${it.p}%;background:linear-gradient(90deg,${it.c},color-mix(in oklab,${it.c} 45%,transparent))"></i><s></s></span>
    <span class="gr-v num" style="color:${it.c}">${it.p}%</span>
  </div>`,
    )
    .join("");

/** 环形 + 右侧图例列表（数值与占比右对齐） */
function ring(items, centerV, centerL) {
  const total = items.reduce((a, b) => a + b.v, 0);
  const R = 40, r = 26;
  let a0 = -Math.PI / 2;
  const arcs = items
    .map((it) => {
      const a1 = a0 + (it.v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = `M${(50 + R * Math.cos(a0)).toFixed(2)} ${(50 + R * Math.sin(a0)).toFixed(2)}A${R} ${R} 0 ${big} 1 ${(50 + R * Math.cos(a1)).toFixed(2)} ${(50 + R * Math.sin(a1)).toFixed(2)}L${(50 + r * Math.cos(a1)).toFixed(2)} ${(50 + r * Math.sin(a1)).toFixed(2)}A${r} ${r} 0 ${big} 0 ${(50 + r * Math.cos(a0)).toFixed(2)} ${(50 + r * Math.sin(a0)).toFixed(2)}Z`;
      a0 = a1;
      return `<path d="${p}" fill="${it.c}"/>`;
    })
    .join("");
  return `<div class="rg-wrap">
  <div class="rg-ring"><svg viewBox="0 0 100 100">${arcs}</svg>
    <div class="rg-c"><b class="num">${centerV}</b><span>${centerL}</span></div></div>
  <ul class="rg-lg">${items
    .map((it) => `<li><i style="background:${it.c}"></i><span>${it.n}</span><b class="num">${num(it.v)}</b><em class="num">${((it.v / total) * 100).toFixed(1)}%</em></li>`)
    .join("")}</ul>
</div>`;
}

/** 柱 + 线 双 Y 轴（量级不同各走一轴） */
function dualAxis({ bars, lines, bl, ll, w = 560, h = 150 }) {
  const padL = 42, padR = 44, padT = 18, padB = 20;
  const bMax = Math.max(...bars) * 1.15;
  const lMax = Math.max(...lines) * 1.15;
  const n = bars.length;
  const bw = (w - padL - padR) / n;
  const X = (i) => padL + i * bw + bw / 2;
  const YB = (v) => h - padB - (v / bMax) * (h - padT - padB);
  const YL = (v) => h - padB - (v / lMax) * (h - padT - padB);
  let grid = "";
  for (let t = 0; t <= 3; t++) {
    const y = (padT + ((h - padT - padB) * t) / 3).toFixed(1);
    grid += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(122,160,220,.09)"/>`;
  }
  let ax = "";
  for (let t = 0; t <= 3; t++) {
    const y = (padT + ((h - padT - padB) * t) / 3 + 3).toFixed(1);
    ax += `<text x="${padL - 5}" y="${y}" fill="#6B7FA0" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${num(Math.round((bMax * (3 - t)) / 3))}</text>`;
    ax += `<text x="${w - padR + 5}" y="${y}" fill="#6B7FA0" font-size="8.5" font-family="ui-monospace,monospace">${num(Math.round((lMax * (3 - t)) / 3))}</text>`;
  }
  const bx = bars
    .map((v, i) => `<rect x="${(X(i) - bw * 0.28).toFixed(1)}" y="${YB(v).toFixed(1)}" width="${(bw * 0.56).toFixed(1)}" height="${Math.max(1, h - padB - YB(v)).toFixed(1)}" fill="#2E9BFF" opacity=".8" rx="1"/>`)
    .join("");
  const pts = lines.map((v, i) => `${X(i).toFixed(1)},${YL(v).toFixed(1)}`).join("L");
  const xl = bl.map((l, i) => (i % 2 ? "" : `<text x="${X(i).toFixed(1)}" y="${h - 5}" fill="#6B7FA0" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${l}</text>`)).join("");
  /* 图例放顶部：放底部会压在柱子上 */
  const lg = `<g font-size="9">
    <rect x="${padL}" y="2" width="9" height="2.5" fill="#2E9BFF"/><text x="${padL + 13}" y="6" fill="#9DB2D0">${ll[0]}</text>
    <circle cx="${padL + 148}" cy="3" r="2.6" fill="#2FE6A8"/><text x="${padL + 155}" y="6" fill="#9DB2D0">${ll[1]}</text></g>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="cv">${grid}${ax}${bx}
    <path d="M${pts}" fill="none" stroke="#2FE6A8" stroke-width="1.8" stroke-linejoin="round"/>
    ${lines.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${YL(v).toFixed(1)}" r="2.4" fill="#2FE6A8"/>`).join("")}
    ${xl}${lg}</svg>`;
}

/** 24 月走势（指数化 + 端点 + 峰值） */
function trend(key, color) {
  const v = prov(key).values;
  const n = v.length;
  const mn = Math.min(...v) * 0.97, mx = Math.max(...v) * 1.03;
  const w = 300, h = 150, pT = 10, pB = 18, pL = 40, pR = 30;
  const X = (i) => pL + (i / (n - 1)) * (w - pL - pR);
  const Y = (x) => h - pB - ((x - mn) / (mx - mn)) * (h - pT - pB);
  const pk = v.indexOf(Math.max(...v));
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="cv">
    ${[0, 1, 2, 3].map((t) => { const y = (pT + ((h - pT - pB) * t) / 3).toFixed(1);
      return `<line x1="${pL}" y1="${y}" x2="${w - pR}" y2="${y}" stroke="rgba(122,160,220,.09)"/>`; }).join("")}
    <path d="M${v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join("L")}L${X(n - 1).toFixed(1)},${Y(mn).toFixed(1)}L${pL},${Y(mn).toFixed(1)}Z" fill="${color}" opacity=".17"/>
    <path d="M${v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join("L")}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linejoin="round"/>
    <circle cx="${X(pk).toFixed(1)}" cy="${Y(v[pk]).toFixed(1)}" r="3.2" fill="none" stroke="${color}" stroke-width="1"/>
    <circle cx="${X(n - 1).toFixed(1)}" cy="${Y(v.at(-1)).toFixed(1)}" r="2.8" fill="${color}"/>
    <text x="${(X(n - 1) + 5).toFixed(1)}" y="${(Y(v.at(-1)) + 3).toFixed(1)}" fill="${color}" font-size="8.5" font-family="ui-monospace,monospace">${num(Math.round(v.at(-1)))}</text>
    <text x="${X(pk).toFixed(1)}" y="${(Y(v[pk]) - 8).toFixed(1)}" fill="${color}" font-size="8" text-anchor="middle">峰 ${D.months[pk].slice(5)}月</text>
  </svg>`;
}

/** 排名条：序号 + 名称 + 条 + 数值 + 同比 */
function ranks(key, colorOf, n = 8) {
  const rows = by(key).slice(0, n);
  const mx = rows[0].v;
  return `<div class="rows">${rows
    .map((c, i) => {
      const s = c.series[key];
      return `<div class="rk">
    <span class="rk-no${i < 3 ? " m" + (i + 1) : ""}">${i < 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][i] : String(i + 1).padStart(2, "0")}</span>
    <span class="rk-n">${c.short}</span>
    <span class="rk-t"><i style="width:${((c.v / mx) * 100).toFixed(1)}%;background:${colorOf(c.name)}"></i><s style="left:${((c.v / mx) * 100).toFixed(1)}%;background:${colorOf(c.name)}"></s></span>
    <span class="rk-v num">${big(c.v)}</span>
    <span class="rk-d num ${cls(s ? s.yoy : 0)}">${pct(s ? s.yoy : 0)}</span>
  </div>`;
    })
    .join("")}</div>`;
}

/* ══════════════ 地图 ══════════════ */
const heatPower = heatOf("power");
const mapSvg = `<div class="stage-in">
  <div class="mapbox">
    <svg viewBox="0 0 ${VW} ${VH}">${REGIONS.map((r) => `<path class="rg" d="${r.d}" style="fill:${heatPower(r.name)}"/>`).join("")}</svg>
    ${REGIONS.map((r) => {
      const y = D.cities[r.name].series.power.yoy;
      return `<span class="ml" style="left:${r.cx}%;top:${r.cy}%"><b>${r.short}</b><em class="num">${pct(y)}</em></span>`;
    }).join("")}
  </div>
  <svg class="compass" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="rgba(46,155,255,.3)"/><path d="M17 5 L20.5 17 L17 14.6 L13.5 17 Z" fill="#38E1FF"/><text x="17" y="32" fill="#5A6B8C" font-size="7" text-anchor="middle" font-family="monospace">N</text></svg>
  <div class="anno a1"><b>◉</b> 全社会用电 · ${D.provinceShort}</div>
  <div class="anno a2">WEB MERCATOR · EPSG:3857</div>
  <div class="lgd"><span>低</span><span class="ramp"></span><span>高</span><span style="color:#5A6B8C">负荷密度</span></div>
</div>`;

/* ══════════════ 采购建议（借鉴 pill 标签） ══════════════ */
const ADVICE = [
  { ic: "warn", t: "特高压通道（5%）", d: "浙西北走廊 · 负载率 92% 接近阈值", lv: "紧急", tone: "crit" },
  { ic: "warn", t: "主变扩容（3%）", d: "宁波北仑 · N-1 校验不通过", lv: "紧急", tone: "crit" },
  { ic: "gauge", t: "储能配置", d: "温州沿海 · 峰谷差超 3.2 万kW", lv: "高", tone: "warn" },
  { ic: "layers", t: "算力并网", d: "杭州余杭 · 新增负荷 4.6 万kW", lv: "高", tone: "warn" },
  { ic: "leaf", t: "新能源消纳", d: "绍兴镜湖 · 光伏出力波动 18%", lv: "中", tone: "info" },
];

/* ══════════════ 组装 ══════════════ */
const body = `
<div class="titlebar">
  <div class="tb-l"><i class="tb-mark"></i><h1>浙江省电力全景感知平台</h1><span>ZHEJIANG POWER GRID OVERVIEW</span></div>
  <div class="tb-r">数据快照 · ${D.asOf}</div>
</div>

<div class="kpis">
  ${kpi("bolt", "全省发电量", num(P.output), "", pct(prov("output").yoy))}
  ${kpi("gauge", "全社会用电", num(P.power), "", pct(prov("power").yoy))}
  ${kpi("target", "峰谷差", PEAK, "", "▼ -3.1%")}
  ${kpi("warn", "设备故障", num(P.faults), "", pct(prov("faults").yoy), "bad")}
  ${kpi("building", "接入企业", num(P.enterprises), "", pct(prov("enterprises").yoy))}
  ${kpi("clock", "待处理事项", num(P.penalties), "", "▼ -1.0%", "warn")}
</div>

<div class="mid">
  <div class="rail">
    ${dk("layers", "用电构成", "LOAD MIX", {
      ac: "var(--cyan)", right: "TOP 5 + 其他",
      body: `<div class="stack">${(() => {
        const top = by("power").slice(0, 5);
        const rest = P.power - top.reduce((a, c) => a + c.v, 0);
        const cols = ["var(--cyan)", "var(--indigo)", "var(--teal)", "var(--violet)", "var(--amber)"];
        const segs = [...top.map((c, i) => ({ n: c.short, v: c.v, c: cols[i] })), { n: "其他 6 市", v: rest, c: "var(--slate)" }];
        const sum = segs.reduce((a, s) => a + s.v, 0);
        return `<div class="stack-bar">${segs.map((s) => {
          const p = (s.v / sum) * 100;
          return `<i style="width:${p.toFixed(2)}%;background:${s.c}"><b>${p >= 13 ? `${s.n} ${p.toFixed(0)}%` : p >= 8 ? p.toFixed(0) + "%" : ""}</b></i>`;
        }).join("")}</div>
        <ul class="stack-lg">${segs.map((s) => `<li><i style="background:${s.c}"></i><span>${s.n}</span><b class="num">${num(s.v)}</b><em class="num">${((s.v / P.power) * 100).toFixed(1)}%</em></li>`).join("")}</ul>
        <div class="stack-k"><div><b class="num">${((top.reduce((a, c) => a + c.v, 0) / P.power) * 100).toFixed(1)}%</b><span>CR5 集中度</span></div><div><b class="num">${ENERGY_INT}</b><span>吨标煤/万元</span></div></div>`;
      })()}</div>`,
    })}
    ${dk("trend", "用电量月度走势", "CONSUMPTION TREND", {
      ac: "var(--cyan)", right: `同比 ${pct(prov("power").yoy)}`, bdStyle: "padding:6px 10px 8px",
      body: trend("power", "var(--cyan)"),
    })}
    ${dk("swap", "供电缺口", "SUPPLY GAP", {
      ac: "var(--amber)", right: "月 × 市", bdStyle: "padding:6px 12px 8px",
      body: (() => {
        const rows = by("power").slice(0, 7);
        const cols = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
        return `<div class="hm"><div class="hm-h"><span></span><div class="cells" style="grid-template-columns:repeat(12,1fr)">${cols.map((c) => `<span>${c}</span>`).join("")}</div></div>
        ${rows.map((c) => {
          const g = c.series.output.values, p = c.series.power.values;
          const vs = cols.map((_, j) => g[12 + j] - p[12 + j]);
          const mn = Math.min(...vs), mx = Math.max(...vs);
          return `<div class="hm-r"><span class="hm-n">${c.short}</span><div class="cells" style="grid-template-columns:repeat(12,1fr)">
          ${vs.map((x) => `<i style="background:${ramp(0.18 + ((x - mn) / (mx - mn || 1)) * 0.8)}"></i>`).join("")}</div></div>`;
        }).join("")}</div>`;
      })(),
    })}
  </div>

  <div class="dk center" style="--ac:var(--cyan)">
    <header class="hd"><i class="hd-bar"></i>${icon("pin", 14, "hd-ic")}<h3>浙江省 · 负荷空间分布</h3><span class="hd-en">LOAD SPATIAL</span>
      <span class="hd-r">悬停高亮 · 点击下钻</span></header>
    <div class="bd" style="padding:0">${mapSvg}</div>
  </div>

  <div class="rail">
    ${dk("gauge", "资源水位", "RESOURCE LEVEL", {
      ac: "var(--teal)", right: "6 项",
      body: gaugeRows([
        { ic: "bolt", n: "发电裕度", p: 87, c: "var(--cyan)" },
        { ic: "gauge", n: "输电负载", p: 94, c: "var(--amber)" },
        { ic: "layers", n: "变电容量", p: 82, c: "var(--cyan)" },
        { ic: "trend", n: "需求响应", p: 71, c: "var(--indigo)" },
        { ic: "leaf", n: "绿电消纳", p: 63, c: "var(--teal)" },
        { ic: "target", n: "储能配比", p: 58, c: "var(--indigo)" },
      ]),
    })}
    ${dk("warn", "扩容采购建议", "ADVICE", {
      ac: "var(--magenta)", right: pill("5 项", "crit"),
      body: `<div class="adv">${ADVICE.map((a) => `<div class="adv-r">
        <i class="adv-ic ${a.tone}">${icon(a.ic, 12)}</i>
        <div class="adv-b"><b>${a.t}</b><span>${a.d}</span></div>
        ${pill(a.lv, a.tone)}</div>`).join("")}</div>`,
    })}
    ${dk("warn", "设备故障排名", "FAULT RANKING", {
      ac: "var(--violet)", right: `${num(P.faults)} 次`,
      body: ranks("faults", heatOf("faults"), 6),
    })}
  </div>
</div>

<div class="bot">
  ${dk("layers", "品牌 / 平台分布", "PLATFORM MIX", {
    ac: "var(--indigo)", bdStyle: "padding:8px 12px 10px",
    body: (() => {
      const rows = by("enterprises").slice(0, 5);
      const mx = rows[0].v;
      return `<div class="rows tight">${rows.map((c) => `<div class="bk">
      <span class="bk-n">${c.short}</span>
      <span class="bk-t"><i style="width:${((c.v / mx) * 100).toFixed(1)}%;background:var(--indigo)"></i></span>
      <span class="bk-v num">${num(c.v)}</span></div>`).join("")}</div>`;
    })(),
  })}
  ${dk("trend", "用电 × 故障 双轴", "DUAL AXIS", {
    ac: "var(--teal)", bdStyle: "padding:6px 10px 8px",
    body: dualAxis({
      bars: prov("power").values,
      lines: prov("faults").values,
      bl: D.months.map((m) => m.slice(5) + "月"),
      ll: ["全社会用电 亿kWh", "设备故障 次"],
      w: 460, h: 132,
    }),
  })}
  ${dk("target", "运行状态分布", "STATUS MIX", {
    ac: "var(--teal)", bdStyle: "padding:6px 12px 8px",
    body: ring(
      [
        { n: "正常", v: Math.round(P.power * 0.773), c: "var(--teal)" },
        { n: "预警", v: Math.round(P.power * 0.142), c: "var(--amber)" },
        { n: "异常", v: Math.round(P.power * 0.085), c: "var(--magenta)" },
      ],
      num(P.power),
      "亿千瓦时",
    ),
  })}
  ${dk("building", "企业规模分布", "ENTERPRISE", {
    ac: "var(--cyan)", bdStyle: "padding:6px 12px 8px",
    body: ring(
      by("enterprises").slice(0, 5).map((c, i) => ({
        n: c.short,
        v: c.enterprises,
        c: ["var(--cyan)", "var(--indigo)", "var(--teal)", "var(--violet)", "var(--amber)"][i],
      })),
      num(P.enterprises),
      "规上企业",
    ),
  })}
</div>`;

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kobin · 电力全景感知（面板语言升级）</title><style>
:root{
  --bg:#03060E;--surf:rgba(11,19,36,.82);--surf2:rgba(16,27,48,.88);
  --line:rgba(46,155,255,.26);--line2:rgba(46,155,255,.5);
  --t1:#EAF2FF;--t2:#A8BEDD;--t3:#6B82A8;--t4:#44587A;
  --cyan:#38E1FF;--blue:#2E9BFF;--indigo:#7C8FFF;--teal:#2FE6A8;--amber:#FFB23F;
  --magenta:#FF5C8A;--gold:#FFD166;--violet:#B58CFF;--slate:#46587A;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;
  --sans:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;--r:4px;
  --ease:cubic-bezier(.4,0,.2,1);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);color:var(--t1);background:var(--bg);display:grid;place-items:center;
  min-height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.up{color:var(--teal)}.dn{color:var(--magenta)}
#fit{width:1920px;height:1080px;transform-origin:center;position:relative;z-index:1}
.ic{display:block;flex:none}
.cv{width:100%;height:100%;display:block}

/* 标题栏 */
.titlebar{height:36px;display:flex;align-items:center;justify-content:space-between;
  padding:0 14px;border-bottom:1px solid var(--line);position:relative}
.titlebar::after{content:'';position:absolute;left:14px;right:14px;bottom:-1px;height:1px;
  background:linear-gradient(90deg,transparent,var(--blue),transparent)}
.tb-l{display:flex;align-items:center;gap:10px}
.tb-mark{width:4px;height:17px;background:linear-gradient(180deg,var(--cyan),var(--blue));border-radius:1px;
  box-shadow:0 0 10px var(--blue)}
.tb-l h1{font-size:16px;font-weight:700;letter-spacing:.02em}
.tb-l span{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--t3)}
.tb-r{font-family:var(--mono);font-size:10px;color:var(--t2);
  padding:3px 11px;border:1px solid var(--line);border-radius:3px;background:rgba(46,155,255,.07)}

/* KPI：图标化 */
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;height:78px;margin-top:10px}
.kpi{position:relative;display:flex;align-items:center;gap:11px;padding:0 13px;overflow:hidden;
  background:linear-gradient(150deg,rgba(46,155,255,.1),var(--surf));
  border:1px solid var(--line);border-radius:var(--r);backdrop-filter:blur(14px)}
.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--blue)}
.kpi-ic{width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:6px;color:var(--blue);
  background:radial-gradient(circle at 35% 30%,rgba(46,155,255,.34),rgba(46,155,255,.09));
  border:1px solid rgba(46,155,255,.3);box-shadow:inset 0 0 12px rgba(46,155,255,.2)}
.kpi-b{display:flex;flex-direction:column;gap:3px;min-width:0}
.kpi-k{font-size:10.5px;color:var(--t2);white-space:nowrap}
.kpi-v{font-size:23px;font-weight:700;line-height:1;display:flex;align-items:baseline;gap:3px}
.kpi-v u{font-size:10px;font-style:normal;text-decoration:none;color:var(--t3);font-weight:400}
.kpi-d{position:absolute;right:12px;top:11px;font-size:9.5px}
.kpi.bad .kpi-ic{color:var(--magenta);background:radial-gradient(circle at 35% 30%,rgba(255,92,138,.34),rgba(255,92,138,.08));
  border-color:rgba(255,92,138,.32);box-shadow:inset 0 0 12px rgba(255,92,138,.2)}
.kpi.bad .kpi-v{color:var(--magenta)}
.kpi.bad::before{background:var(--magenta)}
.kpi.warn .kpi-ic{color:var(--amber);background:radial-gradient(circle at 35% 30%,rgba(255,178,63,.32),rgba(255,178,63,.08));
  border-color:rgba(255,178,63,.3);box-shadow:inset 0 0 12px rgba(255,178,63,.18)}
.kpi.warn::before{background:var(--amber)}

/* 主体 */
/* grid-template-rows 必须显式写：隐式行是 auto，min-content 超过容器高时不会收缩 */
.mid{display:grid;grid-template-columns:320px 1fr 348px;grid-template-rows:minmax(0,1fr);gap:12px;height:732px;margin-top:12px}
.rail{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:12px;min-height:0}
.dk{position:relative;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  background:linear-gradient(168deg,var(--surf2),var(--surf));border:1px solid var(--line);
  border-radius:var(--r);backdrop-filter:blur(16px) saturate(1.2)}
.dk::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--ac),transparent 72%);opacity:.8}
.hd{flex:none;display:flex;align-items:center;gap:8px;padding:9px 12px 8px;border-bottom:1px solid var(--line)}
.hd-bar{width:3px;height:13px;border-radius:1px;background:var(--ac);box-shadow:0 0 7px var(--ac)}
.hd-ic{color:var(--ac);opacity:.9}
.hd h3{font-size:13px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.hd-en{font-family:var(--mono);font-size:8.5px;letter-spacing:.15em;color:var(--t4);text-transform:uppercase;white-space:nowrap}
.hd-r{margin-left:auto;font-family:var(--mono);font-size:9.5px;color:var(--t2);display:flex;align-items:center;gap:6px;white-space:nowrap}
.bd{flex:1;min-height:0;padding:10px 13px 12px;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.rows{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.rows.tight{justify-content:flex-start;gap:5px}

/* 行式计量（借鉴「图标+名称+条+百分比」） */
.gr{display:grid;grid-template-columns:16px 56px 1fr 34px;align-items:center;gap:8px;padding:3px 0;font-size:11px;
  border-bottom:1px solid rgba(46,155,255,.07)}
.gr-ic{opacity:.85;display:flex}
.gr-n{color:var(--t2);white-space:nowrap}
.gr-t{height:6px;background:rgba(46,155,255,.11);border-radius:3px;position:relative;overflow:hidden}
.gr-t i{position:absolute;inset:0 auto 0 0;border-radius:3px}
.gr-t s{position:absolute;top:-2px;right:0;width:3px;height:10px;border-radius:1px;background:#fff;opacity:.85}
.gr-v{text-align:right;font-size:11px}

/* pill 标签 */
.pl-tag{font-style:normal;font-family:var(--mono);font-size:9px;font-weight:600;padding:2px 7px;border-radius:2px;white-space:nowrap}
.pl-tag.crit{color:#fff;background:var(--magenta);box-shadow:0 0 9px -2px var(--magenta)}
.pl-tag.warn{color:#2A1B04;background:var(--amber)}
.pl-tag.info{color:#04211A;background:var(--teal)}

/* 建议列表 */
.adv{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.adv-r{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:9px;padding:3px 0;
  border-bottom:1px solid rgba(46,155,255,.07)}
.adv-ic{width:18px;height:18px;border-radius:4px;display:grid;place-items:center;flex:none}
.adv-ic.crit{color:var(--magenta);background:rgba(255,92,138,.14);border:1px solid rgba(255,92,138,.34)}
.adv-ic.warn{color:var(--amber);background:rgba(255,178,63,.13);border:1px solid rgba(255,178,63,.3)}
.adv-ic.info{color:var(--teal);background:rgba(47,230,168,.12);border:1px solid rgba(47,230,168,.28)}
.adv-b{min-width:0;display:flex;flex-direction:column;gap:1px}
.adv-b b{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adv-b span{font-size:9.5px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* 排名条 */
.rk{display:grid;grid-template-columns:24px 42px 1fr 52px 44px;align-items:center;gap:7px;padding:4.5px 0;
  border-bottom:1px solid rgba(46,155,255,.06);font-size:11px}
.rk-no{font-family:var(--mono);font-size:9px;color:var(--t3);text-align:center;border:1px solid var(--line);
  border-radius:2px;line-height:14px;height:15px}
.rk-no.m1{color:#2A1B04;background:var(--gold);border-color:var(--gold)}
.rk-no.m2{color:#0E1620;background:#C8D6E8;border-color:#C8D6E8}
.rk-no.m3{color:#2A1206;background:#D8955C;border-color:#D8955C}
.rk-n{color:var(--t2);white-space:nowrap}
.rk-t{height:6px;background:rgba(46,155,255,.1);border-radius:3px;position:relative}
.rk-t i{position:absolute;inset:0 auto 0 0;border-radius:3px}
.rk-t s{position:absolute;top:-2px;width:3px;height:10px;border-radius:1px;transform:translateX(-1.5px)}
.rk-v{text-align:right;font-size:11px}
.rk-d{text-align:right;font-size:9px}

/* 堆叠构成 */
.stack{flex:1;min-height:0;display:flex;flex-direction:column;gap:9px}
.stack-bar{height:32px;flex:none;display:flex;border-radius:3px;overflow:hidden}
.stack-bar i{position:relative;display:grid;place-items:center;border-right:1px solid rgba(3,6,14,.55)}
.stack-bar i:last-child{border-right:0}
.stack-bar i b{font-family:var(--mono);font-size:9px;color:#03101A;font-weight:700;white-space:nowrap}
.stack-lg{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.stack-lg li{display:grid;grid-template-columns:8px 1fr 54px 44px;align-items:center;gap:8px;font-size:10.5px;
  list-style:none;padding:2px 0;border-bottom:1px solid rgba(46,155,255,.06)}
.stack-lg i{width:8px;height:8px;border-radius:2px}
.stack-lg span{color:var(--t2)}
.stack-lg b{text-align:right;font-size:10.5px;font-weight:500}
.stack-lg em{text-align:right;font-style:normal;color:var(--t3);font-size:10px}
.stack-k{display:flex;gap:20px;flex:none;padding-top:8px;border-top:1px solid var(--line)}
.stack-k div{display:flex;flex-direction:column;gap:1px}
.stack-k b{font-size:17px;font-weight:700;line-height:1.1}
.stack-k span{font-size:9px;color:var(--t3)}

/* 环形 + 右侧图例 */
.rg-wrap{flex:1;min-height:0;display:grid;grid-template-columns:118px 1fr;gap:11px;align-items:center}
.rg-ring{position:relative;height:100%;display:grid;place-items:center}
.rg-ring svg{width:100%;height:100%;max-height:100%}
.rg-c{position:absolute;text-align:center;pointer-events:none}
.rg-c b{display:block;font-size:18px;font-weight:700;line-height:1.15}
.rg-c span{font-size:8.5px;color:var(--t3)}
.rg-lg{display:flex;flex-direction:column;gap:2px}
.rg-lg li{display:grid;grid-template-columns:8px 1fr auto auto;align-items:center;gap:7px;font-size:10px;list-style:none}
.rg-lg i{width:8px;height:8px;border-radius:2px}
.rg-lg span{color:var(--t2);white-space:nowrap}
.rg-lg b{font-size:10px;font-weight:500}
.rg-lg em{font-style:normal;color:var(--t3);font-size:9.5px;min-width:38px;text-align:right}

/* 热力 */
.hm{flex:1;min-height:0;display:flex;flex-direction:column;gap:3px}
.hm-h{display:grid;grid-template-columns:36px 1fr;gap:3px;height:12px;flex:none}
.hm-h .cells{display:grid;gap:3px}
.hm-h .cells span{font-size:8px;color:var(--t4);text-align:center;font-family:var(--mono)}
.hm-r{display:grid;grid-template-columns:36px 1fr;gap:3px;flex:1;min-height:0}
.hm-n{font-size:9.5px;color:var(--t3);display:flex;align-items:center}
.hm-r .cells{display:grid;gap:3px;min-height:0}
.hm-r i{border-radius:1px;min-height:0}

/* 横向条（底部小图） */
.bk{display:grid;grid-template-columns:44px 1fr 50px;align-items:center;gap:8px;font-size:10.5px}
.bk-n{color:var(--t2);white-space:nowrap}
.bk-t{height:6px;background:rgba(46,155,255,.1);border-radius:3px;position:relative;overflow:hidden}
.bk-t i{position:absolute;inset:0 auto 0 0;border-radius:3px}
.bk-v{text-align:right;font-size:10.5px}

/* 底栏 */
.bot{display:grid;grid-template-columns:1fr 1.55fr 1.1fr 1.1fr;gap:12px;height:200px;margin-top:12px}

/* 地图 */
.center .bd{padding:0}
.stage-in{position:relative;flex:1;min-height:0;display:grid;place-items:center}
.mapbox{position:relative;height:100%;aspect-ratio:${VW} / ${VH};
  filter:drop-shadow(0 16px 40px rgba(0,0,0,.6)) drop-shadow(0 0 54px rgba(46,155,255,.12))}
.mapbox svg{width:100%;height:100%;overflow:visible}
.rg{stroke:rgba(190,225,255,.36);stroke-width:.7;stroke-linejoin:round;cursor:pointer;
  transition:stroke .2s,filter .2s}
.rg:hover{stroke:#fff;stroke-width:1.6;filter:brightness(1.2)}
.ml{position:absolute;transform:translate(-50%,-50%);text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap}
.ml b{font-size:12px;font-weight:600;text-shadow:0 0 3px #03060E,0 0 6px #03060E,0 0 10px #03060E,0 1px 2px #03060E}
.ml em{font-size:9px;font-style:normal;color:#C6D8F0;text-shadow:0 0 3px #03060E,0 0 7px #03060E,0 0 10px #03060E}
.ml::before{content:'';position:absolute;left:50%;top:-9px;width:4px;height:4px;margin-left:-2px;
  border-radius:50%;background:var(--cyan);box-shadow:0 0 7px var(--cyan)}
.anno{position:absolute;font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--t4);z-index:2}
.anno b{color:var(--cyan);font-weight:600}
.a1{top:8px;left:12px}.a2{top:8px;right:12px}
.lgd{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;
  font-size:9px;color:var(--t3);z-index:2}
.lgd .ramp{width:84px;height:4px;border-radius:2px;background:linear-gradient(90deg,rgb(10,27,51),rgb(20,84,127),rgb(30,154,201),rgb(123,232,255))}
.compass{position:absolute;top:6px;left:50%;margin-left:-17px;width:34px;height:34px;opacity:.5;z-index:2}

.bgfx{position:fixed;inset:0;z-index:0;background:
  radial-gradient(92% 68% at 50% -6%,#0A1A38 0%,transparent 60%),
  radial-gradient(80% 60% at 50% 104%,#08122A 0%,transparent 56%),var(--bg)}
.bgfx::before{content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(46,155,255,.05) 1px,transparent 1px),
    linear-gradient(90deg,rgba(46,155,255,.05) 1px,transparent 1px);background-size:52px 52px;
  animation:drift 46s linear infinite}
@keyframes drift{to{transform:translate3d(52px,52px,0)}}
.bgfx::after{content:'';position:absolute;inset:0;
  background:radial-gradient(120% 90% at 50% 44%,transparent 40%,rgba(0,0,0,.6) 100%)}
</style></head><body><div class="bgfx"></div><div id="fit">${body}
<script>(function(){var f=document.getElementById('fit');
function s(){var k=Math.min(1,innerWidth/1920,innerHeight/1080);f.style.transform='scale('+k+')';}
addEventListener('resize',s);s();})();</script></div></body></html>`;

writeFileSync(OUT + "refined-panels.html", html);
console.log(`✓ mockup/refined-panels.html  ${(html.length / 1024).toFixed(0)}KB`);
console.log(`  图标 ${Object.keys(ICONS).length} 枚 · 面板 12 个 · KPI 6 项（全部图标化）`);
console.log(`  峰谷差 ${PEAK} · 能耗强度 ${ENERGY_INT} · 采购建议 ${ADVICE.length} 条（带状态 pill）`);
