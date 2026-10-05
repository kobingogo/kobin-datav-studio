import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useNavigate } from "react-router";
import { MathUtils, type Group } from "three";
import Station from "./panel";
import { AUTO_IDLE_MS, DEMOS, useLanding } from "./store";
import { consumeDrag, markDrag, resetDrag } from "./dragGuard";

/**
 * 展台环
 * ------------------------------------------------------------------
 * 原实现的问题（都是"看起来像轮盘，其实不是"）：
 *   · 8 张卡对应 4 个 demo，每个 demo 出现两次、相隔 180°。代价是任意时刻画面里
 *     都有两组内容互相重叠，读不出当前焦点，而且一半绘制是冗余的
 *   · fov 15 / camera z=100 的长焦把圆环压成近乎一条直线，没有真正的空间关系，
 *     所谓的"3D"只靠 drei Image 自带的弯曲与径向模糊撑场面
 *   · ScrollControls 只提供连续 offset：没有吸附、没有键盘、没有空闲自动巡览，
 *     外部也不知道"现在是第几个"
 *
 * 改为：展台排在一段圆弧上，环带阻尼旋转并磁吸到目标站位。
 * 所有输入路径（滚轮 / 拖拽 / 键盘 / 点击展台 / 点击进度条 / 点击空白）
 * 都汇入同一个 store，因此"正对相机的那一个"在任何操作下都唯一且明确。
 *
 * 几何参数（半径 / 站位间距 / 同屏可读块数）都在 ./layout，
 * 改那里之前先用 `node tools/arc-fit.mjs` 看投影结果，别靠肉眼试。
 */
import { RING, SPREAD_RAD, stationTheta, targetAngleFor } from "./layout";

const RADIUS = RING.radius;
const SPREAD = SPREAD_RAD;

