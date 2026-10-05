/**
 * 时序数据层 —— 项目内时序的唯一来源。
 *
 * 为什么要这个模块
 * ──────────────
 * 原来 `charts.tsx` 里根本没有时序数据，折线是渲染时现合成的：
 *
 *     seasonal = 1 + sin(i/12 * 2π - 1.2) * 0.16     // 固定正弦，所有指标共用
 *     value    = base[m] * (i+1)/n * seasonal * drift
 *
 * 于是「出口走势 / 税收走势 / 负荷走势」归一化后几乎重合 —— 实测三块屏的
 * 最大形状差只有 0.005~0.008。除了缩放，曲线是同一条。
 *
 * 这里给每种指标**不同的生成机制**，而不是同一个函数换参数：
 *   出口年末翘尾 · 进口与出口反相 · 用电夏冬双峰 · 税收近乎单调
 *   GDP 年内爬升 · 人口平滑 · 企业数阶梯 · 设备故障泊松尖峰
 * 形状不同，图才不同。
 *
 * 用确定性 PRNG，不用 Math.random —— 刷新页面数字不变，演示可复现。
 * 同比/环比一律从序列派生，不单独声明，避免与走势打架。
 */
import { cityMetrics, type CityMetrics } from "./data";

export const MONTHS = 24;

const TAU = Math.PI * 2;
const cos = (m: number, center: number) => Math.cos(((m - center) / 12) * TAU);

/** xmur3 + mulberry32 —— 与 data.ts 同源，改一处即可 */
function seeded(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export type MetricKind = "flow" | "stock";

export interface MetricSpec {
  /** 中文名 */
  label: string;
  unit: string;
  /** flow：月度流量，末 12 月之和 = 标量的年度值
   *  stock：时点存量，末值 = 标量的当前值 */
  kind: MetricKind;
  /** 随机噪声幅度 */
  vol: number;
  /** 两年累计增幅，仅 stock 用（0.09 = 两年 +9%）。flow 取自 growth */
  drift?: number;
  /** 月度形态系数，均值归一到 1；null 表示走阶梯分支 */
  shape: ((month: number) => number) | null;
}

/**
 * 指标生成器表 —— 每个指标一套独立机制。
 * 新增指标时先想清楚「它在一年里是什么形状」，再写 shape。
 */
export const METRIC_SPECS = {
  /* 出口：Q4 欧美节日订单集中，年末翘尾；Q1 受春节影响回落 */
  exportValue: {
    label: "出口额",
    unit: "亿元",
    kind: "flow",
    vol: 0.055,
    shape: (m) => 0.8 + 0.2 * cos(m, 10.5),
  },

  /* 进口：与出口反相 —— Q1 春节前备货高峰，Q4 低位 */
  importValue: {
    label: "进口额",
    unit: "亿元",
    kind: "flow",
    vol: 0.05,
    shape: (m) => 1 - 0.17 * cos(m, 10.5),
  },

  /* 全社会用电：夏冬双峰，夏季空调负荷高于冬季取暖 */
  power: {
    label: "全社会用电",
    unit: "亿kWh",
    kind: "flow",
    vol: 0.035,
    shape: (m) => 1 + 0.23 * cos(m, 7.5) + 0.15 * cos(m, 0.5),
  },

  /* 税收：两个集中入库期 —— 5 月汇算清缴、1 月年末入库。
     这两个峰是按国内税制的常见季节性设计的演示形态，
     不代表任何具体口径的真实数据 */
  tax: {
    label: "税收总额",
    unit: "亿元",
    kind: "flow",
    vol: 0.04,
    shape: (m) => 1 + 0.09 * cos(m, 4.5) + 0.11 * cos(m, 0.5),
  },

  /* GDP：确认收入集中于 Q4，年末略高，但月度 GDP 本身波动不大 —— 振幅只给 10%。
     之前用 0.70→1.00 的年内爬升，跨年时形成 30% 锯齿，视觉上是断崖不是数据 */
  gdp: {
    label: "地区生产总值",
    unit: "亿元",
    kind: "flow",
    vol: 0.03,
    shape: (m) => 1 + 0.05 * cos(m, 10.5),
  },

  /* 综合能耗：跟随工业生产，比用电平缓，冬夏双峰幅度小 */
  energy: {
    label: "综合能耗",
    unit: "万吨标煤",
    kind: "flow",
    vol: 0.04,
    shape: (m) => 1 + 0.1 * cos(m, 7) + 0.08 * cos(m, 0),
  },

  /* 发电量：与用电同向但不同形 —— 新能源削峰填谷压平冬季落差，
     丰水期带来春季小峰，波动也更大。不能只是 power 的缩小版 */
  output: {
    label: "发电量",
    unit: "亿kWh",
    kind: "flow",
    vol: 0.09,
    shape: (m) => 1 + 0.13 * cos(m, 6.5) + 0.07 * cos(m, 0) + 0.1 * cos(m, 3),
  },

  /* 常住人口：年内几乎无波动，缓慢单调 */
  population: {
    label: "常住人口",
    unit: "万人",
    kind: "stock",
    vol: 0.006,
    drift: 0.03,
    shape: (m) => 1 + 0.012 * cos(m, 6),
  },

  /* 规上企业数：阶梯式 —— 新增与退规造成台阶，不是平滑曲线 */
  enterprises: {
    label: "规上企业",
    unit: "家",
    kind: "stock",
    vol: 0.012,
    drift: 0.09,
    shape: null,
  },

  /* 综合活跃度：0–100 指数，无量纲，缓慢爬升 + 轻微年内波动 */
  score: {
    label: "综合活跃度",
    unit: "",
    kind: "stock",
    vol: 0.01,
    drift: 0.03,
    shape: (m) => 1 + 0.02 * cos(m, 6),
  },

  /* 设备故障：夏冬双峰（极端天气）+ 强噪声尖峰，无趋势 */
  faults: {
    label: "设备故障",
    unit: "次",
    kind: "flow",
    vol: 0.3,
    shape: (m) => 1 + 0.55 * cos(m, 7.5) + 0.35 * cos(m, 0.5),
  },
} satisfies Record<string, MetricSpec>;

export type MetricKey = keyof typeof METRIC_SPECS;
export const METRIC_KEYS = Object.keys(METRIC_SPECS) as MetricKey[];

/** 企业数的阶梯形态：累积 + 不规则跳变（新增 / 退规） */
function staircase(n: number, rnd: () => number) {
  const out: number[] = [];
  let level = 0.94 + rnd() * 0.02;
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.42) level += (rnd() - 0.3) * 0.035;
    out.push(level);
  }
  return out;
}

