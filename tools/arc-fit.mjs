#!/usr/bin/env node
/**
 * 落地页圆弧布局的几何/投影评估器。
 *
 * 存在的理由：站位能不能"读得清"完全取决于投影后的像素尺寸、相邻块是否相交、
 * 以及亮度衰减后剩多少 —— 这三个量都要过一遍透视投影才算得出来，
 * 肉眼看截图只能看出"好像挤了"，看不出差多少、往哪调。
 *
 *   node tools/arc-fit.mjs                    # 对比若干候选
 *   node tools/arc-fit.mjs --n 6 --sweep      # 扫 6 站的参数网格
 *   node tools/arc-fit.mjs --n 6 --active 3   # 指定当前选中的站，看那一瞬的排布
 *
 * 投影模型与 three.js PerspectiveCamera 一致：
 *   ndc.x = (x_view * f / aspect) / -z_view
 *   ndc.y = (y_view * f) / -z_view          f = 1 / tan(fov / 2)
 */
const FOV = 38;
const ASPECT = 1920 / 1080;
const CAM = { x: 0, y: 0.2, z: 9.6 };
const PX_W = 1920;
const PX_H = 1080;

const DEG = Math.PI / 180;
const f = 1 / Math.tan((FOV / 2) * DEG);

/** 世界坐标 → 屏幕像素。相机不平移旋转地看向原点（与 R3F 默认一致）。 */
function project(p) {
  const vx = p[0] - CAM.x;
  const vy = p[1] - CAM.y;
  const vz = p[2] - CAM.z; // 负值
  const d = -vz;
  return {
    x: ((vx * f) / ASPECT / d) * 0.5 * PX_W + PX_W / 2,
    y: PX_H / 2 - ((vy * f) / d) * 0.5 * PX_H,
    dist: d,
    ndcX: (vx * f) / ASPECT / d,
    ndcY: (vy * f) / d,
  };
}

/**
 * 一块展台的四个角在世界系里的位置。
 * 站位 theta 处：圆周方向偏移 sin/cos，板面绕 Y 转 theta（法线指向圆心外）。
 */
function corners(theta, R, W, H) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  // 板面局部：x = 切向，z = 法向。切向单位向量 = (c, 0, -s)
  const tx = c;
  const tz = -s;
  const cx = s * R;
  const cz = c * R;
  const hw = W / 2;
  const hh = H / 2;
  return [
    [cx - tx * hw, hh, cz - tz * hw],
    [cx + tx * hw, hh, cz + tz * hw],
    [cx + tx * hw, -hh, cz + tz * hw],
    [cx - tx * hw, -hh, cz - tz * hw],
  ].map(project);
}

function evaluate(c, active) {
  const rows = [];
  for (let i = 0; i < c.n; i++) {
    // 站位固定在环上 theta_i = i * spread；
    // 环整体旋转到 -active * spread，于是该站的世界角 = (i - active) * spread
    const theta = (i - active) * c.spread * DEG;
    const world = [Math.sin(theta) * c.R, 0, Math.cos(theta) * c.R];
    const pr = project(world);
    const cs = corners(theta, c.R, c.W, c.H);
    const xs = cs.map((p) => p.x);
    const ys = cs.map((p) => p.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const facing = Math.max(0, Math.cos(theta)) ** c.expF;
    rows.push({
      i,
      deg: Math.round(((i - active) * c.spread * 10) / 10),
      theta,
      world,
      scrX: (left + right) / 2,
      left,
      right,
      top,
      bottom,
      wPx: right - left,
      hPx: bottom - top,
      centerDist: pr.dist,
      facing,
      bright: facing ** c.expB,
      inFrame: left >= -2 && right <= PX_W + 2 && top >= -2 && bottom <= PX_H + 2,
    });
  }
  return rows;
}

function report(c, active) {
  const rows = evaluate(c, active);
  const front = rows.find((r) => r.theta === 0) ?? rows[0];
  const usable = rows.filter((r) => r.bright >= 0.25).length;
  const inFrame = rows.filter((r) => r.inFrame).length;
  const chord = 2 * c.R * Math.sin((c.spread * DEG) / 2);

  // 屏幕上相邻两块的水平间隙（负 = 相交）
  let minGap = Infinity;
  const sorted = [...rows].sort((a, b) => a.scrX - b.scrX);
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i].left - sorted[i - 1].right);
  }
  // 铭牌（DOM，不随 3D 缩放，固定 244px 宽）之间的屏幕间隙
  const PLATE = 244;
  let minPlateGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minPlateGap = Math.min(
      minPlateGap,
      sorted[i].scrX - PLATE / 2 - (sorted[i - 1].scrX + PLATE / 2)
    );
  }

  const L = sorted[0].left;
  const R = sorted[sorted.length - 1].right;
  const span = ((c.n - 1) * c.spread * 2) / 360; // 弧线占整圆比例

  console.log(`\n── ${c.tag}   [active=${active}]`);
  console.log(
    `   n=${c.n}  R=${c.R}  spread=${c.spread}°  弧占整圆 ${(span * 100).toFixed(0)}%  展台 ${c.W}×${c.H}  衰减 ${c.expF}/${c.expB}`
  );
  console.log(
    `   正面站 ${front.wPx.toFixed(0)}×${front.hPx.toFixed(0)}px（占屏宽 ${(
      (front.wPx / PX_W) *
      100
    ).toFixed(0)}%）  弦长 ${chord.toFixed(2)} vs 宽 ${c.W}`
  );
  console.log(
    `   可读(≥25%) ${usable}/${c.n}   完整在画面内 ${inFrame}/${c.n}   屏幕块间隙 ${minGap.toFixed(
      0
    )}px   铭牌间隙 ${minPlateGap.toFixed(0)}px`
  );
  console.log(
    `   整排横向 ${L.toFixed(0)} → ${R.toFixed(0)}px（画面 0→${PX_W}）${
      L < 0 || R > PX_W ? "  ⚠️ 横向溢出" : "  ✓"
    }`
  );
  console.log(
    "   " +
      rows
        .map(
          (r) =>
            `${String(r.deg).padStart(5)}° x=${r.scrX.toFixed(0).padStart(4)} w=${r.wPx
              .toFixed(0)
              .padStart(3)} h=${r.hPx.toFixed(0).padStart(3)} d=${r.centerDist
              .toFixed(1)
              .padStart(4)} f=${r.facing.toFixed(2)} b=${r.bright
              .toFixed(2)
              .padStart(4)}${r.inFrame ? "" : " ✗"}`
        )
        .join("\n   ")
  );
}

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const wantN = arg("--n", null);
const active = arg("--active", 0);
const sweep = argv.includes("--sweep");

