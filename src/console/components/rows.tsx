/**
 * 行式面板组件 —— 表格/列表型可视化的 DOM 实现。
 *
 * 为什么不用 ECharts
 * ─────────────────
 * 原来 6 个面板里有 4 个塞给 ECharts 画「横条 + 名称 + 数字」这种
 * 本质是 HTML 表格的布局。代价是：
 *   · 字号、行距、悬停态要靠 grid/label 反复调，换行就得重算
 *   · 想加图标、序号徽标、状态 pill，ECharts 没有对应概念，
 *     只能拿 graphic 硬画，坐标全靠手算
 *   · 「图标 + 名称 + 条 + 百分比」这种仪表行，ECharts 表达不了
 * 下面这几个组件用 DOM 实现，天然支持图标/徽标/pill/悬停，
 * 并且全部保留 useLinkState 的联动语义 —— 与地图双向联动不变。
 *
 * 组件清单
 *   StackShare  100% 堆叠条 + 右侧图例列表（构成占比）
 *   GaugeRows   图标 + 名称 + 条 + 百分比（资源水位）
 *   AdviceList  图标 + 标题 + 说明 + 状态 pill（建议/告警）
 *   DeltaBars   以中轴为基准的正负差值条（同比增减）
 *   HeatMatrix  行 × 列热力矩阵（月 × 市）
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { useConsole } from "../store";
import { linkKeyOf } from "@/theme/echarts";
import { palette } from "@/theme/tokens";
import Icon, { type IconName } from "./Icon";
import Tag, { type Tone } from "./Tag";

/* ── 联动 ─────────────────────────────────────────────────── */

function useLink() {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  const setHover = useConsole((s) => s.setHover);
  const togglePin = useConsole((s) => s.togglePin);
  return useMemo(
    () => ({
      key: linkKeyOf({ hover, pinned }),
      bind: (name: string) => ({
        onPointerEnter: () => setHover(name),
        onPointerLeave: () => setHover(null),
        onClick: () => togglePin(name),
      }),
    }),
    [hover, pinned, setHover, togglePin]
  );
}

/** 联动下的不透明度：命中 1，未命中 0.28。必须是 css helper —— 
    styled 的插值收到的是 props 对象，不是布尔值 */
const dim = css<{ $dim: boolean }>`
  opacity: ${({ $dim }) => ($dim ? 0.28 : 1)};
  transition: opacity var(--e-base);
`;

/**
 * 按可用高度决定显示几行。
 * 1366×768 下每张卡只有约 184px，写死行数必然溢出；
 * 而用 CSS 裁切会把多出来的行静默藏掉 —— 读者以为「只有这些」，
 * 那是比溢出更糟的错。所以这里按实测高度算行数，宁可少显示也要可见。
 */
export function useRowCap<T extends HTMLElement>(
  perRow: number,
  max: number,
  reserve = 0,
  /** 最少显示几行。默认 1 —— 下限设为 2 时，矮屏上（1366×768 下某卡正文区只有 49px）
   *  两行 × 25px 必然溢出。1 行永远放得下，代价是信息变少而不是溢出。 */
  min = 1,
) {
  const ref = useRef<T>(null);
  const [cap, setCap] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const h = el.clientHeight - reserve;
      setCap(Math.max(min, Math.min(max, Math.floor(h / perRow))));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [perRow, max, reserve, min]);
  return [ref, cap] as const;
}

const Rows = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

/* ══════════════ 1. StackShare ══════════════ */

const StackWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
`;

/**
 * 100% 堆叠条。
 * 宽度不够的段只显示百分比，够宽的段显示「名称 + 百分比」——
 * 段内文字按可用宽度决定，不做溢出裁切，避免出现半个字。
 */
const Bar = styled.div`
  flex: none;
  height: 32px;
  display: flex;
  border-radius: 3px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
`;

const Seg = styled.div<{ $c: string }>`
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  border-right: 1px solid rgba(4, 6, 12, 0.55);
  background: ${({ $c }) => $c};
  transition: filter var(--e-base);

  &:last-child {
    border-right: 0;
  }
  &:hover {
    filter: brightness(1.18);
  }
`;

const SegText = styled.span`
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  font-weight: 600;
  color: #03101a;
  white-space: nowrap;
  padding: 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

/**
 * 图例列表：数值与占比右对齐分列，比顶部横排图例省纵向空间。
 * 单列放不下时自动转双列 —— 否则 6 段的堆叠条只标得下 4 段，
 * 读者认不出剩下两段是哪两个市，等于白画。
 */
