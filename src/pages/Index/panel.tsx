import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import styled from "styled-components";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MathUtils,
  SRGBColorSpace,
  type Group,
  type MeshBasicMaterial,
  type ShaderMaterial,
} from "three";
import { palette, three } from "@/theme/tokens";
import type { DemoEntry } from "./store";
import { RING } from "./layout";
import { consumeDrag } from "./dragGuard";

/**
 * 展台
 * ------------------------------------------------------------------
 * 结构自外向内：
 *   地面光斑 → 发光背板 → 圆角边框 → 预览图 → 四角刻度 → 悬空铭牌
 *
 * ── facing 为什么是 ref 而不是普通 prop ──────────────────────
 * facing 是逐帧变化的量。早期实现把它当 prop 从 Ring 传下来，
 * 而 Ring 里的 facings 是「useMemo 的普通数组 + useFrame 原地赋值」，
 * 引用永远不变 → React 永远不会因此重渲染 → prop 被永久冻结。
 * 实测首屏 propF 全为 0（Ring 只在 active/hover/pos 变化时才重渲染，
 * 而首屏这些都没变），于是：
 *     图片被 lerp 到 palette.line（近黑）、缩到 0.8、
 *     铭牌因 f > 0.08 直接不渲染 → 整个场景只剩环境，一片"空展台"。
 *
 * 现在 Ring 传一个稳定的 Float32Array ref，Station / Frame / Corners
 * 都在自己的 useFrame 里读它。逐帧量不再经过 React，
 * 铭牌也改为「始终挂载 + 逐帧改 opacity」而不是条件渲染 ——
 * 条件渲染同样依赖渲染时机，是同一个陷阱。
 */

const W = RING.panel.w;
const H = RING.panel.h;
const BORDER = 0.055;
const OUT_W = W + BORDER * 2;
const OUT_H = H + BORDER * 2;

/* ── 圆角发光边框 ───────────────────────────────────────────
 * SDF 画描边，一次绘制搞定"外框 + 角部圆角 + 选中内填充"，
 * 比用 8 根线段拼框更干净，也不会有 z-fighting。
 */
const frameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frameFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec2  uSize;
  uniform float uBorder;
  uniform float uActive;
  uniform float uHover;
  uniform vec3  uAccent;
  uniform vec3  uIdle;

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 b = uSize * 0.5 - uBorder * 0.5;
    float r = 0.09;

    vec2 q = abs(p) - b + r;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;

    // 选中时边框额外加粗：用 SDF 阈值随 uActive 收缩，描边自然变厚
    float w = mix(0.007, 0.004, uActive);
    float line = 1.0 - smoothstep(0.0, w, abs(d));
    float fill = (1.0 - smoothstep(-0.01, 0.0, d)) * uActive * 0.12;

    float k = clamp(uActive * 1.15 + uHover * 0.4, 0.0, 1.0);
    vec3 col = mix(uIdle, uAccent, k);
    float alpha = line * (0.5 + uActive * 0.5 + uHover * 0.2) + fill;

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function Frame({
  index,
  facings,
  hovered,
}: {
  index: number;
  facings: React.RefObject<Float32Array>;
  hovered: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      uSize: { value: [OUT_W, OUT_H] },
      uBorder: { value: BORDER },
      uActive: { value: 0 },
      uHover: { value: 0 },
      uAccent: { value: new Color(palette.cyan) },
      uIdle: { value: new Color(palette.lineStrong) },
    }),
    []
  );

  useFrame((_, delta) => {
    const facing = facings.current?.[index] ?? 0;
    uniforms.uActive.value = MathUtils.damp(
      uniforms.uActive.value,
      facing,
      7,
      delta
    );
    uniforms.uHover.value = MathUtils.damp(
      uniforms.uHover.value,
      hovered ? 1 : 0,
      12,
      delta
    );
  });

  return (
    <mesh position={[0, 0, -0.012]} renderOrder={1}>
      <planeGeometry args={[OUT_W, OUT_H]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={DoubleSide}
        uniforms={uniforms}
        vertexShader={frameVertex}
        fragmentShader={frameFragment}
      />
    </mesh>
  );
}