const CANDIDATES = [
  { tag: "现状 4 站 · 40° · 3.2", n: 4, R: 4.4, spread: 40, W: 3.2, H: 1.8, expF: 1.1, expB: 1.9 },
  { tag: "6 站 · 闭口 60° · 3.2", n: 6, R: 4.4, spread: 60, W: 3.2, H: 1.8, expF: 1.1, expB: 1.9 },
  { tag: "6 站 · 开口 34° · 2.2 平衰减", n: 6, R: 5.0, spread: 34, W: 2.2, H: 1.24, expF: 0.8, expB: 0.95 },
  { tag: "6 站 · 开口 30° · 2.0 平衰减", n: 6, R: 5.0, spread: 30, W: 2.0, H: 1.125, expF: 0.8, expB: 0.95 },
  { tag: "6 站 · 开口 28° · 1.9 平衰减", n: 6, R: 5.2, spread: 28, W: 1.9, H: 1.07, expF: 0.75, expB: 0.9 },
];

if (sweep) {
  const rowsOut = [];
  for (const spread of [26, 28, 30, 32, 34, 36]) {
    for (const W of [1.7, 1.9, 2.1, 2.3]) {
      for (const R of [4.6, 5.0, 5.4, 5.8]) {
        const c = { n: 6, R, spread, W, H: W * 0.5625, expF: 0.75, expB: 0.9 };
        const chord = 2 * R * Math.sin((spread * DEG) / 2);
        if (chord < W + 0.18) continue; // 站位弦长必须放得下展台且留缝
        const rows = evaluate(c, active);
        const front = rows.find((r) => r.theta === 0) ?? rows[0];
        const sorted = [...rows].sort((a, b) => a.scrX - b.scrX);
        let minGap = Infinity;
        for (let i = 1; i < sorted.length; i++)
          minGap = Math.min(minGap, sorted[i].left - sorted[i - 1].right);
        const L = sorted[0].left;
        const Rr = sorted[sorted.length - 1].right;
        rowsOut.push({
          c,
          chord,
          frontPct: (front.wPx / PX_W) * 100,
          bright: Math.min(...rows.map((r) => r.bright)),
          inFrame: rows.filter((r) => r.inFrame).length,
          minGap,
          L,
          Rr,
        });
      }
    }
  }
  console.log(`参数扫描  active=${active}   要求：6 站全在画面内、最外侧亮度 ≥0.25、块间不重叠`);
  console.log(
    "spread  R     W     弦长  正面宽%  最暗b  在框  块间隙  横向范围"
  );
  const pass = rowsOut
    .filter((r) => r.inFrame === 6 && r.bright >= 0.25 && r.minGap >= 0 && r.L >= 0 && r.Rr <= PX_W)
    .sort((a, b) => b.frontPct - a.frontPct);
  for (const r of pass) {
    console.log(
      `${String(r.c.spread).padStart(4)}  ${String(r.c.R).padEnd(4)} ${String(
        r.c.W
      ).padEnd(5)} ${r.chord.toFixed(2).padStart(5)}  ${r.frontPct
        .toFixed(0)
        .padStart(6)}  ${r.bright.toFixed(2)}   ${r.inFrame}/6  ${r.minGap
        .toFixed(0)
        .padStart(5)}  ${r.L.toFixed(0)}→${r.Rr.toFixed(0)}`
    );
  }
  console.log(`\n满足全部约束的组合：${pass.length} 组`);
} else {
  console.log(
    `投影模型  fov=${FOV}°  aspect=${ASPECT.toFixed(3)}  相机 z=${CAM.z}  画面 ${PX_W}×${PX_H}  active=${active}`
  );
  for (const c of CANDIDATES) {
    if (wantN && c.n !== wantN) continue;
    report(c, active);
  }
}