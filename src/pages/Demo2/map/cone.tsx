import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Vector2,
  Vector3,
  type Mesh,
} from "three";
import { Instance, Instances, useTexture } from "@react-three/drei";

import guangquan01 from "@/assets/guangquan01.png";
import { useConsole } from "../../../console/store";
import { palette } from "../../../theme/tokens";

export interface ConesProps {
  color?: Color;
  data: {
    name: string;
    center: Vector3;
    points: Vector2[][];
  }[];
}

export default function Cones(props: ConesProps) {
  const { color = new Color(palette.cyan) } = props;
  const show = useConsole((s) => s.layers.labels);
  const texture1 = useTexture(guangquan01);

  return (
    <group position-z={1} renderOrder={5} visible={show}>
      <Instances
        limit={props.data.length}
        position-z={0.3}
        raycast={() => null}>
        {/* 尺寸从 0.3×0.5 收到 0.16×0.28：原尺寸在俯视取景下是一堆
            抢眼的白三角，视觉权重压过了地图本身 */}
        <coneGeometry args={[0.16, 0.28, 4]} />
        <meshBasicMaterial
          transparent
          opacity={0.5}
          color={color}
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
        {props.data.map((data, i) => (
          <Cone key={i} position={data.center} />
        ))}
      </Instances>
      <Instances limit={props.data.length} raycast={() => null}>
        <planeGeometry args={[0.55, 0.55]} />
        <meshBasicMaterial
          transparent
          color={color}
          alphaMap={texture1}
          opacity={0.75}
          depthTest={false}
          fog={false}
          blending={AdditiveBlending}
        />
        {props.data.map((data, i) => (
          <Quan key={i} position={data.center} />
        ))}
      </Instances>
    </group>
  );
}

export interface ConeProps {
  position?: ThreeElements["group"]["position"];
}

function Cone(props: ConeProps) {
  const { position } = props;
  const ref = useRef<Mesh>(null!);
  let dirRef = useRef<1 | -1>(1);

  useFrame((_, delta) => {
    if (ref.current.position.z >= 1) {
      dirRef.current = -1;
      ref.current.position.z = 1;
    }
    if (ref.current.position.z <= 0) {
      dirRef.current = 1;
      ref.current.position.z = 0;
    }
    // const d = Math.min(delta, 0.05);
    ref.current.rotation.y += delta;
    ref.current.position.z += (dirRef.current * delta) / 2;
  });

  return <Instance ref={ref} rotation-x={-Math.PI / 2} position={position} />;
}

function Quan(props: ConeProps) {
  const { position } = props;
  const ref = useRef<Mesh>(null!);
  useFrame((_, delta) => {
    ref.current.rotation.z += delta + 0.02;
  });
  return <Instance ref={ref} position={position} />;
}
