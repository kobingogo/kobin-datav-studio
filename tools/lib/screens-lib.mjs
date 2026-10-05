/**
 * 三屏 UI 设计稿生成器。
 *
 *   node tools/buildScreens.mjs
 *
 * 输出三份自包含 HTML：
 *   mockup/s0-trade.html   经济运行监测   3/map/3 + 底部墙
 *   mockup/s1-city.html    智慧城市数据大脑 2/map/3，无底部
 *   mockup/s2-power.html   电力全景感知   4/map/2 + 底部墙
 *
 * 三屏共用设计语言（token / 仪表框 / 铭牌 / 配色），但**构图不同** ——
 * 只有换模块不换轮廓，仍然会让人觉得「长得一样」。
 *
 * 数据来自 mockup/data.json，是 tools/dumpData.mjs 从运行中的 app 里
 * 通过 Vite import 产品 TS 模块导出的，与真机同一份数字。
 */
import { writeFileSync, readFileSync } from "node:fs";

const GEO = new URL("../../sc-datav/src/geo/", import.meta.url).pathname;
const OUT = new URL("../../mockup/", import.meta.url).pathname;

const geo = JSON.parse(readFileSync(`${GEO}zhejiang.json`, "utf8"));
const D = JSON.parse(readFileSync(`${OUT}data.json`, "utf8"));

/* ══════════════ 真实地图 ══════════════ */
const flat = geo.features.flatMap((f) => f.geometry.coordinates.flat(2));
const minLon = Math.min(...flat.map((p) => p[0]));
const maxLon = Math.max(...flat.map((p) => p[0]));
const minLat = Math.min(...flat.map((p) => p[1]));
const maxLat = Math.max(...flat.map((p) => p[1]));
const VW = 1600;
const K = VW / (maxLon - minLon);
const VH = Math.round((maxLat - minLat) * K);
const pj = ([lon, lat]) => [
  ((lon - minLon) * K).toFixed(1),
  ((maxLat - lat) * K).toFixed(1),
];

