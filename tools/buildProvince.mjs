/**
 * 生成浙江的卫星底图 / 法线图 / 位移图。
 *
 * 为什么需要这一步：原项目自带的 sc_map.png / sc_displacement_map.png
 * 是**按四川边界裁剪的**卫星图与地形图 —— 贴到浙江边界上会显示
 * 四川的雪山与高原，且地形起伏完全不对。heatmapData.json 同理，
 * 54 个点全在四川范围内，换省后会整片落到地图外。
 *
 * 做法：
 *   卫星影像  ESRI World Imagery 静态导出（真实影像）
 *   高程      AWS Terrain Tiles（terrarium PNG，真实 DEM）
 *   法线/位移 由高程实时推导，不伪造
 *
 * 用法：node tools/buildProvince.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";
import { launch } from "./lib.mjs";

/* ── 目标省与输出 ─────────────────────────────────────────────
 * 直接读 JSON 而不 import src/geo/index.ts：那个模块用 Vite 的
 * JSON import 语法，Node 原生跑不了。构建脚本只需要 bbox 与多边形。 */
const GEO_DIR = new URL("../sc-datav/src/geo/", import.meta.url).pathname;
const OUT = GEO_DIR;
const SAT_W = 1600;
const SAT_H = 1350;

const PROVINCE_ID = process.env.PROVINCE ?? "zhejiang";
const cityGeoJSON = JSON.parse(readFileSync(`${GEO_DIR}${PROVINCE_ID}.json`, "utf8"));
const provinceName = PROVINCE_ID === "zhejiang" ? "\u6d59\u6c5f\u7701" : PROVINCE_ID;

const bboxOf = (data) => {
  // 逐轴独立累加。原先复用 lo/hi 两个 [lon,lat] 数组，
  // 导致 lon 实际是 [minLon,minLat]、lat 是 [maxLon,maxLat]，
  // 瓦片跨度算出负数（cols=-128）。
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  data.features.forEach((f) =>
    f.geometry.coordinates.forEach((poly) =>
      poly.forEach((ring) =>
        ring.forEach((pt) => {
          minLon = Math.min(minLon, pt[0]);
          minLat = Math.min(minLat, pt[1]);
          maxLon = Math.max(maxLon, pt[0]);
          maxLat = Math.max(maxLat, pt[1]);
        })
      )
    )
  );
  return { lon: [minLon, maxLon], lat: [minLat, maxLat] };
};

const { lon, lat } = bboxOf(cityGeoJSON);
const BBOX = `${lon[0]},${lat[0]},${lon[1]},${lat[1]}`;
console.log(`[geo] ${provinceName}  bbox=${BBOX}`);

/* ── 1) 卫星影像（ESRI 静态导出） ─────────────────────────── */
console.log("[geo] 拉取卫星影像 …");
const satUrl =
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
  `?bbox=${BBOX}&bboxSR=4326&size=${SAT_W},${SAT_H}&imageSR=4326&format=png32&f=image`;
const satRes = await fetch(satUrl);
if (!satRes.ok) throw new Error(`卫星影像拉取失败 HTTP ${satRes.status}`);
const satB64 = Buffer.from(await satRes.arrayBuffer()).toString("base64");
console.log(`[geo] 卫星影像 ${Math.round(satB64.length * 0.75 / 1024)}KB`);

