import { useLayoutEffect, useRef } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Color, Mesh, type Group, type MeshStandardMaterial } from "three";
import { gsap } from "gsap";
import { useViewer } from "../../console/viewerStore";
import { palette } from "@/theme/tokens";

/**
 * 航空发动机模型
 * ------------------------------------------------------------------
 * 原实现的四个问题：
 *   1. hover 把自发光设成纯红 `0xff0000` —— 与全局青色体系冲突，
 *      且纯红在 Bloom 下会烧成一片红糊，看不出部件形状
 *   2. 拆解位移 x / y 恒等（只有 z 在动），间距固定 0.1，
 *      多部件挤在一起，读不出"分层展开"
 *   3. 拆解开关挂在 leva 的开发期 checkbox 上，产品界面里没有入口
 *   4. `originPosition` 只在 `v === true` 时才记录 —— 首次进来直接点"还原"
 *      会读到 undefined，模型直接跳位
 *
 * 改造后：
 *   · hover 用 token 的 cyan，自发光强度逐帧插值，移开平滑复原
 *   · 拆解沿引擎轴按索引比例展开，并按索引错开起爆时间，形成分层感
 *   · originPosition 在挂载时一次性记录，杜绝首次还原失效
 *   · 拆解 / 线框 / 自转的状态接 store，由外部正式控件驱动
 */

/** 展开间距：模型 scale=2，0.16 × 部件索引差已经能拉开明显层次 */
const EXPLODE_STEP = 0.16;

const HOVER_EMISSIVE = new Color(palette.cyanDeep);
const IDLE_EMISSIVE = new Color(0x000000);

export default function Model() {
  const { scene } = useGLTF(
    `${import.meta.env.BASE_URL}model/glb/turbine.glb`
  );
  const obj = useRef<Group>(null!);

  const explode = useViewer((s) => s.explode);
  const wireframe = useViewer((s) => s.wireframe);
  const spin = useViewer((s) => s.spin);
  const setHoverPart = useViewer((s) => s.setHoverPart);
  const setPartCount = useViewer((s) => s.setPartCount);

  /**
   * 原始位置在挂载时记录一次。
   * 原实现写在 `if (v)` 分支里，即"第一次点拆解"才记录 ——
   * 那之前若直接点还原，originPosition 是 undefined，位置会被写成 NaN。
   */
  useLayoutEffect(() => {
    let n = 0;
    obj.current?.traverse((child) => {
      if (child instanceof Mesh) {
        child.userData.origin = child.position.clone();
        n += 1;
      }
    });
    setPartCount(n);
  }, [setPartCount]);

  /* 拆解 / 收拢 */
  const prevExplode = useRef(explode);
  useFrame(() => {
    if (prevExplode.current === explode) return;
    prevExplode.current = explode;

    const children = obj.current?.children ?? [];
    const mid = (children.length - 1) / 2;

    obj.current.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const origin = child.userData.origin as
        | { x: number; y: number; z: number }
        | undefined;
      if (!origin) return;

      const along = children.indexOf(child) - mid;
      gsap.killTweensOf(child.position);
      gsap.to(child.position, {
        x: origin.x,
        y: origin.y,
        z: explode ? along * EXPLODE_STEP : origin.z,
        // 分层感来自按索引错开起爆时间，而不只是拉开间距
        delay: explode ? Math.abs(along) * 0.014 : 0,
        duration: 0.9,
        ease: explode ? "power3.out" : "power2.inOut",
      });
    });
  });

  /* 线框态 */
  const prevWire = useRef(wireframe);
  useFrame(() => {
    if (prevWire.current === wireframe) return;
    prevWire.current = wireframe;
    obj.current?.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const mat = child.material as MeshStandardMaterial;
      mat.wireframe = wireframe;
      mat.needsUpdate = true;
    });
  });

  /* 自转 */
  useFrame((_, delta) => {
    if (!spin || explode) return;
    obj.current?.getObjectByName("defaultMaterial_45")?.rotateY(delta * 10);
  });

  /* hover 高亮：逐帧把自发光插向目标色，移开后平滑复原 */
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-10 * delta);
    obj.current?.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const mat = child.material as MeshStandardMaterial;
      if (!mat.emissive) return;
      mat.emissive.lerp(
        child.userData.focus ? HOVER_EMISSIVE : IDLE_EMISSIVE,
        k
      );
    });
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.object instanceof Mesh) {
      e.object.userData.focus = true;
      // GLB 里的网格名多是 defaultMaterial_N，直接展示没什么意义，
      // 所以只展示序号，名字非默认时才给出来
      const raw = e.object.name ?? "";
      const isDefault = /^defaultMaterial/i.test(raw);
      setHoverPart(isDefault ? `部件 #${e.object.id}` : raw);
      document.body.style.cursor = "pointer";
    }
  };

  const onOut = (e: ThreeEvent<PointerEvent>) => {
    if (e.object instanceof Mesh) e.object.userData.focus = false;
    setHoverPart(null);
    document.body.style.cursor = "auto";
  };

  return (
    <group scale={2} position-z={-1}>
      <Clone
        deep
        castShadow
        receiveShadow
        ref={obj}
        object={scene}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
    </group>
  );
}