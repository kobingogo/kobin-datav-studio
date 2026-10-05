/**
 * ECharts 与 design token 的桥接层。
 * 所有图表 option 都从这里取基础样式与联动高亮工具，
 * 保证 12+ 张图的颜色 / 字号 / 网格 / tooltip 完全一致。
 */
import type { EChartsCoreOption } from "echarts/core";
import { fontSize, palette, type } from "./tokens";

/* ── 联动状态 ───────────────────────────────────────────────── */

/** 当前联动上下文：hover 优先，其次为已锁定的实体 */
export interface LinkState {
  /** 正在悬停的实体 key（瞬时） */
  hover?: string | null;
  /** 已点击锁定的实体 key（持久） */
  pinned?: string | null;
}

export function linkKeyOf(state: LinkState | null | undefined): string | null {
  if (!state) return null;
  return state.hover ?? state.pinned ?? null;
}

/**
 * 计算某个数据项在当前联动状态下的视觉权重。
 * active = 该项与联动实体匹配；muted = 存在联动实体但不匹配。
 */
export function linkWeight(
  itemKey: string | undefined,
  state: LinkState | null | undefined,
): { opacity: number; isActive: boolean; isMuted: boolean } {
  const key = linkKeyOf(state);
  if (!key) return { opacity: 1, isActive: false, isMuted: false };
  if (!itemKey) return { opacity: 1, isActive: false, isMuted: true };
  const isActive = itemKey === key;
  return {
    opacity: isActive ? 1 : 0.22,
    isActive,
    isMuted: !isActive,
  };
}

/* ── 基础样式 ───────────────────────────────────────────────── */

const font = (size: number, weight: number = 400) =>
  `${weight} ${size}px ${type.sans}`;

/** 统一的 tooltip：小、深、带发丝边，不遮挡数据 */
export const baseTooltip = {
  backgroundColor: "rgba(7, 11, 20, 0.94)",
  borderColor: palette.lineStrong,
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  extraCssText:
    "backdrop-filter: blur(8px); border-radius: 2px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);",
  textStyle: { color: palette.text, fontSize: fontSize.small, fontFamily: type.sans },
  axisPointer: {
    lineStyle: { color: palette.cyanDeep, width: 1, type: "dashed" as const },
    crossStyle: { color: palette.cyanDeep, width: 1, type: "dashed" as const },
    label: {
      backgroundColor: palette.surfaceHi,
      borderColor: palette.lineStrong,
      borderWidth: 1,
      color: palette.cyan,
      fontFamily: type.mono,
      fontSize: fontSize.micro,
    },
  },
};

/** 统一网格：留出轴标签空间，bottom 略大以容纳单位行 */
export const baseGrid = {
  top: 12,
  bottom: 24,
  left: 8,
  right: 16,
  containLabel: true,
};

/** 分类轴：隐藏轴线/刻度，只留标签 */
export const baseCategoryAxis = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: {
    color: palette.textMute,
    fontSize: fontSize.micro,
    fontFamily: type.sans,
    width: 92,
    overflow: "truncate" as const,
  },
  splitLine: { show: false },
};

/**
 * 数值轴：只留一条极淡的分割线。
 * 强制换算单位 —— 大屏上 30,000,000,000 这种数字既占宽又不可读，
 * 一律折算成万/亿/万亿并去掉无意义的小数。
 */
export const axisMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e12) return trimZero(v / 1e12) + "万亿";
  if (a >= 1e8) return trimZero(v / 1e8) + "亿";
  if (a >= 1e4) return trimZero(v / 1e4) + "万";
  return String(Math.round(v));
};

function trimZero(v: number) {
  return String(Math.round(v * 10) / 10);
}

export const baseValueAxis = {
  ...baseCategoryAxis,
  axisLabel: {
    color: palette.textFaint,
    fontSize: fontSize.micro,
    fontFamily: type.mono,
    formatter: axisMoney,
  },
  splitLine: {
    show: true,
    lineStyle: { color: palette.lineSoft, width: 1, type: "dashed" as const },
  },
};

/** 统一动画节奏（慢入场 + 快更新，数值变化不拖沓） */
export const baseAnimation = {
  animationDuration: 600,
  animationEasing: "cubicOut" as const,
  animationDurationUpdate: 320,
  animationEasingUpdate: "cubicOut" as const,
};

/** 通用线性渐变，从 accent 到透明，用于柱体 */
export function gradientFill(
  color: string,
  dir: "vertical" | "horizontal" = "vertical",
  from = 1,
  to = 0.15,
) {
  return {
    type: "linear" as const,
    x: dir === "horizontal" ? 0 : 0,
    y: dir === "horizontal" ? 0 : 0,
    x2: dir === "horizontal" ? 1 : 0,
    y2: dir === "horizontal" ? 0 : 1,
    global: false,
    colorStops: [
      { offset: 0, color: withAlpha(color, from) },
      { offset: 1, color: withAlpha(color, to) },
    ],
  };
}

/** hex → rgba，带透明度 */
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 统一 tooltip 数值样式 */
export const valueStyle = {
  color: palette.text,
  fontFamily: type.mono,
  fontSize: fontSize.small,
  fontWeight: 600 as const,
};

/** 系列默认描边：几乎不可见，只用于分隔相邻色块 */
export const defaultBorder = {
  borderColor: palette.canvas,
  borderWidth: 1,
};

export { font as echartsFont };

/**
 * 生成 legend data —— 显式带色块。
 * 原因：本方案的柱体用 data 级渐变覆盖了 series.itemStyle.color，
 * ECharts 的 legend 反查不到颜色时会退回内置默认调色板，
 * 于是图例出现红/黄/绿而柱子是青/靛的错位。
 */
export function legendItems(
  items: { name: string; color?: string }[]
) {
  return items.map((it) => ({
    name: it.name,
    itemStyle: { color: it.color ?? palette.textDim },
  }));
}

/** 把 token 基础样式浅合并进用户 option（用户字段优先） */
export function withBase<T extends EChartsCoreOption>(option: T): T {
  return {
    textStyle: { fontFamily: type.sans, color: palette.textDim },
    tooltip: baseTooltip,
    animation: baseAnimation,
    ...option,
  } as T;
}