const REGIONS = geo.features
  .map((f) => ({
    name: f.properties.name,
    short: f.properties.name.replace("市", ""),
    d: f.geometry.coordinates
      .flatMap((poly) =>
        poly.map((ring) => {
          let s = "";
          ring.forEach((pt, i) => s += `${i ? "L" : "M"}${pj(pt).join(",")}`);
          return s + "Z";
        })
      )
      .join(""),
    cx: +((pj(f.properties.centroid)[0] / VW) * 100).toFixed(2),
    cy: +((pj(f.properties.centroid)[1] / VH) * 100).toFixed(2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "zh"));

const CITIES = Object.entries(D.cities)
  .map(([name, m]) => ({ name, short: name.replace("市", ""), ...m }))
  .sort((a, b) => b.gdp - a.gdp);
const NAMES = CITIES.map((c) => c.name);
const by = (k) => CITIES.map((c) => ({ ...c, v: c[k] })).sort((a, b) => b.v - a.v);

/* ══════════════ 色阶：heat → 颜色，地图与排名共用 ══════════════ */
const RAMP = [
  [0, [10, 27, 51]],
  [0.35, [20, 84, 127]],
  [0.65, [30, 154, 201]],
  [1, [123, 232, 255]],
];
const ramp = (t) => {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < RAMP.length - 2 && t > RAMP[i + 1][0]) i++;
  const [t0, c0] = RAMP[i];
  const [t1, c1] = RAMP[i + 1];
  const f = (t - t0) / (t1 - t0);
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
};
/** 用指标值的分位归一，让任意指标都能上同一套色阶 */
const heatOf = (key) => {
  const vs = CITIES.map((c) => c[key]).sort((a, b) => a - b);
  return (name) => {
    const v = D.cities[name][key];
    const rank = vs.filter((x) => x <= v).length;
    return ramp((rank - 1) / (vs.length - 1));
  };
};

/* ══════════════ 格式 ══════════════ */
const num = (v) => Math.round(v).toLocaleString();
const big = (v) => (Math.abs(v) >= 10000 ? (v / 10000).toFixed(2) + "万" : num(v));
/** 元 → 亿元 / 万亿。gdp 与人均口径必须过这里，直接 big() 会得到 4 亿亿 */
/** 按量级选单位，不假设输入是元 —— exportValue 本身就是亿元，
    再除一次 1e8 会得到 "0亿"。原来的写法就是这么坏的。 */
const yi = (v) => {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + "万亿";
  if (a >= 1e4) return (v / 1e4).toFixed(2) + "万";
  return num(v);
};
/** 元/人 → 万元/人 */
const wan = (v) => +(v / 1e4).toFixed(1);
const pct = (v) => `${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%`;
const cls = (v) => (v >= 0 ? "up" : "down");

/* ══════════════ 图表基元（全部手写 SVG，无依赖） ══════════════ */

/** 折线/面积图。支持 1–2 条序列，网格 + 轴 + 端点标注 */
function lineChart({ series, labels, w, h, padT = 10, padB = 20, padL = 44, padR = 12, area = true, zero = false, index }) {
  const n = series[0].values.length;
  /* index：各序列以首点为 100 重新归一。GDP(1e12) 与人口(1e4) 共享 Y 轴
     会把后者压成贴底直线，这时比的是形状而不是量级 */
  const norm = index
    ? series.map((s) => ({ ...s, values: s.values.map((v) => (v / s.values[0]) * 100) }))
    : series;
  const all = norm.flatMap((s) => s.values);
  const mx = Math.max(...all) * 1.1;
  const mn = zero ? 0 : Math.min(...all) * 0.86;
  const X = (i) => padL + (i / (n - 1)) * (w - padL - padR);
  const Y = (v) => h - padB - ((v - mn) / (mx - mn || 1)) * (h - padT - padB);

  const ticks = 4;
  let grid = "";
  let axis = "";
  for (let t = 0; t <= ticks; t++) {
    const v = mn + ((mx - mn) * t) / ticks;
    const y = Y(v).toFixed(1);
    grid += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(122,160,220,.09)" stroke-width="1"/>`;
    axis += `<text x="${padL - 6}" y="${y}" fill="#5A6B8C" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${big(v)}</text>`;
  }
  let xlab = "";
  const every = Math.max(1, Math.floor(n / 6));
  labels.forEach((l, i) => {
    if (i % every) return;
    xlab += `<text x="${X(i).toFixed(1)}" y="${h - 6}" fill="#5A6B8C" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${l.slice(5)}月</text>`;
  });

  const paths = norm
    .map((s, si) => {
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      const a = area
        ? `<path d="M${pts.join("L")}L${X(n - 1).toFixed(1)},${Y(mn).toFixed(1)}L${X(0).toFixed(1)},${Y(mn).toFixed(1)}Z" fill="url(#g${si})" opacity=".2"/>`
        : "";
      return (
        a +
        `<path d="M${pts.join("L")}" fill="none" stroke="${s.color}" stroke-width="${si ? 1.3 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(s.values.at(-1)).toFixed(1)}" r="2.6" fill="${s.color}"/>`
      );
    })
    .join("");

  const legend = norm.length > 1
    ? norm.map((s, i) => `<rect x="${padL + i * 62}" y="${h - 17}" width="8" height="2" fill="${s.color}"/><text x="${padL + 12 + i * 62}" y="${h - 13}" fill="#93A6C4" font-size="8.5">${s.name}</text>`).join("")
    : "";

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart">${grid}${axis}${xlab}${paths}${legend}</svg>`;
}

/** 柱状图（峰值差等逐月量） */
function columnChart({ values, labels, color, w, h, padT = 10, padB = 20, padL = 44, highlight }) {
  const mx = Math.max(...values) * 1.15;
  const n = values.length;
  const bw = (w - padL - 12) / n;
  let grid = "";
  for (let t = 0; t <= 3; t++) {
    const y = padT + ((h - padT - padB) * t) / 3;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - 12}" y2="${y.toFixed(1)}" stroke="rgba(122,160,220,.09)"/>`;
  }
  const bars = values
    .map((v, i) => {
      const bh = (v / mx) * (h - padT - padB);
      const c = highlight === i ? "var(--gold)" : color;
      return `<rect x="${(padL + i * bw + bw * 0.18).toFixed(1)}" y="${(h - padB - bh).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" fill="${c}" opacity="${highlight === undefined || highlight === i ? 0.85 : 0.3}" rx="1"/>`;
    })
    .join("");
  const every = Math.max(1, Math.floor(n / 6));
  const xlab = labels
    .map((l, i) => (i % every ? "" : `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" fill="#5A6B8C" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${l.slice(5)}月</text>`))
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart">${grid}${bars}${xlab}</svg>`;
}

/** 热力矩阵（行 × 列）。每行独立归一，读者看的是「该行内谁突出」 */
function heatMatrix({ rows, cols, value, labels }) {
  const grid = `grid-template-columns:repeat(${cols.length},1fr)`;
  const head = `<div class="hm-h"><span></span><div class="cells" style="${grid}">${cols
    .map((c) => `<span>${c}</span>`)
    .join("")}</div></div>`;
  const body = rows
    .map((r) => {
      const vs = cols.map((_, j) => value(r, j));
      const mn = Math.min(...vs);
      const mx = Math.max(...vs);
      return `<div class="hm-r"><span class="hm-n">${r}</span><div class="cells" style="${grid}">${cols
        .map((_, j) => {
          const t = (vs[j] - mn) / (mx - mn || 1);
          return `<i style="background:${ramp(0.15 + t * 0.85)}" title="${r} ${labels[j]} ${num(vs[j])}"></i>`;
        })
        .join("")}</div></div>`;
    })
    .join("");
  return `<div class="hm">${head}${body}</div>`;
}

