/**
 * Demo0 面板 —— 外经贸口径。
 *
 * 与 Demo2 的差异化
 * ────────────────
 * Demo2（电力）的语法是「仪表 + 状态 + 增减」，回答"够不够、升没升"。
 * 贸易屏回答的是完全不同的两个问题：
 *   **这个差额从哪来**   → 瀑布图，逐项扣减到顺差
 *   **对外依赖多深**     → 半环刻度盘 + 城市刻度
 *   **哪类商品撑起来的** → 矩形树图（不是堆叠条）
 *   **进出口谁大谁小**   → 柱线双轴（不是单轴双序列）
 *
 * 所以这里的组件没有一个复用 Demo2 的仪表行语法 —— 刻意做出形态差异，
 * 三块屏并排时不应被认出是同一套模板。
 *
 * 布局也不同：Demo2 是左3+右3，这里是**左2+右4**。
 * 左栏留给两个「需要纵向空间」的构成类图形（树图、刻度盘），
 * 右栏留给四个「横向扫读」的对照与增量类图形。
 */
import { useMemo } from "react";
import styled from "styled-components";
import ConsoleFrame from "@/console/components/ConsoleFrame";
import TopBar from "@/console/components/TopBar";
import KpiRail from "@/console/components/KpiRail";
import Card from "@/console/components/Card";
import LayerDock from "@/console/components/LayerDock";
import MapLegend from "@/console/components/MapLegend";
import DetailDrawer from "@/console/components/DetailDrawer";
import ReplayButton, { useConsoleHotkeys } from "@/console/components/ReplayButton";
import { DeltaBars, StackShare } from "@/console/components/rows";
import { DualAxis, DialectPanel, TRADE, Treemap, Waterfall } from "@/console/components/trade";
import { useConsole } from "@/console/store";
import { useConsoleReset } from "@/console/useMapInteraction";
import { provinceName, provinceShort } from "@/geo";
import { cityMetrics, cityNames, fmt, province } from "@/console/data";
import { provinceSeries, seriesOf } from "@/console/series";
import { palette } from "@/theme/tokens";

const Note = styled.div`
  position: absolute;
  left: var(--sp-xl);
  bottom: 74px;
  max-width: 300px;
  pointer-events: auto;
  padding: var(--sp-sm) var(--sp-md);
  font-size: var(--fs-micro);
  line-height: 1.5;
  color: var(--c-text-faint);
  border: 1px dashed ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(8px);
`;

const UnitTag = styled.span`
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
  white-space: nowrap;
`;

const shortName = (n: string) => n.replace(/[市州]$/, "");

/** 商品分类是演示假设，按规模量级递减给出，注释已标明不是真实统计口径 */
const GOODS = [
  { name: "机电产品", value: 3820, color: TRADE.gold },
  { name: "高新技术", value: 2140, color: "#FF9E4A" },
  { name: "纺织服装", value: 1180, color: "#E8825A" },
  { name: "农产品", value: 640, color: "#D96A8C" },
  { name: "化工", value: 520, color: "#C05C8A" },
  { name: "其他", value: 367, color: palette.textMute },
];

/** 贸易伙伴同理：演示假设 */
const PARTNERS = [
  { name: "东盟", value: 1980, color: TRADE.gold },
  { name: "美国", value: 1740, color: "#FF9E4A" },
  { name: "欧盟", value: 1310, color: "#E8825A" },
  { name: "日韩", value: 980, color: "#D96A8C" },
  { name: "一带一路", value: 870, color: "#C05C8A" },
  { name: "其他", value: 1787, color: palette.textMute },
];

