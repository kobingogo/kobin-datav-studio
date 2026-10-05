import { Suspense } from "react";
import styled from "styled-components";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Lights from "./lights";
import Scene from "./scene";

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

/**
 * Canvas 配置调整
 * ------------------------------------------------------------------
 * · background 从米白改为深空底色，与新 UI 的表面色对齐
 * · 相机初始机位设为新方案的默认取景，OrbitControls 加上阻尼，
 *   让手动旋转有惯性，松手后自然停住（原来 enableDamping 是关的）
 * · maxPolarAngle 收紧，避免钻到地底看到空背面
 */
export default function Index() {
  return (
    <CanvasWrapper>
      <Canvas
        flat
        shadows
        camera={{ position: [-46, 168, 288], fov: 46, far: 2000, near: 1 }}
        dpr={[1, 2]}>
        <color attach="background" args={["#070b14"]} />
        <fog attach="fog" args={["#070b14", 420, 900]} />
        <Lights />

        <Suspense fallback={null}>
          <Scene />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.08}
          zoomSpeed={0.4}
          rotateSpeed={0.5}
          minDistance={130}
          maxDistance={380}
          minPolarAngle={0.35}
          maxPolarAngle={1.42}
        />
      </Canvas>
    </CanvasWrapper>
  );
}