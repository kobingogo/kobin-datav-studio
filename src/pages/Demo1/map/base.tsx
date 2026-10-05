import { use, useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import {
  Box2,
  LineSegments,
  Mesh,
  RepeatWrapping,
  Vector2,
  type Group,
} from "three";
import type { CityGeoJSON } from "@/types/map";
import { createProjection } from "@/geo";
import { dropSlivers } from "@/geo/islands";
import City, { type CityProps } from "./city";
import loadTexture from "../helpers/loadTexture";
import { useConsole } from "../../../console/store";

import map from "@/geo/zhejiang_map.png";
import normalMap from "@/geo/zhejiang_normal.png";
import Heatmap from "./heatmap";

export interface BaseProps {
  depth?: number;
  data: CityGeoJSON;
  outlineData?: CityGeoJSON;
}

const textures = Promise.all([
  loadTexture(map, (tex) => {
    tex.wrapS = tex.wrapT = RepeatWrapping;
  }),
  loadTexture(normalMap, (tex) => {
    tex.wrapS = tex.wrapT = RepeatWrapping;
  }),
]);

export default function Base(props: BaseProps) {
  const { data, depth = 6 } = props;
  const groupRef = useRef<Group>(null!);
  const camera = useThree((state) => state.camera);

  const [texture1, texture2] = use(textures);

  /* scale 由 bbox 反算（见 geo/createProjection），
     换省不需要重调常数；构图宽度锁定后相机机位也不用动。 */
  const projection = useMemo(() => createProjection(data), [data]);

  const { regions, bbox } = useMemo(() => {
    const regions: CityProps["data"][] = [];
    const bbox = new Box2();

    const toV2 = (coord: number[]) => {
      const [x, y] = projection(coord as [number, number])!;
      const projected = new Vector2(x, -y);
      bbox.expandByPoint(projected);
      return projected;
    };

    data.features.forEach((feature) => {
      const points = feature.geometry.coordinates.reduce<Vector2[][]>(
        (pre, cur) => [
          ...pre,
          ...cur.map<Vector2[]>((coordinates) => coordinates.map(toV2)),
        ],
        []
      );

      const [x, y] = projection(
        feature.properties.centroid ?? feature.properties.center
      )!;

      /* 舟山这类群岛市有上千个碎岛，挤出后是针尖状毛刺。
         按投影面积剔掉，阈值与省无关。 */
      const kept = dropSlivers(points);
      if (!kept.length) return;

      regions.push({
        city: feature.properties.name,
        cityId: [x, -y, depth + 0.1],
        points: kept,
      });
    });

    return {
      regions,
      bbox,
    };
  }, [projection, data, depth]);

  /* 面板编排统一由 useConsole.mapReady 驱动：地图就绪 → 面板波次入场 */
  const setMapReady = useConsole((s) => s.setMapReady);
  const setMapHandle = useConsole((s) => s.setMapHandle);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    setMapHandle(groupRef.current);
    const tl = gsap.timeline({
      onComplete: () => setMapReady(true),
    });

    tl.to(camera.position, {
      x: 34,
      y: 168,
      z: 208,
      duration: 2,
      ease: "circ.out",
    });
    tl.to(
      groupRef.current.scale,
      { x: 1, y: 1, z: 1, duration: 1, ease: "circ.out" },
      2
    );
    groupRef.current.traverse((obj) => {
      if (obj instanceof Mesh || obj instanceof LineSegments) {
        tl.to(obj.material, { opacity: 1, duration: 1, ease: "circ.out" }, 2);
      }
    });

    return () => {
      tl.kill();
      setMapHandle(null);
    };
  }, [camera, setMapReady, setMapHandle]);

  return (
    <group
      ref={groupRef}
      rotation={[-Math.PI / 2, 0, 0]}
      scale-z={0.01}
      position={[10, 0, 0]}>
      {regions.map((region, idx) => (
        <City
          key={idx}
          depth={depth}
          bbox={bbox}
          data={region}
          map={texture1}
          normalMap={texture2}
        />
      ))}
      <Heatmap
        renderOrder={11}
        projection={projection}
        position-z={depth + 1}
      />
    </group>
  );
}
