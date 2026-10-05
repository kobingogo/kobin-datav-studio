/**
 * Tag —— 状态标签（pill）。
 *
 * 为什么要 pill
 * ────────────
 * 原来告警/建议这类信息只有颜色（红点、橙点），色弱读者无法区分，
 * 而且颜色要同时承担"分类"和"状态"两个职责，容易互相打架。
 * pill 把状态变成**可读的词**（紧急 / 高 / 中），颜色只做强化。
 *
 * 约定：tone 决定颜色，文字自己说明等级，两者不重复表达同一件事。
 */
import styled, { css } from "styled-components";
import { palette } from "@/theme/tokens";

export type Tone = "crit" | "warn" | "ok" | "info" | "mute";

const TONE_COLOR: Record<Tone, string> = {
  crit: palette.critical,
  warn: palette.amber,
  ok: palette.good,
  info: palette.cyan,
  mute: palette.textMute,
};

const Root = styled.span<{ $tone: Tone }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  color: ${({ $tone }) =>
    $tone === "crit" || $tone === "info" ? "#06121C" : "#1A1206"};
  background: ${({ $tone }) => TONE_COLOR[$tone]};

  ${({ $tone }) =>
    $tone === "crit" &&
    css`
      box-shadow: 0 0 10px -2px ${palette.critical};
    `}
`;

const Dot = styled.i<{ $c: string }>`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
  flex: none;
`;

export interface TagProps {
  tone?: Tone;
  /** 前置圆点；用于列表行内需要与文字同色的场景 */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Tag({ tone = "info", dot, children, className }: TagProps) {
  return (
    <Root $tone={tone} className={className}>
      {dot && <Dot $c={TONE_COLOR[tone]} />}
      {children}
    </Root>
  );
}

export default Tag;
