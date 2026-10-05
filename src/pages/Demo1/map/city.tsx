import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  Shape,
  ShapeGeometry,
  Vector3,
  type Box2,
  type Group,
  type MeshStandardMaterialProperties,
  type Vector2,
} from "three";
import ShapeMesh from "./shape";
import Tooltip from "./tooltip";
import Bar from "./bar";
import Label from "./label";
import { useCityInteract } from "../../../console/useMapInteraction";
import { useConsole } from "../../../console/store";
import { cityMetrics, fmt } from "../../../console/data";
import { palette, three } from "../../../theme/tokens";

export interface CityProps
  extends Pick<MeshStandardMaterialProperties, "map" | "normalMap"> {
  bbox: Box2;
  depth: number;
  data: {
    city: string;
    cityId: [x: number, y: number, z: number];
    points: Vector2[][];
  };
}

/**
 * 单个城市面
 * ------------------------------------------------------------------
 * 相比原版新增：
 *   · 悬停/锁定由 useCityInteract 统一驱动，同时广播到 store 让 2D 面板联动
 *   · 锁定该市时顶面材质切换为更亮的青色，边框线加粗 —— 地图上是"被选中"的强信号
 *   · 挤出体颜色从米白改为深空面板色，与新 UI 的表面色对齐
 *   · 柱体随选中态变色（常态青、悬停浅青、锁定亮青+加粗）
 */
export default function City(props: CityProps) {
  const { data, bbox, depth, map, normalMap } = props;
  const groupRef = useRef<Group>(null!);
  const vector3 = useRef(new Vector3(1, 1, 1));

  const { handlers, target } = useCityInteract(data.city);
  const pinned = useConsole((s) => s.pinned);
  const hover = useConsole((s) => s.hover);
  const isPinned = pinned === data.city;
  const isHover = hover === data.city;
  const metrics = cityMetrics[data.city];

  const [shape, shapeGeometry] = useMemo(() => {
    const shapes = data.points.map((e) => new Shape(e));
    const geo = new ShapeGeometry(shapes);
    return [shapes, geo];
  }, [data.points]);

  useFrame(() => {
    groupRef.current.scale.lerp(vector3.current, 0.12);
  });
  vector3.current.setZ(target.z);

  return (
    <group ref={groupRef} {...handlers}>
      <ShapeMesh position-z={depth + 0.1} bbox={bbox} args={[shape]}>
        <meshStandardMaterial
          map={map}
          normalMap={normalMap}
          color={isPinned ? "#bfe9ff" : isHover ? "#dff3ff" : "#ffffff"}
          metalness={0.25}
          roughness={0.45}
        />
      </ShapeMesh>

      {/* 挤出体：常态透明，仅在选中时给出实体感 */}
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth, steps: 1, bevelEnabled: false }]} />
        <meshStandardMaterial
          transparent
          opacity={isPinned ? 0.9 : 0}
          metalness={0.3}
          roughness={0.4}
          side={DoubleSide}
          color={isPinned ? palette.cyanDeep : palette.surface}
          emissive={new Color(three.cyanDeep)}
          emissiveIntensity={isPinned ? 0.28 : 0}
        />
      </mesh>

      {/* 顶面轮廓线：选中时提亮为青色 */}
      <lineSegments position-z={depth + 0.2} raycast={() => null}>
        <edgesGeometry args={[shapeGeometry]} />
        <lineBasicMaterial
          transparent
          opacity={isPinned ? 0.95 : isHover ? 0.7 : 0.28}
          color={isPinned || isHover ? palette.cyan : palette.text}
        />
      </lineSegments>

      <Bar
        position={data.cityId}
        value={metrics?.population ?? 0}
        color={isPinned ? palette.cyanSoft : palette.cyan}
        emphasized={isPinned}>
        {(barHeight: number) => (
          <>
            <Label
              center
              position={[0, 0, barHeight + 0.2]}
              zIndexRange={[100, 1000]}>
              {data.city}
            </Label>
            <Tooltip
              city={data.city}
              position={[0, 0, barHeight + 8]}
              visible={false}
            />
          </>
        )}
      </Bar>
    </group>
  );
}

export { fmt };