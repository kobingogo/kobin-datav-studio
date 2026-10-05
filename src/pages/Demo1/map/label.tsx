import { Html } from "@react-three/drei";
import styled from "styled-components";
import { useConsole } from "../../../console/store";
import { palette } from "@/theme/tokens";

/**
 * 城市名标注
 * ------------------------------------------------------------------
 * 原项目是一个白底橙框的圆角小药丸，在近黑场景里是一块高亮白斑，
 * 21 个标注同时出现时非常刺眼。
 * 改为：默认无底、只留极暗的文字描边保证在任何底色上都可读；
 * 只有悬停/锁定的那一个才亮起为青色胶囊。
 */
const Box = styled(Html)<{ $on?: boolean }>`
  pointer-events: none;
  width: max-content;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  padding: ${({ $on }) => ($on ? "3px 7px" : "1px 3px")};
  border: 1px solid
    ${({ $on }) => ($on ? palette.cyanDeep : "transparent")};
  border-radius: 2px;
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.14)" : "transparent")};
  color: ${({ $on }) => ($on ? palette.cyanSoft : palette.text)};
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.04em;
  transition:
    color var(--e-fast),
    background var(--e-fast),
    padding var(--e-fast);
`;

export default function Label(
  props: React.ComponentProps<typeof Html> & { children?: React.ReactNode }
) {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  const showLabels = useConsole((s) => s.layers.labels);
  const name = String(props.children ?? "");
  const on = hover === name || pinned === name;

  if (!showLabels && !on) return null;

  return (
    <Box
      {...props}
      $on={on}
      style={{
        ...props.style,
        zIndex: on ? 1200 : 1100,
        opacity: hover && !on ? 0.35 : 1,
      }}
    />
  );
}