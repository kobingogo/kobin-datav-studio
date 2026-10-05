/**
 * 3D 侧的联动适配层
 * ------------------------------------------------------------------
 * 原项目每个 demo 的每个 city 组件都手写一遍：
 *   onPointerOver → vector3.current.setZ(1.5); tooltipRef.current.open();
 *   onPointerOut  → vector3.current.setZ(1);   tooltipRef.current.close();
 *   useFrame(() => groupRef.current.scale.lerp(vector3.current, 0.1));
 * 而且只做了"长高"，没有点击、没有与 2D 面板的联动。
 *
 * 这里抽成两个 hook：
 *   useCityInteract(name)  返回 { hoverProps, clickProps, targetScale }
 *                           目标高度同时受"悬停"和"已锁定"驱动，
 *                           并把事件广播到 store 供面板消费。
 *   useCameraFocus(mapHandle) 锁定城市时把相机推向该市，并恢复默认视角。
 */
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { Vector3 } from "three";
import { useConsole } from "./store";

export interface CityInteract {
  /** 展开到 three 的事件绑定 */
  handlers: {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut: () => void;
    onClick: (e: ThreeEvent<MouseEvent>) => void;
  };
  /** 每帧 lerp 到的目标缩放：锁定 1.55 > 悬停 1.25 > 常态 1 */
  target: { z: number };
}

/**
 * @param name 城市名，同时作为联动 key
 * @param boost 常态 Z 基准（部分 demo 的挤出体本身有厚度）
 */
export function useCityInteract(name: string, boost = 1): CityInteract {
  const hover = useConsole((s) => s.hover);
  const pinned = useConsole((s) => s.pinned);
  const setHover = useConsole((s) => s.setHover);
  const togglePin = useConsole((s) => s.togglePin);

  const z = useMemo(() => {
    if (pinned === name) return boost * 1.55;
    if (hover === name) return boost * 1.25;
    return boost;
  }, [hover, pinned, name, boost]);

  const target = useMemo(() => ({ z }), [z]);

  const handlers = useMemo(
    () => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(name);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        // 只有当 store 里的悬停项仍是本城市时才清空，
        // 避免"从 A 划到 B"时 A 的 onPointerOut 把 B 的状态抹掉
        if (useConsole.getState().hover === name) setHover(null);
        document.body.style.cursor = "auto";
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        togglePin(name);
      },
    }),
    [name, setHover, togglePin]
  );

  return { handlers, target };
}

/**
 * 相机聚焦：锁定某个市时把相机推近并偏移到该市方向；
 * 清除锁定时回到初始机位。用 GSAP 与地图入场动画同一套节奏。
 */
export function useCameraFocus(
  basePosition: [number, number, number],
  /** 城市 → 地图局部坐标（XZ 平面上的偏移） */
  resolveOffset: (name: string) => [number, number] | null
) {
  const camera = useThree((s) => s.camera);
  const pinned = useConsole((s) => s.pinned);
  const mapHandle = useConsole((s) => s.mapHandle);

  useEffect(() => {
    const target = new Vector3(...basePosition);

    if (pinned) {
      const off = resolveOffset(pinned);
      if (off) {
        const [ox, oz] = off;
        // 相机向该市方向平移，并适度拉近，形成"聚焦但不丢失全局"的取景
        target.set(
          basePosition[0] + ox * 0.55,
          basePosition[1] * 0.86,
          basePosition[2] + oz * 0.55
        );
      }
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const tween = gsap.to(camera.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: reduce ? 0 : 1.1,
      ease: "power3.inOut",
      overwrite: true,
    });

    return () => {
      tween.kill();
    };
  }, [camera, pinned, mapHandle, basePosition, resolveOffset]);
}

/** 让退出/切换 demo 时 store 回到初始态 */
export function useConsoleReset() {
  const reset = useConsole((s) => s.reset);
  useEffect(() => reset, [reset]);
}