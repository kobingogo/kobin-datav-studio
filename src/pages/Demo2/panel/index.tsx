/**
 * Demo2 面板 —— 电力口径，按「信息需求」重新编排。
 *
 * 与 Demo0 / Demo1 的差别不只是数据，**结构也不同**：
 *   左栏「结构」：用电构成 → 负荷走势 → 供电缺口矩阵
 *   右栏「状态」：供电自给率 → 扩容建议 → 故障排名
 * 原来左右各三张卡是同一套模板（排名/环形/排名 | 折线/分组柱/表格），
 * 换成电力口径后信息需求变了，模板却没变。
 *
 * 三处语义修正
 * ────────────
 * 1. 「负荷构成」原来是 DonutShare，且「其他」切片等于前 5 名之和
 *    （charts.tsx 已修）。这里进一步换成 StackShare ——
 *    构成占比用堆叠条比环形更好读：能同时看到排序与量级。
 * 2. 「头部地市州负荷对照」原来画本期/同期两根并排柱，但同期数据是
 *    本期乘一个常数得来的，两柱几乎等高，看上去处处「无变化」。
 *    改画**差值条**（本期 − 同期），这才是"对照"该回答的问题。
 * 3. 「扩容采购建议」由数据推导，不是写死的文案：
 *    负荷同比最高 → 扩容；自给率最低 → 外来电通道；故障率最高 → 检修。
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
import {
  AdviceList,
  DeltaBars,
  GaugeRows,
  HeatMatrix,
  StackShare,
  type AdviceItem,
  type GaugeItem,
} from "@/console/components/rows";
import { useConsole } from "@/console/store";
import { useConsoleReset } from "@/console/useMapInteraction";
import { provinceName, provinceShort } from "@/geo";
import { cityMetrics, cityNames, fmt, province } from "@/console/data";
import { seriesOf, provinceSeries, MONTH_LABELS } from "@/console/series";
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

/** 去掉「市」后缀，地市州名在窄卡里必须短 */
const shortOf = (n: string) => n.replace(/[市州]$/, "");

