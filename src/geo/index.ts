/**
 * 地理数据层
 * ------------------------------------------------------------------
 * 原项目把"省"硬编码进了三个地方，任何换省都必须同步改三处：
 *   1. `assets/sc.json` / `assets/sc_outline.json` —— 文件名本身就写着 sc
 *   2. `Demo1/cityData.ts` —— 手工列了成都、绵阳、阿坝…共 21 个市
 *   3. 各处 `geoMercator().center(centroid).scale(820)` —— 820 是照着
 *      四川的 11.2° 跨度试出来的常数
 *
 * 第 2 条最危险：它和 GeoJSON 之间没有任何一致性校验，
 * 换一份 GeoJSON 之后 TS 不会报错，只会静默地产生一堆 undefined 指标。
 *
 * 现在改成：
 *   · PROVINCE 一处声明用哪个省，数据文件名由它推导
 *   · createProjection 从 bbox 反算 scale，换省不用重调常数
 *   · assertRegions 对齐 GeoJSON 与指标表，缺项在开发期直接抛错
 */
import { geoMercator, type GeoProjection } from "d3-geo";
import zhejiang from "./zhejiang.json";
import zhejiangOutline from "./zhejiang_outline.json";
import type { CityGeoJSON } from "@/types/map";

export type ProvinceId = "zhejiang";

interface ProvinceDef {
  /** 显示名 */
  name: string;
  /** 简称，用于标题 */
  short: string;
  /** 行政区数据 */
  cities: CityGeoJSON;
  /** 省界轮廓 */
  outline: CityGeoJSON;
  /** 投影后希望在屏幕上占据的世界宽度（世界单位）。
      820 × 11.2° × π/180 ≈ 160，所以这里锁定 160，
      换省后三个 demo 的相机机位都不用重新试。 */
  targetWidth: number;
}

const REGIONS: Record<ProvinceId, ProvinceDef> = {
  zhejiang: {
    name: "浙江省",
    short: "浙江",
    cities: zhejiang as unknown as CityGeoJSON,
    outline: zhejiangOutline as unknown as CityGeoJSON,
    targetWidth: 160,
  },
};

/** 当前启用的省 */
export const PROVINCE_ID: ProvinceId = "zhejiang";
export const PROVINCE = REGIONS[PROVINCE_ID];

export const cityGeoJSON = PROVINCE.cities;
export const outlineGeoJSON = PROVINCE.outline;
export const provinceName = PROVINCE.name;
export const provinceShort = PROVINCE.short;

/* ── 投影 ────────────────────────────────────────────────────── */

export interface GeoBBox {
  /** 经度 [min, max] */
  lon: [number, number];
  /** 纬度 [min, max] */
  lat: [number, number];
}

/**
 * GeoJSON 的经纬度包围盒。
 *
 * 返回值刻意写成 `{lon:[minLon,maxLon], lat:[minLat,maxLat]}` 而不是
 * 复用累加时那两个 `lo`/`hi` 数组 —— 那样会得到
 * `lon:[minLon,minLat], lat:[maxLon,maxLat]`，两个轴各混了一个纬度/经度值。
 * 踩过一次：投影跨度算成 `minLat - minLon`（27.1-118.0 = -90.9），
 * scale 变成负数、地图整片消失；而 tsc 与运行时断言都查不出来。
 */
export function bboxOf(data: CityGeoJSON): GeoBBox {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  data.features.forEach((f) => {
    f.geometry.coordinates.forEach((poly) =>
      poly.forEach((ring) =>
        ring.forEach((pt) => {
          minLon = Math.min(minLon, pt[0]);
          minLat = Math.min(minLat, pt[1]);
          maxLon = Math.max(maxLon, pt[0]);
          maxLat = Math.max(maxLat, pt[1]);
        })
      )
    );
  });

  return {
    lon: [minLon, maxLon],
    lat: [minLat, maxLat],
  };
}

/**
 * 按数据包围盒反算 scale 的墨卡托投影。
 *
 * 为什么不能写死常数：geoMercator 的 scale 是「每弧度多少世界单位」，
 * 投影后的宽度 = 跨度(度) × scale × π/180。
 * 四川跨度 11.2°，scale 820 → 约 160 单位；
 * 浙江跨度 4.81°，同样用 820 → 只有 69 单位，地图会缩成原来 43% 大小。
 * 从 bbox 反算则换任何省都能得到一致构图。
 */
export function createProjection(data: CityGeoJSON = cityGeoJSON): GeoProjection {
  const { lon, lat } = bboxOf(data);
  const degSpan = lon[1] - lon[0];
  const scale = PROVINCE.targetWidth / ((degSpan * Math.PI) / 180);

  return geoMercator()
    /* 用 bbox 中心，而不是原实现那样的「第一个要素的质心」
       （四川数据里那是成都的质心）。两点理由：
         · 质心会随行政区划调整而漂移，bbox 中心是稳定构图锚点
         · 经纬度必须来自同一个中心，原先那种"经度取 bbox、纬度取质心"
           的混搭会让投影结果既不对称又难复现 */
    .center([(lon[0] + lon[1]) / 2, (lat[0] + lat[1]) / 2])
    .scale(scale)
    .translate([0, 0]);
}

/** 投影 scale（供需要自行微调的 demo 使用） */
export const projectionScale = (() => {
  const { lon } = bboxOf(cityGeoJSON);
  return PROVINCE.targetWidth / (((lon[1] - lon[0]) * Math.PI) / 180);
})();

/* ── 一致性校验 ──────────────────────────────────────────────── */

export type MetricTable = Record<string, unknown>;

/**
 * 校验指标表与 GeoJSON 的地区名一一对应。
 *
 * 这是换省时最该有的一道闸：原来 `cityData.ts` 与 `sc.json` 各写各的，
 * 换省后不报错、只在运行时得到一堆 undefined。
 */
export function assertRegions(table: MetricTable, label = "指标表") {
  const geoNames = cityGeoJSON.features.map((f) => f.properties.name);
  const tableNames = Object.keys(table);

  const missing = geoNames.filter((n) => !(n in table));
  const extra = tableNames.filter((n) => !geoNames.includes(n));

  if (missing.length || extra.length) {
    const parts = [
      missing.length ? `${label} 缺少：${missing.join("、")}` : "",
      extra.length ? `${label} 多出：${extra.join("、")}` : "",
    ].filter(Boolean);
    throw new Error(
      `[geo] ${label} 与 ${provinceName} 行政区不一致 —— ${parts.join("；")}`
    );
  }
  return true;
}