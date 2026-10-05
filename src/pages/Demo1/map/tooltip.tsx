import { Html } from "@react-three/drei";
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import styled from "styled-components";
import { useConsole } from "../../../console/store";
import { getCity, fmt } from "../../../console/data";
import { palette } from "@/theme/tokens";

/**
 * 城市悬浮详情
 * ------------------------------------------------------------------
 * 原项目用 imperativeHandle 的 open()/close() 在 hover 时挂载，
 * 数据只有 3 个字段（人口/GDP/面积），字号 12px、颜色 #656565
 * —— 在米白场景里勉强可读，视觉上却是一块浅色玻璃，与周围橙色系割裂。
 * 改为订阅 store 的 hover 状态，并补齐为一份"可直接做判断"的指标摘要：
 * 主指标 + 同比 + 在全省位次。
 */
const Box = styled.div`
  position: relative;
  width: 232px;
  padding: var(--sp-md) var(--sp-lg);
  background: rgba(7, 11, 20, 0.92);
  border: 1px solid ${palette.cyanDeep};
  border-radius: 2px;
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  font-size: var(--fs-small);
  color: var(--c-text-dim);
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-md);
  padding-bottom: var(--sp-sm);
  margin-bottom: var(--sp-sm);
  border-bottom: 1px solid ${palette.lineSoft};
`;

const Name = styled.strong`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-text);
`;

const Rank = styled.span`
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  color: ${palette.textMute};

  b {
    color: ${palette.cyan};
    font-weight: 600;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-lg);
  padding: 3px 0;

  span {
    color: var(--c-text-mute);
  }
`;

const Val = styled.span<{ $accent?: boolean; $up?: boolean }>`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-md);
  font-weight: 600;
  color: ${({ $accent, $up }) =>
    $accent ? palette.cyan : $up === undefined ? palette.text : $up ? palette.good : palette.critical};
`;

const Bar = styled.div`
  margin-top: var(--sp-sm);
  height: 2px;
  border-radius: 1px;
  background: ${palette.line};
  overflow: hidden;
`;

const BarFill = styled.div<{ $w: number; $c: string }>`
  height: 100%;
  width: ${({ $w }) => $w}%;
  background: ${({ $c }) => $c};
  transition: width var(--e-slow);
`;

interface TooltipProps {
  ref?: Ref<{ open: () => void; close: () => void }>;
  city: string;
  position: [number, number, number];
  visible: boolean;
}

const METRICS = [
  { key: "gdp", label: "GDP", color: palette.cyan },
  { key: "population", label: "人口", color: palette.indigo },
  { key: "enterprises", label: "企业", color: palette.good },
  { key: "energy", label: "能耗", color: palette.amber },
] as const;

export default function Tooltip(props: TooltipProps) {
  const { city, position, visible } = props;
  const hover = useConsole((s) => s.hover);
  const [open, setOpen] = useState(false);

  // 兼容旧的 imperative 调用方式，同时以 store 为准
  useImperativeHandle(props.ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  useEffect(() => {
    setOpen(hover === city || visible);
  }, [hover, city, visible]);

  if (!open || !city) return null;

  const m = getCity(city);

  return (
    <Html
      center
      position={position}
      zIndexRange={[1400, 1500]}
      style={{ pointerEvents: "none" }}
      /* 不设 distanceFactor：三维里的 HUD 面板应保持恒定像素尺寸，
         跟随距离缩放会让远景 tooltip 小到无法阅读 */
    >
      <Box>
        <Head>
          <Name>{city}</Name>
          <Rank>
            活跃度 <b>{m.score}</b>/100
          </Rank>
        </Head>

        {METRICS.map((k) => (
          <Row key={k.key}>
            <span>{k.label}</span>
            <Val>
              {k.key === "gdp"
                ? fmt.moneyShort(m.gdp)
                : k.key === "population"
                  ? fmt.int(m.population) + " 万"
                  : k.key === "enterprises"
                    ? fmt.int(m.enterprises)
                    : fmt.dec(m.energy)}
            </Val>
          </Row>
        ))}

        <Row>
          <span>同比</span>
          <Val $up={m.growth >= 0}>{fmt.pct(m.growth)}</Val>
        </Row>

        {METRICS.slice(0, 2).map((k) => {
          const v = k.key === "gdp" ? m.gdp / 1e12 : m.population / 2100;
          return (
            <Bar key={"bar-" + k.key}>
              <BarFill $w={Math.min(100, v * 100)} $c={k.color} />
            </Bar>
          );
        })}
      </Box>
    </Html>
  );
}