export function generate(
  key: MetricKey,
  annual: number,
  growth: number,
  seedStr: string,
  n = MONTHS,
): number[] {
  const spec: MetricSpec = METRIC_SPECS[key];
  const rnd = seeded(`${seedStr}|${key}`);
  const drift = spec.drift ?? ((growth / 100) * 2 * 0.85); // 两年累计增幅，单位是「倍数增量」

  let shape: number[];
  // 先取出到局部 const：闭包里 TS 不会保留 spec.shape 的非空收窄
  const fn = spec.shape;
  if (fn) {
    shape = Array.from({ length: n }, (_, i) => fn(i % 12));
    const mean = shape.reduce((a, b) => a + b, 0) / n;
    shape = shape.map((v) => v / mean); // 归一到均值 1
  } else {
    shape = staircase(n, rnd);
  }

  const raw = shape.map((s, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const noise = 1 + (rnd() - 0.5) * 2 * spec.vol;
    return s * (1 + drift * t) * noise; // drift 是累计增幅（0.09 = 两年 +9%）
  });

  if (spec.kind === "flow") {
    const tail = raw.slice(-12).reduce((a, b) => a + b, 0);
    const k = annual / tail; // 末 12 月之和 = 标量的年度值
    return raw.map((v) => +(v * k).toFixed(2));
  }
  const k = annual / raw[n - 1]; // 末值 = 标量的当前值
  return raw.map((v) => +(v * k).toFixed(2));
}

/** 同比：末 12 月 vs 前 12 月。声明与走势同源，不打架 */
export function yoyOf(values: number[]) {
  const a = values.slice(-12).reduce((x, y) => x + y, 0);
  const b = values.slice(0, 12).reduce((x, y) => x + y, 0);
  return +(((a - b) / b) * 100).toFixed(1);
}

