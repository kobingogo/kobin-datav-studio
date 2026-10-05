import { useMemo, useRef } from "react";
import { Html, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Box2,
  DoubleSide,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type MeshStandardMaterial,
} from "three";
import { useConsole } from "../../../console/store";
import { useCityInteract } from "../../../console/useMapInteraction";
import { cityMetrics, fmt } from "../../../console/data";
import { palette, three } from "../../../theme/tokens";
import type { GeoProjection } from "d3-geo";
import ShapeBox from "./shape";

import { cityGeoJSON } from "@/geo";
import textureMap from "@/geo/zhejiang_map.png";
import scNormalMap from "@/geo/zhejiang_normal.png";
import scDisplacementMap from "@/geo/zhejiang_displacement.png";

const data = cityGeoJSON;

/**
 * 底图
 * ------------------------------------------------------------------
 * 原实现只按 `newStyle` 在「卫星+位移」和「卫星+描边」两种外观间切换，
 * 地图**没有任何交互**——鼠标划过去什么都不发生，
 * 两侧的 4 张图表也与地图无关。这是一块纯装饰。
 *
 * 改造后：
 *   · 每个行政区是一个独立的 group，接 useCityInteract：
 *     hover 提亮 + 描边转青 + 标注浮起；click 锁定并广播给面板
 *   · 标注从 drei Text（恒定世界尺寸、纯白无底）换成 Html，
 *     带上出口额数值，并只在选中时亮起
 *   · 材质颜色按选中态收敛到 token，而不是一律纯白
 */
export default function BaseMap({
  projection,
}: {
  projection: GeoProjection;
}) {
  const newStyle = useConsole((s) => s.layers.flyline); // 复用：纯净/写实切换
  const [texture1, texture2, texture3] = useTexture(
    [textureMap, scNormalMap, scDisplacementMap],
    (tex) =>
      tex.forEach((el) => {
        el.wrapS = el.wrapT = RepeatWrapping;
      })
  );

  const { regions, bbox } = useMemo(() => {
    const regions: {
      name: string;
      center: Vector3;
      points: Vector2[][];
    }[] = [];
    const bbox = new Box2();

    const toV2 = (coord: number[]) => {
      const [x, y] = projection(coord as [number, number])!;
      const p = new Vector2(x, -y);
      bbox.expandByPoint(p);
      return p;
    };

    data.features.forEach((feature) => {
      const [x, y] = projection(
        feature.properties.centroid ?? feature.properties.center
      )!;
      const points = feature.geometry.coordinates.reduce<Vector2[][]>(
        (pre, cur) => [
          ...pre,
          ...cur.map<Vector2[]>((coordinates) => coordinates.map(toV2)),
        ],
        []
      );
      regions.push({ name: feature.properties.name, center: new Vector3(x, -y), points });
    });

    return { regions, bbox };
  }, [projection]);

  return (
    <group renderOrder={0} position={[0, 0, 0.51]}>
      {regions.map((reg, i) => (
        <Region
          key={reg.name + i}
          name={reg.name}
          center={reg.center}
          points={reg.points}
          bbox={bbox}
          textured={newStyle}
          map={texture1}
          normalMap={texture2}
          displacementMap={texture3}
        />
      ))}
    </group>
  );
}

/**
 * 单个行政区
 * Demo0 用的是位移贴图做地形起伏，没有挤出体，
 * 所以选中反馈只能靠"提亮 + 描边 + 标注"三者，而不是让面长高。
 */