/** 四角刻度：工程感的小装饰，也是"这是个取景器"的可视提示 */
function Corners({
  index,
  facings,
}: {
  index: number;
  facings: React.RefObject<Float32Array>;
}) {
  const mats = useRef<MeshBasicMaterial[]>([]);

  const L = 0.22;
  const t = 0.018;
  /* 贴着边框外沿而不是留出空隙：
     之前 dx = W/2 + BORDER + 0.07，刻度与边框之间有一道明显空隙，
     视觉上成了四根悬空的括号而不是"取景框的角"。 */
  const dx = W / 2 + BORDER;
  const dy = H / 2 + BORDER;

  const bars = [
    { x: -dx + L / 2, y: dy, w: L, h: t, big: true },
    { x: dx - L / 2, y: dy, w: L, h: t, big: true },
    { x: -dx + L / 2, y: -dy, w: L, h: t, big: true },
    { x: dx - L / 2, y: -dy, w: L, h: t, big: true },
    { x: -dx, y: dy - L / 2, w: t, h: L, big: false },
    { x: dx, y: dy - L / 2, w: t, h: L, big: false },
    { x: -dx, y: -dy + L / 2, w: t, h: L, big: false },
    { x: dx, y: -dy + L / 2, w: t, h: L, big: false },
  ];

  useFrame((_, delta) => {
    const facing = facings.current?.[index] ?? 0;
    for (const m of mats.current) {
      if (!m) continue;
      m.opacity = MathUtils.damp(m.opacity, 0.12 + facing * 0.8, 7, delta);
    }
  });

  return (
    <group position={[0, 0, 0.012]} renderOrder={2}>
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0]}>
          <planeGeometry args={[b.w, b.h]} />
          <meshBasicMaterial
            ref={(el) => {
              if (el) mats.current[i] = el;
            }}
            color={b.big ? palette.cyan : palette.indigo}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * 地面光斑：给展台一个"站在轨道上"的落点。
 * 原来是一张 4.4×2.4 的加色矩形 —— 硬边矩形在深色地面上读作一块玻璃板，
 * 四个展台各一张，画面里立刻多出四块玻璃。改为径向衰减的椭圆。
 */