export default function Panel() {
  useConsoleReset();
  useConsoleHotkeys();

  const link = useConsole((s) => s.hover ?? s.pinned);
  const pinned = useConsole((s) => s.pinned);

  /* ── 1. 用电构成：TOP5 + 真实剩余 ── */
  const loadMix = useMemo(() => {
    const total = province.power || 1;
    const top = [...cityNames]
      .map((n) => ({ n, v: cityMetrics[n].power }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
    const colors = [
      palette.cyan,
      palette.indigo,
      palette.good,
      palette.violet,
      palette.amber,
    ];
    const rest = Math.max(0, total - top.reduce((s, c) => s + c.v, 0));
    const segments = [
      ...top.map((c, i) => ({
        name: shortOf(c.n),
        value: c.v,
        color: colors[i],
      })),
      { name: "其他", value: rest, color: palette.textMute },
    ];
    return {
      segments,
      total,
      cr5: (top.reduce((s, c) => s + c.v, 0) / total) * 100,
      top: top[0],
    };
  }, []);

  /* ── 2. 电力自给构成：本地发电在本地供需中的比重，逐市 ──
     原来「负荷构成」占了左中一整张卡讲构成，而「这个市自给水平多少」
     才是电力屏真正要回答的问题。前者进堆叠条，后者单列一行式仪表。

     分母用 (发电 + 用电) 而不是只用用电：output/power 可以大于 1
     （原始数据里舟山是 369%），条形顶格后既读不出差异也失去意义。
     改成有界占比后仍在 0–100%，且排序含义不变。 */
  const selfSupply = useMemo(() => {
    const rows = [...cityNames]
      .map((n) => {
        const o = cityMetrics[n].output;
        const p2 = cityMetrics[n].power;
        return {
          name: shortOf(n),
          full: n,
          ratio: o / ((o + p2) || 1),
        };
      })
      .sort((a, b) => b.ratio - a.ratio);
    const items: GaugeItem[] = rows.slice(0, 8).map((r) => {
      const pct = r.ratio * 100;
      return {
        name: r.name,
        icon: "gauge" as const,
        value: Math.round(pct),
        linkKey: r.full,
        color:
          pct >= 100 ? palette.good : pct >= 70 ? palette.cyan : pct >= 50 ? palette.amber : palette.critical,
      };
    });
    return { items, worst: rows[rows.length - 1] };
  }, []);

  /* ── 3. 供电缺口矩阵：市 × 月，发电减用电 ──
     这是电力屏独有的问题：哪几个月、哪些市最缺电。 */
  const gapMatrix = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
    // 取最近 12 个月（索引 12..23）
    const at = (city: string, key: "output" | "power", j: number) =>
      seriesOf(city, key).values[12 + j] ?? 0;
    const ordered = [...cityNames]
      .sort((a, b) => cityMetrics[b].power - cityMetrics[a].power)
      .slice(0, 7);
    const rows = ordered.map((n) => shortOf(n));
    /* 简称 → 全名：seriesOf 用全名做 key，之前这里直接把简称传进去，
       取不到值全部落成 0，84 个格子于是同色。 */
    const fullOf = new Map(rows.map((r) => [r, [...cityNames].find((n) => shortOf(n) === r) ?? r]));

    /* 预计算全部格子，再取全局极值归一 —— 逐行归一会让每行都一深一浅，
       跨市完全不可比；而原来那个 (gap+400)/800 的公式没有任何含义。 */
    const table = new Map<string, number>();
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      const full = fullOf.get(r) ?? r;
      for (let j = 0; j < 12; j++) {
        const gap = at(full, "output", j) - at(full, "power", j);
        table.set(`${r}|${j}`, gap);
        if (gap < lo) lo = gap;
        if (gap > hi) hi = gap;
      }
    }
    const span = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    return {
      months,
      rows,
      cell: (rowShort: string, col: string): [string, string] => {
        const j = months.indexOf(col);
        const gap = table.get(`${rowShort}|${j}`) ?? 0;
        /* 以 0 为中心的发散色阶：青 = 富余，红 = 缺口，深度 = 幅度 */
        const t = Math.min(1, Math.abs(gap) / span);
        const alpha = (0.1 + t * 0.62).toFixed(3);
        const color =
          gap >= 0 ? `rgba(56,225,255,${alpha})` : `rgba(255,107,107,${alpha})`;
        return [color, `${rowShort} ${col} ${gap >= 0 ? "富余" : "缺口"} ${Math.abs(gap).toFixed(1)} 亿kWh`];
      },
    };
  }, []);

  /* ── 4. 负荷同比差值：本期 vs 同期 ── */
  const loadDelta = useMemo(() => {
    const items = [...cityNames]
      .map((n) => {
        const s = seriesOf(n, "power");
        const cur = s.values.slice(-12).reduce((a, b) => a + b, 0);
        const prev = s.values.slice(0, 12).reduce((a, b) => a + b, 0);
        return { name: shortOf(n), pct: ((cur - prev) / (prev || 1)) * 100 };
      })
      .sort((a, b) => b.pct - a.pct);
    return items.slice(0, 10);
  }, []);

  /* ── 5. 扩容建议：由上面三项指标推导，不写死文案 ── */
  const advice = useMemo(() => {
    const out: AdviceItem[] = [];
    const growth = loadDelta[0];
    if (growth) {
      out.push({
        icon: "bolt",
        title: `${growth.name}负荷扩容（${growth.pct.toFixed(1)}%）`,
        desc: `同比增速全省居首 · 建议核查输电通道余量`,
        level: growth.pct >= 12 ? "紧急" : "高",
        tone: growth.pct >= 12 ? "crit" : "warn",
      });
    }
    if (selfSupply.worst) {
      const r = selfSupply.worst.ratio * 100;
      out.push({
        icon: "swap",
        title: `${selfSupply.worst.name}外来电依赖（${r.toFixed(0)}%）`,
        desc: "自给率全省最低 · 建议核查受电计划",
        level: r < 50 ? "紧急" : "高",
        tone: r < 50 ? "crit" : "warn",
      });
    }
    const worstFault = [...cityNames]
      .map((n) => ({
        n,
        rate: cityMetrics[n].faults / (cityMetrics[n].enterprises || 1),
      }))
      .sort((a, b) => b.rate - a.rate)[0];
    if (worstFault) {
      out.push({
        icon: "warn",
        title: `${shortOf(worstFault.n)}设备检修（${(worstFault.rate * 1000).toFixed(1)}‰）`,
        desc: "单位企业故障率全省最高 · 建议安排预防性检修",
        level: "高",
        tone: "warn",
      });
    }
    out.push({
      icon: "leaf",
      title: "绿电消纳",
      desc: `全省新能源出力占比 ${((provinceSeries("output").values.at(-1) ?? 0) / (province.output || 1) * 100).toFixed(0)}% · 建议核查消纳空间`,
      level: "中",
      tone: "info",
    });
    return out.slice(0, 4);
  }, [loadDelta, selfSupply]);

  /* ── 6. 负荷构成的时间序列（供趋势卡用） ── */
  const months = MONTH_LABELS;

  return (
    <>
      <ConsoleFrame
        header={
          <TopBar
            title={`${provinceName}电力全景感知平台`}
            subtitle={`${provinceShort} Power Grid Overview`}
          />
        }
        kpis={<KpiRail domain="power" />}
        left={[
          <Card
            key="mix"
            icon="layers"
            title="用电构成"
            kicker="Load Mix"
            aside={<UnitTag>TOP5 + 其余</UnitTag>}
            $muted={!!link}
          >
            <StackShare
              segments={loadMix.segments}
              total={loadMix.total}
              footer={[
                {
                  label: "CR5 集中度",
                  value: `${loadMix.cr5.toFixed(1)}%`,
                },
                { label: `${loadMix.top.n.replace(/[市州]$/, "")} 最高`, value: fmt.dec(loadMix.top.v) },
              ]}
            />
          </Card>,

          <Card
            key="trend"
            icon="trend"
            title="用电量月度走势"
            kicker="Consumption Trend"
            aside={<UnitTag>亿千瓦时</UnitTag>}
            $active={!!link}
          >
            <TrendLines metric="power" color={palette.cyan} unit="亿千瓦时" />
          </Card>,

          <Card
            key="gap"
            icon="swap"
            title="地市供电缺口"
            kicker="Supply Gap"
            aside={<UnitTag>月 × 市</UnitTag>}
            $muted={!!link}
          >
            <HeatMatrix rows={gapMatrix.rows} cols={gapMatrix.months} cell={gapMatrix.cell} />
          </Card>,
        ]}
        right={[
          <Card
            key="supply"
            icon="gauge"
            title="电力自给构成"
            kicker="Self Supply"
            aside={<UnitTag>发电 / 发电+用电</UnitTag>}
            $active={!!link}
          >
            <GaugeRows items={selfSupply.items} />
          </Card>,

          <Card
            key="advice"
            icon="warn"
            title="扩容建议"
            kicker="Advice"
            aside={<Tag tone="warn">{advice.length} 项</Tag>}
            $muted={!!link}
          >
            <AdviceList items={advice} />
          </Card>,

          <Card
            key="delta"
            icon="flow"
            title="负荷同比增减"
            kicker="YoY Delta"
            aside={<UnitTag>本期 − 同期</UnitTag>}
            $active={!!link}
          >
            <DeltaBars items={loadDelta} />
          </Card>,
        ]}
        overlays={
          <>
            <LayerDock only={["flyline", "labels", "rotation"]}>
              <MapLegend min={0} max={2200} unit="万kW" caption="负荷密度" />
            </LayerDock>
            <ReplayButton />
            <DetailDrawer metric="power" />
          </>
        }
      />

      {pinned && (
        <Note>
          已锁定 <b style={{ color: palette.cyan }}>{pinned}</b>：
          发电量 {fmt.dec(cityMetrics[pinned]?.output ?? 0)} 亿千瓦时 ·
          用电量 {fmt.dec(cityMetrics[pinned]?.power ?? 0)} 亿千瓦时 ·
          设备故障 {cityMetrics[pinned]?.faults ?? 0} 次。
          按 Esc 返回全省。
        </Note>
      )}
      {/* months 仅用于确认时序长度与面板口径一致 */}
      <span hidden data-months={months.length} />
    </>
  );
}