/** 环比：末月 vs 上月 */
export function momOf(values: number[]) {
  return +(((values.at(-1)! - values.at(-2)!) / values.at(-2)!) * 100).toFixed(1);
}

const _peakTrough = new Map<MetricKey, number>();

/** 该指标理论形态的年内峰谷比（阶梯类返回 1，表示不设季节性下限） */
function theoreticalPeakTrough(key: MetricKey): number {
  const hit = _peakTrough.get(key);
  if (hit !== undefined) return hit;
  const fn = (METRIC_SPECS[key] as MetricSpec).shape;
  let v = 1.1;
  if (fn) {
    const twelve = Array.from({ length: 12 }, (_, m) => fn(m));
    v = Math.max(...twelve) / Math.min(...twelve);
  }
  _peakTrough.set(key, v);
  return v;
}

/** 开发期形态闸门 —— 曲线形状错了图就是错的，编译期抓不到 */
function assertShape(name: string, key: MetricKey, v: number[], spec: MetricSpec) {
  if (v.length !== MONTHS) return;
  const allFinite = v.every(Number.isFinite);
  if (!allFinite) throw new Error(`[series] ${name}/${key} 含非有限值`);

  if (spec.kind === "stock") {
    // 存量不该崩塌也不该翻倍：两年变化率必须落在 ±30% 内
    const chg = (v.at(-1)! - v[0]) / v[0];
    if (Math.abs(chg) > 0.3)
      throw new Error(
        `[series] ${name}/${key} 存量序列 24 个月变化 ${(chg * 100).toFixed(0)}%，超出 ±30%`,
      );
  }
  // 季节性不得被漂移压垮。阈值由该指标的理论形态算出，不写死 ——
  // 人口季节性天然只有 2%，写死阈值会误报
  const yr = v.slice(-12);
  const ratio = Math.max(...yr) / Math.min(...yr);
  if (ratio < theoreticalPeakTrough(key) * 0.75)
    throw new Error(
      `[series] ${name}/${key} 年内峰谷比 ${ratio.toFixed(2)}，` +
        `低于理论值 ${theoreticalPeakTrough(key).toFixed(2)} 的 75% —— 漂移压垮了季节性`,
    );
}

export interface Series {
  values: number[];
  yoy: number;
  mom: number;
}

export type SeriesTable = Record<string, Partial<Record<MetricKey, Series>>>;

/** 全量生成（模块加载时算一次，PRNG 确定性所以结果稳定） */
export const series: SeriesTable = Object.fromEntries(
  Object.entries(cityMetrics).map(([name, m]) => [
    name,
    Object.fromEntries(
      METRIC_KEYS.filter((k) => typeof (m as unknown as Record<string, number>)[k] === "number").map(
        (k) => {
          const values = generate(k, (m as unknown as Record<string, number>)[k], m.growth, name);
          assertShape(name, k, values, METRIC_SPECS[k] as MetricSpec);
          return [k, { values, yoy: yoyOf(values), mom: momOf(values) }];
        },
      ),
    ),
  ]),
);

export function seriesOf(city: string, key: MetricKey): Series {
  return series[city]?.[key] ?? { values: [], yoy: 0, mom: 0 };
}

/** 省级聚合：逐月求和。flow 与 stock 同理 —— 存量也是逐月加总，不是复制末值 */
export function provinceSeries(key: MetricKey): Series {
  const vals = Object.values(series)
    .map((s) => s[key]?.values)
    .filter((v): v is number[] => !!v?.length);
  const n = vals[0]?.length ?? 0;
  const merged = Array.from({ length: n }, (_, i) =>
    +vals.reduce((a, v) => a + v[i], 0).toFixed(2),
  );
  return { values: merged, yoy: yoyOf(merged), mom: momOf(merged) };
}

/** 月份标签（2025-01 … 2026-12） */
export const MONTH_LABELS = Array.from({ length: MONTHS }, (_, i) =>
  `${i < 12 ? "2025" : "2026"}${String((i % 12) + 1).padStart(2, "0")}`,
);

export type { CityMetrics };