const LegendList = styled.ul`
  flex: 1;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* 列数由宽度决定：~400px 宽放两列，窄屏自动回到一列。
     用 JS 量高度来决定列数不可靠 —— 量到的是 flex:1 的中间态高度，
     状态更新后高度又不变，ResizeObserver 不再触发。 */
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  align-content: space-between;
  gap: 0 16px;
`;

const LegendRow = styled.li<{ $dim: boolean }>`
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  /* 窄屏（1366）下图例要转两列才放得下 6 段，每列只剩 ~120px。
     绝对值可以让位，占比才是读者要的那一半。 */
  @media (max-width: 1500px) {
    .lg-abs {
      display: none;
    }
  }
  align-items: center;
  gap: var(--sp-sm);
  padding: 3px 0;
  overflow: hidden;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  cursor: pointer;
  ${dim}
`;

/** 名称不折行：图例列窄，折成两行会把这一行的高度撑乱 */
const LegendName = styled.span`
  color: var(--c-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const Swatch = styled.i<{ $c: string }>`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: ${({ $c }) => $c};
  box-shadow: 0 0 6px -1px ${({ $c }) => $c};
`;

const Foot = styled.div`
  flex: none;
  display: flex;
  gap: var(--sp-xl);
  padding-top: var(--sp-sm);
  border-top: 1px solid ${palette.lineSoft};
`;

const FootItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const FootV = styled.b`
  font-family: var(--font-mono);
  font-size: var(--fs-lg);
  font-weight: 700;
  line-height: 1.1;
`;

const FootL = styled.span`
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
`;

export interface StackSegment {
  name: string;
  value: number;
  color: string;
}

export function StackShare({
  segments,
  total,
  /** 底部脚注：通常给「集中度」与「量纲」 */
  footer,
}: {
  segments: StackSegment[];
  /** 全省合计；决定百分比的分母 */
  total: number;
  footer?: { label: string; value: string }[];
}) {
  const link = useLink();
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  const t = total || sum;
  /* 图例全列显示，不做 JS 限行 —— 堆叠条上有一段没有图例，读者就认不出来，
     那比排得挤一点更难读。列数交给 CSS 的 auto-fit 按宽度决定。 */
  const shownLegend = segments;

  return (
    <StackWrap>
      <Bar>
        {segments.map((s) => {
          const share = (s.value / sum) * 100;
          const ofTotal = (s.value / t) * 100;
          // 段宽 < 9% 放不下百分比，< 14% 放不下「名称 + 百分比」
          const text =
            share >= 14 ? `${s.name} ${ofTotal.toFixed(0)}%` : share >= 9 ? `${ofTotal.toFixed(0)}%` : "";
          return (
            <Seg
              key={s.name}
              $c={s.color}
              style={{ width: `${share.toFixed(2)}%` }}
              title={`${s.name} ${s.value.toFixed(1)} · 占全省 ${ofTotal.toFixed(1)}%`}
              {...link.bind(s.name)}
            >
              {text && <SegText>{text}</SegText>}
            </Seg>
          );
        })}
      </Bar>

      <LegendList>
        {shownLegend.map((s) => {
          const ofTotal = (s.value / t) * 100;
          return (
            <LegendRow
              key={s.name}
              $dim={!!link.key && link.key !== s.name}
              {...link.bind(s.name)}
            >
              <Swatch $c={s.color} />
              <LegendName>{s.name}</LegendName>
              <b className="num lg-abs">{s.value.toFixed(1)}</b>
              <em className="num">{ofTotal.toFixed(1)}%</em>
            </LegendRow>
          );
        })}
      </LegendList>

      {footer && (
        <Foot>
          {footer.map((f) => (
            <FootItem key={f.label}>
              <FootV className="num">{f.value}</FootV>
              <FootL>{f.label}</FootL>
            </FootItem>
          ))}
        </Foot>
      )}
    </StackWrap>
  );
}

/* ══════════════ 2. GaugeRows ══════════════ */

const GaugeRow = styled.div<{ $dim: boolean }>`
  display: grid;
  grid-template-columns: 16px 60px 1fr auto;
  align-items: center;
  gap: var(--sp-md);
  padding: 3px 0;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  cursor: default;
  ${dim}
`;

const GaugeIc = styled.i<{ $c: string }>`
  display: flex;
  color: ${({ $c }) => $c};
  opacity: 0.9;
`;

const GaugeName = styled.span`
  color: var(--c-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Track = styled.span`
  height: 6px;
  border-radius: 3px;
  background: ${palette.line};
  position: relative;
  overflow: hidden;
`;

const Fill = styled.i<{ $c: string; $w: number }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${({ $w }) => $w}%;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    ${({ $c }) => $c},
    ${({ $c }) => `${$c}70`}
  );
  box-shadow: 0 0 8px -2px ${({ $c }) => $c};
  transition: width var(--e-slow);