/** 散点（人均GDP × 人口密度），带象限分割线与均值十字 */
function scatter({ pts, w, h, xlab, ylab }) {
  const X = pts.map((p) => p.x);
  const Y = pts.map((p) => p.y);
  const xmn = Math.min(...X) * 0.82;
  const xmx = Math.max(...X) * 1.12;
  const ymn = Math.min(...Y) * 0.82;
  const ymx = Math.max(...Y) * 1.12;
  const mx = X.reduce((a, b) => a + b, 0) / X.length;
  const my = Y.reduce((a, b) => a + b, 0) / Y.length;
  const px = (v) => 40 + ((v - xmn) / (xmx - xmn)) * (w - 52);
  const py = (v) => h - 26 - ((v - ymn) / (ymx - ymn)) * (h - 38);

  let grid = "";
  for (let t = 0; t <= 3; t++) {
    grid += `<line x1="40" y1="${(10 + ((h - 38) * t) / 3).toFixed(1)}" x2="${w - 12}" y2="${(10 + ((h - 38) * t) / 3).toFixed(1)}" stroke="rgba(122,160,220,.07)"/>`;
  }
  const quad =
    `<line x1="${px(mx).toFixed(1)}" y1="10" x2="${px(mx).toFixed(1)}" y2="${h - 26}" stroke="rgba(122,160,220,.22)" stroke-dasharray="3 3"/>` +
    `<line x1="40" y1="${py(my).toFixed(1)}" x2="${w - 12}" y2="${py(my).toFixed(1)}" stroke="rgba(122,160,220,.22)" stroke-dasharray="3 3"/>` +
    `<text x="${w - 14}" y="${py(my) - 6}" fill="#39485F" font-size="8" text-anchor="end">均密度</text>` +
    `<text x="${px(mx) + 6}" y="20" fill="#39485F" font-size="8">均人均</text>`;

  // 半径必须先归一 —— 直接用 gdp(元) 会算出 4.5 亿的半径
  const rmx = Math.max(...pts.map((q) => q.r));
  const dots = pts
    .map((p) => {
      const rr = 2.6 + (p.r / rmx) * 5.4;
      return `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="${rr.toFixed(1)}" fill="${p.c}" fill-opacity=".55" stroke="${p.c}" stroke-width="1.1"/>` +
        `<text x="${px(p.x).toFixed(1)}" y="${(py(p.y) + 3.2).toFixed(1)}" fill="#EAF0FA" font-size="7.5" text-anchor="middle" pointer-events="none">${p.n}</text>` +
        (rr > 6.6 ? `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="11" fill="none" stroke="${p.c}" stroke-width=".8" opacity=".45"/>` : "");
    })
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="chart">${grid}${quad}${dots}
    <text x="${w / 2}" y="${h - 4}" fill="#5A6B8C" font-size="8.5" text-anchor="middle">${xlab}</text>
    <text x="10" y="${h / 2}" fill="#5A6B8C" font-size="8.5" text-anchor="middle" transform="rotate(-90 10 ${h / 2})">${ylab}</text>
  </svg>`;
}

/* ══════════════ 演示用结构性数据 ══════════════
   这些是设计稿需要、但标量表里没有的维度。标注为设计假设。 */
const GOODS = [
  { n: "机电产品", v: 3820, c: "cyan" },
  { n: "高新技术", v: 2140, c: "indigo" },
  { n: "纺织服装", v: 1180, c: "teal" },
  { n: "农产品", v: 640, c: "violet" },
  { n: "化工", v: 520, c: "amber" },
  { n: "其他", v: 367, c: "slate" },
];
const PARTNERS = [
  { n: "东盟", v: 1980 }, { n: "美国", v: 1740 }, { n: "欧盟", v: 1310 },
  { n: "日韩", v: 980 }, { n: "一带一路沿线", v: 870 },
];
const EVENTS = [
  { t: "20:41:02", c: "宁波", s: "warn", k: "出口", v: "同比 +18.2% 环比转正" },
  { t: "20:39:47", c: "温州", s: "info", k: "用电", v: "负荷 触及 92% 预警线" },
  { t: "20:37:11", c: "杭州", s: "good", k: "税收", v: "单月增量突破 280 亿" },
  { t: "20:34:58", c: "台州", s: "crit", k: "能耗", v: "单位产出能耗环比 +4.1%" },
  { t: "20:31:26", c: "金华", s: "info", k: "企业", v: "新规上 128 家" },
  { t: "20:28:03", c: "绍兴", s: "good", k: "出口", v: "完成季度目标 103%" },
  { t: "20:24:40", c: "湖州", s: "warn", k: "GDP", v: "排名环比下降 1 位" },
  { t: "20:22:15", c: "衢州", s: "crit", k: "税收", v: "连续两月低于时序下界" },
  { t: "20:19:52", c: "丽水", s: "crit", k: "能耗", v: "强度超目标 7.4%" },
  { t: "20:17:30", c: "嘉兴", s: "good", k: "用电", v: "负荷曲线季度新高" },
  { t: "20:15:02", c: "舟山", s: "info", k: "人口", v: "净流入连续 6 月为正" },
  { t: "20:12:44", c: "温州", s: "warn", k: "税收", v: "单月进度落后计划 4pt" },
];
const ALARMS = [
  { c: "台州", d: "220kV 临海变 #2 主变重载", g: "warn", ts: "20:34" },
  { c: "温州", d: "瓯海区配网台区低电压告警", g: "crit", ts: "20:29" },
  { c: "宁波", d: "北仑港区 3# 堆场设备异常", g: "crit", ts: "20:21" },
  { c: "金华", d: "婺城变 10kV 线路跳闸重合", g: "warn", ts: "20:16" },
  { c: "杭州", d: "余杭数据中心新增负荷接入", g: "info", ts: "20:11" },
  { c: "绍兴", d: "镜湖热电并网倒闸操作", g: "info", ts: "20:06" },
  { c: "湖州", d: "±800kV 特高压直流功率波动", g: "warn", ts: "19:58" },
];

/* ══════════════ 面板构造 ══════════════ */
function deck(no, title, en, opts = {}) {
  return `<div class="dk" style="--ac:${opts.ac || "var(--cyan)"};--fill:${opts.fill || "60%"}">
  <span class="brk tl"></span><span class="brk br"></span>
  <div class="pl"><div class="pl-l"><span class="pl-no">${no}</span>
    <span class="pl-t">${title}</span><span class="pl-en">${en}</span></div>
    ${opts.right ? `<span class="${opts.rightCls || "pl-en"}" ${opts.rightStyle || ""}>${opts.right}</span>` : ""}</div>
  <div class="bd" style="${opts.bdStyle || ""}">${opts.body || ""}</div>
</div>`;
}

const plate = (no, title, en, right, rightCls) => ({ no, title, en, right, rightCls });

/** 排名条 + inline delta */
const rankRows = (key, unit, limit = 9, colorOf) => {
  const rows = by(key).slice(0, limit);
  const mx = rows[0].v;
  return rows
    .map((c, i) => {
      const s = c.series[key];
      return `<div class="rk">
  <span class="rk-no">${String(i + 1).padStart(2, "0")}</span>
  <span class="rk-n">${c.short}</span>
  <span class="rk-t"><i style="--w:${((c.v / mx) * 100).toFixed(1)}%;--c:${colorOf ? colorOf(c) : "var(--cyan)"}"></i></span>
  <span class="rk-v num">${big(c.v)}</span>
  <span class="rk-d num ${cls(s ? s.yoy : 0)}">${pct(s ? s.yoy : 0)}</span>
</div>`;
    })
    .join("");
};

/** 双向条（贸易差额，正负分色） */
const diverging = (key, limit = 8) => {
  /* 年度累计差额，不是环比 —— 环比只有 ±10 亿量级，读不出任何信息 */
  const sum = (v) => v.slice(-12).reduce((a, b) => a + b, 0);
  const rows = CITIES.map((c) => ({ ...c, v: sum(c.series.exportValue.values) - sum(c.series.importValue.values) }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, limit);
  const mx = Math.max(...rows.map((r) => Math.abs(r.v)));
  return rows
    .map((c, i) => {
      const w = (Math.abs(c.v) / mx) * 46;
      const pos = c.v >= 0;
      return `<div class="dv">
  <span class="rk-no">${String(i + 1).padStart(2, "0")}</span>
  <span class="rk-n">${c.short}</span>
  <span class="dv-t"><i class="${pos ? "p" : "n"}" style="--w:${w.toFixed(1)}%"></i><s></s></span>
  <span class="rk-v num ${pos ? "up" : "down"}">${pos ? "+" : "−"}${Math.abs(c.v).toFixed(1)}</span>
</div>`;
    })
    .join("");
};

/** bullet：实际 vs 目标 */
const bullets = (items, unit) =>
  items
    .map(
      (it) => `<div class="bl">
  <span class="bl-n">${it.n}</span>
  <span class="bl-t"><i class="bl-band" style="left:${Math.max(0, it.p - 14)}%;width:14%"></i>
    <i class="bl-fill ${it.tone}" style="width:${Math.min(108, it.p)}%"></i><i class="bl-goal"></i></span>
  <span class="bl-v num ${it.tone}">${it.p}%</span>
</div>`,
    )
    .join("");

/** 明细表 */
const table = (key, unit, limit = 9) => {
  const rows = by(key).slice(0, limit);
  const mx = rows[0].v;
  return `<div class="tb">
  <div class="tb-r tb-h"><span>地区</span><span>${D.metrics[key].label}</span><span>占比</span></div>
  ${rows
    .map(
      (c) => `<div class="tb-r"><span class="tb-n">${c.short}</span>
    <span class="num">${big(c.v)}<em>${unit}</em></span>
    <span class="tb-p"><i style="--w:${((c.v / mx) * 100).toFixed(0)}%"></i><b class="num">${((c.v / D.province[key]) * 100).toFixed(1)}%</b></span></div>`,
    )
    .join("")}
</div>`;
};

/** sparkline 墙 */
const sparkWall = (key, limit = 11) =>
  CITIES.slice(0, limit)
    .map((c, i) => {
      const s = c.series[key];
      const n = s.values.length;
      const mn = Math.min(...s.values);
      const mx = Math.max(...s.values);
      const X = (k) => (k / (n - 1)) * 108;
      const Y = (v) => 26 - ((v - mn) / (mx - mn || 1)) * 23 - 1.5;
      const pts = s.values.map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join("L");
      const prev = s.values.slice(0, 12);
      const pMn = Math.min(...prev);
      const pMx = Math.max(...prev);
      const pPts = prev.map((v, k) => `${((k / 11) * 108).toFixed(1)},${(26 - ((v - pMn) / (pMx - pMn || 1)) * 23 - 1.5).toFixed(1)}`).join("L");
      return `<div class="sw${i === 0 ? " top" : ""}">
  <div class="sw-h"><i></i>${c.short}<span class="num">${yi(c[key])}</span></div>
  <svg viewBox="0 0 108 26" preserveAspectRatio="none">
    <path d="M${pPts}" fill="none" stroke="var(--slate)" stroke-width=".9" opacity=".85"/>
    <path class="dr" d="M${pts}L108,26L0,26Z" fill="url(#gCyan)" opacity=".2" style="animation-delay:${0.1 + i * 0.05}s"/>
    <path class="dr" d="M${pts}" fill="none" stroke="var(--cyan)" stroke-width="1.3" style="animation-delay:${0.1 + i * 0.05}s"/>
  </svg>
  <div class="sw-f"><span class="num ${cls(s.yoy)}">${pct(s.yoy)}</span><span class="sw-p">环比 ${s.mom >= 0 ? "+" : "−"}${Math.abs(s.mom)}%</span></div>
</div>`;
    })
    .join("");

/** 地图舞台 */
function stage(no, title, en, key, extra = "") {
  const colorOf = heatOf(key);
  const paths = REGIONS.map(
    (r) => `<path class="rg" data-name="${r.short}" d="${r.d}" style="fill:${colorOf(r.name)}"/>`,
  ).join("");
  const labels = REGIONS.map((r) => {
    const c = D.cities[r.name];
    const yoy = c.series[key]?.yoy ?? 0;
    return `<span class="ml" style="left:${r.cx}%;top:${r.cy}%"><b>${r.short}</b><em class="num">${pct(yoy)}</em></span>`;
  }).join("");
  return deck(no, title, en, {
    ac: "var(--cyan)",
    fill: "71%",
    right: extra || "悬停高亮 · 点击下钻",
    bdStyle: "padding:0",
    body: `<div class="stage-in">
  <div class="scan"></div>
  <div class="mapbox">
    <svg viewBox="0 0 ${VW} ${VH}">${paths}</svg>${labels}
  </div>
  <svg class="compass" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="var(--line2)"/><path d="M17 5 L20.5 17 L17 14.6 L13.5 17 Z" fill="var(--cyan)"/><text x="17" y="32" fill="#39485F" font-size="7" text-anchor="middle" font-family="monospace">N</text></svg>
  <div class="anno a1"><b>◉</b> ${D.metrics[key].label} · ${D.provinceShort}</div>
  <div class="anno a2">WEB MERCATOR · EPSG:3857</div>
  <div class="anno a3">EXTENT ${(maxLon - minLon).toFixed(2)}° × ${(maxLat - minLat).toFixed(2)}°</div>
  <div class="anno a4">${REGIONS.length} REGIONS · ${num(flat.length)} VERTICES</div>
  <div class="lgd"><span>低</span><span class="ramp"></span><span>高</span><span style="color:var(--t4)">${D.metrics[key].label}</span></div>
</div>`,
  });
}

/* ══════════════ CSS ══════════════ */
const CSS = `
:root{
  --bg:#04060D; --surf:rgba(13,19,33,.74); --surf2:rgba(18,26,43,.82);
  --line:rgba(122,160,220,.13); --line2:rgba(122,160,220,.26);
  --t1:#EAF0FA; --t2:#93A6C4; --t3:#5A6B8C; --t4:#39485F;
  --cyan:#38E1FF; --indigo:#7C8FFF; --teal:#2FE6A8; --amber:#FFB23F;
  --magenta:#FF5C8A; --gold:#FFD166; --violet:#B58CFF; --slate:#46587A;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  --sans:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --r:3px; --ease:cubic-bezier(.4,0,.2,1);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);color:var(--t1);background:var(--bg);display:grid;place-items:center;
  min-height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.up{color:var(--teal)} .down{color:var(--magenta)}
.warn{color:var(--amber)} .good{color:var(--teal)} .crit{color:var(--magenta)}
#fit{width:1920px;height:1080px;transform-origin:center;position:relative;z-index:1}
.dk{position:relative;display:flex;flex-direction:column;min-height:0;
  background:linear-gradient(168deg,var(--surf2),var(--surf));border:1px solid var(--line);
  border-radius:var(--r);backdrop-filter:blur(20px) saturate(1.25);overflow:hidden}
.dk::before{content:'';position:absolute;top:0;left:0;height:2px;width:var(--fill);z-index:3;
  background:linear-gradient(90deg,var(--ac),transparent 96%);box-shadow:0 0 14px -2px var(--ac);transition:width 1.3s var(--ease)}
.dk::after{content:'';position:absolute;top:10px;right:11px;width:28px;height:5px;opacity:.7;
  background:repeating-linear-gradient(90deg,var(--line2) 0 1px,transparent 1px 5px)}
.dk>.brk{position:absolute;width:11px;height:11px;pointer-events:none;opacity:.6;z-index:4;border-color:var(--ac);transition:all .2s var(--ease)}
.dk>.brk.tl{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid}
.dk>.brk.br{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid}
.dk:hover{border-color:var(--line2)}
.dk:hover>.brk{opacity:1;width:16px;height:16px}
.pl{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:9px 13px 8px;border-bottom:1px solid var(--line)}
.pl-l{display:flex;align-items:baseline;gap:8px;min-width:0}
.pl-no{font-family:var(--mono);font-size:10px;color:var(--t4);letter-spacing:.14em}
.pl-t{font-size:13px;font-weight:600;letter-spacing:.04em;white-space:nowrap}
.pl-en{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--t4);text-transform:uppercase;white-space:nowrap}
.pl-v{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--ac);white-space:nowrap}
.bd{flex:1;min-height:0;padding:10px 13px 12px;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.chart{width:100%;height:100%;display:block}

/* 顶栏 */
.top{display:grid;gap:12px;height:92px}
.hero{position:relative;padding:11px 15px;display:flex;flex-direction:column;justify-content:space-between;
  background:linear-gradient(135deg,rgba(56,225,255,.14),rgba(13,19,33,.72) 62%);
  border:1px solid rgba(56,225,255,.32);border-radius:var(--r);overflow:hidden}
.hero::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(110% 100% at 0% 0%,rgba(56,225,255,.17),transparent 58%)}
.hero-k{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--cyan);text-transform:uppercase;position:relative}
.hero-v{font-family:var(--mono);font-size:40px;font-weight:700;line-height:1;letter-spacing:-.02em;display:flex;align-items:baseline;gap:6px;position:relative}
.hero-v u{font-size:13px;font-style:normal;text-decoration:none;color:var(--t3);font-weight:400}
.hero-f{display:flex;align-items:center;gap:9px;position:relative}
.pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:2px;font-family:var(--mono);font-size:10px;font-weight:600;background:var(--teal);color:#04211A}
.hero svg{height:24px;flex:1}
.kpi{padding:10px 13px;display:flex;flex-direction:column;gap:5px;justify-content:center;background:var(--surf);
  border:1px solid var(--line);border-radius:var(--r);position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac)}
