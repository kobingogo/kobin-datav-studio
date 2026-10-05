/**
 * 生成 v3 UI 设计稿（自包含 HTML）。
 *
 *   node tools/buildMockup.mjs
 *
 * 输出 mockup/v3-dashboard.html —— 单文件、无外部依赖、可直接浏览器打开。
 * 地图用真实浙江 GeoJSON 投影出的 SVG path，不是占位图。
 *
 * 数据刻意设计而非随机：达成率有红黄绿分布、yoy 有正负、行业构成有量级差，
 * 否则可视化只会呈现「全都一样」，看不出信息量。
 */
import { writeFileSync, readFileSync } from "node:fs";

const GEO = new URL("../sc-datav/src/geo/", import.meta.url).pathname;
const OUT = new URL("../mockup/", import.meta.url).pathname;

const geo = JSON.parse(readFileSync(`${GEO}zhejiang.json`, "utf8"));

/* ══════════════ 投影：真实几何 → SVG path ══════════════ */
const flat = geo.features.flatMap((f) => f.geometry.coordinates.flat(2));
const minLon = Math.min(...flat.map((p) => p[0]));
const maxLon = Math.max(...flat.map((p) => p[0]));
const minLat = Math.min(...flat.map((p) => p[1]));
const maxLat = Math.max(...flat.map((p) => p[1]));
const VW = 1600;
const K = VW / (maxLon - minLon);
const VH = Math.round((maxLat - minLat) * K);
const px = (lon) => ((lon - minLon) * K).toFixed(1);
const py = (lat) => ((maxLat - lat) * K).toFixed(1);

const pathOf = (f) =>
  f.geometry.coordinates
    .flatMap((poly) =>
      poly.map((ring) => {
        let s = "";
        ring.forEach((pt, i) => {
          s += `${i ? "L" : "M"}${px(pt[0])},${py(pt[1])}`;
        });
        return s + "Z";
      })
    )
    .join("");

