/**
 * 城市治理专属组件 —— Demo1 用。
 *
 * 为什么要单独一套
 * ──────────────
 * Demo2 用「仪表 + 状态 pill」，Demo0 用「瀑布 + 刻度盘 + 树图」，
 * 两块屏都已经把「量」和「差」讲透了。城市屏该讲的是**关系**：
 * 谁和谁连在一起、谁偏科、谁被拉下了。
 *
 *   NetworkGraph  关联网络 —— 节点=地市，边=规模相近度。治理屏的第一问题是
 *                             「哪个市在拖后腿」，而拖后腿往往表现为
 *                             「它只和同类连着，够不着头部」。
 *   RadarCompare  城市画像 —— 选中市 vs 全省均值的六维雷达，直接看偏科
 *   ClusterScatter 聚类散点 —— 人口密度 × 人均产出，四象限 + 异常标注
 *   BulletList    能耗强度 —— 目标 vs 实际 + 区间，比进度条多一个「差多少」
 *
 * 配色走紫罗兰，与电力屏冷蓝、贸易屏琥珀金区分。
 */
import { useMemo } from "react";
import styled, { css } from "styled-components";
import { RadarChart } from "echarts/charts";
import {
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import Chart from "@/components/chart";
import { useRowCap } from "./rows";
import { useConsole } from "../store";
import { cityMetrics, cityNames, getCity } from "../data";
import { seriesOf, type MetricKey } from "../series";
import { fontSize, palette } from "@/theme/tokens";

/** 治理屏主色：紫罗兰 */
export const CITY = {
  violet: "#A98CFF",
  orchid: "#C9A6FF",
  deep: "#6E4BB8",
  cool: "#5EC8D8",
  ink: "#DCCBFF",
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
  opacity: ${({ $dim }) => ($dim ? 0.26 : 1)};
  transition: opacity var(--e-base);
`;

/* ══════════════ 1. NetworkGraph ══════════════ */

/**
 * 城市关联网络。
 *
 * 边的定义要诚实：现有数据里没有城市间的流量矩阵，不能假装有引力模型。
 * 这里用**规模相近度**作边权 —— 层级相近的地市在治理上更可比，
 * 而「够不着头部」只靠同类连线的城市就是需要被拉一把的那个。
 *
 * 布局用确定性力导向（模块加载时算一次），不依赖随机数，
 * 所以刷新页面图形完全一致，便于截图与回归比对。
 */
interface NNode {
  name: string;
  x: number;
  y: number;
  r: number;
  gdpRank: number;
  online: boolean;
}
interface NEdge {
  a: number;
  b: number;
  w: number;
}

const NET_W = 320;
const NET_H = 240;

function buildNetwork() {
  const order = [...cityNames].sort(
    (a, b) => cityMetrics[b].gdp - cityMetrics[a].gdp,
  );
  const n = order.length;

  /* 初始布局：按规模次序放在椭圆上，保证可复现 */
  const nodes: NNode[] = order.map((name, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      name,
      x: NET_W / 2 + (NET_W * 0.36) * Math.cos(a),
      y: NET_H / 2 + (NET_H * 0.36) * Math.sin(a),
      r: 3 + (cityMetrics[name].gdp / cityMetrics[order[0]].gdp) * 9,
      gdpRank: i + 1,
      online: false,
    };
  });

  /* 边：每个市连到规模最近的 2 个（无向去重），再加环状邻居补密度 */
  const edges: NEdge[] = [];
  const seen = new Set<string>();
  const add = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    const diff =
      Math.abs(cityMetrics[order[i]].gdp - cityMetrics[order[j]].gdp) /
      cityMetrics[order[0]].gdp;
    edges.push({ a: i, b: j, w: Math.max(0.12, 1 - diff * 6) });
  };
  for (let i = 0; i < n; i++) {
    const near = order
      .map((_, k) => k)
      .filter((k) => k !== i)
      .sort(
        (x, y) =>
          Math.abs(cityMetrics[order[x]].gdp - cityMetrics[order[i]].gdp) -
          Math.abs(cityMetrics[order[y]].gdp - cityMetrics[order[i]].gdp),
      )
      .slice(0, 2);
    near.forEach((k) => add(i, k));
    add(i, (i + 1) % n);
  }

  /* 力导向：斥力 + 边引力，固定迭代次数 —— 结果确定 */
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = (i - j) * 0.5 || 0.7;
          dy = (j - i) * 0.5 || 0.5;
          d2 = dx * dx + dy * dy;
        }
        const f = 900 / d2;
        const d = Math.sqrt(d2);
        const ux = dx / d;
        const uy = dy / d;
        nodes[i].x -= ux * f;
        nodes[i].y -= uy * f;
        nodes[j].x += ux * f;
        nodes[j].y += uy * f;
      }
    }
    for (const e of edges) {
      const A = nodes[e.a];
      const B = nodes[e.b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1;
      const target = 62;
      const f = (d - target) * 0.02 * (0.5 + e.w);
      const ux = dx / d;
      const uy = dy / d;
      A.x += ux * f;
      A.y += uy * f;
      B.x -= ux * f;
      B.y -= uy * f;
    }
    /* 弱回中，避免孤立节点飞出画布 */
    for (const nd of nodes) {
      nd.x += (NET_W / 2 - nd.x) * 0.012;
      nd.y += (NET_H / 2 - nd.y) * 0.012;
    }
  }

  /* 归一到画布内 */
  const pad = 22;
  const xs = nodes.map((v) => v.x);
  const ys = nodes.map((v) => v.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sx = (NET_W - pad * 2) / (x1 - x0 || 1);
  const sy = (NET_H - pad * 2) / (y1 - y0 || 1);
  const sc = Math.min(sx, sy);
  const ox = pad + ((NET_W - pad * 2) - (x1 - x0) * sc) / 2;
  const oy = pad + ((NET_H - pad * 2) - (y1 - y0) * sc) / 2;
  nodes.forEach((v) => {
    v.x = +(ox + (v.x - x0) * sc).toFixed(1);
    v.y = +(oy + (v.y - y0) * sc).toFixed(1);
  });
  return { nodes, edges };
}

const NET = buildNetwork();

const NetWrap = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const NetSvg = styled.svg`
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: visible;
`;

const NetEdge = styled.line<{ $w: number; $dim: boolean }>`
  stroke: ${CITY.deep};
  stroke-width: ${({ $w }) => 0.5 + $w * 1.6};
  stroke-opacity: ${({ $w, $dim }) => ($dim ? 0.07 : 0.24 + $w * 0.3)};
  transition: stroke-opacity var(--e-base);
`;

const Node = styled.g<{ $dim: boolean }>`
  cursor: pointer;
  ${dim}
`;

const NetNote = styled.div`
  flex: none;
  display: flex;
  justify-content: space-between;
  padding-top: 4px;
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
`;

export function NetworkGraph({ metric }: { metric: MetricKey }) {
  const link = useLink();
  const series = (n: string) => {
    const s = seriesOf(n, metric);
    return s.yoy;
  };
  const tone = (y: number) => (y >= 1.5 ? CITY.violet : y >= 0 ? CITY.cool : palette.critical);
  const active = link.key;

  return (
    <NetWrap>
      <NetSvg viewBox={`0 0 ${NET_W} ${NET_H}`} preserveAspectRatio="xMidYMid meet">
        {NET.edges.map((e, i) => (
          <NetEdge
            key={i}
            $w={e.w}
            $dim={!!active && !(NET.nodes[e.a].name === active || NET.nodes[e.b].name === active)}
            x1={NET.nodes[e.a].x}
            y1={NET.nodes[e.a].y}
            x2={NET.nodes[e.b].x}
            y2={NET.nodes[e.b].y}
          />
        ))}
        {NET.nodes.map((nd) => {
          const y = series(nd.name);
          const c = tone(y);
          const on = nd.name === active;
          return (
            <Node
              key={nd.name}
              $dim={!!active && !on}
              {...link.bind(nd.name)}
              onFocus={() => link.bind(nd.name).onPointerEnter?.()}
            >
              {on && (
                <circle cx={nd.x} cy={nd.y} r={nd.r + 5} fill={c} fillOpacity={0.14} />
              )}
              <circle cx={nd.x} cy={nd.y} r={nd.r} fill={c} fillOpacity={0.85} />
              <text
                x={nd.x}
                y={nd.y - nd.r - 4}
                fill={on ? CITY.ink : palette.textDim}
                fontSize="8"
                textAnchor="middle"
                fontFamily="var(--sans)"
              >
                {shortName(nd.name)}
              </text>
            </Node>
          );
        })}
      </NetSvg>
      <NetNote>
        <span>节点大小 = GDP · 环色 = {metric === "population" ? "人口" : metric === "enterprises" ? "企业" : "综合活跃度"}同比</span>
        <span>{NET.nodes.length} 节点 / {NET.edges.length} 边</span>
      </NetNote>
    </NetWrap>
  );
}

/* ══════════════ 2. RadarCompare ══════════════ */

/** 六维画像：规模、结构、活力、能耗、开放、民生 */
const RADAR_DIMS: { key: keyof (typeof cityMetrics)[string]; label: string }[] = [
  { key: "gdp", label: "经济规模" },
  { key: "tertiary", label: "三产占比" },
  { key: "enterprises", label: "企业密度" },
  { key: "score", label: "运行活跃" },
  { key: "energy", label: "能耗强度" },
  { key: "exportValue", label: "外向程度" },
];

const RadarBox = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
`;

const PickRow = styled.div<{ $dim: boolean }>`
  flex: none;
  display: grid;
  grid-template-columns: 46px 1fr 46px;
  align-items: center;
  gap: var(--sp-sm);
  padding: 3px 0;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  cursor: pointer;
  ${dim}
`;

const PickName = styled.span`
  color: var(--c-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PickTrack = styled.span`
  height: 5px;
  border-radius: 3px;
  background: ${palette.line};
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--w);
    border-radius: 3px;
    background: linear-gradient(90deg, ${CITY.deep}, ${CITY.violet});
  }