`;

/** 条尾白色端点标：读数位置比纯色条更容易定位 */
const Cap = styled.i<{ $c: string }>`
  position: absolute;
  top: -2px;
  right: 0;
  width: 3px;
  height: 10px;
  border-radius: 1px;
  background: #fff;
  opacity: 0.85;
  box-shadow: 0 0 6px ${({ $c }) => $c};
`;

const Pct = styled.span<{ $c: string }>`
  font-family: var(--font-mono);
  color: ${({ $c }) => $c};
  min-width: 34px;
  text-align: right;
`;

export interface GaugeItem {
  name: string;
  icon: IconName;
  /** 0–100 */
  value: number;
  color: string;
  /** 联动 key，通常是地市名；给 null 表示不参与联动 */
  linkKey?: string;
}

export function GaugeRows({
  items,
  max = 10,
}: {
  items: GaugeItem[];
  max?: number;
}) {
  const link = useLink();
  const [ref, cap] = useRowCap<HTMLDivElement>(24, max);
  const shown = items.slice(0, cap);
  return (
    <Rows ref={ref}>
      {shown.map((it) => (
        <GaugeRow
          key={it.name}
          $dim={!!link.key && !!it.linkKey && link.key !== it.linkKey}
          title={it.linkKey ? `${it.name} · ${it.value}%` : `${it.name} · ${it.value}%`}
        >
          <GaugeIc $c={it.color}>
            <Icon name={it.icon} size={13} />
          </GaugeIc>
          <GaugeName>{it.name}</GaugeName>
          <Track>
            <Fill $c={it.color} $w={it.value} />
            <Cap $c={it.color} />
          </Track>
          <Pct $c={it.color} className="num">
            {it.value}%
          </Pct>
        </GaugeRow>
      ))}
    </Rows>
  );
}

/* ══════════════ 3. AdviceList ══════════════ */

const AdviceRow = styled.div`
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: var(--sp-md);
  padding: 3px 0;
  border-bottom: 1px solid ${palette.lineSoft};
`;

const AdviceIc = styled.i<{ $tone: Tone }>`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  color: ${({ $tone }) =>
    $tone === "crit"
      ? palette.critical
      : $tone === "warn"
        ? palette.amber
        : palette.good};
  background: ${({ $tone }) =>
    $tone === "crit"
      ? `${palette.critical}24`
      : $tone === "warn"
        ? `${palette.amber}21`
        : `${palette.good}1f`};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "crit"
        ? `${palette.critical}57`
        : $tone === "warn"
          ? `${palette.amber}4d`
          : `${palette.good}47`};
`;

const AdviceBody = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const AdviceTitle = styled.b`
  font-size: var(--fs-micro);
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AdviceDesc = styled.span`
  font-size: 9.5px;
  line-height: 1.3;
  color: var(--c-text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export interface AdviceItem {
  icon: IconName;
  title: string;
  desc: string;
  /** pill 文字，如「紧急 / 高 / 中」 */
  level: string;
  tone: Tone;
}

export function AdviceList({
  items,
  max = 6,
}: {
  items: AdviceItem[];
  max?: number;
}) {
  const [ref, cap] = useRowCap<HTMLDivElement>(38, max);
  const shown = items.slice(0, cap);
  return (
    <Rows ref={ref}>
      {shown.map((a) => (
        <AdviceRow key={a.title}>
          <AdviceIc $tone={a.tone}>
            <Icon name={a.icon} size={12} />
          </AdviceIc>
          <AdviceBody>
            <AdviceTitle>{a.title}</AdviceTitle>
            <AdviceDesc>{a.desc}</AdviceDesc>
          </AdviceBody>
          <Tag tone={a.tone}>{a.level}</Tag>
        </AdviceRow>
      ))}
    </Rows>
  );
}

/* ══════════════ 4. DeltaBars ══════════════ */

const DeltaRow = styled.div<{ $dim: boolean }>`
  display: grid;
  grid-template-columns: 22px 44px 1fr 52px;
  align-items: center;
  gap: var(--sp-sm);
  padding: 4px 0;
  font-size: var(--fs-micro);
  border-bottom: 1px solid ${palette.lineSoft};
  cursor: pointer;
  ${dim}
`;

const Rank = styled.span<{ $m?: number }>`
  font-family: var(--font-mono);
  font-size: 9px;
  text-align: center;
  line-height: 15px;
  height: 15px;
  color: #2a1b04;
  background: ${({ $m }) =>
    $m === 1 ? "#FFD166" : $m === 2 ? "#C8D6E8" : $m === 3 ? "#D8955C" : "transparent"};
  border: 1px solid ${({ $m }) => ($m ? "transparent" : palette.line)};
  border-radius: 2px;
  ${({ $m }) =>
    $m
      ? css`
          font-weight: 700;
        `
      : css`
          color: ${palette.textFaint};
        `}
