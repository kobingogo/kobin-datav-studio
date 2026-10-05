import { useLayoutEffect, useMemo, useRef } from "react";
import { Center, useTexture } from "@react-three/drei";
import {
  Box2,
  DoubleSide,
  LineSegments,
  Mesh,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Group,
} from "three";
import { geoMercator } from "d3-geo";
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import ShiftMaterial from "./shaderMaterial";
import GeoTrail from "./geoTrail";
import type { CityGeoJSON } from "@/types/map";
import ShapeBox from "./shape";
import FlyLine from "./flyLine";
import Boundary from "./boundary";
import Label from "./label";
import { useConsole } from "../../../console/store";
import { useCityInteract } from "../../../console/useMapInteraction";
import { cityMetrics } from "../../../console/data";
import { dropSlivers } from "../../../geo/islands";
import { palette } from "../../../theme/tokens";

import scNormalMap from "@/geo/zhejiang_normal.png";
import Cones from "./cone";

export interface BaseProps {
  depth?: number;
  data: CityGeoJSON;
  outlineData?: CityGeoJSON;
}

export default function Base(props: BaseProps) {
  const { data, outlineData, depth = 1 } = props;
  const groupRef = useRef<Group>(null!);
  const camera = useThree((state) => state.camera);
  const setMapReady = useConsole((s) => s.setMapReady);
  const setMapHandle = useConsole((s) => s.setMapHandle);

  const projection = useMemo(() => {
    // 不设 scale（沿用 d3-geo 默认 152.513）：
    // Demo2 的地图组还有一层 scale 0.5，若照抄 Demo1 的 820，
    // 成品会比原版大 5 倍以上，相机直接钻进地表内部。
    return geoMercator()
      .center(data.features[0].properties.centroid)
      .translate([0, 0]);
  }, [data]);

  const { regions, bbox, boundary } = useMemo(() => {
    const regions: {
      name: string;
      center: Vector3;
      points: Vector2[][];
    }[] = [];
    const bbox = new Box2();

    const toV2 = (coord: number[]) => {
      const [x, y] = projection(coord as [number, number])!;
      const projected = new Vector2(x, -y);
      bbox.expandByPoint(projected);
      return projected;
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

      /* 与 demo1 同一处理：剔除挤出后会变成毛刺的碎岛 */
      const kept = dropSlivers(points);
      if (!kept.length) return;

      regions.push({
        name: feature.properties.name,
        center: new Vector3(x, -y),
        points: kept,
      });
    });

    let boundary: Shape[] = [];

    outlineData?.features.forEach((feature) => {
      const points = feature.geometry.coordinates.map<Shape>((cur) => {
        return new Shape(
          cur.reduce<Vector2[]>(
            (pre, coordinates) => [...pre, ...coordinates.map(toV2)],
            []
          )
        );
      });

      boundary = boundary.concat(points);
    });

    return {
      regions,
      bbox,
      boundary,
    };
  }, [projection, data, outlineData]);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    setMapHandle(groupRef.current);
    const tl = gsap.timeline();

    tl.to(camera.position, {
      x: -2.0,
      y: 7.6,
      z: 11.6,
      duration: 2.5,
      ease: "circ.out",
      onComplete: () => setMapReady(true),
    });
    tl.to(groupRef.current.position, { x: 0, y: 0, z: 0, duration: 1 }, 2.5);

    tl.to(
      groupRef.current.scale,
      {
        x: 1,
        y: 1,
        z: 1,
        duration: 1,
        ease: "circ.out",
      },
      2.5
    );
    groupRef.current.traverse((obj) => {
      if (obj instanceof Mesh || obj instanceof LineSegments) {
        tl.to(obj.material, { opacity: 1, duration: 1, ease: "circ.out" }, 2.5);
      }
    });

    return () => {
      tl.kill();
      setMapHandle(null);
    };
  }, [camera, setMapReady, setMapHandle]);

  return (
    <Center top>
      <group
        castShadow
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.5, 0.5, 0.5]}
        position={[0, 0.2, 0]}>
        <group ref={groupRef} scale={[1, 1, 0]} position={[0, 0, -0.01]}>
          {regions.map((region, idx) => (
            <City
              key={region.name + idx}
              depth={depth}
              bbox={bbox}
              data={region}
            />
          ))}
          {outlineData && (
            <GeoTrail
              projection={projection}
              feature={outlineData.features[0]}
            />
          )}
          <Cones data={regions} />
          <FlyLine data={regions} />
          <Boundary data={boundary} />
        </group>
      </group>
    </Center>
  );
}

/**
 * 单个地市州
 * ------------------------------------------------------------------
 * 原版只在 pointerOver 时把 scale.z 推到 1.5，且没有点击、
 * 没有与面板的联动。这里接入 useCityInteract：
 *   · 悬停 → 1.25×，广播 hover 给面板
 *   · 锁定 → 1.55×，同时挤出体不再透明、边线转为青色
 */
function City(props: {
  depth: number;
  bbox: Box2;
  data: {
    name: string;
    center: Vector3;
    points: Vector2[][];
  };
}) {
  const { bbox, data, depth } = props;
  const materialRef = useRef<ShaderMaterial>(null!);
  const groupRef = useRef<Group>(null!);
  const vector3 = useRef(new Vector3(1, 1, 1));

  const { handlers, target } = useCityInteract(data.name);
  const pinned = useConsole((s) => s.pinned);
  const hover = useConsole((s) => s.hover);
  const isPinned = pinned === data.name;
  const isHover = hover === data.name;
  const metrics = cityMetrics[data.name];

  const texture = useTexture(scNormalMap);

  const [shape, shapeGeometry] = useMemo(() => {
    const shapes = data.points.map((e) => new Shape(e));
    const geo = new ShapeGeometry(shapes);
    return [shapes, geo];
  }, [data.points]);

  useFrame((_, delta) => {
    groupRef.current.scale.lerp(vector3.current, 0.12);
    if (materialRef.current)
      materialRef.current.uniforms.time.value += delta / 3;
  });
  vector3.current.setZ(target.z);

  return (
    <group ref={groupRef} {...handlers}>
      <ShapeBox bbox={bbox} args={[shape, { depth, bevelEnabled: false }]}>
        <meshStandardMaterial
          transparent
          attach="material-0"
          color={isPinned ? "#2E5F7E" : "#1B2C38"}
          normalMap={texture}
          metalness={0.5}
          roughness={0.7}
          side={DoubleSide}
          opacity={isPinned || isHover ? 0.95 : 0.62}
          emissive={isPinned ? palette.cyanDeep : "#000000"}
          emissiveIntensity={isPinned ? 0.35 : 0}
        />
        <ShiftMaterial
          transparent
          attach="material-1"
          ref={materialRef}
          opacity={isPinned ? 1 : isHover ? 0.9 : 0.72}
          depth={depth}
        />
      </ShapeBox>

      <lineSegments position={[0, 0, depth + 0.05]} raycast={() => null}>
        <edgesGeometry args={[shapeGeometry]} />
        <lineBasicMaterial
          transparent
          opacity={isPinned ? 1 : isHover ? 0.85 : 0.3}
          color={isPinned || isHover ? palette.cyan : palette.text}
        />
      </lineSegments>

      <Label
        center
        position={[data.center.x, data.center.y, depth + 0.2]}
        zIndexRange={[100, 1000]}
        value={metrics ? `${metrics.power}` : ""}
      >
        {data.name}
      </Label>
    </group>
  );
}