.kpi-k{font-size:10px;color:var(--t3);display:flex;align-items:center;gap:5px;white-space:nowrap}
.kpi-k i{width:4px;height:4px;border-radius:50%;background:var(--ac);box-shadow:0 0 6px var(--ac)}
.kpi-v{font-family:var(--mono);font-size:22px;font-weight:700;line-height:1;display:flex;align-items:baseline;gap:4px}
.kpi-v u{font-size:10px;font-style:normal;text-decoration:none;color:var(--t3);font-weight:400}
.kpi-s{height:18px;margin-top:auto}
.clk{padding:10px 13px;display:flex;flex-direction:column;justify-content:center;gap:3px;background:var(--surf);border:1px solid var(--line);border-radius:var(--r)}
.clk-t{font-family:var(--mono);font-size:21px;font-weight:600}
.clk-t s{text-decoration:none;color:var(--t4);font-size:13px}
.clk-m{font-size:9px;color:var(--t4);font-family:var(--mono);line-height:1.5}

/* 主体 */
.mid{display:grid;gap:12px;min-height:0}
.rail{display:grid;gap:12px;min-height:0}
.stage .bd{padding:0}
.stage-in{position:relative;flex:1;min-height:0;display:grid;place-items:center}
.mapbox{position:relative;height:100%;aspect-ratio:${VW} / ${VH};
  filter:drop-shadow(0 18px 44px rgba(0,0,0,.62)) drop-shadow(0 0 60px rgba(56,225,255,.09))}