`;

/**
 * 城市画像雷达。
 * 选中市与全省均值叠在一起 —— 单看一个市的六维数值没有意义，
 * 只有「相对全省偏科在哪一维」才读得出来。
 */
export function RadarCompare() {
  const link = useLink();
  const target = link.key ?? "全省";

  const option = useMemo(() => {
    /**
     * 各维归一到 0–100：按城市极值缩放。
     *
     * 参考线用**市均值**而不是 province 里的省合计 ——
     * data.ts 的 province 是 11 个市的 reduce 求和（省 gdp = Σ 市 gdp），
     * 拿它去对城市级的 min/max 归一会算出 1100%，多边形直接冲出网格。
     */
    const norm = (city: string | null) =>
      RADAR_DIMS.map(({ key }) => {
        const vals = cityNames.map((n) => cityMetrics[n][key] as number);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const v = city === null ? mean : (cityMetrics[city][key] as number);
        return +(((v - min) / (max - min || 1)) * 100).toFixed(1);
      });
    return {
      animationDuration: 500,
      tooltip: {
        backgroundColor: "rgba(7,11,20,.94)",
        borderColor: palette.lineStrong,
        textStyle: { color: palette.text, fontSize: fontSize.micro },
      },
      legend: {
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: palette.textMute, fontSize: fontSize.micro },
      },
      radar: {
        center: ["50%", "47%"],
        radius: "56%",
        splitNumber: 4,
        indicator: RADAR_DIMS.map((d) => ({ name: d.label, max: 100 })),
        axisName: { color: palette.textMute, fontSize: fontSize.micro },
        axisLine: { lineStyle: { color: palette.lineSoft } },
        splitLine: { lineStyle: { color: palette.lineSoft } },
        splitArea: { show: false },
      },
      series: [
        {
          type: "radar" as const,
          symbolSize: 3,
          /* 未联动时 target 是「全省」，两条序列会算成同一条数据 ——
             画出来是两条完全重叠的多边形，看着像畸形。
             所以只在选中了具体城市时才叠「全省均值」参考线。 */
          data:
            target === "全省"
              ? [
                  {
                    name: "全省均值",
                    value: norm(null),
                    lineStyle: { color: CITY.violet, width: 1.8 },
                    itemStyle: { color: CITY.violet },
                    areaStyle: { color: `${CITY.violet}33` },
                  },
                ]
              : [
                  {
                    name: shortName(target),
                    value: norm(target),
                    lineStyle: { color: CITY.violet, width: 2 },
                    itemStyle: { color: CITY.violet },
                    areaStyle: { color: `${CITY.violet}33` },
                  },
                  {
                    name: "全省均值",
                    value: norm(null),
                    lineStyle: { color: palette.textFaint, width: 1, type: "dashed" },
                    itemStyle: { color: palette.textFaint },
                    areaStyle: { opacity: 0 },
                  },
                ],
        },
      ],
    };
  }, [target]);

  const ranked = [...cityNames].sort(
    (a, b) => cityMetrics[b].score - cityMetrics[a].score,
  );
  const mx = cityMetrics[ranked[0]].score || 1;

  /* 画像切换列表自适应：雷达本身是 flex:1 会缩，固定行数不会 */
  const [pickRef, pickCap] = useRowCap<HTMLDivElement>(24, 5);
  const shownPick = ranked.slice(0, pickCap);

  return (
    <div
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}
    >
      <RadarBox>
        <Chart
          use={[RadarChart, RadarComponent, LegendComponent, TooltipComponent]}
          option={option}
          style={{ width: "100%", height: "100%" }}
        />
      </RadarBox>
      <div ref={pickRef} style={{ flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {shownPick.map((n) => (
        <PickRow
          key={n}
          $dim={!!link.key && link.key !== n}
          {...link.bind(n)}
          title={`切换到 ${shortName(n)} 的画像`}
        >
          <PickName>{shortName(n)}</PickName>
          <PickTrack style={{ "--w": `${(cityMetrics[n].score / mx) * 100}%` } as React.CSSProperties} />
          <b className="num" style={{ textAlign: "right", color: CITY.violet }}>
            {cityMetrics[n].score}
          </b>
        </PickRow>
      ))}
      </div>
    </div>
  );
}

/* ══════════════ 3. ClusterScatter ══════════════ */

/**
 * 聚类散点：人口密度 × 人均产出。
 * 四象限把 11 个市分开，右上（高密度高产出）是标杆，
 * 左上（高密度低产出）是治理重点 —— 这正是城市屏要指出来的。
 */
const ScatterBox = styled.div`
  flex: 1;
  min-height: 0;