export default function Ring() {
  const navigate = useNavigate();
  const ring = useRef<Group>(null!);
  const gl = useThree((s) => s.gl);

  const active = useLanding((s) => s.active);
  const hover = useLanding((s) => s.hover);
  const step = useLanding((s) => s.step);
  const goto = useLanding((s) => s.goto);
  const poke = useLanding((s) => s.poke);
  const setHover = useLanding((s) => s.setHover);

  /** 环的当前旋转角（连续量，用于阻尼） */
  const angle = useRef(0);

  /**
   * facings 用 ref 装一个 Float32Array，而不是 useMemo + 普通数组。
   *
   * 之前是 `useMemo(() => [...].fill(0))` 并在 useFrame 里原地赋值。
   * 数组引用永远不变 → React 永远不会因为 facings 变化而重渲染 Ring，
   * 于是传给 Station 的 `facing` prop 被永久冻结在「上次 Ring 重渲染那一刻」
   * 的值。实测：
   *     ringF=[1,0.75,0.15,0]   propF=[0,0,0,0]        ← 首屏四个展台 f 全 0 → 全黑
   *     ringF=[0.75,1,0.75,0.15] propF=[1,0.75,0.15,0] ← 落后一整拍
   * 而首屏没有任何 store 变化，所以那一次重渲染都不会发生 → 永远是空展台。
   *
   * 现在传稳定的 ref，Station 在自己的 useFrame 里读，彻底不依赖重渲染时机。
   */
  /** 上一次已结算的 active，仅用于在帧内检测"索引变了"（触发一次快照） */
  const settledActive = useRef(active);

  const facings = useRef(new Float32Array(DEMOS.length));
  const facingTargets = useRef(new Float32Array(DEMOS.length));

  /* 空闲自动巡览的下一跳时刻 */
  const nextAt = useRef(Date.now() + AUTO_IDLE_MS);
  useEffect(() => {
    nextAt.current = Date.now() + AUTO_IDLE_MS;
  }, [active]);

  /* 全部输入通道 ───────────────────────────────────────────── */
  useEffect(() => {
    const el = gl.domElement;

    /* 滚轮：累积到阈值才切一站，做出"档位感" */
    let wheelAcc = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      poke();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) > 90) {
        step(wheelAcc > 0 ? 1 : -1);
        wheelAcc = 0;
      }
    };

    /* 拖拽擦洗：拖动过程中直接改 angle 获得即时跟手的手感，
       松手时把累计的弧长折算成整数步、交给 step() 结算。
       之所以不"拖完就停在半格"：那样画面中央会停在一个不存在的位置，
       与进度条失配。 */
    let dragging = false;
    let lastX = 0;
    let swept = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      swept = 0;
      resetDrag();
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const d = dx * 0.0052;
      angle.current += d;
      swept += d;
      markDrag();
      poke();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      // 1 弧度 ≈ 0.7 格 → 用 SPREAD 归一；夹在 ±3 步内避免一次甩飞
      const n = Math.max(
        -DEMOS.length,
        Math.min(DEMOS.length, Math.round(swept / SPREAD))
      );
      if (n !== 0) step(-n);
    };

    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          step(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          step(-1);
          break;
        case "Home":
          goto(0);
          break;
        case "End":
          goto(DEMOS.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          navigate(DEMOS[useLanding.getState().active].route);
          return;
        default:
          return;
      }
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [gl, poke, step, goto, navigate]);

  useFrame((state, delta) => {
    const s = useLanding.getState();

    // 空闲 5s → 恢复自动巡览；到点 → 前进一站
    if (!s.auto && Date.now() - s.lastInput > AUTO_IDLE_MS) {
      useLanding.setState({ auto: true });
      nextAt.current = Date.now() + AUTO_IDLE_MS;
    }
    if (s.auto && Date.now() > nextAt.current) {
      useLanding.getState().step(1);
      nextAt.current = Date.now() + AUTO_IDLE_MS;
    }

    /* 目标角度：active 的绝对函数，不做增量累加。

       早先用的是「单调 pos 累加」（angle = -pos × SPREAD），
       想让"从最后一张走回第一张"也继续向前转。但站位间距是 40°、
       一共 4 个站，走满一轮只转 160° 而不是 360° —— 于是每循环一次
       就整体漂移 160°。实测连按两次后 active=0，而 ringF[0]=0：
       位置是 pos=4 → angle=-160°，而 active=0 要求 angle=0。
       数学上环是对的，但选中项已经转到背后去了。

       现在直接由 active 求：angle = -active × SPREAD，
       再加减 360° 的整数倍，取离当前角度最近的那个等价角。
       效果：
         · 首屏精确落在 active=0（angle=0），不会有任何残留偏移
         · 每次切换都是一小步（最短等价角）
         · 永远不累积漂移 —— 选中项永远精确正对相机 */
    let targetAngle = targetAngleFor(s.active);
    if (s.active !== settledActive.current) {
      settledActive.current = s.active;
    }
    const TWO_PI = Math.PI * 2;
    while (targetAngle - angle.current > Math.PI) targetAngle -= TWO_PI;
    while (targetAngle - angle.current < -Math.PI) targetAngle += TWO_PI;

    // 磁吸：阻尼逼近目标角度
    angle.current = MathUtils.damp(angle.current, targetAngle, 3.6, delta);

    if (ring.current) {
      ring.current.rotation.y = angle.current;
      // 静止时的指针视差，避免画面完全死板
      ring.current.rotation.x = MathUtils.damp(
        ring.current.rotation.x,
        state.pointer.y * 0.035,
        4,
        delta
      );
      ring.current.position.x = MathUtils.damp(
        ring.current.position.x,
        state.pointer.x * 0.28,
        4,
        delta
      );
    }

    // facing：站点世界角度越接近 0（正对相机）越接近 1
    for (let i = 0; i < DEMOS.length; i++) {
      const world = i * SPREAD + angle.current;
      let a = world % (Math.PI * 2);
      if (a > Math.PI) a -= Math.PI * 2;
      if (a < -Math.PI) a += Math.PI * 2;
      /* cos: 1 正前、-1 正后；指数让侧翼更快衰减但不清零到不可见 */
      facingTargets.current[i] = Math.max(0, Math.cos(a)) ** RING.expFacing;
    }
    for (let i = 0; i < DEMOS.length; i++) {
      facings.current[i] = MathUtils.damp(
        facings.current[i],
        facingTargets.current[i],
        8,
        delta
      );
    }

  });

  const enter = (i: number) => navigate(DEMOS[i].route);

  return (
    /* ref 必须挂在这里：旋转、指针视差都作用在这个 group 上 */
    <group ref={ring}>
      {DEMOS.map((d, i) => {
        const theta = stationTheta(i);
        return (
          <group
            key={d.id}
            position={[Math.sin(theta) * RADIUS, 0, Math.cos(theta) * RADIUS]}
            rotation={[0, theta, 0]}>
            <Station
              demo={d}
              index={i}
              facings={facings}
              hovered={hover === i}
              onEnter={() => enter(i)}
              onHover={(v) => setHover(v ? i : null)}
            />
          </group>
        );
      })}

      {/*
        背景背板：承接"点击空白处进入当前展台"。
        之前把它挂在环的 onClick 上，结果拖拽擦洗松手时也会触发跳转
        ——R3F 的 click 容差只按指针位移判定，而这里的位移被拖拽逻辑消费了。
        改成一块独立的、位于所有展台之后的大平面：射线先命中展台（展台会 stopPropagation），
        命中不到任何展台时才落到背板，语义就干净了。
      */}
      <mesh
        position={[0, 0, -14]}
        onClick={() => {
          if (consumeDrag()) return;
          enter(useLanding.getState().active);
        }}>
        <planeGeometry args={[80, 50]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export { RADIUS, SPREAD };