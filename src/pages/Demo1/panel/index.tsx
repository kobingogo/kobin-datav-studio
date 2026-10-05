/**
 * Demo1 面板 —— 智慧城市数据大脑。
 *
 * 与 Demo0 / Demo2 的差异化
 * ──────────────────────
 * Demo2（电力）讲「够不够、升没升」，Demo0（贸易）讲「差额从哪来」。
 * 城市治理屏讲的是**关系与偏科**：
 *   哪个市只和同类连线、够不着头部    → 关联网络
 *   哪个市在哪一维偏科              → 六维画像雷达
 *   谁在高密低产象限（治理重点）    → 聚类散点
 *   能耗强度离目标差多少            → 目标区间条
 *
 * 布局也刻意不同：Demo2 是左3+右3，Demo0 是左2+右4，这里是**左4+右2**。
 * 左栏四张都是「需要纵向空间去铺开关系/象限」的图形，右栏两张留白给
 * 事件流与双序列时序 —— 一屏之内的重心与前两块屏完全相反。
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
import Tag from "@/console/components/Tag";
import { TrendLines } from "@/console/components/charts";
import { AdviceList, type AdviceItem } from "@/console/components/rows";
import {
  BulletList,
  CITY,
  ClusterScatter,
  NetworkGraph,
  RadarCompare,
} from "@/console/components/city";
import { useConsole } from "@/console/store";
import { useConsoleReset } from "@/console/useMapInteraction";
import { provinceName, provinceShort } from "@/geo";
import { cityMetrics, cityNames, fmt, province } from "@/console/data";
import { seriesOf } from "@/console/series";
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

export default function Panel() {
  useConsoleReset();
  useConsoleHotkeys();

  const link = useConsole((s) => s.hover ?? s.pinned);
  const pinned = useConsole((s) => s.pinned);

  /** 治理事件：由指标推导，不写死文案 */
  const events = useMemo(() => {
    const out: AdviceItem[] = [];

    /* 高密度低产：治理重点 */
    const dens = cityNames.map((n) => {
      const m = cityMetrics[n];
      return { n, d: m.population / (m.area || 1), p: m.gdp / (m.population || 1) };
    });
    const mdp = dens.reduce((a, b) => a + b.d, 0) / dens.length;
    const mpp = dens.reduce((a, b) => a + b.p, 0) / dens.length;
    const gap = dens.filter((x) => x.d >= mdp && x.p < mpp).sort((a, b) => b.d - a.d)[0];
    if (gap) {
      out.push({
        icon: "target",
        title: `${shortName(gap.n)}高密低产`,
        desc: `密度高于均值 ${(((gap.d / mdp) - 1) * 100).toFixed(0)}% 但人均产出低 ${(((mdp / gap.p) - 1) * 100).toFixed(0)}%`,
        level: "重点",
        tone: "crit",
      });
    }

    /* 能耗强度最差的市 */
    const inten = cityNames.map((n) => ({
      n,
      v: cityMetrics[n].energy / (cityMetrics[n].gdp || 1),
    }));
    const best = Math.min(...inten.map((x) => x.v));
    const worstE = inten.sort((a, b) => b.v - a.v)[0];
    if (worstE) {
      const gap2 = ((worstE.v / best) - 1) * 100;
      out.push({
        icon: "bolt",
        title: `${shortName(worstE.n)}能耗强度偏高`,
        desc: `为全省最优市的 ${(1 + gap2 / 100).toFixed(2)} 倍 · 超出 ${gap2.toFixed(0)}%`,
        level: gap2 > 60 ? "高" : "关注",
        tone: gap2 > 60 ? "warn" : "info",
      });
    }

    /* 企业数同比回落 */
    const entDown = cityNames
      .map((n) => ({ n, y: seriesOf(n, "enterprises").yoy }))
      .sort((a, b) => a.y - b.y)[0];
    if (entDown) {
      out.push({
        icon: "building",
        title: `${shortName(entDown.n)}规上企业回落`,
        desc: `两年累计同比 ${entDown.y > 0 ? "+" : ""}${entDown.y.toFixed(1)}% · 建议核查退规原因`,
        level: entDown.y < 0 ? "关注" : "常态",
        tone: entDown.y < 0 ? "warn" : "info",
      });
    }

    /* 人口净流入 */
    const inflow = cityNames
      .map((n) => ({ n, y: seriesOf(n, "population").yoy }))
      .sort((a, b) => b.y - a.y)[0];
    if (inflow) {
      out.push({
        icon: "users",
        title: `${shortName(inflow.n)}人口增速居首`,
        desc: `两年同比 +${inflow.y.toFixed(1)}% · 建议核查公共服务承载`,
        level: "常态",
        tone: "info",
      });
    }

    return out;
  }, []);

  /** 双序列时序的量纲说明。标题栏空间有限，只留最要紧的一句。 */
  const dualNote = useMemo(
    () => `指数化 · 起点=100 · GDP ${fmt.moneyShort(province.gdp)}`,
    [],
  );

  return (
    <>
      <ConsoleFrame
        header={
          <TopBar
            title={`${provinceName}智慧城市数据大脑`}
            subtitle={`${provinceShort} City Brain`}
          />
        }
        kpis={<KpiRail domain="city" accent={CITY.violet} />}
        left={[
          /* 图形类面板需要高度 → 权重 2；行列表 → 权重 1.3~1.4。
             这套权重是 ConsoleFrame 新增的能力：栏内槽位原本是裸 div，
             按内容高度排，图形撑不满、列表会溢出。 */
          { weight: 2, node: <Card
            key="net"
            icon="flow"
            title="城市关联网络"
            kicker="City Network"
            aside={<UnitTag>节点=地市 · 边=规模相近度</UnitTag>}
            $muted={!!link}
          >
            <NetworkGraph metric="score" />
          </Card> },

          { weight: 1.3, node: <Card
            key="bullet"
            icon="gauge"
            title="能耗强度达成"
            kicker="Energy Intensity"
            aside={<Tag tone="ok">
              {events.filter((e) => e.level === "重点").length || 0} 项重点
            </Tag>}
            $active={!!link}
          >
            <BulletList metric="energy" lowerIsBetter />
          </Card> },

          { weight: 2, node: <Card
            key="scatter"
            icon="grid"
            title="密度 × 人均产出"
            kicker="Density vs Output"
            aside={<UnitTag>四象限</UnitTag>}
            $muted={!!link}
          >
            <ClusterScatter />
          </Card> },

          { weight: 1.4, node: <Card
            key="event"
            icon="warn"
            title="治理感知事件"
            kicker="Civic Feed"
            aside={<Tag tone="warn">{events.length} 项</Tag>}
            $muted={!!link}
          >
            <AdviceList items={events} />
          </Card> },
        ]}
        right={[
          { weight: 1.3, node: <Card
            key="trend"
            icon="trend"
            title="GDP 与人口走势"
            kicker="GDP vs Population"
            aside={<UnitTag>{dualNote}</UnitTag>}
            $active={!!link}
          >
            <TrendLines
              metric="gdp"
              compareMetric="population"
              color={CITY.violet}
              unit="指数化"
              indexed
            />
          </Card> },

          { weight: 1.6, node: <Card
            key="radar"
            icon="target"
            title="城市画像对比"
            kicker="Profile Radar"
            aside={<UnitTag>选中市 vs 全省均值</UnitTag>}
            $active={!!link}
          >
            <RadarCompare />
          </Card> },
        ]}
        overlays={
          <>
            <LayerDock only={["labels", "cloud", "bar"]}>
              <MapLegend min={0} max={1400} unit="人/km²" caption="人口密度" />
            </LayerDock>
            <ReplayButton />
            <DetailDrawer metric="gdp" />
          </>
        }
      />

      {pinned && (
        <Note>
          已锁定 <b style={{ color: CITY.violet }}>{pinned}</b>：
          GDP {fmt.moneyShort(cityMetrics[pinned]?.gdp ?? 0)} 元 ·
          常住人口 {fmt.int(cityMetrics[pinned]?.population ?? 0)} 万人 ·
          运行健康度 {cityMetrics[pinned]?.score ?? 0}/100。
          按 Esc 返回全省。
        </Note>
      )}
    </>
  );
}