`;

export function ClusterScatter() {
  const link = useLink();

  const { svg } = useMemo(() => {
    const W = 330;
    const H = 250;
    const P = { l: 42, r: 16, t: 14, b: 26 };
    const pts = cityNames.map((n) => {
      const m = cityMetrics[n];
      return {
        n,
        d: m.population / (m.area || 1), // 人 / km²
        p: m.gdp / (m.population || 1), // 元 / 人
        r: m.gdp,
      };
    });
    const dx = pts.map((v) => v.d);
    const dy = pts.map((v) => v.p);
    const x0 = Math.min(...dx) * 0.9;
    const x1 = Math.max(...dx) * 1.08;
    const y0 = Math.min(...dy) * 0.9;
    const y1 = Math.max(...dy) * 1.08;
    const X = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
    const Y = (v: number) => H - P.b - ((v - y0) / (y1 - y0)) * (H - P.t - P.b);
    const mx = dx.reduce((a, b) => a + b, 0) / dx.length;
    const my = dy.reduce((a, b) => a + b, 0) / dy.length;
    const rmx = Math.max(...pts.map((p) => p.r));
    const active = link.key;

    const body = pts
      .map((p) => {
        const c =
          p.d >= mx ? (p.p >= my ? CITY.violet : CITY.orchid) : p.p >= my ? CITY.cool : palette.textMute;
        const big = p.r > rmx * 0.5;
        return `<g class="${active && active !== p.n ? "sc-dim" : ""}" data-city="${p.n}">
        <circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="${(3 + (p.r / rmx) * 6).toFixed(1)}"
          fill="${c}" fill-opacity=".5" stroke="${c}" stroke-width="1.2"/>
        ${big ? `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="12" fill="none" stroke="${c}" stroke-width=".8" stroke-opacity=".45"/>` : ""}
        <text x="${X(p.d).toFixed(1)}" y="${(Y(p.p) + 3).toFixed(1)}" fill="${palette.text}" font-size="7.5" text-anchor="middle">${shortName(p.n)}</text>
        </g>`;
      })
      .join("");

    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((t) => {
        const x = P.l + t * (W - P.l - P.r);
        const y = H - P.b - t * (H - P.t - P.b);
        return `<line x1="${x.toFixed(1)}" y1="${P.t}" x2="${x.toFixed(1)}" y2="${H - P.b}" stroke="rgba(122,160,220,.07)"/>
        <line x1="${P.l}" y1="${y.toFixed(1)}" x2="${W - P.r}" y2="${y.toFixed(1)}" stroke="rgba(122,160,220,.07)"/>`;
      })
      .join("");

    const cross =
      `<line x1="${X(mx).toFixed(1)}" y1="${P.t}" x2="${X(mx).toFixed(1)}" y2="${H - P.b}" stroke="${palette.lineStrong}" stroke-dasharray="3 3"/>` +
      `<line x1="${P.l}" y1="${Y(my).toFixed(1)}" x2="${W - P.r}" y2="${Y(my).toFixed(1)}" stroke="${palette.lineStrong}" stroke-dasharray="3 3"/>`;

    const labels =
      `<text x="${(W - P.r).toFixed(1)}" y="${(P.t + 9).toFixed(1)}" fill="${CITY.violet}" font-size="7.5" text-anchor="end">高密高产</text>` +
      `<text x="${P.l + 4}" y="${(P.t + 9).toFixed(1)}" fill="${CITY.orchid}" font-size="7.5">高密低产</text>` +
      `<text x="${(W - P.r).toFixed(1)}" y="${(H - P.b - 4).toFixed(1)}" fill="${CITY.cool}" font-size="7.5" text-anchor="end">低密高</text>` +
      `<text x="${P.l + 4}" y="${(H - P.b - 4).toFixed(1)}" fill="${palette.textFaint}" font-size="7.5">低密低产</text>` +
      `<text x="${((P.l + W - P.r) / 2).toFixed(1)}" y="${H - 6}" fill="${palette.textFaint}" font-size="8" text-anchor="middle">人口密度（人/km²）</text>` +
      `<text x="9" y="${((P.t + H - P.b) / 2).toFixed(1)}" fill="${palette.textFaint}" font-size="8" text-anchor="middle" transform="rotate(-90 9 ${((P.t + H - P.b) / 2).toFixed(1)})">人均 GDP（元）</text>`;

    return { svg: `${grid}${cross}${body}${labels}` };
  }, [link.key]);

  return (
    <ScatterBox
      onPointerLeave={() => link.bind("").onPointerLeave?.()}
    >
      <svg
        viewBox="0 0 330 250"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </ScatterBox>
  );
}

/* ══════════════ 4. BulletList ══════════════ */

/**
 * 能耗强度达成：目标 vs 实际 + 区间。
 * 比进度条多给一个「差多少」—— 治理指标要看的是缺口，不是完成度。
 */
const BRow = styled.div<{ $dim: boolean }>`
  display: grid;
  grid-template-columns: 44px 1fr 48px;
  align-items: center;
  gap: var(--sp-sm);
  padding: 3.5px 0;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  cursor: pointer;
  ${dim}
