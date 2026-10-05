/**
 * LayerDock —— 图层控制
 * ------------------------------------------------------------------
 * 替换原项目底部 5 个纯图标按钮：
 *   · 纯图标无法推断行为（云？旋转？模式？）→ 每项带文字标签
 *   · 没有 tooltip 解释 → 加 title 说明当前态与将切换到的态
 *   · active 态靠"变大+变色"，语义方向相反 → 改为明确的 on/off 视觉：
 *     开 = 青色实心指示点 + 文字亮；关 = 空心灰点 + 文字降透明
 *   · 没有重置 → 加一键重置
 * 形态从"居中悬浮按钮排"改为贴左下角的分段控件，不与地图中心争夺注意力。
 */
import styled from "styled-components";
import { useConsole, type LayerKey } from "../store";
import { palette } from "@/theme/tokens";

const Root = styled.div`
  position: absolute;
  left: 50%;
  bottom: var(--sp-md);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  z-index: 3;
  pointer-events: auto;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-lg);
`;

const Label = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  white-space: nowrap;
  font-size: var(--fs-kicker);
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--c-text-faint);
`;

const Bar = styled.div`
  flex: none;
  display: flex;
  align-items: stretch;
  border: 1px solid ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(10px);
  overflow: hidden;
`;

const Item = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  white-space: nowrap;
  font-size: var(--fs-micro);
  color: ${({ $on }) => ($on ? palette.cyanSoft : palette.textFaint)};
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.07)" : "transparent")};
  border-right: 1px solid ${palette.lineSoft};
  transition:
    color var(--e-fast),
    background var(--e-fast);

  &:last-of-type {
    border-right: none;
  }

  &:hover {
    color: ${palette.cyan};
    background: rgba(79, 209, 255, 0.09);
  }
`;

const Led = styled.span<{ $on: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: ${({ $on }) => ($on ? palette.cyan : "transparent")};
  border: 1px solid
    ${({ $on }) => ($on ? palette.cyan : palette.lineStrong)};
  box-shadow: ${({ $on }) => ($on ? `0 0 6px ${palette.cyan}` : "none")};
  transition: all var(--e-fast);
`;

const Reset = styled.button`
  flex: none;
  white-space: nowrap;
  overflow: visible;
  margin-left: var(--sp-sm);
  padding: 2px 8px;
  font-size: var(--fs-kicker);
  font-family: var(--font-mono);
  letter-spacing: 0.14em;
  color: var(--c-text-faint);
  border: 1px solid transparent;
  border-radius: 2px;
  transition:
    color var(--e-fast),
    border-color var(--e-fast);

  &:hover {
    color: var(--c-amber);
    border-color: var(--c-line-strong);
  }
`;

interface LayerMeta {
  key: LayerKey;
  label: string;
  desc: string;
}

const LAYERS: LayerMeta[] = [
  { key: "heat", label: "热力", desc: "指标密度热力图" },
  { key: "bar", label: "柱体", desc: "城市指标立体柱" },
  { key: "flyline", label: "飞线", desc: "城市间流向飞线" },
  { key: "labels", label: "标注", desc: "城市名三维标注" },
  { key: "rotation", label: "底座", desc: "旋转底座与光环" },
  { key: "cloud", label: "云层", desc: "高空的流动云层" },
];

export default function LayerDock({
  only,
  children,
}: {
  only?: LayerKey[];
  /** 可选：与图层条并排的附加控件（如地图图例） */
  children?: React.ReactNode;
}) {
  const layers = useConsole((s) => s.layers);
  const toggleLayer = useConsole((s) => s.toggleLayer);
  const resetLayers = useConsole((s) => s.resetLayers);

  const items = only ? LAYERS.filter((l) => only.includes(l.key)) : LAYERS;
  if (!items.length) return null;

  return (
    <Root>
      <Group>
        <Label>Layers</Label>
        <Bar>
          {items.map((l) => {
            const on = layers[l.key];
            return (
              <Item
                key={l.key}
                $on={on}
                onClick={() => toggleLayer(l.key)}
                title={`${l.desc} —— 点击${on ? "关闭" : "开启"}`}
                aria-pressed={on}
              >
                <Led $on={on} />
                {l.label}
              </Item>
            );
          })}
        </Bar>
        <Reset onClick={resetLayers} title="恢复全部图层">
          RESET
        </Reset>
      </Group>
      {children}
    </Root>
  );
}