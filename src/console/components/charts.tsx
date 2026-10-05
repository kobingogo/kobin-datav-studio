/**
 * 联动图表 —— 全部图表的通用工厂
 * ------------------------------------------------------------------
 * 每个 demo 原本各有 6 个 chart 文件，各自手写颜色、坐标轴、tooltip，
 * 导致：配色不统一、字号混乱、且没有任何一个跟地图联动。
 *
 * 这里提供 4 个基元，全部自带 `linkKey` 联动语义：
 *   RankBars   横向排名条 —— 地图 hover 某市 → 该市那条高亮、其余降到 22%
 *   TrendLines 双序列折线 —— 悬停某市 → 曲线切换为该市数据
 *   DonutShare 占比环 —— 扇区按联动项高亮
 *   ColumnSet  分组柱 —— 同 RankBars 的高亮逻辑，垂直方向
 * 统一调用 `useLinkState()` 读取 store，图表只声明数据不关心联动。
 */
import { useMemo, type ReactNode } from "react";
import styled from "styled-components";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import Chart from "@/components/chart";
import { useConsole } from "../store";
import { ALL_CITIES, cityMetrics, cityNames, province } from "../data";
import {
  provinceSeries,
  seriesOf,
  type MetricKey,
} from "../series";
import {
  baseCategoryAxis,
  baseGrid,
  baseTooltip,
  baseValueAxis,
  axisMoney,
  gradientFill,
  legendItems,
  linkKeyOf,
  withAlpha,
  type LinkState,
} from "@/theme/echarts";
import { fontSize, palette, type } from "@/theme/tokens";

/** 读取当前联动上下文 */
export function useLinkState() {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  return useMemo(() => ({ hover, pinned }), [hover, pinned]);
}

/**
 * 图表侧的联动桥（图表 → 地图 / 卡片）。
 * 让"悬停柱条"和"悬停地图区域"走同一条通道，
 * 两个方向的联动才对称，否则只能单向高亮。
 */
export function useChartLink() {
  const setHover = useConsole((s) => s.setHover);
  const togglePin = useConsole((s) => s.togglePin);
  return useMemo(
    () => ({
      onHover: (name: string | null) => setHover(name),
      onSelect: (name: string | null) => {
        if (name) togglePin(name);
      },
    }),
    [setHover, togglePin]
  );
}

/** 某项在当前联动下的权重 */
function weightOf(itemKey: string | undefined, state: LinkState) {
  const key = linkKeyOf(state);
  if (!key || !itemKey) return 1;
  return itemKey === key ? 1 : 0.22;
}

