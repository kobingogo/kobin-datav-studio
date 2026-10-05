import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Stars } from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
} from "three";
import { palette, three } from "@/theme/tokens";

/**
 * 展台环境
 * ------------------------------------------------------------------
 * 原实现只有一张 6×6 的 simplex 噪声平面（hsl 0.6 → 青绿色块）放在 y=-3、z=-10，
 * 作用只是"让背景不那么空"。问题：
 *   · 色相固定为青绿，与 Demo1 的卫星绿图撞色
 *   · 6×6 的平面在 fov 15 / z=100 的长焦下铺满整个下半屏，
 *     读作一大块渐变色斑，而不是"空间"
 *   · 噪声在动但没有可参照的结构，观众无法感知自己在移动
 *
 * 改为四层可读的空间结构：
 *   ① 星场     —— 深度与运动参照
 *   ② 地平辉光 —— 在环后方给一圈冷光（径向衰减，不是硬边圆盘）
 *   ③ 环形轨道 —— 与展台同半径的地面圆环，把"轮盘"画出来
 *   ④ 地面栅格 —— 远距离淡出，提供透视参照物
 */

/** 径向衰减的地平辉光：中心亮、边缘归零，不会在背景上留下一块硬边色片 */
function Halo({
  radius,
  color,
  opacity,
  y = 0,
  z = -4,
  squash = 1,
}: {
  radius: number;
  color: string;
  opacity: number;
  y?: number;
  z?: number;
  squash?: number;
}) {
  return (
    <mesh position={[0, y, z]} scale={[radius * squash, radius, 1]} renderOrder={-3}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
        uniforms={{
          uColor: { value: new Color(color) },
          uOpacity: { value: opacity },
          uFalloff: { value: 3.2 },
          uSquash: { value: 1 },
        }}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          precision highp float;
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uFalloff;
          void main() {
            float r = length((vUv - 0.5) * 2.0);
            if (r > 1.0) discard;
            gl_FragColor = vec4(uColor, pow(1.0 - r, uFalloff) * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

/**
 * 环形轨道：与展台同半径的地面细环 + 一圈缓慢自转的刻度点。
 * 它把"这是一个可以转动的展台"直接画出来，比只靠卡片围绕暗示要清楚得多。
 */
function OrbitTrack({ radius = 5 }) {
  const dots = useRef<Group>(null!);

  useFrame((_, delta) => {
    if (dots.current) dots.current.rotation.y -= delta * 0.05;
  });

  return (
    <group position={[0, -1.42, 0]}>
      {/* 主环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.005, radius + 0.005, 192]} />
        <meshBasicMaterial
          color={three.cyanDeep}
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* 内侧更淡的同心环，强化"多层轨道" */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.58 - 0.004, radius * 0.58 + 0.004, 128]} />
        <meshBasicMaterial
          color={three.indigo}
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* 每 5 个一个大刻度，缓慢反向自转 */}
      <group ref={dots}>
        {Array.from({ length: 30 }, (_, i) => {
          const a = (i / 30) * Math.PI * 2;
          const big = i % 5 === 0;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * radius, 0.004, Math.cos(a) * radius]}>
              <sphereGeometry args={[big ? 0.026 : 0.013, 8, 8]} />
              <meshBasicMaterial
                color={big ? three.cyan : three.cyanDeep}
                transparent
                opacity={big ? 0.85 : 0.32}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export default function Env() {
  return (
    <>
      {/* ① 星场 —— 深度与运动参照 */}
      <Stars
        radius={60}
        depth={30}
        count={800}
        factor={2.2}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* ② 地平辉光：两层径向衰减，替代原来那块硬边噪声色斑 */}
      <Halo radius={16} color={palette.cyanDeep} opacity={0.16} y={-0.4} z={-6} squash={1.5} />
      <Halo radius={8} color={palette.cyan} opacity={0.05} y={-0.2} z={-2} squash={1.2} />

      {/* ③ 环形轨道 */}
      <OrbitTrack />

      {/* ④ 地面栅格：远距离淡出，只做透视参照 */}
      <Grid
        position={[0, -1.44, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor={palette.line}
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor={palette.cyanDeep}
        fadeDistance={22}
        fadeStrength={2.6}
        followCamera={false}
        infiniteGrid={false}
      />
    </>
  );
}