function Region({
  name,
  center,
  points,
  bbox,
  textured,
  map,
  normalMap,
  displacementMap,
}: {
  name: string;
  center: Vector3;
  points: Vector2[][];
  bbox: Box2;
  textured: boolean;
  map: import("three").Texture;
  normalMap: import("three").Texture;
  displacementMap: import("three").Texture;
}) {
  const matRef = useRef<MeshStandardMaterial>(null!);
  const lineRef = useRef<import("three").LineBasicMaterial>(null!);

  const { handlers } = useCityInteract(name);
  const pinned = useConsole((s) => s.pinned);
  const hover = useConsole((s) => s.hover);
  const showLabels = useConsole((s) => s.layers.labels);

  const isPinned = pinned === name;
  const isHover = hover === name;
  const lit = isPinned || isHover;

  const shapes = useMemo(() => points.map((p) => new Shape(p)), [points]);
  /** ShapeGeometry / EdgesGeometry 都接受 Shape 数组，
      但 R3F 的 args 类型推断成 tuple，所以显式给一个 props 接口 */
  const shapeArgs = useMemo(() => [shapes] as [Shape[]], [shapes]);
  const shapeGeometry = useMemo(() => new ShapeGeometry(shapes), [shapes]);
  const metrics = cityMetrics[name];

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-9 * delta);
    if (matRef.current) {
      matRef.current.emissiveIntensity +=
        ((lit ? 0.5 : 0) - matRef.current.emissiveIntensity) * k;
    }
    if (lineRef.current) {
      lineRef.current.opacity +=
        ((lit ? 0.95 : isPinned ? 0.4 : 0.28) - lineRef.current.opacity) * k;
    }
  });

  return (
    <group {...handlers}>
      <ShapeBox bbox={bbox} args={shapeArgs}>
        <meshStandardMaterial
          ref={matRef}
          map={map}
          normalMap={normalMap}
          {...(textured ? { displacementMap } : {})}
          metalness={0.2}
          roughness={0.5}
          side={DoubleSide}
          emissive={three.cyanDeep}
          emissiveIntensity={0}
        />
      </ShapeBox>

      {/* 描边：选中时转青，是地图上"被选中"最强的信号 */}
      <lineSegments position={[0, 0, 0.01]} raycast={() => null}>
        <edgesGeometry args={[shapeGeometry]} />
        <lineBasicMaterial
          ref={lineRef}
          transparent
          opacity={0.28}
          color={lit ? palette.cyan : palette.text}
        />
      </lineSegments>

      {showLabels && (
        <Html
          position={[center.x, center.y, 0.6]}
          center
          /* 不设 distanceFactor。
             drei 的 distanceFactor 是「按距离缩放 DOM」，缩放系数 = factor / 相机距离。
             Demo0 的相机距离约 250 世界单位，factor=6 时系数只有 0.024，
             12px 的标注渲染出来不到 0.3px —— 完全看不见。
             这里改用恒定像素尺寸，标注在任何缩放下都可读。 */
          zIndexRange={[100, 1000]}
          style={{ pointerEvents: "none" }}>
          <Tag $on={lit} $dim={!!hover && !lit}>
            <b>{name}</b>
            {metrics && <i>{fmt.dec(metrics.exportValue)} 亿</i>}
          </Tag>
        </Html>
      )}
    </group>
  );
}

/* ── 标注 ─────────────────────────────────────────────────── */

import styled from "styled-components";

const Tag = styled.div<{ $on: boolean; $dim: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 4px;
  width: max-content;
  white-space: nowrap;
  padding: ${({ $on }) => ($on ? "2px 7px" : "1px 3px")};
  border: 1px solid ${({ $on }) => ($on ? palette.cyanDeep : "transparent")};
  border-radius: 2px;
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.14)" : "transparent")};
  opacity: ${({ $dim }) => ($dim ? 0.32 : 1)};
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
  transition:
    opacity var(--e-fast),
    background var(--e-fast),
    padding var(--e-fast);

  b {
    font-size: 12px;
    font-weight: 600;
    color: ${({ $on }) => ($on ? palette.cyanSoft : palette.text)};
  }

  i {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 10px;
    font-style: normal;
    color: ${({ $on }) => ($on ? palette.cyan : palette.textFaint)};
  }
`;