const Empty = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
`;

/* ── 1. 横向排名条 ───────────────────────────────────────────── */

export function RankBars({
  metric,
  limit = 8,
  color = palette.cyan,
  unit = "",
  valueFormat,
}: {
  metric: keyof (typeof cityMetrics)[string];
  limit?: number;
  color?: string;
  unit?: string;
  valueFormat?: (v: number) => string;
}) {
  const link = useLinkState();
  const chartLink = useChartLink();

  const rows = useMemo(() => {
    const arr = cityNames
      .map((n) => ({ name: n, value: cityMetrics[n][metric] as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
    const max = arr[0]?.value || 1;
    return arr.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  }, [metric, limit]);

  return (
    <Chart
      use={[BarChart, GridComponent, TooltipComponent, LabelLayout]}
      events={chartLink}
      option={{
        grid: { ...baseGrid, left: 4, right: 68, top: 6, bottom: 6 },
        tooltip: {
          ...baseTooltip,
          formatter: (p: any) =>
            `${p.name}<br/><b>${valueFormat
              ? valueFormat(p.value)
              : p.value.toLocaleString("zh-CN")}</b> ${unit}`,
        },
        xAxis: { type: "value", show: false, max: 100 },
        yAxis: {
          ...baseCategoryAxis,
          type: "category",
          inverse: true,
          data: rows.map((r) => r.name),
          axisLabel: {
            ...baseCategoryAxis.axisLabel,
            color: (v: string) =>
              weightOf(v, link) === 1 ? palette.textDim : palette.textFaint,
            // 自治州这类长名必须截断，否则会折行压住条形；
            // margin 让标签与条形之间留出呼吸位
            margin: 10,
            width: 86,
            overflow: "truncate",
          },
        },
        series: [
          {
            type: "bar",
            data: rows.map((r) => ({
              value: r.pct,
              name: r.name,
              itemStyle: {
                color: gradientFill(
                  weightOf(r.name, link) === 1 ? color : palette.lineStrong,
                  "horizontal",
                  1,
                  0.35
                ),
                borderRadius: [0, 2, 2, 0],
              },
            })),
            barWidth: 6,
            showBackground: true,
            backgroundStyle: { color: palette.lineSoft, borderRadius: 2 },
            label: {
              show: true,
              position: "right",
              distance: 8,
              overlap: false,
              color: palette.textDim,
              fontFamily: type.mono,
              fontSize: fontSize.micro,
              formatter: (p: any) => {
                const row = rows.find((r) => r.name === p.name)!;
                return valueFormat
                  ? valueFormat(row.value)
                  : axisMoney(row.value);
              },
            },
            animationDuration: 500,
          },
        ],
      }}
    />
  );
}

/* ── 2. 走势双序列折线 ──────────────────────────────────────── */

export function TrendLines({
  metric,
  compareMetric,
  months = 12,
  indexed = false,
  color = palette.cyan,
  colorB,
  unit = "",
  nameA = "本期",
  nameB = "同期",
}: {
  metric: keyof (typeof cityMetrics)[string];
  /** 对照序列指标。给定时画两个不同口径，否则画同一指标的本期/同期 */
  compareMetric?: keyof (typeof cityMetrics)[string];
  months?: number;
  /**
   * 指数化：两条序列各自以首月为 100。
   * 不加这个选项时，量级差一个数量级的两条线（例如 GDP 与人口）
   * 会把后者压成贴底直线 —— 比形状就比不出来。
   */
  indexed?: boolean;
  /** 标注末值与峰值 */
  markers?: boolean;
  color?: string;
  colorB?: string;
  unit?: string;
  nameA?: string;
  nameB?: string;
}) {
  const link = useLinkState();
  const chartLink = useChartLink();
  const key = linkKeyOf(link);

  /**
   * 数据来源：console/series.ts，而不是现合成。
   * 原来这里用「标量 × 线性爬升 × 固定正弦」现造月度序列，
   * 于是出口 / 税收 / 负荷三条曲线归一化后几乎重合（实测形状差
   * 0.005~0.008），三块屏的折线看起来一模一样。
   * series.ts 给每个指标独立的年内形态（用电夏冬双峰、出口年末翘尾、
   * 故障泊松尖峰），并把同比/环比从序列派生，保证走势与标注一致。
   */
  const series = useMemo(() => {
    const whole = key === ALL_CITIES;
    const read = (k: MetricKey) =>
      whole || !key ? provinceSeries(k).values : seriesOf(key, k).values;

    const a = read(metric as MetricKey);
    if (!a.length) return { a: [], b: [] };

    /* 同期 = 前 12 个月（series.ts 固定 24 个月，首尾两年可直接对比） */
    const prevYear = a.length >= 24 ? a.slice(0, 12) : null;
    const b = compareMetric
      ? read(compareMetric as MetricKey)
      : (prevYear ?? a.map((v, i) => Number((v * (0.82 + (i / months) * 0.16)).toFixed(1))));

    if (!indexed) return { a, b };
    /* 各自以首值为 100 —— 只比形状 */
    const rebase = (arr: number[]) => {
      const base0 = arr[0] || 1;
      return arr.map((v) => Number(((v / base0) * 100).toFixed(1)));
    };
    return { a: rebase(a), b: rebase(b) };
  }, [key, metric, compareMetric, months, indexed]);

  return (
    <Chart
      use={[LineChart, GridComponent, LegendComponent, TooltipComponent]}
      events={chartLink}
      option={{
        grid: { ...baseGrid, top: 20, bottom: 20, left: 0, right: 8 },
        legend: {
          show: true,
          right: 0,
          top: 0,
          itemWidth: 10,
          itemHeight: 2,
          textStyle: { color: palette.textMute, fontSize: fontSize.micro },
          data: legendItems([
            { name: nameA, color },
            { name: nameB, color: colorB ?? palette.textFaint },
          ]),
        },
        tooltip: {
          ...baseTooltip,
          valueFormatter: (v: any) => `${axisMoney(Number(v))} ${unit}`,
        },
        xAxis: {
          ...baseCategoryAxis,
          type: "category",
          boundaryGap: false,
          data: Array.from({ length: months }, (_, i) => `${i + 1}月`),
          axisLabel: { ...baseCategoryAxis.axisLabel, interval: 1 },
        },
        yAxis: { ...baseValueAxis, type: "value" },
        series: [
          {
            name: nameA,
            type: "line",
            smooth: 0.4,
            symbol: "circle",
            symbolSize: 4,
            showSymbol: false,
            lineStyle: { width: 2, color },
            itemStyle: { color },
            areaStyle: { color: gradientFill(color, "vertical", 0.24, 0) },
            data: series.a,
          },
          {
            name: nameB,
            type: "line",
            smooth: 0.4,
            symbol: "none",
            lineStyle: {
              width: compareMetric ? 2 : 1,
              color: colorB ?? palette.textFaint,
              type: compareMetric ? "solid" : "dashed",
            },
            itemStyle: { color: colorB ?? palette.textFaint },
            data: series.b,
          },
        ],
      }}
    />
  );
}

/* ── 3. 占比环 ──────────────────────────────────────────────── */

export function DonutShare({
  metric = "energy",
  centerLabel,
  centerValue,
  valueFormat,
}: {
  /** 参与占比计算的指标 —— 原实现写死为 energy，导致电力大屏显示的是能耗占比 */
  metric?: keyof (typeof cityMetrics)[string];
  centerLabel: string;
  centerValue: string;
  valueFormat?: (v: number) => string;
}) {
  const link = useLinkState();
  const chartLink = useChartLink();

  const segments = useMemo(() => {
    const total = (province[metric] as number) || 1;
    const top = cityNames
      .map((n) => ({ name: n, value: cityMetrics[n][metric] as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    /* 「其他」必须是**剩余部分**，不是前 5 名之和。
       原来写成 top.reduce(...) ，于是 6 片之和 = 全省 + 前5名，
       百分比必然超 100%（实测三屏分别到 172.6% / 169.7% / 169.4%），
       而「其他」又占满整环，环形图彻底失效。 */
    const topSum = top.reduce((s, c) => s + c.value, 0);
    const rest = Math.max(0, total - topSum);
    return [
      ...top.map((c) => ({ ...c, pct: (c.value / total) * 100 })),
      { name: `其他 ${cityNames.length - top.length} 市`, value: rest, pct: (rest / total) * 100 },
    ];
  }, [metric]);

  return (
    <Chart
      use={[PieChart, LegendComponent, TitleComponent, TooltipComponent]}
      events={chartLink}
      option={{
        // 中心读数用 ECharts 的 title 承载：它自带居中布局，
        // 不需要像 graphic 那样手算偏移量
        title: [
          {
            text: centerValue,
            left: "center",
            top: "52%",
            textStyle: {
              color: palette.text,
              font: `600 22px ${type.mono}`,
              fontWeight: 600,
            },
          },
          {
            text: centerLabel,
            left: "center",
            top: "63%",
            textStyle: {
              color: palette.textMute,
              font: `400 10px ${type.sans}`,
            },
          },
        ],
        tooltip: {
          ...baseTooltip,
          formatter: (p: any) => {
            const s = segments.find((x) => x.name === p.name);
            const v = s ? (valueFormat ? valueFormat(s.value) : s.value.toFixed(1)) : "";
            return `${p.marker}${p.name}<br/><b>${v}</b> · ${p.value.toFixed(1)}%`;
          },
        },
        legend: {
          show: true,
          // 竖排 legend 在窄卡片里会换行并压住圆环，
          // 改为顶部横排三列，圆环居中于下方空间
          orient: "horizontal",
          left: "center",
          right: "auto",
          top: 0,
          itemWidth: 7,
          itemHeight: 7,
          itemGap: 8,
          padding: [0, 4],
          textStyle: {
            color: (name: string) =>
              weightOf(name, link) === 1 ? palette.textDim : palette.textFaint,
            fontSize: fontSize.micro,
          },
          formatter: (name: string) => {
            const s = segments.find((x) => x.name === name);
            return `${name}  ${s ? s.pct.toFixed(1) : 0}%`;
          },
          selectedMode: false,
        },
        series: [
          {
            type: "pie",
            radius: ["58%", "84%"],
            center: ["50%", "62%"],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: palette.canvas, borderWidth: 2 },
            label: { show: false },
            labelLine: { show: false },
            emphasis: { scaleSize: 4 },
            data: segments.map((s, i) => {
              const w = weightOf(s.name, link);
              // 前 N 段用序列色，"其他"聚合项用中性灰，避免读成一个告警
              const base =
                i < segments.length - 1
                  ? palette.series[i % palette.series.length]
                  : palette.textMute;
              return {
                ...s,
                itemStyle: {
                  color: w === 1 ? base : withAlpha(base, 0.22),
                  borderColor: palette.canvas,
                  borderWidth: 2,
                },
              };
            }),
          },
        ],
      }}
    />
  );
}

/* ── 4. 分组柱 ──────────────────────────────────────────────── */

export function ColumnSet({
  groups,
  series,
  unit = "",
}: {
  groups: string[];
  series: { name: string; data: number[]; color?: string }[];
  unit?: string;
}) {
  const link = useLinkState();
  const chartLink = useChartLink();

  return (
    <Chart
      use={[BarChart, GridComponent, LegendComponent, TooltipComponent]}
      events={chartLink}
      option={{
        grid: { ...baseGrid, top: 20, left: 0, right: 0 },
        legend: {
          show: series.length > 1,
          right: 0,
          top: 0,
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: palette.textMute, fontSize: fontSize.micro },
          data: legendItems(
            series.map((s, i) => ({
              name: s.name,
              color: s.color ?? palette.series[i % palette.series.length],
            }))
          ),
        },
        tooltip: {
          ...baseTooltip,
          valueFormatter: (v: any) => `${axisMoney(Number(v))} ${unit}`,
        },
        xAxis: {
          ...baseCategoryAxis,
          type: "category",
          data: groups,
          axisLabel: {
            ...baseCategoryAxis.axisLabel,
            color: (v: string) =>
              weightOf(v, link) === 1 ? palette.textDim : palette.textFaint,
            // 自治州这类长名必须截断，否则会折行压住条形；
            // margin 让标签与条形之间留出呼吸位
            margin: 10,
            width: 86,
            overflow: "truncate",
          },
        },
        yAxis: { ...baseValueAxis, type: "value" },
        series: series.map((s, i) => {
          const c = s.color ?? palette.series[i % palette.series.length];
          return {
            name: s.name,
            type: "bar",
            barWidth: 10,
            data: s.data.map((v, gi) => {
              const w = weightOf(groups[gi], link);
              return {
                value: v,
                itemStyle: {
                  color: gradientFill(w === 1 ? c : palette.lineStrong),
                  borderRadius: [2, 2, 0, 0],
                },
              };
            }),
          };
        }),
      }}
    />
  );
}

/* ── 5. 明细表 ──────────────────────────────────────────────── */

const Table = styled.div`
  height: 100%;
  overflow: hidden auto;
  font-size: var(--fs-micro);
