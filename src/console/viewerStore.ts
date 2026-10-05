/**
 * 模型查看器状态
 * ------------------------------------------------------------------
 * Demo3 原本把"拆解/还原"挂在 leva 的 checkbox 上 —— 那是开发期调试面板，
 * 产品界面里用户根本不知道有这个功能，也没有快捷键、没有状态提示。
 *
 * 这里把可交互的状态提到 store，由正式的控件组件消费。
 * 与 demo1/demo2 用的 useConsole 分开：模型查看器没有"省市联动"这层语义，
 * 硬塞进同一个 store 只会把两件事搅在一起。
 */
import { create } from "zustand";

export interface ViewerState {
  /** 拆解展开 */
  explode: boolean;
  /** 线框 */
  wireframe: boolean;
  /** 自动旋转 */
  spin: boolean;
  /** 当前悬停的部件名，null = 未悬停 */
  hoverPart: string | null;
  /** 部件总数，用于 HUD 展示 */
  partCount: number;
  /** 视角重置的触发计数：自增即触发一次相机复位 */
  resetTick: number;

  setExplode: (v: boolean) => void;
  setWireframe: (v: boolean) => void;
  setSpin: (v: boolean) => void;
  setHoverPart: (v: string | null) => void;
  setPartCount: (n: number) => void;
  resetView: () => void;
}

export const useViewer = create<ViewerState>()((set) => ({
  explode: false,
  wireframe: false,
  spin: true,
  hoverPart: null,
  partCount: 0,
  resetTick: 0,

  setExplode: (explode) => set({ explode }),
  setWireframe: (wireframe) => set({ wireframe }),
  setSpin: (spin) => set({ spin }),
  setHoverPart: (hoverPart) => set({ hoverPart }),
  setPartCount: (partCount) => set({ partCount }),
  /** 自增 resetTick 作为"复位视角"的信号；相机侧 useEffect 监听它 */
  resetView: () => set((s) => ({ resetTick: s.resetTick + 1 })),
}));