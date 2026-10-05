/**
 * 深空数据台 · Design Tokens
 * ------------------------------------------------------------------
 * 单一事实来源：颜色 / 字阶 / 间距 / 圆角 / 动效 / 层级。
 * 2D 面板通过 CSS 变量消费，3D 场景与 ECharts 通过 `three()` / `palette`
 * 直接取色，保证三种渲染管线视觉一致。
 */

export const palette = {
  /* 底层 —— 蓝紫调近黑，避免纯黑造成的发光刺眼 */
  void: "#04060C",
  canvas: "#070B14",
  surface: "#0B1120",
  surfaceHi: "#101829",
  surfaceHover: "#16203400",

  /* 描边：极细发丝线 */
  line: "#1B2740",
  lineSoft: "#141D31",
  lineStrong: "#26375A",

  /* 文本 */
  text: "#E9EFFA",
  textDim: "#8FA0BF",
  textMute: "#5A6B8A",
  textFaint: "#3C4A64",

  /* 数据主色 */
  cyan: "#4FD1FF",
  cyanSoft: "#8FE3FF",
  cyanDeep: "#1E7FA8",

  /* 对比 / 次序列 */
  indigo: "#7B8CFF",
  violet: "#A98CFF",

  /* 语义色 */
  amber: "#FFB547",
  critical: "#FF6B6B",
  good: "#3ED598",

  /* 图表序列梯度（冷→暖，保证相邻序列可区分） */
  series: [
    "#4FD1FF",
    "#7B8CFF",
    "#3ED598",
    "#A98CFF",
    "#FFB547",
    "#FF6B6B",
    "#5EEAD4",
    "#F472B6",
  ],

  /* 热力梯度：单一色相（深蓝 → 青 → 白）由暗到亮。
     原版用 青→绿→黄→红 多色相，叠在卫星绿图上会互相污染；
     收敛到单色相后，密度高低靠明度区分，与 UI 主色天然统一。 */
  heat: ["#0A1E38", "#0F3A5F", "#146C9C", "#1FA3D6", "#4FD1FF", "#A8ECFF"],
} as const;

export const type = {
  /** 等宽数字 —— 所有指标数字必须用它，保证跳动时不抖动 */
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, monospace',
  sans: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif',
} as const;

export const fontSize = {
  kicker: 10,
  micro: 11,
  small: 12,
  base: 13,
  md: 15,
  lg: 18,
  xl: 22,
  hero: 34,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  none: 0,
  sm: 2,
  md: 3,
} as const;

export const motion = {
  fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "220ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "420ms cubic-bezier(0.16, 1, 0.3, 1)",
  /** 面板波次入场错开间隔 */
  stagger: 0.06,
} as const;

export const z = {
  canvas: 0,
  mapOverlay: 10,
  panel: 100,
  dock: 200,
  drawer: 300,
  tooltip: 1001,
} as const;

/** 统一降为 CSS 变量，供 styled-components 与原生 CSS 共用 */
export const cssVars = {
  "--c-void": palette.void,
  "--c-canvas": palette.canvas,
  "--c-surface": palette.surface,
  "--c-surface-hi": palette.surfaceHi,
  "--c-line": palette.line,
  "--c-line-soft": palette.lineSoft,
  "--c-line-strong": palette.lineStrong,
  "--c-text": palette.text,
  "--c-text-dim": palette.textDim,
  "--c-text-mute": palette.textMute,
  "--c-text-faint": palette.textFaint,
  "--c-cyan": palette.cyan,
  "--c-cyan-soft": palette.cyanSoft,
  "--c-cyan-deep": palette.cyanDeep,
  "--c-indigo": palette.indigo,
  "--c-amber": palette.amber,
  "--c-critical": palette.critical,
  "--c-good": palette.good,
  "--font-mono": type.mono,
  "--font-sans": type.sans,
  "--fs-kicker": `${fontSize.kicker}px`,
  "--fs-micro": `${fontSize.micro}px`,
  "--fs-small": `${fontSize.small}px`,
  "--fs-base": `${fontSize.base}px`,
  "--fs-md": `${fontSize.md}px`,
  "--fs-lg": `${fontSize.lg}px`,
  "--fs-xl": `${fontSize.xl}px`,
  "--fs-hero": `${fontSize.hero}px`,
  "--sp-xs": `${space.xs}px`,
  "--sp-sm": `${space.sm}px`,
  "--sp-md": `${space.md}px`,
  "--sp-lg": `${space.lg}px`,
  "--sp-xl": `${space.xl}px`,
  "--sp-xxl": `${space.xxl}px`,
  "--r-sm": `${radius.sm}px`,
  "--r-md": `${radius.md}px`,
  "--e-fast": motion.fast,
  "--e-base": motion.base,
  "--e-slow": motion.slow,
} as const;

/** 给 three.js 用的颜色（必须是数字） */
export const three = {
  bg: 0x070b14,
  fog: 0x070b14,
  surface: 0x0b1120,
  line: 0x1b2740,
  cyan: 0x4fd1ff,
  cyanDeep: 0x1e7fa8,
  indigo: 0x7b8cff,
  amber: 0xffb547,
  text: 0xe9effa,
  textMute: 0x5a6b8a,
} as const;

export type Theme = typeof palette;