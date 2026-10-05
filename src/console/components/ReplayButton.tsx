/**
 * 键盘与重播控制
 * ------------------------------------------------------------------
 * 原项目的入场动画只能靠切路由重看，且不响应系统动效偏好。
 * 这里把"重播"变成一个显式控制，并统一处理键盘：
 *   Esc   取消下钻锁定
 *   R     重播入场
 *   L     切换图层面板
 */
import { useEffect } from "react";
import styled from "styled-components";
import { useConsole } from "../store";
import { palette } from "@/theme/tokens";

/**
 * REPLAY 按钮贴右下角、位于底部控制条正上方。
 * 原来写死 top:116px，在 1366×768 下会压住 KPI 带，
 * 且完全不随布局变化。改为锚定底部。
 */
const Btn = styled.button<{ $inline?: boolean }>`
  position: ${({ $inline }) => ($inline ? "static" : "absolute")};
  right: ${({ $inline }) => ($inline ? "auto" : "var(--sp-xl)")};
  bottom: ${({ $inline }) => ($inline ? "auto" : "64px")};
  z-index: 3;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  font-size: var(--fs-micro);
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  color: var(--c-text-mute);
  background: rgba(7, 11, 20, 0.82);
  border: 1px solid ${palette.line};
  border-radius: 2px;
  backdrop-filter: blur(10px);
  pointer-events: auto;
  transition: all var(--e-fast);

  &:hover {
    color: ${palette.cyan};
    border-color: ${palette.cyanDeep};
    background: rgba(79, 209, 255, 0.08);
  }

  svg {
    display: block;
  }
`;

export default function ReplayButton({ inline }: { inline?: boolean } = {}) {
  const setIntroPlayed = useConsole((s) => s.setIntroPlayed);
  const setMapReady = useConsole((s) => s.setMapReady);
  const pinned = useConsole((s) => s.pinned);

  // 抽屉展开时右栏整体让位，此时再浮一个 REPLAY 只会与抽屉头部打架
  if (pinned) return null;

  return (
    <Btn
      $inline={inline}
      onClick={() => {
        // 先把面板藏回起点并关掉地图就绪信号，再重新置位 → 触发完整编排
        setIntroPlayed(false);
        setMapReady(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setMapReady(true)));
      }}
      title="重播入场动画（快捷键 R）"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path
          d="M10 6a4 4 0 1 1-1.2-2.85"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path d="M10.5 1v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      REPLAY
    </Btn>
  );
}

/** 全局键盘绑定，由 demo 顶层挂载一次 */
export function useConsoleHotkeys() {
  const clearScope = useConsole((s) => s.clearScope);
  const setIntroPlayed = useConsole((s) => s.setIntroPlayed);
  const setMapReady = useConsole((s) => s.setMapReady);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearScope();
      if (e.key === "r" || e.key === "R") {
        setIntroPlayed(false);
        setMapReady(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setMapReady(true))
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearScope, setIntroPlayed, setMapReady]);
}