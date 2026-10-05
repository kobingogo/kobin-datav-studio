/**
 * ConsoleFrame —— 控制台外壳
 * ------------------------------------------------------------------
 * 替换原项目 `panel/index.tsx` 里这套重复样板：
 *   const topBox = useMoveTo("toBottom", 0.6)
 *   const leftBox = useMoveTo("toRight", 0.8, 0.5)  // ×3
 *   const rightBox = useMoveTo("toLeft", 0.8, 0.5)  // ×3
 *   useEffect(() => { subscribe(mapPlayComplete, 全部 restart) }, [])
 *   <Card ref={leftBox.ref} style={{ gridArea: "1 / 1 / 3 / 2" }}>
 * 每个 demo 都要抄一遍，且 gridArea 硬编码导致布局完全不可变。
 *
 * 新方案：
 *   · 布局用 CSS grid 的 `grid-template-areas` 语义化命名 + minmax，
 *     左右栏各自 flex 分配，不再有魔法数字行列
 *   · 入场编排收敛到一处：容器上打 data-panel，子元素统一被 GSAP
 *     按 stagger 波次推入；由 mapReady 信号触发，可重播
 *   · 尊重 prefers-reduced-motion
 */
import {
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import styled from "styled-components";
import { gsap } from "gsap";
import { useConsole } from "../store";
import { palette } from "@/theme/tokens";

const Root = styled.div<{ $hidden?: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  z-index: 100;
  /* 纯净模式：面板整体淡出，只留地图 */
  opacity: ${({ $hidden }) => ($hidden ? 0 : 1)};
  transition: opacity var(--e-base);
`;

const Columns = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 22vw) 1fr minmax(280px, 22vw);
  gap: var(--sp-lg);
  padding: 0 var(--sp-xl) 64px;
`;

/**
 * 栏内槽位。
 * 原来这里是个没有 flex 属性的裸 <div>，默认 flex: 0 1 auto ——
 * 卡片按**内容高度**排，而不是按可用高度分配。后果是：需要固定画布的
 * 图形类面板撑不满，而行数多的列表类面板会溢出。
 *
 * 改为显式 flex-grow，权重默认 1（等分），需要高度的图形可声明更大权重。
 */
const Slot = styled.div<{ $w: number }>`
  flex: ${({ $w }) => $w} 1 0;
  min-height: 0;
  min-width: 0;
  display: flex;

  > * {
    flex: 1;
    min-width: 0;
  }
`;

/** 槽位内容：直接给节点，或给 { node, weight } */
export type SlotSpec =
  | React.ReactNode
  | { node: React.ReactNode; weight?: number };

function splitSlot(s: SlotSpec): { node: React.ReactNode; weight: number } {
  if (s && typeof s === "object" && !isValidElement(s) && "node" in s) {
    const t = s as { node: React.ReactNode; weight?: number };
    return { node: t.node, weight: t.weight ?? 1 };
  }
  return { node: s as React.ReactNode, weight: 1 };
}

const Rail = styled.div<{ $dim?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: var(--sp-lg);
  min-height: 0;
  transition:
    opacity var(--e-base),
    transform var(--e-slow);

  /* 抽屉展开时右栏让位：左移 + 降透明，
     避免两套信息在同一块区域互相干扰（抽屉里已有同口径的明细） */
  transform: ${({ $dim }) => ($dim ? "translateX(-28px)" : "none")};
  opacity: ${({ $dim }) => ($dim ? 0.18 : 1)};
  pointer-events: ${({ $dim }) => ($dim ? "none" : "auto")};

  /* 注意：这里不要写 "> * { flex: 1 }"。它与 Slot 自身的 flex 同特异性
     （都是单类选择器）却排在后面，会把权重直接覆盖成等分 ——
     实测权重写了 2 / 1.3 / 1.4，渲染出来全是 flex-grow: 1。
     flex 归属 Slot 自己，这里只补它没管的 display / min-height。 */
  > * {
    min-height: 0;
    display: flex;
  }
`;

const Center = styled.div`
  min-width: 0;
  min-height: 0;
  position: relative;
`;

export interface ConsoleFrameProps {
  /** 顶栏 */
  header?: ReactNode;
  /** KPI 带 */
  kpis?: ReactNode;
  /** 左栏卡片（自上而下） */
  /** 栏内槽位：直接给节点，或给 { node, weight } 指定高度权重 */
  left: SlotSpec[];
  /** 右栏卡片（自上而下） */
  right: SlotSpec[];
  /** 浮层：图例、图层控件等 */
  overlays?: ReactNode;
  /** 纯净模式：隐藏全部面板 */
  hidden?: boolean;
}

const mark = (side: string) => ({
  "data-panel": "",
  "data-panel-side": side,
});

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function ConsoleFrame({
  header,
  kpis,
  left,
  right,
  overlays,
  hidden = false,
}: ConsoleFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapReady = useConsole((s) => s.mapReady);
  const introPlayed = useConsole((s) => s.introPlayed);
  const setIntroPlayed = useConsole((s) => s.setIntroPlayed);

  /* 入场编排：一次订阅 + 一次 stagger，替代每个 demo 抄一遍的样板 */
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        gsap.set("[data-panel]", { clearProps: "all", opacity: 1 });
        return;
      }
      // 每张卡按自己所在的一侧决定位移方向：左栏从左推入，右栏从右推入
      gsap.fromTo(
        "[data-panel]",
        {
          opacity: 0,
          x: (_i: number, el: Element) => {
            const side = (el as HTMLElement).dataset.panelSide;
            return side === "left" ? -28 : side === "right" ? 28 : 0;
          },
          y: (_i: number, el: Element) => {
            const side = (el as HTMLElement).dataset.panelSide;
            return side === "top" ? -28 : side === "bottom" ? 28 : 0;
          },
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "power3.out",
          stagger: { each: 0.06 },
          overwrite: true,
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [mapReady, introPlayed]);

  useEffect(() => {
    if (mapReady && !introPlayed) setIntroPlayed(true);
  }, [mapReady, introPlayed, setIntroPlayed]);

  const drawerOpen = !!useConsole((s) => s.pinned);

  return (
    <Root ref={rootRef} $hidden={hidden}>
      {header && <div {...mark("top")}>{header}</div>}
      {kpis && <div {...mark("top")}>{kpis}</div>}
      <Columns>
        <Rail>
          {left.map((spec, i) => {
            const { node, weight } = splitSlot(spec);
            return (
              <Slot key={i} $w={weight} data-w={weight} {...mark("left")}>
                {node}
              </Slot>
            );
          })}
        </Rail>
        <Center />
        <Rail $dim={drawerOpen}>
          {right.map((spec, i) => {
            const { node, weight } = splitSlot(spec);
            return (
              <Slot key={i} $w={weight} data-w={weight} {...mark("right")}>
                {node}
              </Slot>
            );
          })}
        </Rail>
      </Columns>
      {overlays}
    </Root>
  );
}

/** 供卡片挂载时声明自己在哪一侧（决定入场方向） */
export const panelSide = mark;

export const frameTokens = { palette };