function FloorSpot() {
  const mat = useRef<ShaderMaterial>(null!);

  useFrame((_, delta) => {
    const u = mat.current.uniforms.uOpacity;
    u.value = MathUtils.damp(u.value, 0.3, 5, delta);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.38, 0.35]}>
      <planeGeometry args={[3.4, 1.5]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        uniforms={{
          uColor: { value: new Color(three.cyan) },
          uOpacity: { value: 0.2 },
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
          void main() {
            float r = length((vUv - 0.5) * 2.0);
            if (r > 1.0) discard;
            gl_FragColor = vec4(uColor, pow(1.0 - r, 2.4) * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

export interface StationProps {
  demo: DemoEntry;
  /** 本站在环上的序号 */
  index: number;
  /** 逐帧的朝向权重，由 Ring 的 useFrame 就地更新 —— 不要当普通数据用 */
  facings: React.RefObject<Float32Array>;
  hovered: boolean;
  onEnter: () => void;
  onHover: (v: boolean) => void;
}

export default function Station({
  demo,
  index,
  facings,
  hovered,
  onEnter,
  onHover,
}: StationProps) {
  const group = useRef<Group>(null!);
  const imgMat = useRef<MeshBasicMaterial>(null!);
  const glowMat = useRef<ShaderMaterial>(null!);
  const plateRef = useRef<HTMLDivElement>(null);

  const tex = useTexture(demo.img, (t) => {
    t.colorSpace = SRGBColorSpace;
  });

  // 选中 = 原色满亮；远端 = 压暗并偏冷（用 textFaint 而不是纯灰，
  // 这样远端画面仍留在冷色体系里，不会变成一张脏灰）
  const bright = useMemo(() => new Color("#ffffff"), []);
  const dim = useMemo(() => new Color(palette.line), []);
  const target = useMemo(() => new Color(), []);

  useFrame((_, delta) => {
    const f = facings.current?.[index] ?? 0;
    const lift = f ** 2 * RING.lift + (hovered ? 0.11 : 0);

    if (group.current) {
      group.current.position.y = MathUtils.damp(
        group.current.position.y,
        lift,
        7,
        delta
      );
      const s = 0.8 + f ** 1.4 * 0.2 + (hovered ? 0.035 : 0);
      group.current.scale.setScalar(
        MathUtils.damp(group.current.scale.x, s, 7, delta)
      );
    }

    if (imgMat.current) {
      // 指数取自 layout.expBright：facing 0.75（±40° 侧翼）保留约 58% 亮度，
      // 正面与侧翼立刻拉开层级；到 ±80° 只剩 3%，自然退成背景。
      target.copy(dim).lerp(bright, f ** RING.expBright);
      imgMat.current.color.lerp(target, 1 - Math.exp(-8 * delta));
    }

    if (glowMat.current) {
      glowMat.current.uniforms.uOpacity.value = MathUtils.damp(
        glowMat.current.uniforms.uOpacity.value,
        0.02 + f ** 2 * 0.3 + (hovered ? 0.12 : 0),
        6,
        delta
      );
    }

    /* 铭牌：始终挂载，逐帧改 opacity 与左侧色条。
       之前是 `{f > 0.08 && <Html/>}` 条件渲染 —— 条件本身依赖渲染时机，
       与 facing prop 是同一个陷阱：首屏 f 恒为 0，铭牌永远挂不上。 */
    if (plateRef.current) {
      const el = plateRef.current;
      el.style.opacity = String(0.28 + Math.min(1, f) * 0.72);
      const accent = demo.kind === "embed" ? palette.indigo : palette.cyan;
      el.style.borderLeftColor =
        f > 0.6 ? (demo.v2 ? accent : palette.lineStrong) : palette.line;
      el.style.backgroundColor = f > 0.6 ? "rgba(7,11,20,0.62)" : "transparent";
    }
  });

  return (
    <group ref={group}>
      <FloorSpot />

      {/* 背板辉光：把展台从背景里"托"出来。
          同样是径向衰减 —— 硬边矩形会在展台后面留下一块方形色块 */}
      <mesh position={[0, 0, -0.08]} renderOrder={0}>
        <planeGeometry args={[W + 1.6, H + 1.9]} />
        <shaderMaterial
          ref={glowMat}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uColor: { value: new Color(three.cyanDeep) },
            uOpacity: { value: 0.12 },
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
            void main() {
              vec2 p = (vUv - 0.5) * 2.0;
              float r = length(p * vec2(1.0, 1.18));
              if (r > 1.0) discard;
              gl_FragColor = vec4(uColor, pow(1.0 - r, 2.2) * uOpacity);
            }
          `}
        />
      </mesh>

      <Frame index={index} facings={facings} hovered={hovered} />

      {/* 预览图 —— 唯一可点击的命中区 */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          // 刚拖拽过就松手的，视为擦洗而非点击
          if (consumeDrag()) return;
          onEnter();
        }}
      >
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial
          ref={imgMat}
          map={tex}
          toneMapped={false}
          transparent
        />
      </mesh>

      <Corners index={index} facings={facings} />

      {/* 铭牌：DOM 排版，与 token 体系保持一致。
          drei 的 Html 不做深度遮挡，背面站位的铭牌会直接盖住前景画面 ——
          40° 弧线下最远的一站也还有 0.17 的 facing，因此用 opacity 压到很低
          而不是卸载，避免条件渲染带来的时机依赖。 */}
      <Html
        position={[0, -H / 2 - 0.34, 0]}
        center
        distanceFactor={3.4}
        zIndexRange={[24, 4]}
        style={{ pointerEvents: "none" }}
      >
        <Plate ref={plateRef} $v2={demo.v2} data-station-plate={demo.id}>
          <PlateNo>{demo.no}</PlateNo>
          <PlateBody>
            <PlateTitle>{demo.title}</PlateTitle>
            <PlateSub>{demo.subtitle}</PlateSub>
          </PlateBody>
          <PlateTag $kind={demo.kind}>{demo.status}</PlateTag>
        </Plate>
      </Html>
    </group>
  );
}

/* ── 铭牌 ────────────────────────────────────────────────────── */

const Plate = styled.div<{ $v2: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  /* 244 → 276：站位从 4 块变6 块后标题普遍变长（「杭州市城市运行大屏」），
     244px 下副标题只剩 ~130px 可用，英文副标题必被截断 */
  width: 276px;
  padding: 7px 12px;
  white-space: nowrap;
  /* opacity / 背景 / 色条由 Station 的 useFrame 逐帧写入，
     这里不给初值以外的值，避免与 JS 写入打架 */
  opacity: 0.3;
  border-left: 2px solid ${palette.line};
  backdrop-filter: blur(6px);
  border-radius: 2px;
`;

const PlateNo = styled.span`
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: ${palette.cyanDeep};
  flex: none;
`;

const PlateBody = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
`;

/*
 * 标题与副标题都要能截断。
 * 之前只写了 min-width: 0 而没有 overflow，Plate 又是 nowrap 定宽 ——
 * 副标题比可用宽度长时不会省略，而是直接压在右侧的状态标签上。
 * 之前四个 demo 的英文副标题短（HANGZHOU 那种长度刚好放得下），
 * 加上「杭州市城市运行大屏 / HANGZHOU CITY OPERATIONS」这种长标题才暴露出来。
 */
const PlateTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PlateSub = styled.span`
  font-size: 9px;
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  color: var(--c-text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * 状态标签：原生页用青，静态集成页用靛。
 * 两类进站后视觉语言完全不同（前者共用 token，后者是另一套设计语言的
 * iframe），标签同色会让读者以为进了同一套东西。
 */
const PlateTag = styled.span<{ $kind: "native" | "embed" }>`
  margin-left: auto;
  flex: none;
  padding: 1px 6px;
  font-size: 9px;
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  border-radius: 2px;
  color: ${({ $kind }) => ($kind === "embed" ? palette.text : "#06222E")};
  background: ${({ $kind }) =>
    $kind === "embed" ? "rgba(123,140,255,0.16)" : palette.cyan};
  border: 1px solid
    ${({ $kind }) => ($kind === "embed" ? palette.indigo : palette.cyan)};
`;