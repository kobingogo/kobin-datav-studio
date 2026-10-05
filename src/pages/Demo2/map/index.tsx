import { Suspense } from "react";
import styled from "styled-components";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Lights from "./lights";
import Mirror from "./mirror";
import Base from "./base";
import Bottom from "./bottom";
import BeamLight from "./beamLight";
import { palette } from "@/theme/tokens";

import { cityGeoJSON, outlineGeoJSON } from "@/geo";

const mapData = cityGeoJSON,
  outlineData = outlineGeoJSON;

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

/**
 * Canvas 配置
 * ------------------------------------------------------------------
 * 原版是纯黑背景 + fog(10,30) 的近景黑雾，地图之外没有任何层次，
 * 底座与背景之间出现明显接缝。改为：
 *   · 背景用 token 的 canvas 色，与面板表面同源
 *   · fog 拉远到与地图尺度匹配的区间，只做轻微空气衰减
 *   · OrbitControls 打开阻尼，避免拖拽后地图"突然停住"
 */
export default function Map() {
  return (
    <CanvasWrapper>
      <Canvas
        camera={{
          fov: 46,
          position: [-2.0, 7.6, 11.6],
        }}
        dpr={[1, 2]}>
        <fog attach="fog" args={[palette.canvas, 13, 34]} />
        <color attach="background" args={[palette.canvas]} />
        <Lights />
        <Suspense fallback={null}>
          <Base data={mapData} outlineData={outlineData} />
        </Suspense>
        <Bottom />
        <Mirror />
        <BeamLight />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          zoomSpeed={0.4}
          rotateSpeed={0.5}
          minDistance={7}
          maxDistance={24}
          minPolarAngle={0.3}
          maxPolarAngle={1.42}
        />
      </Canvas>
    </CanvasWrapper>
  );
}