`;

const TRow = styled.div<{ $on?: boolean; $muted?: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--sp-md);
  padding: 5px 2px;
  border-bottom: 1px solid ${palette.lineSoft};
  color: ${({ $on, $muted }) =>
    $on ? palette.cyanSoft : $muted ? palette.textFaint : palette.textDim};
  transition: color var(--e-fast);
  cursor: default;
`;

const Cell = styled.span<{ $num?: boolean; $muted?: boolean }>`
  font-family: ${({ $num }) => ($num ? "var(--font-mono)" : "inherit")};
  font-variant-numeric: ${({ $num }) => ($num ? "tabular-nums" : "normal")};
  color: ${({ $muted }) => ($muted ? palette.textFaint : "inherit")};
`;

const THead = styled(TRow)`
  position: sticky;
  top: 0;
  background: rgba(11, 17, 32, 0.95);
  color: var(--c-text-mute);
  border-bottom-color: ${palette.line};
  z-index: 1;
`;

export function DetailTable({
  valueOf,
  unit,
}: {
  valueOf: (m: (typeof cityMetrics)[string]) => number;
  unit: string;
}) {
  const link = useLinkState();
  const key = linkKeyOf(link);
  const setHover = useConsole((s) => s.setHover);
  const togglePin = useConsole((s) => s.togglePin);

  const rows = useMemo(
    () =>
      cityNames
        .map((n) => cityMetrics[n])
        .sort((a, b) => valueOf(b) - valueOf(a)),
    [valueOf]
  );

  return (
    <Table>
      <THead>
        <Cell>地区</Cell>
        <Cell $num $muted>
          数值{unit ? ` / ${unit}` : ""}
        </Cell>
        <Cell $num $muted>
          占比
        </Cell>
      </THead>
      {rows.map((m) => {
        const total = rows.reduce((s, r) => s + valueOf(r), 0) || 1;
        return (
          <TRow
            key={m.name}
            $on={m.name === key}
            $muted={!!key && m.name !== key}
            onPointerEnter={() => setHover(m.name)}
            onPointerLeave={() => setHover(null)}
            onClick={() => togglePin(m.name)}
          >
            <Cell>{m.name}</Cell>
            <Cell $num>{axisMoney(valueOf(m))}</Cell>
            <Cell $num $muted>
              {((valueOf(m) / total) * 100).toFixed(1)}%
            </Cell>
          </TRow>
        );
      })}
    </Table>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Empty>{children}</Empty>;
}