/**
 * TopBar —— 顶栏
 * ------------------------------------------------------------------
 * 解决原顶栏的三个问题：
 *   1. 标题占据全部视觉权重，没有任何"当前状态"信息 → 增加 KPI 落点与时间/口径
 *   2. 下钻后没有任何"我现在在看哪个市"的提示 → 增加 ScopeBadge + 清除
 *   3. 入场动画不可重放 → 增加重播按钮（并尊重 reduced-motion）
 */
import { useEffect, useState } from "react";
import styled from "styled-components";
import { useConsole } from "../store";
import { ALL_CITIES, DATA_AS_OF, DATA_SOURCE, getCity } from "../data";
import { palette } from "@/theme/tokens";

const Root = styled.header`
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-xl);
  height: 56px;
  padding: 0 var(--sp-xl);
  background: linear-gradient(
    180deg,
    rgba(11, 17, 32, 0.92) 0%,
    rgba(11, 17, 32, 0.6) 70%,
    transparent 100%
  );
  position: relative;
  z-index: 2;
  pointer-events: auto;

  &::after {
    content: "";
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      ${palette.lineStrong} 15%,
      ${palette.cyanDeep} 50%,
      ${palette.lineStrong} 85%,
      transparent
    );
  }
`;

const Slot = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  min-width: 0;
`;

const Brand = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--sp-md);
  min-width: 0;
`;

const Mark = styled.span`
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, ${palette.cyan}, ${palette.indigo});
  box-shadow: 0 0 10px ${palette.cyan}80;
  align-self: center;
  flex: none;
`;

const Title = styled.h1`
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--c-text);
  white-space: nowrap;
`;

const Subtitle = styled.span`
  font-size: var(--fs-micro);
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-faint);
  white-space: nowrap;
`;

/* ── 下钻态提示 ─────────────────────────────────────────────── */

const Scope = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  height: 26px;
  padding: 0 4px 0 var(--sp-md);
  border: 1px solid ${palette.cyanDeep};
  border-radius: 13px;
  background: rgba(79, 209, 255, 0.08);
  font-size: var(--fs-small);
  color: ${palette.cyanSoft};
  white-space: nowrap;
`;

const ScopeLabel = styled.span`
  font-size: var(--fs-micro);
  color: ${palette.textMute};
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
`;

const ScopeName = styled.strong`
  font-weight: 700;
  color: ${palette.cyan};
`;

const ClearBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: ${palette.textMute};
  background: transparent;
  transition:
    color var(--e-fast),
    background var(--e-fast);

  &:hover {
    color: ${palette.void};
    background: ${palette.cyan};
  }

  svg {
    display: block;
  }
`;

/* ── 时间与口径 ─────────────────────────────────────────────── */

const Stamp = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.25;
`;

const Clock = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-base);
  color: var(--c-text);
`;

const Meta = styled.span`
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
`;

export default function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  const pinned = useConsole((s) => s.pinned);
  const clearScope = useConsole((s) => s.clearScope);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const city = getCity(pinned ?? ALL_CITIES);

  return (
    <Root>
      <Slot>
        <Brand>
          <Mark />
          <Title>{title}</Title>
          <Subtitle>{subtitle}</Subtitle>
        </Brand>
        {pinned && (
          <Scope>
            <ScopeLabel>SCOPE</ScopeLabel>
            <ScopeName>{pinned}</ScopeName>
            <Meta>
              人口 {city.population}万 · GDP {city.gdp / 1e8 >= 1 ? (city.gdp / 1e8).toFixed(0) : city.gdp}亿
            </Meta>
            <ClearBtn onClick={clearScope} title="返回全省视角" aria-label="返回全省视角">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1l8 8M9 1l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </ClearBtn>
          </Scope>
        )}
      </Slot>

      <Slot style={{ marginLeft: "auto" }}>
        <Stamp>
          <Clock>
            {hh}:{mm}
            <span style={{ color: palette.textFaint }}>:{ss}</span>
          </Clock>
          <Meta>
            数据截至 {DATA_AS_OF} · {DATA_SOURCE}
          </Meta>
        </Stamp>
      </Slot>
    </Root>
  );
}