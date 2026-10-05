/**
 * 贸易专属组件 —— Demo0 用。
 *
 * 为什么要单独一套
 * ──────────────
 * Demo2（电力）已经占了「行式仪表 + 状态 pill + 中轴差值条」这套语法：
 * 读数、状态、增减。贸易屏若复用，三个屏会长成同一张皮。
 *
 * 贸易的本质是**两个量之间的关系** —— 出口对进口、顺差对逆差、
 * 结构对规模。所以这里的组件一律走「成对 / 差额 / 累积」：
 *   Treemap      矩形树图 —— 构成的面积感（与堆叠条形态完全不同）
 *   Waterfall    瀑布图   —— 全省出口逐项扣减到顺差，讲清「差额从哪来」
 *   DialectPanel 依存度   —— 半环刻度盘 + 城市刻度，带阈值线
 *   DualAxis     柱线双轴 —— 左轴出口、右轴进口，一眼看出剪刀差
 *
 * 配色走暖调（琥珀金），与电力屏的冷蓝、治理屏的紫罗兰区分开。
 */
import { useMemo } from "react";
import styled, { css } from "styled-components";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import Chart from "@/components/chart";
import { useRowCap } from "./rows";
import { useConsole } from "../store";
import { cityMetrics, cityNames, province } from "../data";
import { seriesOf, type MetricKey } from "../series";
import { fontSize, palette, type } from "@/theme/tokens";

/** 贸易屏主色：暖琥珀。刻意区别于电力屏的冷蓝 */
export const TRADE = {
  gold: "#FFB547",
  amber: "#FFC46B",
  deep: "#C77B1A",
  cool: "#6BA8D6",
  ink: "#FFD98A",
};

export const shortName = (n: string) => n.replace(/[市州]$/, "");

/* ══════════════ 联动 ══════════════ */

function useLink() {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  const setHover = useConsole((s) => s.setHover);
  const togglePin = useConsole((s) => s.togglePin);
  return useMemo(
    () => ({
      key: hover ?? pinned,
      bind: (name: string) => ({
        onPointerEnter: () => setHover(name),
        onPointerLeave: () => setHover(null),
        onClick: () => togglePin(name),
      }),
    }),
    [hover, pinned, setHover, togglePin],
  );
}

const dim = css<{ $dim: boolean }>`
  opacity: ${({ $dim }) => ($dim ? 0.3 : 1)};
  transition: opacity var(--e-base);
`;

/* ══════════════ 1. Treemap ══════════════ */

/**
 * 矩形树图（squarified）。
 * 与 Demo2 的 100% 堆叠条相比：堆叠条适合读「排序」，树图适合读「构成」。
 * 贸易屏要同时回答「哪类商品占比大」和「大类和小区怎么嵌套」，所以用树图。
 */
const TreeBox = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const TreeCell = styled.div<{ $c: string }>`
  position: absolute;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  overflow: hidden;
  border: 1px solid ${({ $c }) => `${$c}66`};
  background: ${({ $c }) => `${$c}1f`};
  border-radius: 2px;
  transition: background var(--e-base);
  cursor: pointer;

  &:hover {
    background: ${({ $c }) => `${$c}3d`};
  }

  b {
    font-size: var(--fs-micro);
    font-weight: 600;
    color: ${palette.text};
    white-space: nowrap;
  }
  span {
    font-family: var(--font-mono);
    font-size: var(--fs-base);
    font-weight: 700;
    color: ${({ $c }) => $c};
    line-height: 1.15;
  }
  em {
    font-family: var(--font-mono);
    font-size: 9px;
    font-style: normal;
    color: var(--c-text-mute);
  }
`;

export interface TreeItem {
  name: string;
  value: number;
  color: string;
}