.mapbox svg{width:100%;height:100%;overflow:visible}
.rg{stroke:rgba(190,225,255,.34);stroke-width:.7;stroke-linejoin:round;transition:stroke .25s,filter .25s;cursor:pointer}
.rg:hover{stroke:var(--gold);stroke-width:1.8;filter:brightness(1.18)}
.ml{position:absolute;transform:translate(-50%,-50%);text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap}
.ml b{font-size:12px;font-weight:600;letter-spacing:.06em;text-shadow:0 0 3px #04060D,0 0 6px #04060D,0 0 10px #04060D,0 1px 2px #04060D}
.ml em{font-size:9px;font-style:normal;color:#C6D6EC;text-shadow:0 0 3px #04060D,0 0 6px #04060D,0 0 10px #04060D,0 1px 2px #04060D}
.ml::before{content:'';position:absolute;left:50%;top:-9px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--cyan);box-shadow:0 0 7px var(--cyan)}
.anno{position:absolute;font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--t4);display:flex;align-items:center;gap:6px;white-space:nowrap;z-index:2}
.anno b{color:var(--cyan);font-weight:600}
.a1{top:8px;left:12px} .a2{top:8px;right:12px} .a3{bottom:8px;left:12px} .a4{bottom:8px;right:12px}
.lgd{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;font-size:9px;color:var(--t3);z-index:2}
.lgd .ramp{width:88px;height:4px;border-radius:2px;background:linear-gradient(90deg,${RAMP.map(([t, c]) => `rgb(${c.join(",")}) ${(t * 100).toFixed(0)}%`).join(",")})}
.compass{position:absolute;top:6px;left:50%;margin-left:-17px;width:34px;height:34px;opacity:.45;z-index:2}
.scan{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:var(--r)}
.scan::before{content:'';position:absolute;left:0;right:0;height:110px;
  background:linear-gradient(180deg,transparent,rgba(56,225,255,.075) 55%,transparent);animation:scan 8s linear infinite}
