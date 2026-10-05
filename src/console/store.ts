/**
 * 控制台共享状态
 * ------------------------------------------------------------------
 * 一份 store 驱动两条渲染管线：
 *   · 3D 地图读 hover/pinned/layers → 改变挤出高度、描边、标签、相机
 *   · 2D 面板读 hover/pinned       → 图表高亮/降透明、卡片联动、标题改写
 * 原项目每个 demo 各有一份 `stores/index.ts` 只存 boolean 图层开关，
 * 这里把它升级为"实体 + 联动 + 图层 + 入场状态"的统一模型。
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Group } from "three";
import { ALL_CITIES } from "./data";

/** 可开关的地图图层 */
export interface LayerFlags {
  heat: boolean;
  bar: boolean;
  cloud: boolean;
  rotation: boolean;
  labels: boolean;
  flyline: boolean;
}

export type LayerKey = keyof LayerFlags;

interface ConsoleState {
  /** 悬停中的城市名（null = 未悬停） */
  hover: string | null;
  /** 已锁定的城市名（null = 全省视角） */
  pinned: string | null;
  /** 入场动画是否播放过 —— 用于"重播" */
  introPlayed: boolean;
  /** 地图入场完成的信号，沿用原项目 mapPlayComplete 的语义 */
  mapReady: boolean;
  layers: LayerFlags;
  /** 地图根 group 的引用，供相机聚焦使用 */
  mapHandle: Group | null;

  setHover: (name: string | null) => void;
  setPinned: (name: string | null) => void;
  /** 锁定一个城市：已锁定同一家则解锁 */
  togglePin: (name: string | null) => void;
  clearScope: () => void;
  setIntroPlayed: (v: boolean) => void;
  setMapReady: (v: boolean) => void;
  toggleLayer: (key: LayerKey) => void;
  resetLayers: () => void;
  setMapHandle: (g: Group | null) => void;
  /** 统一重置：切换 demo 时调用 */
  reset: () => void;
}

const defaultLayers: LayerFlags = {
  heat: true,
  bar: true,
  cloud: true,
  rotation: true,
  labels: true,
  flyline: true,
};

const initial = {
  hover: null as string | null,
  pinned: null as string | null,
  introPlayed: false,
  mapReady: false,
  layers: defaultLayers,
  mapHandle: null as Group | null,
};

export const useConsole = create<ConsoleState>()(
  subscribeWithSelector((set) => ({
    ...initial,
    setHover: (hover) => set({ hover }),
    setPinned: (pinned) => set({ pinned }),
    togglePin: (name) =>
      set((s) => ({ pinned: s.pinned === name ? null : name })),
    clearScope: () => set({ pinned: null }),
    setIntroPlayed: (introPlayed) => set({ introPlayed }),
    setMapReady: (mapReady) => set({ mapReady }),
    toggleLayer: (key) =>
      set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
    resetLayers: () => set({ layers: defaultLayers }),
    setMapHandle: (mapHandle) => set({ mapHandle }),
    reset: () => set(initial),
  }))
);

/** 当前生效的联动实体：hover 优先于 pinned */
export function useLinkEntity(): string | null {
  return useConsole((s) => s.hover ?? s.pinned);
}

/** 是否处于"非全省"的下钻态 */
export function useIsDrilled(): boolean {
  return useConsole((s) => s.pinned !== null);
}

export { ALL_CITIES };