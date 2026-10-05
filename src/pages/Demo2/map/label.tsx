import { Html } from "@react-three/drei";
import styled from "styled-components";
import { useConsole } from "../../../console/store";
import { palette } from "@/theme/tokens";

/**
 * 地市州标注 + 数值
 * ------------------------------------------------------------------
 * 原版是一个固定 `color="#fff" fontSize={0.3}` 的 drei Text：
 * 纯白、无底、恒定世界尺寸，21 个标注在黑色场景里亮度完全一致，
 * 既抢眼又分不出主次。
 * 改为：默认弱化（半透明灰），悬停/锁定时亮为青色并带底板；
 * 同时把该市的用电量数值一并带上 —— 让"标注"变成"数据标签"。
 * 不设 distanceFactor，保证屏幕上的实际像素尺寸恒定。
 */
const Box = styled(Html)<{ $on?: boolean; $dim?: boolean }>`
  pointer-events: none;
  width: max-content;
  white-space: nowrap;
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: ${({ $on }) => ($on ? "3px 8px" : "1px 3px")};
  border: 1px solid ${({ $on }) => ($on ? palette.cyanDeep : "transparent")};
  border-radius: 2px;
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.14)" : "transparent")};
  opacity: ${({ $dim }) => ($dim ? 0.3 : 1)};
  transition:
    opacity var(--e-fast),
    background var(--e-fast),
    padding var(--e-fast);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
`;

const Name = styled.span<{ $on?: boolean }>`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ $on }) => ($on ? palette.cyanSoft : palette.text)};
`;

const Val = styled.span<{ $on?: boolean }>`
  font-size: 10px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: ${({ $on }) => ($on ? palette.cyan : palette.textFaint)};
`;

export default function Label({
  children,
  value,
  ...props
}: React.ComponentProps<typeof Html> & {
  children?: React.ReactNode;
  /** 附带的指标值 */
  value?: string;
}) {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  const showLabels = useConsole((s) => s.layers.labels);
  const name = String(children ?? "");
  const on = hover === name || pinned === name;

  if (!showLabels && !on) return null;

  return (
    <Box
      {...props}
      $on={on}
      $dim={!!hover && !on}
      style={{ ...props.style, zIndex: on ? 1200 : 1100 }}
    >
      <Name $on={on}>{name}</Name>
      {value && <Val $on={on}>{value}</Val>}
    </Box>
  );
}