@keyframes scan{0%{transform:translateY(-110px)}100%{transform:translateY(100%)}}

/* 行式模块 */
.rk{display:grid;grid-template-columns:20px 42px 1fr 58px 46px;align-items:center;gap:8px;padding:4px 0;
  border-bottom:1px solid rgba(122,160,220,.06);font-size:11px}
.rk-no{font-family:var(--mono);font-size:9px;color:var(--t4)}
.rk-n{color:var(--t2);white-space:nowrap}
.rk-t{height:5px;background:rgba(122,160,220,.1);border-radius:2px;position:relative;overflow:hidden}
.rk-t i{position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--c);border-radius:2px;box-shadow:0 0 9px -2px var(--c)}
.rk-v{font-size:11px;text-align:right}
.rk-d{font-size:9px;text-align:right}
/* 双向条 */
.dv{display:grid;grid-template-columns:20px 42px 1fr 56px;align-items:center;gap:8px;padding:4px 0;
  border-bottom:1px solid rgba(122,160,220,.06);font-size:11px}
.dv-t{height:12px;position:relative;background:rgba(122,160,220,.06);border-radius:2px}
.dv-t i{position:absolute;top:2px;bottom:2px;border-radius:1px}
.dv-t i.p{left:50%;width:var(--w);background:var(--teal);box-shadow:0 0 8px -2px var(--teal)}
.dv-t i.n{right:50%;width:var(--w);background:var(--magenta);box-shadow:0 0 8px -2px var(--magenta)}
.dv-t s{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(122,160,220,.3)}
/* bullet */
.bl{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:9px;padding:3.5px 0;font-size:11px}
.bl-n{color:var(--t2)}
.bl-t{height:13px;position:relative;background:rgba(122,160,220,.07);border-radius:2px;overflow:hidden}
.bl-band{position:absolute;top:0;bottom:0;background:rgba(56,225,255,.1)}
.bl-fill{position:absolute;top:2px;bottom:2px;left:0;border-radius:2px;background:var(--cyan)}
.bl-fill.good{background:var(--teal)} .bl-fill.warn{background:var(--amber)} .bl-fill.crit{background:var(--magenta)}
.bl-goal{position:absolute;top:-1px;bottom:-1px;left:100%;width:2px;background:var(--gold);box-shadow:0 0 7px var(--gold)}
.bl-v{font-size:11px;text-align:right}
/* 环形 */
.dn{position:relative;flex:1;min-height:0;display:grid;place-items:center}
.dn svg{width:100%;height:100%;max-height:100%}
.dn-c{position:absolute;text-align:center;pointer-events:none}
.dn-c b{display:block;font-family:var(--mono);font-size:20px;font-weight:700;line-height:1.1}
.dn-c span{font-size:9px;color:var(--t3)}
/* treemap */
.tm-g{position:relative;flex:1;min-height:0}
.tm{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);overflow:hidden;container-type:size}
.tm-in{height:100%;padding:5px 7px;display:flex;flex-direction:column;justify-content:center;gap:0;overflow:hidden;
  background:color-mix(in oklab,var(--c) 17%,rgba(10,16,28,.62));
  border:1px solid color-mix(in oklab,var(--c) 45%,transparent);transition:background .2s}
