import { useLayoutEffect, useMemo } from "react";
import { Center } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useConsole } from "../../../console/store";
import BaseMap from "./baseMap";
import OutLine from "./outline";
import FlyLine from "./flyLine";

import { cityGeoJSON, createProjection } from "@/geo";

const data = cityGeoJSON;

/**
 * 场景内容（必须在 Canvas 内渲染）
 * ------------------------------------------------------------------
 * 原 Demo0 把 <Canvas> 写在 demo.tsx 里，这个文件只是场景内容，
 * 与 demo1/demo2 的 `map/index.tsx`（Canvas 包装）职责不同。
 * 改造时若直接照抄 demo1 的结构，`useThree` 会在 Canvas 外被调用，
 * 整页抛 "Hooks can only be used within the Canvas component" 而白屏。
 * 现在按 demo1 的约定拆成 index.tsx（Canvas 包装）+ scene.tsx（内容）。
 */
export default function Scene() {
  /* scale 由 bbox 反算，三个 demo 共用同一构图宽度，
     换省时相机机位不必重新试。 */
  const projection = useMemo(() => createProjection(data), []);

  return (
    <Center top>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <BaseMap projection={projection} />
        <OutLine projection={projection} />
        <FlyLine projection={projection} />
      </group>
    </Center>
  );
}

/**
 * 相机推入 + 入场信号。
 * 终点与 demo1 对齐（fov 46 / y 168），否则两个页面之间切换时地图取景会跳一下。
 * 入场完成写 mapReady，ConsoleFrame 据此触发面板波次入场 ——
 * 原来 Demo0 的面板是自己 restart() 的，与地图动画没有可靠关联。
 */
export function CameraIntro() {
  const camera = useThree((s) => s.camera);
  const setMapReady = useConsole((s) => s.setMapReady);

  useLayoutEffect(() => {
    const tween = gsap.fromTo(
      camera.position,
      { x: -34, y: 96, z: 205 },
      {
        x: -8,
        y: 134,
        z: 168,
        duration: 2,
        ease: "circ.out",
        onComplete: () => setMapReady(true),
      }
    );
    return () => {
      tween.kill();
      setMapReady(false);
    };
  }, [camera, setMapReady]);

  return null;
}