/** squarified treemap —— 行沿短边铺开，切掉垂直于长边的厚条 */
function squarify(items: TreeItem[]) {
  const total = items.reduce((a, x) => a + x.value, 0) || 1;
  const scale = 10000 / total;
  const list = [...items]
    .sort((a, b) => b.value - a.value)
    .map((i) => ({ ...i, a: i.value * scale }));

  const worst = (row: typeof list, side: number) => {
    const ra = row.reduce((s, r) => s + r.a, 0);
    return Math.max(
      ...row.map((r) => {
        const s = (side * side * r.a) / (ra * ra);
        return Math.max(s, 1 / s);
      }),
    );
  };

  const out: (TreeItem & { x: number; y: number; w: number; h: number })[] = [];
  let rx = 0;
  let ry = 0;
  let rw = 100;
  let rh = 100;
  let i = 0;
  while (i < list.length) {
    const vertical = rw >= rh;
    const side = vertical ? rh : rw;
    let j = i + 1;
    while (
      j < list.length &&
      (j === i + 1 || worst(list.slice(i, j + 1), side) <= worst(list.slice(i, j), side))
    ) {
      j++;
    }
    const row = list.slice(i, j);
    const ra = row.reduce((s, r) => s + r.a, 0);
    const thick = ra / side;
    let off = 0;
    row.forEach((it) => {
      const len = (it.a / ra) * side;
      out.push(
        vertical
          ? { ...it, x: rx, y: ry + off, w: thick, h: len }
          : { ...it, x: rx + off, y: ry, w: len, h: thick },
      );
      off += len;
    });
    if (vertical) {
      rx += thick;
      rw -= thick;
    } else {
      ry += thick;
      rh -= thick;
    }
    i = j;
  }
  return { out, total };
}