`;

const DeltaTrack = styled.span`
  height: 11px;
  position: relative;
  background: ${palette.lineSoft};
  border-radius: 2px;
`;

const DeltaBar = styled.i<{ $pos: boolean; $w: number }>`
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: ${({ $w }) => $w}%;
  border-radius: 1px;
  ${({ $pos }) =>
    $pos
      ? css`
          left: 50%;
          background: ${palette.good};
          box-shadow: 0 0 8px -2px ${palette.good};
        `
      : css`
          right: 50%;
          background: ${palette.critical};
          box-shadow: 0 0 8px -2px ${palette.critical};
        `}
`;

const Axis = styled.s`
  position: absolute;
  left: 50%;
  top: -1px;
  bottom: -1px;
  width: 1px;
  background: ${palette.lineStrong};
`;

const DeltaV = styled.span<{ $pos: boolean }>`
  font-family: var(--font-mono);
  text-align: right;
  color: ${({ $pos }) => ($pos ? palette.good : palette.critical)};
`;

export interface DeltaItem {
  name: string;
  /** 百分比变化 */
  pct: number;
}

export function DeltaBars({
  items,
  unit = "%",
  max: maxRows = 10,
}: {
  items: DeltaItem[];
  unit?: string;
  max?: number;
}) {
  const link = useLink();
  const scale = Math.max(...items.map((i) => Math.abs(i.pct)), 1);
  const [ref, cap] = useRowCap<HTMLDivElement>(25, maxRows);
  const shown = items.slice(0, cap);
  return (
    <Rows ref={ref}>
      {shown.map((it, i) => {
        const pos = it.pct >= 0;
        return (
          <DeltaRow
            key={it.name}
            $dim={!!link.key && link.key !== it.name}
            {...link.bind(it.name)}
          >
            <Rank $m={i < 3 ? i + 1 : undefined}>
              {i < 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][i] : String(i + 1).padStart(2, "0")}
            </Rank>
            <GaugeName>{it.name}</GaugeName>
            <DeltaTrack>
              <DeltaBar $pos={pos} $w={(Math.abs(it.pct) / scale) * 50} />
              <Axis />
            </DeltaTrack>
            <DeltaV $pos={pos} className="num">
              {pos ? "+" : "−"}
              {Math.abs(it.pct).toFixed(1)}
              {unit}
            </DeltaV>
          </DeltaRow>
        );
      })}
    </Rows>
  );
}

/* ══════════════ 5. HeatMatrix ══════════════ */

const Matrix = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const MatrixHead = styled.div`
  flex: none;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 3px;
  height: 12px;
`;

const HeadCells = styled.div`
  display: grid;
  gap: 3px;
  span {
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--c-text-faint);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
  }
`;

const MatrixRow = styled.div<{ $dim: boolean }>`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 3px;
  cursor: pointer;
  ${dim}
`;

const RowName = styled.span`
  font-size: 9.5px;
  color: var(--c-text-mute);
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
`;

const Cells = styled.div`
  display: grid;
  gap: 3px;
  min-height: 0;
`;

const Cell = styled.i<{ $c: string }>`
  border-radius: 1px;
  background: ${({ $c }) => $c};
  min-height: 0;
  transition: outline-color var(--e-base);
  outline: 1px solid transparent;

  &:hover {
    outline-color: ${palette.text};
  }
`;

/** 单色相热力色阶（深蓝 → 青），与地图共用一套 */
function heat(t: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [10, 27, 51]],
    [0.35, [20, 84, 127]],
    [0.65, [30, 154, 201]],
    [1, [123, 232, 255]],
  ];
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (x - t0) / (t1 - t0);
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
}

export function HeatMatrix({
  rows,
  cols,
  /** 返回 [色值, tooltip 文本] */
  cell,
}: {
  rows: string[];
  cols: string[];
  cell: (row: string, col: string) => [string, string];
}) {
  const link = useLink();
  return (
    <Matrix>
      <MatrixHead>
        <span />
        <HeadCells style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </HeadCells>
      </MatrixHead>
      {rows.map((r) => (
        <MatrixRow
          key={r}
          $dim={!!link.key && link.key !== r}
          {...link.bind(r)}
        >
          <RowName>{r}</RowName>
          <Cells style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
            {cols.map((c) => {
              const [color, tip] = cell(r, c);
              return <Cell key={c} $c={color} title={tip} />;
            })}
          </Cells>
        </MatrixRow>
      ))}
    </Matrix>
  );
}

export { heat, dim };