`;

const BTrack = styled.span`
  height: 13px;
  position: relative;
  border-radius: 2px;
  background: ${palette.lineSoft};
  overflow: hidden;
`;

const BBand = styled.span<{ $a: number; $b: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${({ $a }) => $a}%;
  width: ${({ $b }) => $b}%;
  background: ${CITY.violet}1f;
`;

const BFill = styled.span<{ $w: number; $ok: boolean }>`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: ${({ $w }) => $w}%;
  border-radius: 2px;
  background: ${({ $ok }) => ($ok ? CITY.violet : CITY.orchid)};
  box-shadow: 0 0 8px -2px ${({ $ok }) => ($ok ? CITY.violet : CITY.orchid)};
`;

const BGoal = styled.span`
  position: absolute;
  top: -1px;
  bottom: -1px;
  left: 100%;
  width: 2px;
  background: ${palette.text};
  opacity: 0.85;
`;

const BPct = styled.span<{ $ok: boolean }>`
  font-family: var(--font-mono);
  text-align: right;
  color: ${({ $ok }) => ($ok ? CITY.violet : CITY.orchid)};
`;

export function BulletList({
  metric,
  /** 越大越好（如效率分），还是越小越好（如强度） */
  lowerIsBetter = true,
}: {
  metric: MetricKey;
  lowerIsBetter?: boolean;
}) {
  const link = useLink();
  const rows = useMemo(() => {
    const vals = cityNames.map((n) => ({
      n,
      v: (cityMetrics[n][metric as "energy"] as number) / (cityMetrics[n].gdp || 1),
    }));
    const best = lowerIsBetter
      ? Math.min(...vals.map((x) => x.v))
      : Math.max(...vals.map((x) => x.v));
    return vals
      .map((x) => {
        /* 完成率：以全省最优为 100% */
        const ratio = lowerIsBetter ? best / x.v : x.v / best;
        const p = Math.min(118, ratio * 100);
        return {
          n: x.n,
          p: +p.toFixed(0),
          ok: p >= 100,
          band: [88, 100] as [number, number],
        };
      })
      .sort((a, b) => b.p - a.p);
  }, [metric, lowerIsBetter]);

  /* 行数按实测高度自适应：11 行在 1366×768 下装不进 180px 的卡 */
  const [ref, cap] = useRowCap<HTMLDivElement>(26, rows.length);
  const shown = rows.slice(0, cap);
  return (
    <div
      ref={ref}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      {shown.map((r) => (
        <BRow key={r.n} $dim={!!link.key && link.key !== r.n} {...link.bind(r.n)}>
          <PickName>{shortName(r.n)}</PickName>
          <BTrack>
            <BBand $a={r.band[0]} $b={r.band[1]} />
            <BFill $w={Math.min(100, r.p)} $ok={r.ok} />
            <BGoal />
          </BTrack>
          <BPct $ok={r.ok} className="num">
            {r.p}%
          </BPct>
        </BRow>
      ))}
    </div>
  );
}

/** 供面板读取单市画像 */
export function cityProfile(name: string) {
  return getCity(name === "全省" ? null : name);
}
