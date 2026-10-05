import { Suspense } from "react";
import styled from "styled-components";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import Scene, { CameraIntro } from "./scene";
import { palette } from "../../../theme/tokens";

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

/**
 * Canvas 包装 —— 与 demo1/demo2 同一套约定（index 只负责 Canvas，scene 放内容）。
 * 相机初始机位设为入场动画的起点，OrbitControls 开阻尼。
 */
export default function Index() {
  return (
    <CanvasWrapper>
      <Canvas
        flat
        shadows
        camera={{ position: [-34, 96, 205], fov: 46, far: 2000, near: 1 }}
        dpr={[1, 2]}>
        <color attach="background" args={[palette.void]} />
        <fog attach="fog" args={[palette.void, 300, 760]} />
        <Stars
          radius={80}
          depth={40}
          count={500}
          factor={2}
          saturation={0}
          fade
          speed={0.25}
        />
        <ambientLight intensity={0.5} />
        <directionalLight
          intensity={2.2}
          position={[0, 200, 60]}
          color={palette.cyanSoft}
        />
        <directionalLight
          intensity={0.8}
          position={[-120, 80, -80]}
          color={palette.indigo}
        />

        <CameraIntro />
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
          minDistance={120}
          maxDistance={380}
          minPolarAngle={0.3}
          maxPolarAngle={1.45}
        />
      </Canvas>
    </CanvasWrapper>
  );
}