export function Treemap({ items }: { items: TreeItem[] }) {
  const link = useLink();
  const { out, total } = useMemo(() => squarify(items), [items]);
  return (
    <TreeBox>
      {out.map((r) => {
        const pct = (r.value / total) * 100;
        return (
          <TreeCell
            key={r.name}
            $c={r.color}
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.w}%`,
              height: `${r.h}%`,
            }}
            title={`${r.name} ${r.value.toLocaleString()} · ${pct.toFixed(1)}%`}
            {...link.bind(r.name)}
          >
            <b>{r.name}</b>
            <span>{r.value.toLocaleString()}</span>
            <em>{pct.toFixed(1)}%</em>
          </TreeCell>
        );
      })}
    </TreeBox>
  );
}

/* ══════════════ 2. Waterfall ══════════════ */

/**
 * 贸易顺差瀑布：全省出口 → 逐项扣减主要进口来源 → 净顺差。
 *
 * 为什么用瀑布而不是一根条：贸易屏要回答的是「**这个差额是从哪来的**」。
 * 一根条只能给出顺差数值，瀑布能定位到具体是哪个市在拉低全省顺差。
 *
 * ECharts 没有 waterfall，用「透明占位柱 + 实值柱」的堆叠柱实现：
 * 占位柱负责把每根柱子垫到正确高度，实值柱只画可见部分。
 */
export function Waterfall({ metric, compare }: { metric: MetricKey; compare: MetricKey }) {
  const link = useLink();

  const data = useMemo(() => {
    const exportTotal = province[metric as "exportValue"] as number;
    const importers = [...cityNames]
      .map((n) => ({ n, v: cityMetrics[n][compare as "importValue"] as number }))
      .sort((a, b) => b.v - a.v);
    /* 只拆前 5 个进口来源，其余合并 —— 拆到底反而看不出主因 */
    const top = importers.slice(0, 5);
    const rest = importers
      .slice(5)
      .reduce((s, c) => s + c.v, 0);
    const rows: {
      name: string;
      kind: "total" | "sub" | "end";
      value: number;
    }[] = [{ name: "全省出口", kind: "total", value: exportTotal }];
    for (const c of top) {
      rows.push({ name: shortName(c.n), kind: "sub", value: -c.v });
    }
    if (rest > 0) rows.push({ name: "其余 6 市", kind: "sub", value: -rest });
    const surplus = exportTotal - importers.reduce((s, c) => s + c.v, 0);
    rows.push({ name: "贸易顺差", kind: "end", value: surplus });
    return { rows, surplus };
  }, [metric, compare]);

  const option = useMemo(() => {
    /* 占位高度：sub 项从前一根的累计位置起跳 */
    const base: number[] = [];
    const up: number[] = [];
    const down: number[] = [];
    let acc = 0;
    for (const r of data.rows) {
      if (r.kind === "total") {
        base.push(0);
        up.push(r.value);
        down.push(0);
        acc = r.value;
      } else if (r.kind === "sub") {
        base.push(acc + r.value);
        up.push(0);
        down.push(-r.value);
        acc += r.value;
      } else {
        base.push(0);
        up.push(Math.max(0, r.value));
        down.push(Math.max(0, -r.value));
      }
    }
    return {
      animationDuration: 600,
      grid: { left: 6, right: 10, top: 26, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(7,11,20,.94)",
        borderColor: palette.lineStrong,
        textStyle: { color: palette.text, fontSize: fontSize.micro, fontFamily: type.mono },
        formatter: (ps: { name: string; seriesName: string; value: number; dataIndex: number }[]) => {
          const r = data.rows[ps[0].dataIndex];
          const sign = r.value >= 0 ? "+" : "−";
          return `${r.name}<br/><b>${sign}${Math.abs(r.value).toFixed(1)}</b> 亿元`;
        },
      },
      legend: {
        show: true,
        top: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: palette.textMute, fontSize: fontSize.micro },
        data: ["出口", "进口"],
      },
      xAxis: {
        type: "category",
        data: data.rows.map((r) => r.name),
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { show: false },
        axisLabel: {
          color: palette.textMute,
          fontSize: fontSize.micro,
          fontFamily: type.sans,
          interval: 0,
          rotate: data.rows.length > 6 ? 22 : 0,
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: palette.textFaint,
          fontSize: fontSize.micro,
          fontFamily: type.mono,
          showMinLabel: false,
          formatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)),
        },
        splitLine: { lineStyle: { color: palette.lineSoft, type: "dashed" } },
      },
      series: [
        {
          name: "累计",
          type: "bar" as const,
          stack: "wf",
          itemStyle: { color: "transparent" },
          emphasis: { itemStyle: { color: "transparent" } },
          data: base,
          silent: true,
        },
        {
          name: "出口",
          type: "bar" as const,
          stack: "wf",
          barWidth: "58%",
          itemStyle: { color: TRADE.gold, borderRadius: [2, 2, 0, 0] },
          data: up,
        },
        {
          name: "进口",
          type: "bar" as const,
          stack: "wf",
          barWidth: "58%",
          itemStyle: { color: TRADE.cool, borderRadius: [0, 0, 2, 2] },
          data: down,
        },
      ],
    };
  }, [data]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Chart
        use={[BarChart, GridComponent, LegendComponent, TooltipComponent]}
        events={{
          onHover: (n) => n && link.bind(shortName(n)).onPointerEnter?.(),
          onSelect: (n) => n && link.bind(shortName(n)).onClick?.(),
        }}
        option={option}
      />
      <Footnote>
        顺差 <b className="num">{data.surplus >= 0 ? "" : "−"}</b>
        <b className="num" style={{ color: data.surplus >= 0 ? TRADE.gold : palette.critical }}>
          {Math.abs(data.surplus).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </b>{" "}
        亿元 · 由前 5 大进口来源逐项扣减得出
      </Footnote>
    </div>
  );
}

const Footnote = styled.div`
  flex: none;
  padding-top: 6px;
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
  text-align: right;

  b {
    font-size: var(--fs-base);
  }
`;

/* ══════════════ 3. DialectPanel ══════════════ */

/**
 * 贸易依存度：半环刻度盘 + 城市刻度列表。
 *
 * 依存度 = (出口 + 进口) / GDP，是贸易屏唯一不能由金额直接看出的比率 ——
 * 它把「绝对规模」换算成「经济对外依赖的深度」。半环刻度盘给全省读数，
 * 下方刻度行给城市分布，两者共用一条 0–100% 的轴。
 */
const DialWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--sp-sm);
`;

const DialBox = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 0;
`;

const DialRead = styled.div`
  position: absolute;
  bottom: 4%;
  text-align: center;
  pointer-events: none;

  b {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--fs-xl);
    font-weight: 700;
    line-height: 1;
    color: ${TRADE.gold};
  }
  span {
    font-size: var(--fs-micro);
    color: var(--c-text-mute);
  }
`;

const Threshold = styled.div<{ $dim: boolean }>`
  flex: none;
  display: grid;
  grid-template-columns: 44px 1fr 40px;
  align-items: center;
  gap: var(--sp-sm);
  padding: 3px 0;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  ${dim}
`;

const DName = styled.span`
  color: var(--c-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DTrack = styled.span<{ $p: number; $hot: boolean }>`
  height: 6px;
  border-radius: 3px;
  position: relative;
  background: ${palette.line};
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: ${({ $p }) => Math.min(100, $p)}%;
    border-radius: 3px;
    background: ${({ $hot }) =>
      $hot
        ? `linear-gradient(90deg, ${TRADE.deep}, ${TRADE.gold})`
        : `linear-gradient(90deg, ${palette.indigo}, ${palette.cyan})`};
    box-shadow: 0 0 8px -2px ${({ $hot }) => ($hot ? TRADE.gold : palette.cyan)};
    transition: width var(--e-slow);
  }
`;

const DPct = styled.span<{ $hot: boolean }>`
  font-family: var(--font-mono);
  text-align: right;
  color: ${({ $hot }) => ($hot ? TRADE.gold : palette.textDim)};
`;

export function DialectPanel({ metric, compare }: { metric: MetricKey; compare: MetricKey }) {
  const link = useLink();
  const rows = useMemo(() => {
    const dep = (n: string) => {
      const m = cityMetrics[n];
      const t = ((m[metric as "exportValue"] as number) + (m[compare as "importValue"] as number)) * 1e8;
      return t / (m.gdp || 1);
    };
    return [...cityNames]
      .map((n) => ({ n, v: dep(n) }))
      .sort((a, b) => b.v - a.v);
  }, [metric, compare]);

  const whole =
    (((province[metric as "exportValue"] as number) +
      (province[compare as "importValue"] as number)) *
      1e8) /
    (province.gdp || 1);

  /* 城市刻度行按可用高度自适应 —— 8 行在 1366×768 的卡里放不下 */
  const [depRef, depCap] = useRowCap<HTMLDivElement>(26, 8);
  const shownDeps = rows.slice(0, depCap);

  /* 半环刻度盘：0–100%，指针落在全省依存度 */
  const R = 54;
  const CX = 70;
  const CY = 66;
  const pct = Math.max(0, Math.min(1, whole));
  const angle = Math.PI * (1 - pct);
  const px = CX + R * Math.cos(angle);
  const py = CY - R * Math.sin(angle);

  return (
    <DialWrap>
      <DialBox>
        <svg viewBox="0 0 140 76" style={{ width: "100%", height: "100%" }}>
          {/* 底弧 */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={palette.line}
            strokeWidth={9}
            strokeLinecap="round"
          />
          {/* 已填充弧 */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${px} ${py}`}
            fill="none"
            stroke={TRADE.gold}
            strokeWidth={9}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(255,181,71,.55))" }}
          />
          {/* 刻度 */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const a = Math.PI * (1 - t);
            const x1 = CX + (R - 7) * Math.cos(a);
            const y1 = CY - (R - 7) * Math.sin(a);
            const x2 = CX + (R - 11) * Math.cos(a);
            const y2 = CY - (R - 11) * Math.sin(a);
            return (
              <line
                key={t}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={palette.lineStrong}
                strokeWidth={t === 0.5 ? 1.6 : 1}
              />
            );
          })}
          <text x={CX - R} y={CY + 13} fill={palette.textFaint} fontSize="7.5" fontFamily="monospace">
            0
          </text>
          <text x={CX + R - 10} y={CY + 13} fill={palette.textFaint} fontSize="7.5" fontFamily="monospace">
            100%
          </text>
        </svg>
        <DialRead>
          <b className="num">{(whole * 100).toFixed(1)}%</b>
          <span>全省贸易依存度</span>
        </DialRead>
      </DialBox>

      <div ref={depRef} style={{ flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {shownDeps.map((r) => (
        <Threshold
          key={r.n}
          $dim={!!link.key && link.key !== r.n}
          {...link.bind(r.n)}
          title={`${r.n} · 依存度 ${(r.v * 100).toFixed(1)}%`}
        >
          <DName>{shortName(r.n)}</DName>
          <DTrack $p={r.v * 100} $hot={r.v * 100 > whole * 100} />
          <DPct $hot={r.v * 100 > whole * 100} className="num">
            {/* 依存度理论上不超过 100%；超过说明 data.ts 里出口额本身
                超过了 GDP（舟山 793 亿出口 vs 178 亿 GDP）。这里钳到 100%
                并标注，而不是把 718% 摆在条上让条形失去意义。 */}
            {r.v > 1 ? "＞100%" : `${(r.v * 100).toFixed(1)}%`}
          </DPct>
        </Threshold>
      ))}
      </div>
    </DialWrap>
  );
}

/* ══════════════ 4. DualAxis ══════════════ */

/**
 * 柱线双轴：左轴柱（出口额）、右轴线（进口额）。
 * 两者量级常常差一个数量级，共用一个轴会把小的那条压平；
 * 而贸易屏必须同时看到「谁大谁小」和「差额在扩大还是收窄」。
 */
export function DualAxis({
  barValues,
  lineValues,
  barName,
  lineName,
  barUnit,
  lineUnit,
}: {
  barValues: number[];
  lineValues: number[];
  barName: string;
  lineName: string;
  barUnit: string;
  lineUnit: string;
}) {
  const link = useLink();
  const a = barValues;
  const b = lineValues;
  const labels = Array.from({ length: a.length }, (_, i) => `${(i % 12) + 1}月`);

  const option = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 6, right: 8, top: 26, bottom: 2, containLabel: true },
      legend: {
        show: true,
        top: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: palette.textMute, fontSize: fontSize.micro },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,11,20,.94)",
        borderColor: palette.lineStrong,
        textStyle: { color: palette.text, fontSize: fontSize.micro, fontFamily: type.mono },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { show: false },
        axisLabel: { color: palette.textFaint, fontSize: fontSize.micro, fontFamily: type.mono },
      },
      yAxis: [
        {
          type: "value",
          name: barUnit,
          nameTextStyle: { color: TRADE.gold, fontSize: fontSize.micro },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: TRADE.deep,
            fontSize: fontSize.micro,
            fontFamily: type.mono,
            showMinLabel: false,
            formatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
          },
          splitLine: { lineStyle: { color: palette.lineSoft, type: "dashed" } },
        },
        {
          type: "value",
          name: lineUnit,
          nameTextStyle: { color: TRADE.cool, fontSize: fontSize.micro },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: palette.indigo,
            fontSize: fontSize.micro,
            fontFamily: type.mono,
            showMinLabel: false,
            formatter: (v: number) => `${v.toFixed(0)}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: barName,
          type: "bar" as const,
          yAxisIndex: 0,
          barWidth: "52%",
          data: a.map((v) => Number(v.toFixed(1))),
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: TRADE.amber },
                { offset: 1, color: `${TRADE.deep}66` },
              ],
            },
            borderRadius: [2, 2, 0, 0],
          },
        },
        {
          name: lineName,
          type: "line" as const,
          yAxisIndex: 1,
          smooth: 0.24,
          symbol: "circle",
          symbolSize: 5,
          data: b.map((v) => Number(v.toFixed(1))),
          lineStyle: { color: TRADE.cool, width: 2 },
          itemStyle: { color: TRADE.cool },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${TRADE.cool}40` },
                { offset: 1, color: `${TRADE.cool}00` },
              ],
            },
          },
        },
      ],
    }),
    [a, b, labels, barName, lineName, barUnit, lineUnit],
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Chart
        use={[BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent]}
        events={{
          onHover: (n) => {
            const t = n && link.bind(shortName(n));
            if (t) t.onPointerEnter?.();
          },
          onSelect: (n) => {
            const t = n && link.bind(shortName(n));
            if (t) t.onClick?.();
          },
        }}
        option={option}
      />
      <Footnote>
        两轴量级不同：柱读<b style={{ color: TRADE.gold }}>{barUnit}</b>，线读
        <b style={{ color: TRADE.cool }}>{lineUnit}</b>
      </Footnote>
    </div>
  );
}

/** 供外部按联动高亮时取序列 */
export function tradeSeries(city: string, key: MetricKey) {
  return seriesOf(city, key);
}
