/**
 * 控制台共享数据层
 * ------------------------------------------------------------------
 * 把"每个市一份完整指标"作为一等公民，这样地图 hover / 点击联动
 * 才有东西可联动。所有派生值由 city 名称做种子确定性生成，
 * 保证每次刷新数值一致（演示数据，不随时间抖动）。
 */
import { checkCityData } from "@/pages/Demo1/cityData";
import { assertRegions, cityGeoJSON } from "@/geo";

/**
 * 基础表由 GeoJSON 驱动（见 pages/Demo1/cityData）。
 * 开发期校验它与行政区是否一一对应 —— 原来这两者各写各的，
 * 换省时不会有任何报错，只会静默地产生一堆 undefined 指标。
 */
export const cityData = checkCityData();

export type CityName = keyof typeof cityData;

/** 城市指标 —— 面板与地图共用 */
export interface CityMetrics {
  name: string;
  /** 常住人口（万人） */
  population: number;
  /** 地区生产总值（元） */
  gdp: number;
  /** 行政区域面积（平方公里） */
  area: number;
  /** 规上企业数（家） */
  enterprises: number;
  /** 年税收（万元） */
  tax: number;
  /** 综合能耗（万吨标煤） */
  energy: number;
  /** 全年用电量（亿千瓦时） */
  power: number;
  /** 出口额（亿元）—— Demo0 进出口监测用 */
  exportValue: number;
  /** 进口额（亿元） */
  importValue: number;
  /** 三次产业增加值（亿元） */
  tertiary: number;
  /** 一产增加值（亿元） */
  primary: number;
  /** 全年发电量（亿千瓦时） */
  output: number;
  /** 设备故障次数 */
  faults: number;
  /** 行政处罚记录数 */
  penalties: number;
  /** 同比增速 % */
  growth: number;
  /** 0–100 综合活跃度 */
  score: number;
}

