/**
 * 左右侧面板的「现状 vs 优化」对照设计稿。
 *
 *   node tools/buildPanels.mjs
 *
 * 输出 mockup/panels-before-after.html
 * 「现状」一列是照着 charts.tsx 当前的 ECharts 配置复刻的，不是稻草人。
 * 「优化」一列是提案。数据取自 mockup/data.json（与真机同源）。
 */
import { writeFileSync, readFileSync } from "node:fs";

const D = JSON.parse(
  readFileSync(new URL("../mockup/data.json", import.meta.url).pathname, "utf8"),
);

const CITIES = Object.entries(D.cities).map(([name, m]) => ({ name, short: name.replace("市", ""), ...m }));
const P = D.province;
const by = (k) => CITIES.map((c) => ({ ...c, v: c[k] })).sort((a, b) => b.v - a.v);

const num = (v) => Math.round(v).toLocaleString();
const num1 = (v) => v.toFixed(1);
const pct = (v) => `${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%`;
const cls = (v) => (v >= 0 ? "up" : "down");

/* 色阶 —— 与地图、排名共用一套 */
const RAMP = [[0, [10, 27, 51]], [0.35, [20, 84, 127]], [0.65, [30, 154, 201]], [1, [123, 232, 255]]];
const ramp = (t) => {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < RAMP.length - 2 && t > RAMP[i + 1][0]) i++;
  const [t0, c0] = RAMP[i];
  const [t1, c1] = RAMP[i + 1];
  const f = (t - t0) / (t1 - t0);
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
};
const heatOf = (key) => {
  const vs = CITIES.map((c) => c[key]).sort((a, b) => a - b);
  return (n) => {
    const v = D.cities[n][key];
    return ramp((vs.filter((x) => x <= v).length - 1) / (vs.length - 1));
  };
};

const prov = (k) => D.metrics[k].province;
const MONTHS = D.months;

