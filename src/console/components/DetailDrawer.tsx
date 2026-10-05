/**
 * DetailDrawer —— 下钻详情抽屉
 * ------------------------------------------------------------------
 * 解决"无法下钻"：原项目点击地图或图表没有任何反应，
 * 用户永远只能看到聚合值，看不到单个市/单个指标的结构。
 *
 * 选抽屉而非全屏的原因：全屏会丢失地图与全局上下文，
 * 而大屏的核心价值恰恰是"局部 vs 全局"的对照。抽屉压在右侧，
 * 左侧地图仍可见并高亮被选中的市，形成对照关系。
 */
import styled from "styled-components";
import { useConsole } from "../store";
import { ALL_CITIES, cityMetrics, cityNames, fmt, getCity } from "../data";
import { palette } from "@/theme/tokens";
import { RankBars, TrendLines } from "./charts";

const Scrim = styled.div<{ $open: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 290;
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  background: linear-gradient(
    90deg,
    transparent 40%,
    rgba(4, 6, 12, 0.55) 100%
  );
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  transition: opacity var(--e-base);
`;

const Panel = styled.aside<{ $open: boolean }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  z-index: 300;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    rgba(11, 17, 32, 0.98),
    rgba(7, 11, 20, 0.98)
  );
  border-left: 1px solid ${palette.cyanDeep};
  box-shadow: -24px 0 64px -24px rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transform: translateX(${({ $open }) => ($open ? "0" : "100%")});
  transition: transform var(--e-slow);
  overflow: hidden auto;
`;

const Head = styled.div`
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-md);
  padding: var(--sp-lg) var(--sp-xl);
  border-bottom: 1px solid ${palette.line};
`;

const Kicker = styled.div`
  font-size: var(--fs-kicker);
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${palette.cyanDeep};
`;

const Name = styled.h2`
  margin: 2px 0 0;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--c-text);
`;

const Close = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid ${palette.line};
  border-radius: 2px;
  color: var(--c-text-mute);
  transition: all var(--e-fast);

  &:hover {
    color: ${palette.void};
    background: ${palette.cyan};
    border-color: ${palette.cyan};
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-xl);
  padding: var(--sp-lg) var(--sp-xl) var(--sp-xxl);
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: ${palette.lineSoft};
  border: 1px solid ${palette.lineSoft};
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-md) var(--sp-lg);
  background: ${palette.surface};

  &:hover {
    background: ${palette.surfaceHi};
  }
`;

const StatLabel = styled.span`
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
`;

const StatValue = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--c-text);
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
  min-height: 0;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--c-text-dim);
  padding-left: var(--sp-sm);
  border-left: 2px solid ${palette.cyanDeep};
`;

const ChartBox = styled.div`
  height: 168px;
  min-height: 0;
`;

const Rank = styled.div`
  height: 210px;
  min-height: 0;
`;

const Hint = styled.p`
  margin: 0;
  font-size: var(--fs-micro);
  line-height: 1.6;
  color: var(--c-text-faint);
  padding: var(--sp-md);
  border: 1px dashed ${palette.line};
  border-radius: 2px;
`;

export default function DetailDrawer({
  metric = "gdp",
}: {
  metric?: keyof (typeof cityMetrics)[string];
}) {
  const pinned = useConsole((s) => s.pinned);
  const clearScope = useConsole((s) => s.clearScope);
  const open = !!pinned;

  const m = getCity(pinned);

  const stats: [string, string][] = [
    ["地区生产总值", fmt.money(m.gdp) + " 元"],
    ["常住人口", fmt.int(m.population) + " 万人"],
    ["行政面积", fmt.int(m.area) + " km²"],
    ["在册企业", fmt.int(m.enterprises) + " 家"],
    ["税收总额", fmt.money(m.tax) + " 元"],
    ["综合能耗", fmt.dec(m.energy) + " 万吨标煤"],
    ["年用电量", fmt.dec(m.power) + " 亿kWh"],
    ["设备故障", fmt.int(m.faults) + " 次"],
  ];

  return (
    <>
      <Scrim $open={open} onClick={clearScope} />
      <Panel $open={open} aria-hidden={!open}>
        <Head>
          <div>
            <Kicker>{pinned ? "Drill-down" : "No Selection"}</Kicker>
            <Name>{pinned ?? "未选择地区"}</Name>
          </div>
          <Close onClick={clearScope} aria-label="关闭详情" disabled={!open}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </Close>
        </Head>

        <Body>
          {open && pinned ? (
            <>
              <StatGrid>
                {stats.map(([k, v]) => (
                  <Stat key={k}>
                    <StatLabel>{k}</StatLabel>
                    <StatValue className="num">{v}</StatValue>
                  </Stat>
                ))}
              </StatGrid>

              <Section>
                <SectionTitle>同比走势</SectionTitle>
                <ChartBox>
                  <TrendLines metric={metric} color={palette.cyan} />
                </ChartBox>
              </Section>

              <Section>
                <SectionTitle>全省同指标位次</SectionTitle>
                <Rank>
                  <RankBars
                    metric={metric}
                    limit={10}
                    color={palette.indigo}
                    valueFormat={(v) => fmt.moneyShort(v)}
                  />
                </Rank>
              </Section>

              <Hint>
                按住地图可旋转视角，滚轮缩放。再次点击同一城市或按 Esc 取消锁定。
                数据口径：{cityNames.length} 个地市州行政区，指标为演示数据。
              </Hint>
            </>
          ) : (
            <Hint>
              在地图上点击任一地市州，或点击任一排行条，即可锁定该地区并在此查看明细。
              当前为全省聚合视角。
            </Hint>
          )}
        </Body>
      </Panel>
    </>
  );
}

export { ALL_CITIES };