.tm:hover .tm-in{background:color-mix(in oklab,var(--c) 32%,rgba(10,16,28,.7))}
.tm b{font-size:10px;font-weight:600;white-space:nowrap}
.tm span{font-size:11px;font-weight:700;color:var(--c)}
.tm em{font-size:8px;font-style:normal;color:var(--t3);line-height:1.35}
@container (max-height:46px){.tm em{display:none}}
@container (max-height:34px){.tm-in{flex-direction:row;align-items:center;gap:5px}.tm em{display:none}}
@container (max-width:46px){.tm em{display:none}}
/* 矩阵热力 */
.hm{display:flex;flex-direction:column;gap:2px;flex:1;min-height:0}
.hm-h{display:grid;grid-template-columns:40px 1fr;gap:3px;height:12px;flex:none}
.hm-h .cells{display:grid;gap:3px}
.hm-h .cells span{font-size:8.5px;color:var(--t4);text-align:center;font-family:var(--mono);monospace;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-r{display:grid;grid-template-columns:40px 1fr;gap:3px;flex:1;min-height:0}
.hm-n{font-size:9.5px;color:var(--t3);display:flex;align-items:center;overflow:hidden}
.hm-r .cells{display:grid;gap:3px;min-height:0}
.hm-r i{border-radius:1px;min-height:0}
/* 表 */
.tb{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.tb-r{display:grid;grid-template-columns:52px 1fr 78px;align-items:center;gap:8px;padding:4px 0;font-size:10.5px;
  border-bottom:1px solid rgba(122,160,220,.06)}
.tb-h{color:var(--t4);font-size:9px;font-family:var(--mono);border-bottom:1px solid var(--line)}
.tb-h span:nth-child(2){text-align:right}
.tb-n{color:var(--t2)}
.tb-r .num{text-align:right;color:var(--t1)}
.tb-r em{font-style:normal;font-size:8.5px;color:var(--t4);margin-left:3px}
.tb-p{display:grid;grid-template-columns:1fr 34px;align-items:center;gap:6px}
.tb-p i{position:relative;height:4px;background:rgba(122,160,220,.1);border-radius:2px;overflow:hidden}
.tb-p i::after{content:'';position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--cyan);border-radius:2px;box-shadow:0 0 7px -2px var(--cyan)}
.tb-p b{font-size:9px;color:var(--t3);text-align:right}
/* 事件流 */
.fd{display:flex;flex-direction:column;flex:1;min-height:0;justify-content:space-between}
.fd-r{display:grid;grid-template-columns:50px 6px 40px 34px 1fr;align-items:center;gap:8px;padding:5px 0;
  border-bottom:1px solid rgba(122,160,220,.06);font-size:10px}
.fd-t{font-size:9px;color:var(--t4)}
.fd-d{width:5px;height:5px;border-radius:50%;background:var(--t4)}
.fd-d.info{background:var(--cyan);box-shadow:0 0 6px var(--cyan)}
.fd-d.good{background:var(--teal);box-shadow:0 0 6px var(--teal)}
.fd-d.warn{background:var(--amber);box-shadow:0 0 6px var(--amber);animation:br 2.2s ease-in-out infinite}
.fd-d.crit{background:var(--magenta);box-shadow:0 0 7px var(--magenta);animation:br 1.4s ease-in-out infinite}
@keyframes br{0%,100%{opacity:1}50%{opacity:.32}}
.fd-c{color:var(--t2)} .fd-k{color:var(--cyan);font-size:9px}
.fd-v{color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 告警 */
.al-r{display:grid;grid-template-columns:6px 40px 1fr 44px;align-items:center;gap:8px;padding:6px 0;
  border-bottom:1px solid rgba(122,160,220,.06);font-size:10.5px}
.al-g{width:5px;height:5px;border-radius:50%}
.al-g.crit{background:var(--magenta);box-shadow:0 0 7px var(--magenta);animation:br 1.4s ease-in-out infinite}
.al-g.warn{background:var(--amber);box-shadow:0 0 6px var(--amber);animation:br 2.2s ease-in-out infinite}
.al-g.info{background:var(--cyan);box-shadow:0 0 6px var(--cyan)}
.al-c{color:var(--t2)} .al-d{color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.al-t{font-family:var(--mono);font-size:9px;color:var(--t4);text-align:right}
/* 底部墙 */
.bot{display:grid;gap:8px;height:130px;margin-top:12px}
.sw{padding:9px 10px;background:var(--surf);border:1px solid var(--line);border-radius:var(--r);
  display:flex;flex-direction:column;gap:5px;position:relative;overflow:hidden;transition:border-color .2s,background .2s}
.sw:hover{border-color:var(--line2);background:var(--surf2)}
.sw:hover::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--cyan);box-shadow:0 0 10px var(--cyan)}
.sw-h{font-size:10px;color:var(--t3);display:flex;align-items:center;gap:5px}
.sw-h i{width:4px;height:4px;border-radius:50%;background:var(--t4);flex:none}
.sw.top .sw-h i{background:var(--cyan);box-shadow:0 0 6px var(--cyan)}
.sw-h span{margin-left:auto;font-size:10px;color:var(--t1)}
.sw svg{width:100%;flex:1;min-height:0}
.sw-f{display:flex;align-items:baseline;justify-content:space-between;font-size:9px}
.sw-p{color:var(--t4);font-family:var(--mono);font-size:8.5px}
.dr{stroke-dasharray:460;stroke-dashoffset:460;animation:draw 2.6s var(--ease) forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.bgfx{position:fixed;inset:0;z-index:0;background:
  radial-gradient(88% 66% at 50% -4%,#0C1730 0%,transparent 62%),
  radial-gradient(76% 58% at 50% 104%,#0A1122 0%,transparent 56%),var(--bg)}
.bgfx::before{content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(122,160,220,.042) 1px,transparent 1px),
    linear-gradient(90deg,rgba(122,160,220,.042) 1px,transparent 1px);
  background-size:48px 48px;animation:drift 44s linear infinite}
@keyframes drift{to{transform:translate3d(48px,48px,0)}}
.bgfx::after{content:'';position:absolute;inset:0;
  background:radial-gradient(118% 88% at 50% 44%,transparent 40%,rgba(0,0,0,.6) 100%)}
`;

const page = (title, body) => `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${CSS}</style></head>
<body><div class="bgfx"></div><div id="fit">${body}
<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38E1FF" stop-opacity=".6"/><stop offset="1" stop-color="#38E1FF" stop-opacity="0"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C8FFF" stop-opacity=".55"/><stop offset="1" stop-color="#7C8FFF" stop-opacity="0"/></linearGradient>
<linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38E1FF" stop-opacity=".55"/><stop offset="1" stop-color="#38E1FF" stop-opacity="0"/></linearGradient>
</defs></svg>
<script>(function(){var f=document.getElementById('fit');function s(){var k=Math.min(1,innerWidth/1920,innerHeight/1080);f.style.transform='scale('+k+')';}addEventListener('resize',s);s();})();</script>
</div></body></html>`;

/* ══════════════ 派生值 ══════════════ */
const prov = (k) => D.metrics[k].province;
const cs = (n, k) => D.cities[n].series[k];
const fv = (k) => prov(k).values;

export { lineChart, columnChart, heatMatrix, scatter, deck, plate, rankRows, diverging, bullets, table, sparkWall, stage, page, GOODS, PARTNERS, EVENTS, ALARMS, prov, cs, fv, num, big, yi, wan, pct, cls, CITIES, D, ramp, heatOf, by, REGIONS, VW, VH, pj, NAMES };