/* ══════════════ 折线图基元 ══════════════ */
function lineSvg(series, opts = {}) {
  const { w = 420, h = 150, index = false, padT = 12, padB = 18, padL = 40, padR = 34, marks = false, grid = 3 } = opts;
  const n = series[0].values.length;
  const norm = index
    ? series.map((s) => ({ ...s, values: s.values.map((v) => (v / s.values[0]) * 100) }))
    : series;
  const all = norm.flatMap((s) => s.values);
  const mx = Math.max(...all) * 1.06;
  const mn = Math.min(...all) * 0.94;
  const X = (i) => padL + (i / (n - 1)) * (w - padL - padR);
  const Y = (v) => h - padB - ((v - mn) / (mx - mn || 1)) * (h - padT - padB);

  /* grid<=0 用于迷你 sparkline：跳过网格与轴，否则 (grid-t)/grid 会算出 0/0 = NaN */
  let g = "";
  let ax = "";
  if (grid > 0) {
    for (let t = 0; t <= grid; t++) {
      const y = (padT + ((h - padT - padB) * t) / grid).toFixed(1);
      g += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(122,160,220,.08)"/>`;
    }
    for (let t = 0; t <= grid; t++) {
      const v = mn + ((mx - mn) * (grid - t)) / grid;
      ax += `<text x="${padL - 5}" y="${(padT + ((h - padT - padB) * t) / grid + 3).toFixed(1)}" fill="#5A6B8C" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${index ? v.toFixed(0) : num(v)}</text>`;
    }
  }
  let xl = "";
  MONTHS.forEach((m, i) => {
    if (i % 4) return;
    xl += `<text x="${X(i).toFixed(1)}" y="${h - 4}" fill="#5A6B8C" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${m.slice(5)}月</text>`;
  });

  const path = norm
    .map((s, si) => {
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      const a = si === 0
        ? `<path d="M${pts.join("L")}L${X(n - 1).toFixed(1)},${Y(mn).toFixed(1)}L${padL},${Y(mn).toFixed(1)}Z" fill="url(#gCyan)" opacity=".28"/>`
        : "";
      const dash = si === 1 ? ' stroke-dasharray="3 3"' : "";
      return (
        a +
        `<path d="M${pts.join("L")}" fill="none" stroke="${s.color}" stroke-width="${si ? 1.2 : 1.8}" stroke-linejoin="round"${dash}/>` +
        `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(s.values.at(-1)).toFixed(1)}" r="2.6" fill="${s.color}"/>` +
        `<text x="${(X(n - 1) + 5).toFixed(1)}" y="${(Y(s.values.at(-1)) + 3).toFixed(1)}" fill="${s.color}" font-size="8.5" font-family="ui-monospace,monospace">${s.values.at(-1).toFixed(index ? 0 : 0)}</text>`
      );
    })
    .join("");

  /* 峰值标注 —— 现状没有 */
  let pk = "";
  if (marks) {
    const s0 = norm[0].values;
    const i = s0.indexOf(Math.max(...s0));
    pk = `<circle cx="${X(i).toFixed(1)}" cy="${Y(s0[i]).toFixed(1)}" r="3.4" fill="none" stroke="${norm[0].color}" stroke-width="1"/>` +
      `<text x="${X(i).toFixed(1)}" y="${(Y(s0[i]) - 9).toFixed(1)}" fill="${norm[0].color}" font-size="8" text-anchor="middle">峰 ${MONTHS[i].slice(5)}月</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="cv">${g}${ax}${xl}${path}${pk}</svg>`;
}

/* ══════════════ 面板：现状（照 charts.tsx 复刻） ══════════════ */

/* 现状 A · 排名条：gradientFill(alpha 1→0.35)，无序号无 delta */
const rankBefore = (key, color) => {
  const rows = by(key).slice(0, 7);
  const mx = rows[0].v;
  return rows
    .map((c) => `<div class="br">
    <span class="br-n">${c.short}</span>
    <span class="br-t"><i style="width:${((c.v / mx) * 100).toFixed(1)}%;background:linear-gradient(90deg,${color} 0%,${color}59 100%)"></i></span>
    <span class="br-v num">${num1(c.v)}</span>
  </div>`)
    .join("");
};

/* 现状 B · 环形：「其他」= 前5名之和（bug） */
const donutBefore = (key) => {
  const total = P[key];
  const top = by(key).slice(0, 5);
  const segs = [...top.map((c) => ({ n: c.short, v: c.v, pct: (c.v / total) * 100 })),
    { n: "其他", v: top.reduce((s, c) => s + c.v, 0), pct: (top.reduce((s, c) => s + c.v, 0) / total) * 100 }];
  const sum = segs.reduce((a, s) => a + s.v, 0);
  const cols = ["#38E1FF", "#7C8FFF", "#2FE6A8", "#B58CFF", "#FFB23F", "#5A6B8C"];
  let a0 = -Math.PI / 2;
  const arcs = segs.map((s, i) => {
    const a1 = a0 + (s.v / sum) * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = `M ${(50 + 42 * Math.cos(a0)).toFixed(2)} ${(50 + 42 * Math.sin(a0)).toFixed(2)} A 42 42 0 ${big} 1 ${(50 + 42 * Math.cos(a1)).toFixed(2)} ${(50 + 42 * Math.sin(a1)).toFixed(2)} L ${(50 + 28 * Math.cos(a1)).toFixed(2)} ${(50 + 28 * Math.sin(a1)).toFixed(2)} A 28 28 0 ${big} 0 ${(50 + 28 * Math.cos(a0)).toFixed(2)} ${(50 + 28 * Math.sin(a0)).toFixed(2)} Z`;
    a0 = a1;
    return `<path d="${p}" fill="${cols[i]}"/>`;
  }).join("");
  const leg = segs.map((s, i) => `<span class="lg-i"><i style="background:${cols[i]}"></i>${s.n} ${s.pct.toFixed(1)}%</span>`).join("");
  return `<div class="dn-b">
    <div class="lg-row">${leg}</div>
    <svg viewBox="0 0 100 100">${arcs}</svg>
    <div class="dn-t"><b class="num">${num(P[key])}</b><span>全省</span></div>
  </div>`;
};

/* 现状 C · 走势：本期面积 + 同期虚线，Y 轴 1万 与 2000 混排 */
const trendBefore = (key, compare) => {
  const a = prov(key).values;
  const b = prov(compare).values.map((v, i) => +(v * (0.82 + (i / 12) * 0.16)).toFixed(1));
  const mx = Math.max(...a) * 1.1;
  const n = a.length;
  const X = (i) => 40 + (i / (n - 1)) * (380 - 46);
  const Y = (v) => 132 - (v / mx) * 118;
  const pts = (arr) => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("L");
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    const v = mx * t;
    const y = Y(v).toFixed(1);
    /* 复刻现状的混排：≥1万显示「1万」，其余原样 */
    const lb = v >= 1e4 ? (v / 1e4).toFixed(0) + "万" : num(v);
    return `<line x1="40" y1="${y}" x2="380" y2="${y}" stroke="rgba(122,160,220,.09)"/><text x="34" y="${+y + 3}" fill="#5A6B8C" font-size="8.5" text-anchor="end" font-family="ui-monospace,monospace">${lb}</text>`;
  }).join("");
  const xl = MONTHS.map((m, i) => (i % 2 ? "" : `<text x="${X(i).toFixed(1)}" y="146" fill="#5A6B8C" font-size="8.5" text-anchor="middle" font-family="ui-monospace,monospace">${m.slice(5)}月</text>`)).join("");
  return `<svg viewBox="0 0 420 150" preserveAspectRatio="none" class="cv">${ticks}${xl}
    <path d="M${pts(a)}L380,132L40,132Z" fill="rgba(56,225,255,.16)"/>
    <path d="M${pts(b)}" fill="none" stroke="#5A6B8C" stroke-width="1.2" stroke-dasharray="3 3"/>
    <path d="M${pts(a)}" fill="none" stroke="#38E1FF" stroke-width="1.8"/>
  </svg>`;
};

