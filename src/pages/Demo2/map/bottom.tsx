import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, Mesh } from "three";

import quan1 from "@/assets/quan1.png";
import { useConsole } from "../../../console/store";
import { palette } from "../../../theme/tokens";

export default function Bottom() {
  const meshRef1 = useRef<Mesh>(null!);
  const show = useConsole((s) => s.layers.rotation);

  const quan1Tex = useTexture(quan1);

  useFrame((_state, delta) => {
    meshRef1.current.rotation.z += delta / 5;
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position-y={-0.01} visible={show}>
      <mesh ref={meshRef1}>
        <planeGeometry args={[16, 16]} />
        <meshBasicMaterial
          transparent
          map={quan1Tex}
          color={palette.cyan}
          opacity={1}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