export default function Panel() {
  useConsoleReset();
  useConsoleHotkeys();

  const link = useConsole((s) => s.hover ?? s.pinned);
  const pinned = useConsole((s) => s.pinned);

  /** 贸易顺差变动：本期 − 同期，逐市 */
  const surplusDelta = useMemo(() => {
    const cur = (n: string) => {
      const s = seriesOf(n, "exportValue");
      return s.values.slice(-12).reduce((a, b) => a + b, 0);
    };
    const prev = (n: string) => {
      const s = seriesOf(n, "exportValue");
      return s.values.slice(0, 12).reduce((a, b) => a + b, 0);
    };
    return [...cityNames]
      .map((n) => {
        const d = cur(n) - prev(n);
        return { name: shortName(n), pct: (d / (prev(n) || 1)) * 100, full: n };
      })
      .sort((a, b) => b.pct - a.pct);
  }, []);

  /**
   * 双轴的两条线：柱=出口额（亿元），线=年化贸易依存度（%）。
   * 原来配的是出口 vs 进口 —— 两者量级相近（8667 vs 9991），
   * 两个 Y 轴刻度几乎一样，双轴形同虚设。改成量纲不同的一对，
   * 才真的需要双轴，且「规模大的是不是依赖也深」是贸易屏该回答的问题。
   */
  const dualAxis = useMemo(() => {
    const exp = provinceSeries("exportValue").values;
    const imp = provinceSeries("importValue").values;
    const gdp = province.gdp || 1;
    /* 年化依存度：近 12 个月的进出口合计 ÷ 全年 GDP */
    const dep = exp.map((_, i) => {
      const win = (arr: number[]) => arr.slice(Math.max(0, i - 11), i + 1).reduce((a, b) => a + b, 0);
      return +(((win(exp) + win(imp)) * 1e8) / gdp * 100).toFixed(1);
    });
    return { barValues: exp.map((v) => +v.toFixed(1)), lineValues: dep };
  }, []);

  /** 贸易伙伴的份额按全省出口归一 */
  const partnerMix = useMemo(() => {
    const total = province.exportValue || 1;
    return {
      segments: PARTNERS.map((p) => ({ ...p })),
      total,
    };
  }, []);

  return (
    <>
      <ConsoleFrame
        header={
          <TopBar
            title={`${provinceName}经济运行监测`}
            subtitle={`${provinceShort} Economic Monitor`}
          />
        }
        kpis={<KpiRail domain="trade" accent={TRADE.gold} />}
        left={[
          <Card
            key="goods"
            icon="layers"
            title="商品出口结构"
            kicker="Goods Mix"
            aside={<UnitTag>亿元 · 演示分类</UnitTag>}
            $muted={!!link}
          >
            <Treemap items={GOODS} />
          </Card>,

          <Card
            key="dialect"
            icon="gauge"
            title="贸易依存度"
            kicker="Trade Dependence"
            aside={<UnitTag>(出口+进口)/GDP</UnitTag>}
            $active={!!link}
          >
            <DialectPanel metric="exportValue" compare="importValue" />
          </Card>,
        ]}
        right={[
          <Card
            key="dual"
            icon="swap"
            title="进出口双轴对照"
            kicker="Export vs Dependence"
            aside={<UnitTag>24 个月</UnitTag>}
            $active={!!link}
          >
            <DualAxis
              barValues={dualAxis.barValues}
              lineValues={dualAxis.lineValues}
              barName="出口额"
              lineName="贸易依存度"
              barUnit="亿元"
              lineUnit="%"
            />
          </Card>,

          <Card
            key="wf"
            icon="flow"
            title="贸易顺差瀑布"
            kicker="Surplus Bridge"
            aside={<UnitTag>全省出口 − 主要进口</UnitTag>}
            $muted={!!link}
          >
            <Waterfall metric="exportValue" compare="importValue" />
          </Card>,

          <Card
            key="partner"
            icon="target"
            title="贸易伙伴构成"
            kicker="Partners"
            aside={<UnitTag>出口额占比</UnitTag>}
            $active={!!link}
          >
            <StackShare segments={partnerMix.segments} total={partnerMix.total} />
          </Card>,

          <Card
            key="delta"
            icon="trend"
            title="出口同比增减"
            kicker="YoY Delta"
            aside={<UnitTag>本期 − 同期</UnitTag>}
            $active={!!link}
          >
            <DeltaBars items={surplusDelta.map(({ name, pct }) => ({ name, pct }))} max={8} />
          </Card>,
        ]}
        overlays={
          <>
            <LayerDock only={["flyline", "labels", "rotation"]}>
              <MapLegend min={0} max={2600} unit="亿元" caption="出口规模" />
            </LayerDock>
            <ReplayButton />
            <DetailDrawer metric="exportValue" />
          </>
        }
      />

      {pinned && (
        <Note>
          已锁定 <b style={{ color: TRADE.gold }}>{pinned}</b>：
          出口 {fmt.dec(cityMetrics[pinned]?.exportValue ?? 0)} 亿元 ·
          进口 {fmt.dec(cityMetrics[pinned]?.importValue ?? 0)} 亿元 ·
          顺差 {fmt.dec(
            (cityMetrics[pinned]?.exportValue ?? 0) - (cityMetrics[pinned]?.importValue ?? 0),
          )}{" "}
          亿元。按 Esc 返回全省。
        </Note>
      )}
    </>
  );
}