/* 现状 D · 分组柱：本期/同期并排，两条几乎同形 */
const colBefore = (key) => {
  const rows = by(key).slice(0, 6);
  const mx = Math.max(...rows.map((r) => r.v)) * 1.1;
  const bw = 300 / rows.length;
  return `<svg viewBox="0 0 420 150" preserveAspectRatio="none" class="cv">
    ${[0, 0.5, 1].map((t) => { const y = 138 - t * 126; return `<line x1="40" y1="${y}" x2="410" y2="${y}" stroke="rgba(122,160,220,.09)"/>`; }).join("")}
    ${rows.map((c, i) => {
      const h1 = (c.v / mx) * 126, h2 = (c.v * 0.86 / mx) * 126;
      const x = 46 + i * bw;
      return `<rect x="${(x + bw * 0.16).toFixed(1)}" y="${(138 - h1).toFixed(1)}" width="${(bw * 0.3).toFixed(1)}" height="${h1.toFixed(1)}" fill="#38E1FF" opacity=".85"/>
      <rect x="${(x + bw * 0.52).toFixed(1)}" y="${(138 - h2).toFixed(1)}" width="${(bw * 0.3).toFixed(1)}" height="${h2.toFixed(1)}" fill="#7C8FFF" opacity=".85"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="147" fill="#5A6B8C" font-size="8.5" text-anchor="middle">${c.short}</text>`;
    }).join("")}
  </svg>`;
};

/* 现状 E · 明细表：纯文本三列 */
const tableBefore = (key, unit) => {
  const rows = by(key).slice(0, 8);
  return `<div class="tb-b">
    <div class="tb-br tb-bh"><span>地区</span><span>数值 / ${unit}</span><span>占比</span></div>
    ${rows.map((c) => `<div class="tb-br"><span>${c.short}</span><span class="num">${num1(c.v)}</span><span class="num">${((c.v / P[key]) * 100).toFixed(1)}%</span></div>`).join("")}
  </div>`;
};

/* ══════════════ 面板：优化 ══════════════ */

