import { Suspense, useEffect } from "react";
import styled from "styled-components";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Grid,
  OrbitControls,
  Stage,
  useEnvironment,
} from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { gsap } from "gsap";
import TopBar from "@/console/components/TopBar";
import ViewerDock from "./viewerDock";
import { useViewer } from "@/console/viewerStore";
import { palette } from "@/theme/tokens";
import Model from "./model";

/* 资源路径统一走 BASE_URL：改 vite 的 base 时不必再逐处改硬编码前缀 */
const HDR = `${import.meta.env.BASE_URL}hdr/venice_sunset_1k.hdr`;

useEnvironment.preload({ files: HDR });

const Wrapper = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: ${palette.void};
`;

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

/** 收拢态的机位 */
const HOME = { x: -10, y: 5, z: 12 };
/**
 * 拆解态的机位：沿轴展开后模型纵向长了近一倍，
 * 不退相机的话右端会直接冲出画面（实测确实冲出去了）。
 */
const EXPLODED = { x: -16, y: 6.5, z: 19 };

/**
 * 相机：拆解 / 收拢之间平滑切换机位，并响应"复位视角"。
 * 放在 Canvas 内是因为需要 useThree 拿相机。
 */
function CameraDirector() {
  const camera = useThree((s) => s.camera);
  const tick = useViewer((s) => s.resetTick);
  const explode = useViewer((s) => s.explode);

  useEffect(() => {
    // tick 初始为 0，此时不干预首次取景
    if (tick) {
      const home = gsap.to(camera.position, {
        ...HOME,
        duration: 0.8,
        ease: "power3.inOut",
      });
      return () => {
        home.kill();
      };
    }
  }, [tick, camera]);

  useEffect(() => {
    const tween = gsap.to(camera.position, {
      ...(explode ? EXPLODED : HOME),
      duration: 0.9,
      ease: "power3.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [explode, camera]);

  return null;
}

/** 悬停部件的浮层提示 */
const PartTag = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, 168px);
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  color: var(--c-cyan);
  border: 1px solid var(--c-cyan-deep);
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(8px);
  z-index: 12;
  pointer-events: none;
  white-space: nowrap;
`;

export default function Demo3() {
  const hoverPart = useViewer((s) => s.hoverPart);

  return (
    <>
      <Wrapper>
        <CanvasWrapper>
          <Canvas shadows dpr={[1, 2]} camera={{ position: [-10, 5, 12], fov: 25 }}>
            {/* HDRI 只做环境光照，不再当背景。
                原实现加了 `background`，整个场景被 HDRI 的灰色铺满，
                与深空体系脱节，也看不到栅格的透视参照。 */}
            <color attach="background" args={[palette.void]} />
            <fog attach="fog" args={[palette.void, 22, 60]} />

            <Suspense fallback={null}>
              <Stage
                intensity={0.5}
                shadows={{ type: "accumulative", bias: -0.001, intensity: Math.PI }}
                center={{ disableZ: true }}
                adjustCamera={false}
                environment={null}>
                <Model />
              </Stage>
            </Suspense>

            {/* 栅格颜色取 token。
                原值 `new Color(0.5, 0.5, 10)` 第四个参数根本不存在，
                b=10 越界后被钳制，栅格因此泛紫。 */}
            <Grid
              position={[0, -1.4, 0]}
              args={[40, 40]}
              cellSize={0.6}
              cellThickness={0.6}
              sectionSize={3.3}
              sectionThickness={1.2}
              cellColor={palette.line}
              sectionColor={palette.cyanDeep}
              fadeDistance={30}
              fadeStrength={1.9}
              infiniteGrid
              renderOrder={-1}
              followCamera={false}
            />

            <ContactShadows
              position={[0, -1.38, 0]}
              opacity={0.45}
              scale={26}
              blur={2.4}
              far={7}
              resolution={512}
              color="#000000"
            />

            <EffectComposer>
              <Bloom
                disableNormalPass
                luminanceThreshold={1.9}
                luminanceSmoothing={0.3}
                mipmapBlur
                intensity={0.5}
              />
              <ToneMapping />
            </EffectComposer>

            <Environment
              blur={0.8}
              files={HDR}
            />

            <CameraDirector />
            <OrbitControls
              enablePan={false}
              enableZoom
              enableRotate
              enableDamping
              dampingFactor={0.08}
              minDistance={6}
              maxDistance={26}
              minPolarAngle={Math.PI / 5}
              maxPolarAngle={Math.PI / 1.9}
              makeDefault
            />
          </Canvas>
        </CanvasWrapper>

        <TopBar
          title="航空发动机三维模型查看器"
          subtitle="Turbine Model Viewer"
        />

        {hoverPart && <PartTag>{hoverPart}</PartTag>}

        <ViewerDock />
      </Wrapper>
    </>
  );
}