/* ── 2) 高程瓦片（AWS Terrain Tiles, terrarium 编码） ──────── */
const ZOOM = 9;
/** Web Mercator 瓦片坐标 */
const lon2tile = (x, z) => ((x + 180) / 360) * 2 ** z;
const lat2tile = (y, z) => {
  const r = (y * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

const x0 = Math.floor(lon2tile(lon[0], ZOOM));
const x1 = Math.floor(lon2tile(lon[1], ZOOM));
const y0 = Math.floor(lat2tile(lat[1], ZOOM));
const y1 = Math.floor(lat2tile(lat[0], ZOOM));
const cols = x1 - x0 + 1;
const rows = y1 - y0 + 1;
console.log(`[geo] 拉取高程瓦片 zoom=${ZOOM}  ${cols}×${rows} …`);

const tiles = [];
for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`高程瓦片 ${tx}/${ty} HTTP ${r.status}`);
    tiles.push({
      col: tx - x0,
      row: ty - y0,
      b64: Buffer.from(await r.arrayBuffer()).toString("base64"),
    });
  }
}
console.log(`[geo] 高程瓦片 ${tiles.length} 张`);

/* ── 3) 在浏览器里做 canvas 运算并导出 ────────────────────── */
const browser = await launch();
const page = await (await browser.newContext()).newPage();
const out = await page.evaluate(
  async ({ satB64, tiles, W, H, cols, rows, mask }) => {
    const load = (b64) =>
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = "data:image/png;base64," + b64;
      });

    /* 3.1 合成高程 → 单通道 elevation (0..1) */
    const TILE = 256;
    const dem = document.createElement("canvas");
    dem.width = cols * TILE;
    dem.height = rows * TILE;
    const dctx = dem.getContext("2d", { willReadFrequently: true });
    for (const t of tiles) {
      const im = await load(t.b64);
      dctx.drawImage(im, t.col * TILE, t.row * TILE);
    }
    const demData = dctx.getImageData(0, 0, dem.width, dem.height);
    // terrarium: elevation(m) = R * 256 + G + B / 256 - 32768
    const elev = new Float32Array(dem.width * dem.height);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < elev.length; i++) {
      const o = i * 4;
      const raw = demData.data[o] * 256 + demData.data[o + 1] + demData.data[o + 2] / 256 - 32768;
      // 负高程是海床/瓦片异常（实测低至 -2277m，而浙江最低约 0m）。
      // 位移贴图只用于陆地表现，钳到 0 之后归一化区间才不会被离群值压扁。
      const e = raw < 0 ? 0 : raw;
      elev[i] = e;
      if (e < lo) lo = e;
      if (e > hi) hi = e;
    }
    const range = Math.max(1, hi - lo);

    /* 3.2 由高程推法线（Sobel），并归一化出位移灰度 */
    const nrm = document.createElement("canvas");
    nrm.width = W;
    nrm.height = H;
    const nctx = nrm.getContext("2d");
    const nimg = nctx.createImageData(W, H);

    const disp = document.createElement("canvas");
    disp.width = W;
    disp.height = H;
    const pctx = disp.getContext("2d");
    const pimg = pctx.createImageData(W, H);

    const sample = (u, v) => {
      // u,v in [0,1] over the whole dem canvas
      const x = Math.min(dem.width - 1, Math.max(0, Math.round(u * (dem.width - 1))));
      const y = Math.min(dem.height - 1, Math.max(0, Math.round(v * (dem.height - 1))));
      return (elev[y * dem.width + x] - lo) / range;
    };

    const STRENGTH = 3.2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const v = y / (H - 1);
        const e = 1 / dem.width;
        const f = 1 / dem.height;

        const gx =
          sample(u + e, v - f) + 2 * sample(u + e, v) + sample(u + e, v + f) -
          (sample(u - e, v - f) + 2 * sample(u - e, v) + sample(u - e, v + f));
        const gy =
          sample(u - e, v + f) + 2 * sample(u, v + f) + sample(u + e, v + f) -
          (sample(u - e, v - f) + 2 * sample(u, v - f) + sample(u + e, v - f));

        let nx = -gx * STRENGTH;
        let ny = -gy * STRENGTH;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;

        const o = (y * W + x) * 4;
        nimg.data[o] = Math.round((nx * 0.5 + 0.5) * 255);
        nimg.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        nimg.data[o + 2] = Math.round((nz / len) * 0.5 * 255 + 127);
        nimg.data[o + 3] = 255;

        const h = sample(u, v);
        const g = Math.round(h * 255);
        pimg.data[o] = pimg.data[o + 1] = pimg.data[o + 2] = g;
        pimg.data[o + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);
    pctx.putImageData(pimg, 0, 0);

    /* 3.3 按行政区轮廓把卫星图裁到省界内（对齐原项目做法） */
    const sat = document.createElement("canvas");
    sat.width = W;
    sat.height = H;
    const sctx = sat.getContext("2d", { willReadFrequently: true });
    const satImg = await load(satB64);
    sctx.drawImage(satImg, 0, 0, W, H);
    const simg = sctx.getImageData(0, 0, W, H);

    // 在离屏 canvas 上把多边形转成路径并裁剪
    const clip = document.createElement("canvas");
    clip.width = W;
    clip.height = H;
    const cctx = clip.getContext("2d");
    const bb = mask.bbox; // [lon0, lat0, lon1, lat1]
    const px = (x) => ((x - bb[0]) / (bb[2] - bb[0])) * W;
    const py = (y) => ((bb[3] - y) / (bb[3] - bb[1])) * H;
    cctx.fillStyle = "#fff";
    cctx.beginPath();
    // mask.rings 是预先压平的一维环列表：[ring][pt][lon,lat]
    // （原先按 GeoJSON 的 [feature][polygon][ring][pt] 四层直接用，
    //   少用一层导致画出的路径全是垃圾、整张图被裁成透明）
    for (const ring of mask.rings) {
      ring.forEach((pt, i) => {
        const X = px(pt[0]);
        const Y = py(pt[1]);
        if (i === 0) cctx.moveTo(X, Y);
        else cctx.lineTo(X, Y);
      });
      cctx.closePath();
    }
    cctx.fill("nonzero");

    const cdata = cctx.getImageData(0, 0, W, H).data;
    for (let i = 0; i < simg.data.length; i += 4) {
      const a = cdata[i + 3];
      if (a < 255) {
        // 省外：保留一点点卫星图但压暗并偏冷，与深空主题相容；
        // 完全透明会让省界看起来"贴纸化"
        const k = a / 255;
        simg.data[i] = simg.data[i] * k * 0.35;
        simg.data[i + 1] = simg.data[i + 1] * k * 0.4;
        simg.data[i + 2] = simg.data[i + 2] * k * 0.5;
        simg.data[i + 3] = Math.round(255 * k * 0.5);
      }
    }
    sctx.putImageData(simg, 0, 0);

    const png = (c) => c.toDataURL("image/png").split(",")[1];
    return {
      sat: png(sat),
      normal: png(nrm),
      displacement: png(disp),
      elevation: { lo: Math.round(lo), hi: Math.round(hi) },
    };
  },
  {
    satB64,
    tiles,
    W: SAT_W,
    H: SAT_H,
    cols,
    rows,
    mask: {
      bbox: [lon[0], lat[0], lon[1], lat[1]],
      // 压平：[feature][polygon][ring][pt] → [ring][pt][lon,lat]
      rings: cityGeoJSON.features.flatMap((f) =>
        f.geometry.coordinates.flatMap((poly) =>
          poly.map((ring) => ring.map((pt) => [pt[0], pt[1]]))
        )
      ),
    },
  }
);

await browser.close();

writeFileSync(`${OUT}zhejiang_map.png`, Buffer.from(out.sat, "base64"));
writeFileSync(`${OUT}zhejiang_normal.png`, Buffer.from(out.normal, "base64"));
writeFileSync(`${OUT}zhejiang_displacement.png`, Buffer.from(out.displacement, "base64"));

console.log(
  `[geo] 高程范围 ${out.elevation.lo}m ~ ${out.elevation.hi}m（${provinceName}）`
);
console.log("[geo] 输出：zhejiang_map.png / zhejiang_normal.png / zhejiang_displacement.png");