/* 优化 A · 排名条：序号徽标 + 纯色条（与地图同色标）+ 端点 + delta */
const rankAfter = (key, colorOf) => {
  const rows = by(key).slice(0, 7);
  const mx = rows[0].v;
  return `<div class="rows">` + rows
    .map((c, i) => {
      const s = c.series[key];
      return `<div class="ar">
    <span class="ar-no${i < 3 ? " m" + (i + 1) : ""}">${i < 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][i] : String(i + 1).padStart(2, "0")}</span>
    <span class="ar-n">${c.short}</span>
    <span class="ar-t"><i style="width:${((c.v / mx) * 100).toFixed(1)}%;background:${colorOf(c.name)}"></i><s style="left:${((c.v / mx) * 100).toFixed(1)}%;background:${colorOf(c.name)}"></s></span>
    <span class="ar-v num">${num1(c.v)}</span>
    <span class="ar-d num ${cls(s ? s.yoy : 0)}">${pct(s ? s.yoy : 0)}</span>
  </div>`;
    })
    .join("") + `</div>`;
};

/* 优化 B · 构成：换掉环形，改 100% 堆叠条 + 集中度读数 */
const stackAfter = (key) => {
  const total = P[key];
  const top = by(key).slice(0, 5);
  const cols = ["var(--cyan)", "var(--indigo)", "var(--teal)", "var(--violet)", "var(--amber)"];
  const rest = total - top.reduce((s, c) => s + c.v, 0);
  const segs = [...top.map((c, i) => ({ n: c.short, v: c.v, c: cols[i] })), { n: "其他 6 市", v: rest, c: "var(--slate)" }];
  const sum = segs.reduce((a, s) => a + s.v, 0);
  const cr5 = (top.reduce((a, c) => a + c.v, 0) / total) * 100;
  return `<div class="sa">
    <div class="sa-bar">${segs.map((s) => {
      const p = (s.v / sum) * 100;
      return `<i style="width:${p.toFixed(2)}%;background:${s.c}" title="${s.n} ${p.toFixed(1)}%"><b>${p >= 14 ? `${s.n} ${p.toFixed(0)}%` : p >= 8 ? p.toFixed(0) + "%" : ""}</b></i>`;
    }).join("")}</div>
    <div class="sa-lg">${segs.map((s) => `<span><i style="background:${s.c}"></i>${s.n}<b class="num">${((s.v / total) * 100).toFixed(1)}%</b></span>`).join("")}</div>
    <div class="sa-k"><div><b class="num">${cr5.toFixed(1)}%</b><span>CR5 集中度</span></div>
      <div><b class="num">${num(top[0].v)}</b><span>${top[0].short} 最高</span></div></div>
  </div>`;
};

/* 优化 D · 对照：改为差值条 —— 直接回答"谁在增长" */
const diffAfter = (key) => {
  const rows = by(key).slice(0, 6).map((c) => {
    const s = c.series[key];
    const prev = s.values.slice(0, 12).reduce((a, b) => a + b, 0);
    const cur = s.values.slice(-12).reduce((a, b) => a + b, 0);
    return { ...c, d: cur - prev, p: ((cur - prev) / prev) * 100 };
  }).sort((a, b) => b.p - a.p);
  const mx = Math.max(...rows.map((r) => Math.abs(r.p)));
  return `<div class="rows">` + rows
    .map((c, i) => `<div class="df">
    <span class="ar-no">${String(i + 1).padStart(2, "0")}</span>
    <span class="ar-n">${c.short}</span>
    <span class="df-t"><i style="width:${((Math.abs(c.p) / mx) * 50).toFixed(1)}%;background:${c.p >= 0 ? "var(--teal)" : "var(--magenta)"}"></i><s></s></span>
    <span class="ar-d num ${c.p >= 0 ? "up" : "down"}">${c.p >= 0 ? "+" : "−"}${Math.abs(c.p).toFixed(1)}%</span>
  </div>`)
    .join("") + `</div>`;
};

