/**
 * 语义图标集 —— 面板视觉语言的第一层。
 *
 * 为什么要图标
 * ────────────
 * 原来 KPI 与面板标题都是纯文字，读者的眼睛要靠"标签 + 数值"两段文字去
 * 建立语义。图标把"这是什么类别"压成一个可扫读的形状，一排 KPI 里
 * 「发电(闪电) / 负荷(仪表) / 故障(警告三角) / 企业(建筑)」的区别不必读字。
 *
 * 约定
 * ────
 * · 24×24 线性描边，stroke-width 1.7，圆角端点，随字色走 currentColor
 * · 全部 inline SVG，不引图标库（大屏要控制包体，且描边粗细需统一）
 * · 图标只承载"类别"，不承载"状态" —— 状态交给颜色与 pill
 */
import type { SVGProps } from "react";

export type IconName =
  | "bolt"
  | "gauge"
  | "building"
  | "users"
  | "warn"
  | "clock"
  | "pin"
  | "trend"
  | "layers"
  | "screen"
  | "target"
  | "swap"
  | "leaf"
  | "grid"
  | "flow"
  | "rank"
  | "table"
  | "ring";

const PATHS: Record<IconName, string> = {
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  gauge:
    '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 14l4-4"/><circle cx="12" cy="18" r="1.6"/>',
  building:
    '<path d="M4 21V7l7-4v18"/><path d="M11 21V10l9 3v8"/><path d="M2 21h20"/><path d="M7 10h1M7 14h1M7 18h1M15 14h1M15 18h1"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.5A6 6 0 0 1 21 20"/>',
  warn:
    '<path d="M12 3 2 20h20L12 3z"/><path d="M12 9.5v4.6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.4l3.4 2"/>',
  pin:
    '<path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6"/>',
  target:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  swap: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19c2-5 5-8 9-10"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  flow: '<path d="M3 17c3-6 6-6 9 0s6 6 9 0"/><path d="M3 7h6"/><path d="M15 7h6"/>',
  rank: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  table:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 9.5V20"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/>',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{ flex: "none", display: "block" }}
      {...rest}
    >
      {PATHS[name] ? <g dangerouslySetInnerHTML={{ __html: PATHS[name] }} /> : null}
    </svg>
  );
}

export default Icon;
