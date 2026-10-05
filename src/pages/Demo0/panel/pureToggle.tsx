/**
 * 纯净模式开关
 * ------------------------------------------------------------------
 * 原实现是一个渐变胶囊按钮（conic-gradient 背景 + hover 旋转 180°），
 * 和 v2 里 LayerDock 的分段控件完全不是一套语言，
 * 而且"纯净模式"这个行为本身没有任何文字解释。
 *
 * 改为：贴底的一项分段控件，带文字 + LED 状态点 + title 说明。
 * 状态由外部持有（受控组件），因为 ConsoleFrame 的 hidden 也需要它，
 * 不能让开关和外壳各存一份。
 */
import styled from "styled-components";
import { palette } from "@/theme/tokens";

const Root = styled.div<{ $inline?: boolean }>`
  position: ${({ $inline }) => ($inline ? "static" : "absolute")};
  right: ${({ $inline }) => ($inline ? "auto" : "var(--sp-xl)")};
  bottom: ${({ $inline }) => ($inline ? "auto" : "var(--sp-md)")};
  z-index: 3;
  pointer-events: auto;
  flex: none;
`;

const Bar = styled.div`
  display: flex;
  align-items: stretch;
  border: 1px solid ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(10px);
  overflow: hidden;
`;

const Item = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  white-space: nowrap;
  font-size: var(--fs-micro);
  color: ${({ $on }) => ($on ? palette.cyanSoft : palette.textFaint)};
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.07)" : "transparent")};
  transition:
    color var(--e-fast),
    background var(--e-fast);

  &:hover {
    color: ${palette.cyan};
    background: rgba(79, 209, 255, 0.09);
  }
`;

const Led = styled.span<{ $on: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: ${({ $on }) => ($on ? palette.cyan : "transparent")};
  border: 1px solid ${({ $on }) => ($on ? palette.cyan : palette.lineStrong)};
  box-shadow: ${({ $on }) => ($on ? `0 0 6px ${palette.cyan}` : "none")};
  transition: all var(--e-fast);
`;

export default function PureToggle({
  on,
  onToggle,
  inline,
}: {
  /** 受控：状态由持有 ConsoleFrame 的那层传入 */
  on: boolean;
  onToggle: (v: boolean) => void;
  /** 排进底栏（与图层控件同行），而不是贴在右下角 */
  inline?: boolean;
}) {
  return (
    <Root $inline={inline}>
      <Bar>
        <Item
          $on={on}
          onClick={() => onToggle(!on)}
          aria-pressed={on}
          title={
            on
              ? "恢复面板（快捷键 C）"
              : "隐藏全部面板，只看地图（快捷键 C）"
          }>
          <Led $on={on} />
          纯净模式
        </Item>
      </Bar>
    </Root>
  );
}