/* 优化 E · 明细表：内联占比条 + 合计行 */
const tableAfter = (key, unit) => {
  const rows = by(key).slice(0, 6);
  const mx = rows[0].v;
  const top8 = rows.reduce((a, c) => a + c.v, 0);
  return `<div class="ta">
    <div class="ta-r ta-h"><span>地区</span><span>${D.metrics[key].label} / ${unit}</span><span>占全省</span></div>
    ${rows.map((c) => `<div class="ta-r">
      <span class="ta-n">${c.short}</span>
      <span class="num">${num1(c.v)}</span>
      <span class="ta-p"><i style="--w:${((c.v / mx) * 100).toFixed(0)}%"></i><b class="num">${((c.v / P[key]) * 100).toFixed(1)}%</b></span>
    </div>`).join("")}
    <div class="ta-r ta-f"><span>TOP6 合计</span><span class="num">${num(top8)}</span><span class="num">${((top8 / P[key]) * 100).toFixed(1)}%</span></div>
  </div>`;
};

/* ══════════════ 组装 ══════════════ */
const heatPower = heatOf("power");
const heatFault = heatOf("faults");
const heatExport = heatOf("exportValue");

function row(no, name, why, before, after) {
  return `<section class="r">
  <div class="rl"><span class="rl-no">${no}</span><h3>${name}</h3><p>${why}</p></div>
  <div class="cell"><div class="cell-h"><i class="tag b">现状</i><span>charts.tsx 当前实现</span></div><div class="card mini">${before}</div></div>
  <div class="cell"><div class="cell-h"><i class="tag a">优化</i><span>提案</span></div><div class="card mini">${after}</div></div>
</section>`;
}

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>Kobin · 面板优化对照</title><style>
:root{
  --bg:#04060D;--surf:rgba(13,19,33,.74);--surf2:rgba(18,26,43,.82);
  --line:rgba(122,160,220,.13);--line2:rgba(122,160,220,.26);
  --t1:#EAF0FA;--t2:#93A6C4;--t3:#5A6B8C;--t4:#39485F;
  --cyan:#38E1FF;--indigo:#7C8FFF;--teal:#2FE6A8;--amber:#FFB23F;
  --magenta:#FF5C8A;--gold:#FFD166;--violet:#B58CFF;--slate:#46587A;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;
  --sans:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;--r:3px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);color:var(--t1);background:var(--bg);padding:34px 40px 60px;-webkit-font-smoothing:antialiased}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.up{color:var(--teal)} .down{color:var(--magenta)}
.hd{display:flex;align-items:baseline;gap:16px;margin-bottom:6px}
.hd h1{font-size:24px;font-weight:700;letter-spacing:.02em}
.hd span{font-family:var(--mono);font-size:11px;letter-spacing:.2em;color:var(--cyan);text-transform:uppercase}
.hd p{font-size:12px;color:var(--t3);margin-left:auto;text-align:right;line-height:1.7}

.r{display:grid;grid-template-columns:236px 1fr 1fr;gap:22px;padding:22px 0;border-top:1px solid var(--line)}
.rl h3{font-size:15px;font-weight:600;margin-bottom:8px}
.rl-no{font-family:var(--mono);font-size:10px;color:var(--t4);letter-spacing:.14em;display:block;margin-bottom:6px}
.rl p{font-size:11px;color:var(--t3);line-height:1.85}
.rl p b{color:var(--amber);font-weight:600}
.rl p i{color:var(--magenta);font-style:normal;font-weight:600}

