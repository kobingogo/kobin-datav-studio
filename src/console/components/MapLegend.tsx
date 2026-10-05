/**
 * MapLegend —— 地图图例
 * ------------------------------------------------------------------
 * 原项目两个 demo 都没有图例：地图上叠着热力图和柱体，
 * 用户无从判断颜色深浅代表数值高低。把"数值 → 颜色"的映射显式画出来。
 */
import styled from "styled-components";
import { palette } from "@/theme/tokens";

const Root = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  padding: 5px 10px;
  border: 1px solid ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  white-space: nowrap;
`;

const Label = styled.div`
  font-size: var(--fs-kicker);
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-faint);
`;

const Ramp = styled.div<{ $colors: readonly string[] }>`
  width: 76px;
  height: 5px;
  border-radius: 1px;
  background: linear-gradient(
    90deg,
    ${({ $colors }) => $colors.join(", ")}
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
`;

const Scale = styled.div`
  display: flex;
  gap: 4px;
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding-left: var(--sp-sm);
  border-left: 1px solid ${palette.lineSoft};
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
`;

const Dot = styled.span<{ $c: string }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
  box-shadow: 0 0 5px ${({ $c }) => $c};
  flex: none;
`;

export default function MapLegend({
  colors = palette.heat,
  min,
  max,
  unit,
  caption = "指标密度",
}: {
  colors?: readonly string[];
  min: number;
  max: number;
  unit: string;
  caption?: string;
}) {
  return (
    <Root>
      <Label>{caption}</Label>
      <Ramp $colors={colors} />
      <Scale>
        <span className="num">{min}</span>
        <span style={{ color: palette.textFaint }}>{unit}</span>
        <span className="num">{max}</span>
      </Scale>
      <Foot>
        <Dot $c={palette.cyan} />
        悬停查看 · 点击下钻
      </Foot>
    </Root>
  );
}