/** xmur3 + mulberry32：小而稳的确定性 PRNG */
function seeded(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function build(name: string, population: number, areaKm2: number): CityMetrics {
  const rnd = seeded(name);
  const j = (min: number, max: number) => min + rnd() * (max - min);

  // 人均 GDP 与人口/面积弱相关，避免出现"甘孜人均上千万"这类离谱值
  const perCapita = j(4.2, 12.5) * 1e4 * (population / (population + 300));
  const gdp = perCapita * population * 1e4;

  return {
    name,
    population,
    gdp,
    area: areaKm2,
    enterprises: Math.round(j(180, 5200) * (population / 900 + 0.35)),
    tax: Math.round(gdp * j(0.035, 0.082)),
    energy: Number((j(120, 2400) * (population / 700 + 0.3)).toFixed(1)),
    power: Number((j(60, 980) * (population / 500 + 0.4)).toFixed(1)),
    // 出口与 gdp 正相关但不等比：成都的进出口结构以加工贸易为主，
    // 沿用 gdp 比例会让甘孜/阿坝这类地区算出不合理的贸易额
    exportValue: Number((j(40, 2600) * (population / 900 + 0.22)).toFixed(1)),
    importValue: Number((j(30, 2200) * (population / 950 + 0.18)).toFixed(1)),
    primary: Number((gdp * j(0.04, 0.11) / 1e8).toFixed(1)),
    tertiary: Number((gdp * j(0.42, 0.58) / 1e8).toFixed(1)),
    output: Number((j(40, 760) * (population / 800 + 0.25)).toFixed(1)),
    faults: Math.round(j(0, 240) * (population / 1000 + 0.2)),
    penalties: Math.round(j(0, 180) * (population / 1500 + 0.15)),
    growth: Number(j(-3.5, 14.2).toFixed(1)),
    score: Math.round(j(28, 97)),
  };
}

/**
 * 面积由 GeoJSON 几何按等距圆柱近似算出（1° 纬度 ≈ 111 km）。
 * 原实现是从 cityData 的 `area` 字符串里正则抠数字，
 * 而那份字符串是手写的、和边界数据没有任何关系 —— 现在两者同源。
 */
function areaOf(name: string): number {
  const f = cityGeoJSON.features.find((x) => x.properties.name === name);
  if (!f) return 5000;
  let sum = 0;
  // coordinates 是 4 层：[多边形][环][点][经纬度]
  f.geometry.coordinates.forEach((polygon) =>
    polygon.forEach((ring) => {
      // 鞋带公式。跨 0° 经线的多边形会被高估，中国境内不存在这种情况
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      sum += Math.abs(a / 2);
    })
  );
  // 1 平方度 ≈ 111km × 111km × cos(lat)；浙江中纬度取 cos≈0.87
  return Math.max(200, Math.round(sum * 11100 * 0.87));
}

export const cityMetrics: Record<string, CityMetrics> = Object.fromEntries(
  Object.entries(cityData).map(([name, v]) => [
    name,
    build(name, v.population, areaOf(name)),
  ])
);

export const cityNames = Object.keys(cityMetrics);

export const ALL_CITIES = "全省";

/** 全省汇总（population/gdp 等做真实求和，其余取加权近似） */
export const province: CityMetrics = Object.values(cityMetrics).reduce(
  (acc, c) => ({
    name: ALL_CITIES,
    population: acc.population + c.population,
    gdp: acc.gdp + c.gdp,
    area: acc.area + c.area,
    enterprises: acc.enterprises + c.enterprises,
    tax: acc.tax + c.tax,
    energy: acc.energy + c.energy,
    power: acc.power + c.power,
    exportValue: acc.exportValue + c.exportValue,
    importValue: acc.importValue + c.importValue,
    primary: acc.primary + c.primary,
    tertiary: acc.tertiary + c.tertiary,
    output: acc.output + c.output,
    faults: acc.faults + c.faults,
    penalties: acc.penalties + c.penalties,
    growth: acc.growth + c.growth,
    score: acc.score + c.score,
  }),
  {
    name: ALL_CITIES,
    population: 0,
    gdp: 0,
    area: 0,
    enterprises: 0,
    tax: 0,
    energy: 0,
    power: 0,
    exportValue: 0,
    importValue: 0,
    primary: 0,
    tertiary: 0,
    output: 0,
    faults: 0,
    penalties: 0,
    growth: 0,
    score: 0,
  }
);
province.growth = Number(
  (Object.values(cityMetrics).reduce((s, c) => s + c.growth * c.gdp, 0) /
    province.gdp).toFixed(1)
);
province.score = Math.round(
  Object.values(cityMetrics).reduce((s, c) => s + c.score, 0) /
    cityNames.length
);

export function getCity(name: string | null | undefined): CityMetrics {
  if (!name || name === ALL_CITIES) return province;
  return cityMetrics[name] ?? province;
}

/** 指标格式化 —— 统一单位与量级，大屏上数字必须可读 */
export const fmt = {
  /** 自动选万/亿/万亿 */
  money(v: number) {
    if (v >= 1e12) return (v / 1e12).toFixed(2) + " 万亿";
    if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
    if (v >= 1e4) return (v / 1e4).toFixed(2) + " 万";
    return v.toFixed(0);
  },
  moneyShort(v: number) {
    if (v >= 1e12) return (v / 1e12).toFixed(2) + "万亿";
    if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿";
    return v.toFixed(0);
  },
  int(v: number) {
    return Math.round(v).toLocaleString("zh-CN");
  },
  dec(v: number, d = 1) {
    return v.toFixed(d);
  },
  pct(v: number, d = 1) {
    return (v >= 0 ? "+" : "") + v.toFixed(d) + "%";
  },
};

/** 数据口径说明 —— 大屏必须自证数据来源，否则数字不可信 */
export const DATA_AS_OF = "2026-09-30";
export const DATA_SOURCE = "演示数据 · 非真实统计口径";

/* ── 与行政区的一致性校验 ───────────────────────────────────────
   import 时就跑一次：手写的 POPULATION 表若漏了某个行政区，
   开发期会立刻在控制台点名，而不是等到页面上出现一片 NaN。 */
assertRegions(cityData, "POPULATION / cityData");