.cell-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.cell-h span{font-size:10.5px;color:var(--t4)}
.tag{font-style:normal;font-family:var(--mono);font-size:9px;letter-spacing:.14em;padding:2px 7px;border-radius:2px}
.tag.b{color:#2A0812;background:var(--magenta)}
.tag.a{color:#04211A;background:var(--teal)}

.card{background:linear-gradient(168deg,var(--surf2),var(--surf));border:1px solid var(--line);
  border-radius:var(--r);padding:11px 13px 12px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;height:2px;width:62%;
  background:linear-gradient(90deg,var(--cyan),transparent 96%);box-shadow:0 0 14px -2px var(--cyan)}
.mini{height:212px;display:flex;flex-direction:column;gap:7px}
.rows{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.cv{width:100%;flex:1;min-height:0;display:block}

/* 现状 · 排名条 */
.br{display:grid;grid-template-columns:44px 1fr 52px;align-items:center;gap:8px;font-size:11px}
.br-n{color:var(--t2)}
.br-t{height:6px;background:rgba(122,160,220,.1);border-radius:2px;position:relative;overflow:hidden}
.br-t i{position:absolute;inset:0 auto 0 0;border-radius:0 2px 2px 0}
.br-v{text-align:right;color:var(--t2);font-size:11px}

/* 现状 · 环形 */
.dn-b{flex:1;display:flex;flex-direction:column;min-height:0}
.lg-row{display:flex;flex-wrap:wrap;gap:5px 10px;font-size:8.5px;color:var(--t3);font-family:var(--mono)}
.lg-i{display:inline-flex;align-items:center;gap:3px}
.lg-i i{width:6px;height:6px;border-radius:1px}
.dn-b svg{flex:1;min-height:0;width:100%}
.dn-t{text-align:center}
.dn-t b{display:block;font-family:var(--mono);font-size:17px;font-weight:700;line-height:1.1}
.dn-t span{font-size:9px;color:var(--t3)}

/* 现状 · 表格 */
.tb-b{flex:1;display:flex;flex-direction:column;overflow:hidden}
.tb-br{display:grid;grid-template-columns:1fr 1fr 52px;gap:8px;padding:3.5px 0;font-size:10.5px;
  border-bottom:1px solid rgba(122,160,220,.06)}
.tb-bh{color:var(--t4);font-size:9px;font-family:var(--mono)}
.tb-br span:nth-child(2),.tb-br span:nth-child(3){text-align:right}
.tb-br span{color:var(--t2)}

/* 优化 · 排名条 */
.ar{display:grid;grid-template-columns:24px 42px 1fr 54px 46px;align-items:center;gap:7px;
  padding:4px 0;border-bottom:1px solid rgba(122,160,220,.05);font-size:11px}
.ar-no{font-family:var(--mono);font-size:9px;color:var(--t4);text-align:center;
  border:1px solid var(--line);border-radius:2px;line-height:14px;height:15px}
.ar-no.m1{color:#2A1B04;background:var(--gold);border-color:var(--gold)}
.ar-no.m2{color:#0E1620;background:#C8D6E8;border-color:#C8D6E8}
.ar-no.m3{color:#2A1206;background:#D8955C;border-color:#D8955C}
.ar-n{color:var(--t2);white-space:nowrap}
.ar-t{height:6px;background:rgba(122,160,220,.09);border-radius:2px;position:relative}
.ar-t i{position:absolute;inset:0 auto 0 0;border-radius:2px}
.ar-t s{position:absolute;top:-2px;width:3px;height:10px;border-radius:1px;transform:translateX(-1.5px);
  box-shadow:0 0 6px currentColor}
.ar-v{text-align:right;font-size:11px}
.ar-d{text-align:right;font-size:9px}

/* 优化 · 堆叠条 */
.sa{flex:1;display:flex;flex-direction:column;gap:10px;min-height:0}
.sa-bar{height:34px;border-radius:2px;overflow:hidden;display:flex;flex:none}
.sa-bar i{position:relative;display:grid;place-items:center;border-right:1px solid rgba(4,6,13,.5)}
.sa-bar i:last-child{border-right:0}
.sa-bar i b{font-family:var(--mono);font-size:9px;color:#04060D;font-weight:700;white-space:nowrap}
.sa-lg{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 10px;font-size:9px;color:var(--t3)}
.sa-lg span{display:inline-flex;align-items:center;gap:4px}
.sa-lg i{width:6px;height:6px;border-radius:1px;flex:none}
.sa-lg b{margin-left:auto;color:var(--t2);font-size:9px}
.sa-k{display:flex;gap:18px;margin-top:auto;padding-top:8px;border-top:1px solid var(--line)}
.sa-k div{display:flex;flex-direction:column;gap:1px}
.sa-k b{font-family:var(--mono);font-size:17px;font-weight:700;line-height:1.1}
.sa-k span{font-size:9px;color:var(--t3)}

/* 优化 · 差值条 */
.df{display:grid;grid-template-columns:24px 42px 1fr 50px;align-items:center;gap:7px;
  padding:4px 0;border-bottom:1px solid rgba(122,160,220,.05);font-size:11px}
.df-t{height:11px;background:rgba(122,160,220,.07);border-radius:2px;position:relative}
.df-t i{position:absolute;top:2px;bottom:2px;border-radius:1px}
.df-t i::after{}
.df-t s{position:absolute;left:50%;top:-1px;bottom:-1px;width:1px;background:rgba(122,160,220,.32)}

/* 优化 · 表格 */
.ta{flex:1;display:flex;flex-direction:column;overflow:hidden}
.ta-r{display:grid;grid-template-columns:44px 1fr 96px;align-items:center;gap:8px;padding:3px 0;
  font-size:10.5px;border-bottom:1px solid rgba(122,160,220,.05)}
.ta-h{color:var(--t4);font-size:9px;font-family:var(--mono);border-bottom:1px solid var(--line)}
.ta-h span:nth-child(2){text-align:right}
.ta-n{color:var(--t2)}
.ta-r .num{text-align:right;color:var(--t1)}
.ta-p{display:grid;grid-template-columns:1fr 36px;align-items:center;gap:6px}
.ta-p i{position:relative;height:4px;background:rgba(122,160,220,.1);border-radius:2px;overflow:hidden}
.ta-p i::after{content:'';position:absolute;inset:0 auto 0 0;width:var(--w);border-radius:2px;
  background:linear-gradient(90deg,var(--cyan),rgba(56,225,255,.35));box-shadow:0 0 7px -2px var(--cyan)}
.ta-p b{text-align:right;font-size:9px;color:var(--t3)}
.ta-f{border-bottom:0;border-top:1px solid var(--line2);margin-top:auto;color:var(--t2)}
.ta-f span:first-child{color:var(--t3)}
</style></head><body>

<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38E1FF" stop-opacity=".55"/><stop offset="1" stop-color="#38E1FF" stop-opacity="0"/></linearGradient>
</defs></svg>

<div class="hd"><h1>左右侧面板 · 现状与优化对照</h1><span>Panel Refinement</span>
<p>数据取自运行中的产品（11 市 × 11 指标 × 24 月）<br/>「现状」一列照 charts.tsx 当前配置复刻</p></div>

${row("A", "排名条 RankBars",
    `条形用 <b>渐变</b>（alpha 1→0.35）<br/>短条与长条颜色不一致，<i>颜色不承载信息</i><br/>无序号、无同比，视线要从条尾跳到数字列`,
    rankBefore("power", "#38E1FF"),
    rankAfter("power", heatPower))}

${row("B", "构成占比 DonutShare",
    `<i>真 bug</i>：「其他」这一片是<b>前 5 名之和</b><br/>6 片合计 = 全省 ×1.73，百分比必然超 100%<br/>且「其他」占环 60% ���环形图<b>彻底失效</b>`,
    donutBefore("power"),
    stackAfter("power"))}

${row("C", "走势 TrendLines",
    `Y 轴混排 <b>1万</b> 与 2000<br/>同期是同一份合成序列，<i>两条线几乎重合</i><br/>无端点读数，读者要自己找最后一点的值`,
    trendBefore("power", "power"),
    lineSvg([
      { values: prov("power").values, color: "var(--cyan)" },
      { values: prov("power").values.map((v, i) => v * (0.82 + (i / 24) * 0.16)), color: "var(--slate)", name: "同期" },
    ], { index: true, marks: true }))}

${row("D", "对照 ColumnSet",
    `本期 / 同期并排，<b>两柱几乎等高</b><br/>看上去处处「无变化」，读者得自己心算差值<br/>这类图存在意义就是<b>对比</b>，却把对比做没了`,
    colBefore("power"),
    `<div class="sa" style="justify-content:center"><div class="sa-lg" style="grid-template-columns:1fr 1fr;margin-bottom:2px">
       <span><i style="background:var(--teal)"></i>同比增长<b>领先</b></span><span><i style="background:var(--magenta)"></i>同比下降</span></div>
     ${diffAfter("power")}</div>`)}

${row("E", "明细表 DetailTable",
    `纯文本三列，占比要<b>心算比较</b><br/>行分隔线偏重，密集时发闷<br/>看不到「全省」这个分母，<i>占比失去参照</i>`,
    tableBefore("power", "亿千瓦时"),
    tableAfter("power", "亿千瓦时"))}

${row("F", "KPI 轨 KpiRail",
    `<b>6 个等宽方盒</b>，权重完全相同<br/>全社会用电 9618 是主角，设备故障 619 是配角<br/>但字号一样，<i>视觉上没有主次</i>`,
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;flex:1;align-content:start">
      ${[["全省发电量", "4940.5", "+6.6%", "#38E1FF"], ["全社会用电", "9618.4", "+4.6%", "#38E1FF"], ["设备故障", "619", "-2.6%", "#FF5C8A"],
         ["投入企业", "28,873", "+2.0%", "#2FE6A8"], ["运行健康度", "70", "+1.3%", "#FFB23F"], ["待处理事项", "438", "-1.0%", "#7C8FFF"]]
        .map(([k, v, d, c]) => `<div style="padding:8px 10px;background:rgba(122,160,220,.05);border-left:2px solid ${c};border-radius:2px">
        <div style="font-size:9px;color:var(--t3);display:flex;gap:4px;align-items:center"><i style="width:4px;height:4px;border-radius:50%;background:${c}"></i>${k}</div>
        <div class="num" style="font-size:17px;font-weight:700;line-height:1.25">${v}</div>
        <div class="num" style="font-size:9px;color:${d.startsWith('-') ? 'var(--magenta)' : 'var(--teal)'}">${d}</div></div>`).join("")}
     </div>`,
    `<div style="display:grid;grid-template-columns:1.5fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:7px;flex:1">
      <div style="grid-row:span 2;padding:11px 13px;background:linear-gradient(135deg,rgba(56,225,255,.15),rgba(13,19,33,.7));border:1px solid rgba(56,225,255,.3);border-radius:3px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--cyan)">POWER · 主导指标</div>
        <div class="num" style="font-size:30px;font-weight:700;line-height:1">9618.4<u style="font-size:11px;text-decoration:none;color:var(--t3);margin-left:5px">亿千瓦时</u></div>
        <div style="display:flex;align-items:center;gap:7px"><span class="num" style="font-size:9px;font-weight:600;background:var(--teal);color:#04211A;padding:2px 6px;border-radius:2px">▲ +4.6%</span>
          <div style="flex:1;height:18px;min-height:0;overflow:hidden">${lineSvg([{ values: prov("power").values, color: "var(--cyan)" }], { index: true, padL: 0, padR: 0, padT: 2, padB: 2, grid: 0 }).replace('preserveAspectRatio="none"', 'preserveAspectRatio="none" style="height:18px"')}</div></div>
      </div>
      ${[["全省发电量", "4940.5", "+6.6%", "#38E1FF"], ["运行健康度", "70", "+1.3%", "#FFB23F"], ["设备故障", "619", "−2.6%", "#FF5C8A"], ["待处理事项", "438", "−1.0%", "#7C8FFF"]]
        .map(([k, v, d, c]) => `<div style="padding:7px 10px;background:rgba(122,160,220,.05);border-left:2px solid ${c};border-radius:2px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:9px;color:var(--t3)">${k}</div>
        <div style="display:flex;align-items:baseline;gap:5px"><span class="num" style="font-size:15px;font-weight:700">${v}</span>
        <span class="num" style="font-size:9px;color:${d.startsWith('−') || d.startsWith('-') ? 'var(--magenta)' : 'var(--teal)'}">${d}</span></div></div>`).join("")}
    </div>`)}

</body></html>`;

const OUT = new URL("../mockup/panels-before-after.html", import.meta.url).pathname;
writeFileSync(OUT, html);
console.log(`✓ mockup/panels-before-after.html  ${(html.length / 1024).toFixed(0)}KB`);
console.log(`  6 组对照 · 数据 11 市 × ${MONTHS.length} 月（真实导出）`);
