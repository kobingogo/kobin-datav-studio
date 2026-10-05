import { use, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Mesh,
} from "three";
import { useConsole } from "../../../console/store";
import loadTexture from "../helpers/loadTexture";

import guangquan01 from "@/assets/guangquan01.png";
import huiguang from "@/assets/huiguang.png";
import { palette } from "../../../theme/tokens";

export interface CityBarProps {
  position?: ThreeElements["group"]["position"];
  value?: number;
  /** 柱体主色，来自 design token */
  color?: string;
  /** 选中态加粗 */
  emphasized?: boolean;
  dir?: "x" | "y" | "z";
  factor?: number;
  max?: number;
  children?: React.ReactNode | ((barHeight: number) => React.ReactNode);
}

const textures = Promise.all([
  loadTexture(guangquan01),
  loadTexture(huiguang, (tex) => {
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
  }),
]);

/**
 * 指标柱
 * ------------------------------------------------------------------
 * 原版柱体是橙→米黄渐变（uColor1 #fbdf88 / uColor2 #ea580c），
 * 与新 UI 的青色主色不统一。改为从 token 取色：
 * 常态主色为青，柱脚更深、柱顶更亮，配合底座光环形成统一的冷色体系。
 */
export default function Bar(props: CityBarProps) {
  const {
    position,
    value = 500,
    children,
    color = palette.cyan,
    emphasized = false,
    dir = "y",
    factor = 5,
    max = 2100,
  } = props;

  const dirMap = { x: 1.0, y: 2.0, z: 3.0 };
  const quanRef = useRef<Mesh>(null!);
  const meshRef = useRef<InstancedMesh>(null!);
  const barVisible = useConsole((s) => s.layers.bar);

  const [texture1, texture2] = use(textures);

  const barHeight = useMemo(
    () => 4.0 * factor * (value / max),
    [value, factor, max]
  );

  const colors = useMemo(() => {
    const c = new Color(color);
    const foot = c.clone().multiplyScalar(0.35);
    const top = c.clone().lerp(new Color(palette.text), 0.35);
    return { uColor1: top, uColor2: foot };
  }, [color]);

  useFrame((_, delta) => {
    if (quanRef.current) quanRef.current.rotation.z += delta + 0.02;
  });

  useEffect(() => {
    const rotations = [0, 60, 120];
    const object3D = new Object3D();
    rotations.forEach((deg, i) => {
      object3D.rotation.set(Math.PI / 2, (Math.PI / 180) * deg, 0);
      object3D.updateMatrix();
      meshRef.current.setMatrixAt(i, object3D.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  const thickness = 0.1 * factor * (emphasized ? 1.5 : 1);

  return (
    <group visible={barVisible} position={position}>
      <mesh
        renderOrder={5}
        position={[0, 0, barHeight / 2]}
        raycast={() => null}>
        {/* 三片交叉的辉光面，制造体积感 */}
        <instancedMesh
          ref={meshRef}
          matrixAutoUpdate={false}
          args={[undefined, undefined, 3]}
          renderOrder={10}
          rotation-x={Math.PI / 2}
          raycast={() => null}>
          <planeGeometry args={[3.5, barHeight]} />
          <meshBasicMaterial
            transparent
            color={color}
            map={texture2}
            opacity={emphasized ? 0.6 : 0.35}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </instancedMesh>

        {/* 柱芯：沿轴向的 token 渐变 */}
        <boxGeometry args={[thickness, thickness, barHeight]} />
        <meshBasicMaterial
          transparent
          color="#ffffff"
          opacity={1}
          depthTest={false}
          fog={false}
          onBeforeCompile={(shader) => {
            shader.uniforms = {
              ...shader.uniforms,
              uColor1: { value: colors.uColor1 },
              uColor2: { value: colors.uColor2 },
              uDir: { value: dirMap[dir] },
              uSize: { value: barHeight },
            };

            shader.vertexShader = shader.vertexShader.replace(
              "void main() {",
              /* glsl */ `
                attribute float alpha;
                varying vec3 vPosition;
                varying float vAlpha;
                void main() {
                  vAlpha = alpha;
                  vPosition = position;
              `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "void main() {",
              /* glsl */ `
                varying vec3 vPosition;
                varying float vAlpha;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform float uDir;
                uniform float uSize;

                void main() {
              `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <opaque_fragment>",
              /* glsl */ `
                #ifdef OPAQUE
                  diffuseColor.a = 1.0;
                #endif

                vec3 gradient = vec3(0.0);
                if (uDir == 1.0) {
                  gradient = mix(uColor1, uColor2, clamp(vPosition.x / uSize, 0.0, 1.0));
                } else if (uDir == 2.0) {
                  gradient = mix(uColor1, uColor2, clamp(vPosition.z / uSize, 0.0, 1.0));
                } else {
                  gradient = mix(uColor1, uColor2, clamp(vPosition.y / uSize, 0.0, 1.0));
                }
                outgoingLight = outgoingLight * gradient;

                gl_FragColor = vec4(outgoingLight, diffuseColor.a);
              `
            );
          }}
        />
      </mesh>

      {/* 柱脚光环 */}
      <mesh renderOrder={6} ref={quanRef} raycast={() => null}>
        <planeGeometry args={[emphasized ? 7 : 5, emphasized ? 7 : 5]} />
        <meshBasicMaterial
          transparent
          color={color}
          map={texture1}
          alphaMap={texture1}
          opacity={emphasized ? 1 : 0.7}
          depthTest={false}
          fog={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {typeof children === "function" ? children(barHeight) : children}
    </group>
  );
}