const regions = geo.features
  .map((f) => ({
    name: f.properties.name,
    d: pathOf(f),
    cx: (px(f.properties.centroid[0]) / VW) * 100,
    cy: (py(f.properties.centroid[1]) / VH) * 100,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "zh"));

/* ══════════════ 演示数据：设计过的，不是随机的 ══════════════
   量级贴近浙江 2024 实际（GDP 约 8.9 万亿），并刻意做出结构差异：
   plan 有 76→105 的分布，yoy 有正有负，heat 与经济密度正相关。 */
const CITY = [
  // name       gdp    exp   tax  power  ent   yoy    plan  heat
  ["杭州市", 20000, 6850, 2980, 1420, 520, +5.2, 102, 96],
  ["宁波市", 18150, 6320, 2210, 1180, 448, +6.8, 98, 88],
  ["温州市", 10030, 1980, 1120, 760, 292, +3.4, 91, 62],
  ["绍兴市", 9000, 1720, 860, 620, 268, +4.9, 105, 70],
  ["嘉兴市", 7500, 2210, 780, 590, 236, +5.6, 96, 66],
  ["台州市", 6500, 1180, 640, 540, 208, +2.1, 88, 52],
  ["金华市", 6000, 1290, 700, 610, 244, +4.4, 93, 58],
  ["湖州市", 4500, 940, 520, 430, 212, +3.9, 87, 40],
  ["舟山市", 2300, 480, 210, 190, 132, +8.3, 76, 34],
  ["衢州市", 2200, 320, 260, 300, 186, -0.8, 79, 26],
  ["丽水市", 2100, 280, 230, 280, 208, -1.4, 84, 24],
];

const METRICS = [
  { key: "gdp", label: "GDP" },
  { key: "exp", label: "出口" },
  { key: "tax", label: "税收" },
  { key: "power", label: "用电" },
  { key: "ent", label: "企业" },
];

const byGdp = [...CITY].sort((a, b) => b[1] - a[1]);
const rankOf = (name) => byGdp.findIndex((c) => c[0] === name) + 1;

const cities = CITY.map(([name, gdp, exp, tax, power, ent, yoy, plan, heat]) => {
  const seed = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = (() => {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();
  /* 月度序列：以 yoy 为斜率造趋势，叠加噪声 —— 走势与标注的 yoy 一致 */
  const walk = (base, slope, vol, n = 24) => {
    const out = [];
    let v = base / (1 + slope);
    for (let i = 0; i < n; i++) {
      v *= 1 + slope / n + (rnd() - 0.5) * vol;
      out.push(v);
    }
    return out;
  };
  const spark = (data, w = 108, h = 26) => {
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    return (
      "M" +
      data
        .map(
          (v, i) =>
            `${((i * w) / (data.length - 1)).toFixed(1)},${(
              h -
              ((v - mn) / (mx - mn || 1)) * (h - 3) -
              1.5
            ).toFixed(1)}`
        )
        .join("L")
    );
  };
  const trend = walk(gdp, yoy / 100, 0.055);
  const prev = trend.map((v) => v * (0.985 - rnd() * 0.05));
  return {
    name,
    short: name.replace("市", ""),
    gdp, exp, tax, power, ent, yoy, plan, heat,
    rank: rankOf(name),
    line: spark(trend),
    prevLine: spark(prev),
    area: spark(trend) + "L108,26L0,26Z",
    prevArea: spark(prev) + "L108,26L0,26Z",
  };
});

const T = cities.reduce(
  (a, c) => ({
    gdp: a.gdp + c.gdp, exp: a.exp + c.exp, tax: a.tax + c.tax,
    power: a.power + c.power, ent: a.ent + c.ent,
  }),
  { gdp: 0, exp: 0, tax: 0, power: 0, ent: 0 }
);

/* 行业构成 */
const INDUSTRY = [
  { n: "装备制造", v: 26200, c: "cyan" },
  { n: "数字经济", v: 21800, c: "indigo" },
  { n: "批发零售", v: 12400, c: "teal" },
  { n: "金融保险", v: 9100, c: "violet" },
  { n: "新材料", v: 7400, c: "amber" },
  { n: "其他", v: 6300, c: "slate" },
];
const IND_TOTAL = INDUSTRY.reduce((a, x) => a + x.v, 0);

/* 事件流 */
const EVENTS = [
  { t: "20:41:02", c: "宁波市", s: "warn", k: "出口", v: "同比 +18.2% 环比转正" },
  { t: "20:39:47", c: "温州市", s: "info", k: "用电", v: "负荷 触及 92% 预警线" },
  { t: "20:37:11", c: "杭州市", s: "good", k: "税收", v: "单月增量突破 280 亿" },
  { t: "20:34:58", c: "台州市", s: "crit", k: "能耗", v: "单位产出能耗环比 +4.1%" },
  { t: "20:31:26", c: "金华市", s: "info", k: "企业", v: "新规上 128 家" },
  { t: "20:28:03", c: "绍兴市", s: "good", k: "出口", v: "完成季度目标 103%" },
  { t: "20:24:40", c: "湖州市", s: "warn", k: "GDP", v: "排名环比下降 1 位" },
  { t: "20:22:15", c: "衢州市", s: "crit", k: "GDP", v: "连续两月同比负增长" },
  { t: "20:19:52", c: "丽水市", s: "crit", k: "税收", v: "低于时序下界 6.2%" },
  { t: "20:17:30", c: "嘉兴市", s: "good", k: "用电", v: "负荷曲线创新高" },
];

/* ══════════════ Treemap：squarified ══════════════ */
const treemap = (() => {
  const scale = (100 * 100) / IND_TOTAL;
  const items = [...INDUSTRY]
    .sort((a, b) => b.v - a.v)
    .map((i) => ({ ...i, a: i.v * scale }));

  const worst = (row, side) => {
    const ra = row.reduce((s, r) => s + r.a, 0);
    return Math.max(
      ...row.map((r) => {
        const s = (side * side * r.a) / (ra * ra);
        return Math.max(s, 1 / s);
      })
    );
  };

  const out = [];
  let rx = 0, ry = 0, rw = 100, rh = 100, i = 0;

  while (i < items.length) {
    /* squarified：行沿较短边铺开，切掉一条垂直于长边的厚条
       vertical → 行是一列（x=rx, w=thick），块在列内上下叠，len 落在 h
       否则     → 行是一条带（y=ry, h=thick），块在带内左右排，len 落在 w */
    const vertical = rw >= rh;
    const side = vertical ? rh : rw;
    let j = i + 1;
    while (j < items.length) {
      if (j === i + 1 || worst(items.slice(i, j + 1), side) <= worst(items.slice(i, j), side)) j++;
      else break;
    }
    const row = items.slice(i, j);
    const ra = row.reduce((s, r) => s + r.a, 0);
    const thick = ra / side;
    let off = 0;
    row.forEach((it) => {
      const len = (it.a / ra) * side;
      out.push(
        vertical
          ? { ...it, x: rx, y: ry + off, w: thick, h: len }
          : { ...it, x: rx + off, y: ry, w: len, h: thick }
      );
      off += len;
    });
    if (vertical) { rx += thick; rw -= thick; }
    else { ry += thick; rh -= thick; }
    i = j;
  }

  /* 块内显示几行字交给容器查询（见 .tm-g），生成时只管输出全部三行 */
  return out
    .map(
      (r) => `<div class="tm" style="--x:${r.x.toFixed(2)}%;--y:${r.y.toFixed(2)}%;--w:${r.w.toFixed(2)}%;--h:${r.h.toFixed(2)}%;--c:var(--${r.c})">
    <div class="tm-in"><b>${r.n}</b><span class="num">${r.v.toLocaleString()}</span><em class="num">${((r.v / IND_TOTAL) * 100).toFixed(1)}%</em></div>
  </div>`
    )
    .join("");
})();

/* ══════════════ 色阶：heat → 颜色（地图与排名共用一套） ══════════════
   单色相拉明度跨度，契合整体青蓝科技风；同时保证各地市颜色可区分。 */
const RAMP = [
  [0.0, [10, 27, 51]],
  [0.35, [20, 84, 127]],
  [0.65, [30, 154, 201]],
  [1.0, [123, 232, 255]],
];
const rampColor = (t) => {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < RAMP.length - 2 && t > RAMP[i + 1][0]) i++;
  const [t0, c0] = RAMP[i];
  const [t1, c1] = RAMP[i + 1];
  const f = (t - t0) / (t1 - t0);
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
};
const HEAT_LO = 18;
const HEAT_HI = 96;
const heatColor = (h) => rampColor((h - HEAT_LO) / (HEAT_HI - HEAT_LO));

/* ══════════════ 渲染 ══════════════ */
const fmt = (v) => (v >= 10000 ? (v / 10000).toFixed(2) + "万亿" : v.toLocaleString());
const dlt = (v) => `${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%`;
const cls = (v) => (v >= 0 ? "up" : "down");

/* 矩阵：列内归一化，颜色直接给 rgba（color-mix + calc(var()) 无效） */
const colMax = Object.fromEntries(
  METRICS.map((m) => [m.key, Math.max(...cities.map((c) => c[m.key]))])
);
const cellColor = (p) =>
  p > 0.001
    ? `rgba(56,225,255,${(0.06 + Math.pow(p, 0.75) * 0.72).toFixed(3)})`
    : "rgba(122,160,220,.06)";
const matrix = cities
  .slice()
  .sort((a, b) => b.gdp - a.gdp)
  .slice(0, 9)
  .map(
    (c) => `<div class="mx-r"><span class="mx-n">${c.short}</span>${METRICS.map((m) => {
      const p = c[m.key] / colMax[m.key];
      const v = c[m.key];
      return `<i style="background:${cellColor(p)}" title="${m.label} ${v.toLocaleString()}">${v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString()}</i>`;
    }).join("")}</div>`
  )
  .join("");

/* 排名 */
const ranking = cities
  .slice()
  .sort((a, b) => b.gdp - a.gdp)
  .map((c) => {
    const w = ((c.gdp / byGdp[0][1]) * 100).toFixed(1);
    const tone = heatColor(c.heat);
    return `<div class="rk">
  <span class="rk-no">${String(c.rank).padStart(2, "0")}</span>
  <span class="rk-n">${c.short}</span>
  <span class="rk-t"><i style="--w:${w}%;--c:${tone}"></i></span>
  <span class="rk-v num">${c.gdp.toLocaleString()}</span>
  <span class="rk-d num ${cls(c.yoy)}">${dlt(c.yoy)}</span>
</div>`;
  })
  .join("");

/* bullet：设计过的达成率，红黄绿分布 */
const bullets = cities
  .slice()
  .sort((a, b) => b.plan - a.plan)
  .map((c) => {
    const p = Math.min(108, c.plan);
    const tone = p >= 100 ? "good" : p >= 90 ? "warn" : "crit";
    const lo = Math.max(0, p - 16);
    return `<div class="bl">
  <span class="bl-n">${c.short}</span>
  <span class="bl-t">
    <i class="bl-band" style="left:${lo}%;width:16%"></i>
    <i class="bl-fill ${tone}" style="width:${p}%"></i>
    <i class="bl-goal"></i>
  </span>
  <span class="bl-v num ${tone}">${p}%</span>
</div>`;
  })
  .join("");

/* 地图：热力用 heat 值，注记走 HTML 覆盖层（SVG 内文字会随缩放变小） */
const mapPaths = regions
  .map((r) => {
    const c = cities.find((x) => x.name === r.name);
    return `<path class="rg" data-name="${r.short}" d="${r.d}" style="fill:${heatColor(c.heat)}"/>`;
  })
  .join("");

const mapLabels = regions
  .map((r) => {
    const c = cities.find((x) => x.name === r.name);
    return `<span class="ml" style="left:${r.cx}%;top:${r.cy}%">
  <b>${c.short}</b><em class="num">${c.gdp.toLocaleString()}</em></span>`;
  })
  .join("");

const feed = EVENTS.map(
  (e) => `<div class="fd-r">
  <span class="fd-t num">${e.t}</span>
  <i class="fd-d ${e.s}"></i>
  <span class="fd-c">${e.c.replace("市", "")}</span>
  <span class="fd-k num">${e.k}</span>
  <span class="fd-v">${e.v}</span>
</div>`
).join("");

const kpis = [
  { k: "出口总额", v: fmt(T.exp), u: "亿元", d: +7.4, c: "cyan" },
  { k: "税收总额", v: fmt(T.tax), u: "亿元", d: +4.2, c: "indigo" },
  { k: "全社会用电", v: T.power.toLocaleString(), u: "亿 kWh", d: +5.8, c: "amber" },
  { k: "规上企业", v: T.ent.toLocaleString(), u: "家", d: +3.1, c: "teal" },
];

const sparkWall = cities
  .slice()
  .sort((a, b) => b.gdp - a.gdp)
  .map(
    (c, i) => `<div class="sw${i === 0 ? " top" : ""}">
  <div class="sw-h"><i></i>${c.short}<span class="num">${c.gdp.toLocaleString()}</span></div>
  <svg viewBox="0 0 108 26" preserveAspectRatio="none">
    <path class="dr" d="${c.prevArea}" fill="var(--slate)" opacity=".2" style="animation-delay:${0.1 + i * 0.05}s"/>
    <path d="${c.prevLine}" fill="none" stroke="var(--slate)" stroke-width="1" opacity=".9"/>
    <path class="dr" d="${c.area}" fill="url(#gCyan)" opacity=".22" style="animation-delay:${0.15 + i * 0.05}s"/>
    <path class="dr" d="${c.line}" fill="none" stroke="var(--cyan)" stroke-width="1.3" style="animation-delay:${0.15 + i * 0.05}s"/>
  </svg>
  <div class="sw-f"><span class="num ${cls(c.yoy)}">${dlt(c.yoy)}</span><span class="sw-p">计划 ${c.plan}%</span></div>
</div>`
  )
  .join("");

const html = /* html */ `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kobin 数据大屏 · v3 设计稿</title>
<style>
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
body{font-family:var(--sans);color:var(--t1);background:var(--bg);
  display:grid;place-items:center;min-height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.up{color:var(--teal)} .down{color:var(--magenta)}
.warn{color:var(--amber)} .good{color:var(--teal)} .crit{color:var(--magenta)}

/* ── 1920×1080 固定舞台，按视口缩放 ── */
#fit{width:1920px;height:1080px;transform-origin:center;position:relative;z-index:1}

/* ══ 仪表框 ══
   ① 顶部量程条（长度=完成度，语义）②右上刻度尺 ③两角括号 ④hover 括号张开 */
.dk{position:relative;display:flex;flex-direction:column;min-height:0;
  background:linear-gradient(168deg,var(--surf2),var(--surf));
  border:1px solid var(--line);border-radius:var(--r);
  backdrop-filter:blur(20px) saturate(1.25);overflow:hidden}
.dk::before{content:'';position:absolute;top:0;left:0;height:2px;width:var(--fill,60%);z-index:3;
  background:linear-gradient(90deg,var(--ac),transparent 96%);
  box-shadow:0 0 14px -2px var(--ac);transition:width 1.3s var(--ease)}
.dk::after{content:'';position:absolute;top:10px;right:11px;width:28px;height:5px;opacity:.7;
  background:repeating-linear-gradient(90deg,var(--line2) 0 1px,transparent 1px 5px)}
.dk>.brk{position:absolute;width:11px;height:11px;pointer-events:none;opacity:.6;z-index:4;
  border-color:var(--ac);transition:all .2s var(--ease)}
.dk>.brk.tl{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid}
.dk>.brk.br{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid}
.dk:hover{border-color:var(--line2)}
.dk:hover>.brk{opacity:1;width:16px;height:16px}

/* ══ 铭牌：标题区承载数据 ══ */
.pl{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;
  padding:9px 13px 8px;border-bottom:1px solid var(--line)}
.pl-l{display:flex;align-items:baseline;gap:8px;min-width:0}
.pl-no{font-family:var(--mono);font-size:10px;color:var(--t4);letter-spacing:.14em}
.pl-t{font-size:13px;font-weight:600;letter-spacing:.04em;white-space:nowrap}
.pl-en{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--t4);text-transform:uppercase;white-space:nowrap}
.pl-v{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--ac);white-space:nowrap}
.bd{flex:1;min-height:0;padding:10px 13px 12px;display:flex;flex-direction:column;gap:8px;overflow:hidden}

/* ══ 顶栏 ══ */
.top{display:grid;grid-template-columns:286px repeat(4,1fr) 196px;gap:12px;height:92px}
.hero{position:relative;padding:11px 15px;display:flex;flex-direction:column;justify-content:space-between;
  background:linear-gradient(135deg,rgba(56,225,255,.14),rgba(13,19,33,.72) 62%);
  border:1px solid rgba(56,225,255,.32);border-radius:var(--r);overflow:hidden}
.hero::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(110% 100% at 0% 0%,rgba(56,225,255,.17),transparent 58%)}
.hero-k{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--cyan);text-transform:uppercase;position:relative}
.hero-v{font-family:var(--mono);font-size:40px;font-weight:700;line-height:1;letter-spacing:-.02em;
  display:flex;align-items:baseline;gap:6px;position:relative}
.hero-v u{font-size:13px;font-style:normal;text-decoration:none;color:var(--t3);font-weight:400}
.hero-f{display:flex;align-items:center;gap:9px;position:relative}
.pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:2px;
  font-family:var(--mono);font-size:10px;font-weight:600;background:var(--teal);color:#04211A}
.hero svg{height:24px;flex:1}

.kpi{padding:10px 13px;display:flex;flex-direction:column;gap:5px;justify-content:center;
  background:var(--surf);border:1px solid var(--line);border-radius:var(--r);position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac)}
.kpi-k{font-size:10px;color:var(--t3);display:flex;align-items:center;gap:5px;white-space:nowrap}
.kpi-k i{width:4px;height:4px;border-radius:50%;background:var(--ac);box-shadow:0 0 6px var(--ac)}
.kpi-v{font-family:var(--mono);font-size:22px;font-weight:700;line-height:1;display:flex;align-items:baseline;gap:4px}
.kpi-v u{font-size:10px;font-style:normal;text-decoration:none;color:var(--t3);font-weight:400}
.kpi-s{height:18px;margin-top:auto}

.clk{padding:10px 13px;display:flex;flex-direction:column;justify-content:center;gap:3px;
  background:var(--surf);border:1px solid var(--line);border-radius:var(--r)}
.clk-t{font-family:var(--mono);font-size:21px;font-weight:600;letter-spacing:.02em}
.clk-t s{text-decoration:none;color:var(--t4);font-size:13px}
.clk-m{font-size:9px;color:var(--t4);font-family:var(--mono);line-height:1.5}

/* ══ 主体 ══ */
.mid{display:grid;grid-template-columns:300px 1fr 340px;gap:12px;height:834px;margin-top:12px}
.rail{display:grid;gap:12px;min-height:0}
.rail.l{grid-template-rows:.92fr 1fr 1.15fr}
.rail.r{grid-template-rows:auto 1fr}

/* ══ 地图舞台 ══ */
.stage .bd{padding:0;position:relative}
.stage-in{position:relative;flex:1;min-height:0;display:grid;place-items:center}
/* mapbox 保持 viewBox 比例，HTML 注记按百分比对齐 */
.mapbox{position:relative;height:100%;aspect-ratio:${VW} / ${VH};
  filter:drop-shadow(0 18px 44px rgba(0,0,0,.62)) drop-shadow(0 0 60px rgba(56,225,255,.09))}
.mapbox svg{width:100%;height:100%;overflow:visible}
.rg{stroke:rgba(190,225,255,.34);stroke-width:.7;stroke-linejoin:round;
  transition:stroke .25s,filter .25s;cursor:pointer}
.rg:hover{stroke:var(--gold);stroke-width:1.8;filter:brightness(1.18)}
/* 注记做成 HTML：SVG 内文字会随缩放变小，12px 在 1600 宽的 viewBox 下只剩 2px */
.ml{position:absolute;transform:translate(-50%,-50%);text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap}
.ml b{font-size:12px;font-weight:600;letter-spacing:.06em;
  text-shadow:0 0 3px #04060D,0 0 6px #04060D,0 0 10px #04060D,0 1px 2px #04060D}
.ml em{font-size:9px;font-style:normal;color:#C6D6EC;
  text-shadow:0 0 3px #04060D,0 0 6px #04060D,0 0 10px #04060D,0 1px 2px #04060D}
.ml::before{content:'';position:absolute;left:50%;top:-9px;width:4px;height:4px;margin-left:-2px;
  border-radius:50%;background:var(--cyan);box-shadow:0 0 7px var(--cyan)}
/* 四角仪表注记 */
.anno{position:absolute;font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--t4);
  display:flex;align-items:center;gap:6px;white-space:nowrap;z-index:2}
.anno b{color:var(--cyan);font-weight:600}
.a1{top:8px;left:12px} .a2{top:8px;right:12px}
.a3{bottom:8px;left:12px} .a4{bottom:8px;right:12px}
.lgd{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;
  gap:8px;font-size:9px;color:var(--t3);z-index:2}
.lgd .ramp{width:88px;height:4px;border-radius:2px;
  background:linear-gradient(90deg,${RAMP.map(([t, c]) => `rgb(${c.join(",")}) ${(t * 100).toFixed(0)}%`).join(",")})}
.compass{position:absolute;top:6px;left:50%;margin-left:-17px;width:34px;height:34px;opacity:.45;z-index:2}
.scan{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:var(--r)}
.scan::before{content:'';position:absolute;left:0;right:0;height:110px;
  background:linear-gradient(180deg,transparent,rgba(56,225,255,.075) 55%,transparent);
  animation:scan 8s linear infinite}
@keyframes scan{0%{transform:translateY(-110px)}100%{transform:translateY(100%)}}

/* ══ 排名 ══ */
.rk{display:grid;grid-template-columns:20px 42px 1fr 58px 48px;align-items:center;gap:8px;
  padding:5px 0;border-bottom:1px solid rgba(122,160,220,.06);font-size:11px}
.rk-no{font-family:var(--mono);font-size:9px;color:var(--t4)}
.rk-n{color:var(--t2);white-space:nowrap}
.rk-t{height:5px;background:rgba(122,160,220,.1);border-radius:2px;position:relative;overflow:hidden}
.rk-t i{position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--c);border-radius:2px;
  box-shadow:0 0 9px -2px var(--c)}
.rk-v{font-size:11px;text-align:right}
.rk-d{font-size:9px;text-align:right}

/* ══ bullet ══ */
.bl{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:9px;padding:3.5px 0;font-size:11px}
.bl-n{color:var(--t2)}
.bl-t{height:13px;position:relative;background:rgba(122,160,220,.07);border-radius:2px;overflow:hidden}
.bl-band{position:absolute;top:0;bottom:0;background:rgba(56,225,255,.1)}
.bl-fill{position:absolute;top:2px;bottom:2px;left:0;border-radius:2px;background:var(--cyan)}
.bl-fill.good{background:var(--teal)} .bl-fill.warn{background:var(--amber)} .bl-fill.crit{background:var(--magenta)}
.bl-goal{position:absolute;top:-1px;bottom:-1px;left:100%;width:2px;background:var(--gold);box-shadow:0 0 7px var(--gold)}
.bl-v{font-size:11px;text-align:right}

/* ══ 矩阵 ══ */
.mx{display:flex;flex-direction:column;gap:3px;flex:1;min-height:0;justify-content:space-between}
.mx-h{display:grid;grid-template-columns:38px repeat(5,1fr);gap:3px}
.mx-h span{font-family:var(--mono);font-size:9px;color:var(--t4);text-align:center}
.mx-r{display:grid;grid-template-columns:38px repeat(5,1fr);gap:3px}
.mx-n{font-size:10px;color:var(--t3);display:flex;align-items:center}
.mx-r i{height:18px;border-radius:1px;display:grid;place-items:center;font-style:normal;
  font-family:var(--mono);font-size:8.5px;color:rgba(255,255,255,.8);transition:transform .15s;cursor:default}
.mx-r i:hover{transform:scale(1.14);z-index:2;outline:1px solid var(--gold)}

/* ══ treemap ══ */
.tm-g{position:relative;flex:1;min-height:0}
.tm{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);overflow:hidden;
  container-type:size}
.tm-in{height:100%;padding:5px 7px;display:flex;flex-direction:column;justify-content:center;gap:0;overflow:hidden
  background:color-mix(in oklab,var(--c) 17%,rgba(10,16,28,.62));
  border:1px solid color-mix(in oklab,var(--c) 45%,transparent);transition:background .2s}
.tm:hover{background:color-mix(in oklab,var(--c) 32%,rgba(10,16,28,.7))}
.tm b{font-size:10px;font-weight:600;white-space:nowrap}
.tm span{font-size:11px;font-weight:700;color:var(--c)}
.tm em{font-size:8px;font-style:normal;color:var(--t3);line-height:1.35}
/* 块越小显示的行越少：挤在一起比缺信息更糟 */
@container (max-height:46px){.tm em{display:none}}
@container (max-height:34px){.tm-in{flex-direction:row;align-items:center;gap:5px}.tm em{display:none}}
@container (max-width:46px){.tm em{display:none}}

/* ══ 事件流 ══ */
.fd{display:flex;flex-direction:column;flex:1;min-height:0;justify-content:space-between}
.fd-r{display:grid;grid-template-columns:50px 6px 40px 34px 1fr;align-items:center;gap:8px;
  padding:6px 0;border-bottom:1px solid rgba(122,160,220,.06);font-size:10px}
.fd-t{font-size:9px;color:var(--t4)}
.fd-d{width:5px;height:5px;border-radius:50%;background:var(--t4)}
.fd-d.info{background:var(--cyan);box-shadow:0 0 6px var(--cyan)}
.fd-d.good{background:var(--teal);box-shadow:0 0 6px var(--teal)}
.fd-d.warn{background:var(--amber);box-shadow:0 0 6px var(--amber);animation:br 2.2s ease-in-out infinite}
.fd-d.crit{background:var(--magenta);box-shadow:0 0 7px var(--magenta);animation:br 1.4s ease-in-out infinite}
@keyframes br{0%,100%{opacity:1}50%{opacity:.32}}
.fd-c{color:var(--t2)} .fd-k{color:var(--cyan);font-size:9px}
.fd-v{color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ══ 底部 sparkline 墙 ══ */
.bot{display:grid;grid-template-columns:repeat(11,1fr);gap:8px;height:130px;margin-top:12px}
.sw{padding:9px 10px;background:var(--surf);border:1px solid var(--line);border-radius:var(--r);
  display:flex;flex-direction:column;gap:5px;position:relative;overflow:hidden;transition:border-color .2s,background .2s}
.sw:hover{border-color:var(--line2);background:var(--surf2)}
.sw:hover::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--cyan);
  box-shadow:0 0 10px var(--cyan)}
.sw-h{font-size:10px;color:var(--t3);display:flex;align-items:center;gap:5px}
.sw-h i{width:4px;height:4px;border-radius:50%;background:var(--t4);flex:none}
.sw.top .sw-h i{background:var(--cyan);box-shadow:0 0 6px var(--cyan)}
.sw-h span{margin-left:auto;font-size:10px;color:var(--t1)}
.sw svg{width:100%;height:26px;flex:1;min-height:0}
.sw-f{display:flex;align-items:baseline;justify-content:space-between;font-size:9px}
.sw-p{color:var(--t4);font-family:var(--mono);font-size:8.5px}
.dr{stroke-dasharray:420;stroke-dashoffset:420;animation:draw 2.6s var(--ease) forwards}
@keyframes draw{to{stroke-dashoffset:0}}

/* ══ 背景 ══ */
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
</style></head>
<body>
<div class="bgfx"></div>
<div id="fit">

  <svg width="0" height="0" style="position:absolute"><defs>
    <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38E1FF" stop-opacity=".6"/><stop offset="1" stop-color="#38E1FF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gSw" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#38E1FF"/><stop offset="1" stop-color="#B58CFF"/>
    </linearGradient>
  </defs></svg>

  <!-- ══ 顶栏 ══ -->
  <div class="top">
    <div class="hero">
      <div class="hero-k">GDP · Zhejiang</div>
      <div class="hero-v num">${fmt(T.gdp)}<u>亿元</u></div>
      <div class="hero-f">
        <span class="pill num">▲ +5.6%</span>
        <svg viewBox="0 0 108 26" preserveAspectRatio="none">
          <path d="${cities[0].prevLine}" fill="none" stroke="var(--slate)" stroke-width="1"/>
          <path class="dr" d="${cities[0].line}" fill="none" stroke="url(#gSw)" stroke-width="1.6"/>
        </svg>
      </div>
    </div>

    ${kpis.map((k, i) => `<div class="kpi" style="--ac:var(--${k.c})">
      <div class="kpi-k"><i></i>${k.k}</div>
      <div class="kpi-v num">${k.v}<u>${k.u}</u></div>
      <svg class="kpi-s" viewBox="0 0 108 18" preserveAspectRatio="none">
        <path class="dr" d="${cities[i + 1].line}" fill="none" stroke="var(--${k.c})" stroke-width="1.2"
          style="animation-delay:${0.2 + i * 0.1}s"/>
      </svg>
    </div>`).join("")}

    <div class="clk">
      <div class="clk-t num">20:47:33 <s>UTC+8</s></div>
      <div class="clk-m">数据截至 2026-09-30<br/>11 地市 · 5 指标 · 演示数据</div>
    </div>
  </div>

  <!-- ══ 主体 ══ -->
  <div class="mid">

    <div class="rail l">
      <div class="dk" style="--ac:var(--indigo);--fill:76%">
        <span class="brk tl"></span><span class="brk br"></span>
        <div class="pl"><div class="pl-l"><span class="pl-no">01</span>
          <span class="pl-t">产业结构</span><span class="pl-en">Industry Mix</span></div>
          <span class="pl-v num">${IND_TOTAL.toLocaleString()}</span></div>
        <div class="bd"><div class="tm-g">${treemap}</div></div>
      </div>

      <div class="dk" style="--ac:var(--teal);--fill:64%">
        <span class="brk tl"></span><span class="brk br"></span>
        <div class="pl"><div class="pl-l"><span class="pl-no">02</span>
          <span class="pl-t">指标矩阵</span><span class="pl-en">City × Metric</span></div>
          <span class="pl-en">TOP 9/11</span></div>
        <div class="bd">
          <div class="mx">
            <div class="mx-h"><span></span>${METRICS.map((m) => `<span>${m.label}</span>`).join("")}</div>
            ${matrix}
          </div>
        </div>
      </div>

      <div class="dk" style="--ac:var(--amber);--fill:88%">
        <span class="brk tl"></span><span class="brk br"></span>
        <div class="pl"><div class="pl-l"><span class="pl-no">03</span>
          <span class="pl-t">目标达成</span><span class="pl-en">Plan vs Actual</span></div>
          <span class="pl-v num">3 / 11 达标</span></div>
        <div class="bd" style="gap:0;padding:6px 13px">${bullets}</div>
      </div>
    </div>

    <div class="dk stage" style="--ac:var(--cyan);--fill:71%">
      <span class="brk tl"></span><span class="brk br"></span>
      <div class="pl"><div class="pl-l"><span class="pl-no">04</span>
        <span class="pl-t">浙江省 · 空间态势</span><span class="pl-en">Spatial Overview</span></div>
        <span class="pl-en">悬停高亮 · 点击下钻</span></div>
      <div class="bd">
        <div class="stage-in">
          <div class="scan"></div>
          <div class="mapbox">
            <svg viewBox="0 0 ${VW} ${VH}">${mapPaths}</svg>
            ${mapLabels}
          </div>
          <svg class="compass" viewBox="0 0 34 34">
            <circle cx="17" cy="17" r="13" fill="none" stroke="var(--line2)"/>
            <path d="M17 5 L20.5 17 L17 14.6 L13.5 17 Z" fill="var(--cyan)"/>
            <text x="17" y="32" fill="var(--t4)" font-size="7" text-anchor="middle" font-family="monospace">N</text>
          </svg>
          <div class="anno a1"><b>◉</b> TOP1 ${cities.find(c=>c.rank===1).short} · ${byGdp[0][1].toLocaleString()} 亿</div>
          <div class="anno a2">WEB MERCATOR · EPSG:3857</div>
          <div class="anno a3">EXTENT ${(maxLon - minLon).toFixed(2)}° × ${(maxLat - minLat).toFixed(2)}°</div>
          <div class="anno a4">11 REGIONS · ${flat.length} VERTICES</div>
          <div class="lgd"><span>低</span><span class="ramp"></span><span>高</span><span style="color:var(--t4)">经济密度</span></div>
        </div>
      </div>
    </div>

    <div class="rail r">
      <div class="dk" style="--ac:var(--cyan);--fill:82%">
        <span class="brk tl"></span><span class="brk br"></span>
        <div class="pl"><div class="pl-l"><span class="pl-no">05</span>
          <span class="pl-t">GDP 排名</span><span class="pl-en">Ranking</span></div>
          <span class="pl-v num">${fmt(T.gdp)}</span></div>
        <div class="bd" style="gap:0;padding:4px 13px 8px">${ranking}</div>
      </div>

      <div class="dk" style="--ac:var(--gold);--fill:91%">
        <span class="brk tl"></span><span class="brk br"></span>
        <div class="pl"><div class="pl-l"><span class="pl-no">06</span>
          <span class="pl-t">实时事件</span><span class="pl-en">Live Feed</span></div>
          <span class="pl-v num" style="--ac:var(--gold)">LIVE</span></div>
        <div class="bd" style="gap:0;padding:4px 13px 8px">
          <div class="fd">${feed}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ 底部 sparkline 墙 ══ -->
  <div class="bot">${sparkWall}</div>
</div>

<script>
/* 1920×1080 固定舞台等比缩放，避免小屏出现大片空白 */
(function(){
  var fit=document.getElementById('fit');
  function s(){var k=Math.min(1,innerWidth/1920,innerHeight/1080);fit.style.transform='scale('+k+')';}
  addEventListener('resize',s);s();
})();
</script>
</body></html>`;

writeFileSync(`${OUT}v3-dashboard.html`, html);
console.log(`✓ mockup/v3-dashboard.html  (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  地图 ${regions.length} 市 · ${(flat.length).toLocaleString()} 真实顶点`);
console.log(`  达成率分布 ${cities.map(c=>c.plan).sort((a,b)=>a-b).join("/")}`);
console.log(`  yoy 分布 ${cities.filter(c=>c.yoy<0).length} 负 / ${cities.filter(c=>c.yoy>0).length} 正`);