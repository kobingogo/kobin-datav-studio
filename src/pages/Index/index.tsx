import { Suspense } from "react";
import styled, { keyframes } from "styled-components";
import { Canvas } from "@react-three/fiber";
import { palette } from "@/theme/tokens";
import Ring from "./ring";
import Env from "./env";
import { DEMOS, useLanding } from "./store";

/**
 * 落地页 · 展厅环廊
 * ------------------------------------------------------------------
 * 视觉：四站展台排在一段圆弧上，环带可拖动/滚轮/键盘旋转并磁吸到站位；
 *      选中的展台正面朝相机、满亮并抬起，其余退到侧后方压暗；
 *      地面有与展台同半径的轨道环，把"这是可转动的"画出来。
 * 交互：滚轮分档切换 · 拖拽擦洗 · ←/→/Home/End 切换 · Enter 进入 ·
 *      点击展台或点击空白进入 · 底部进度条直达 · 空闲 5s 自动巡览
 *
 * 原实现（8 张卡 + fov15 长焦 + ScrollControls + simplex 噪声背景）
 * 的问题与逐条改法见 ring.tsx / env.tsx 的注释。
 */

const Wrapper = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(
      120% 90% at 50% 46%,
      ${palette.canvas} 0%,
      ${palette.void} 78%
    );
`;

/**
 * 左侧压暗层。
 * 弧线排布下，最外侧那块展台会横穿到画面左侧，
 * 而左侧正好是标题与说明文案的所在 —— 直接叠字会被展台内容干扰。
 * 这层渐变把左侧压下去，文案始终有稳定对比度。
 */
const LeftScrim = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  width: 44%;
  z-index: 5;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    ${palette.void}f2 0%,
    ${palette.void}d9 38%,
    ${palette.void}80 68%,
    transparent 100%
  );
`;

/* ── 品牌 ─────────────────────────────────────────────────────── */

const Brand = styled.header`
  position: absolute;
  left: var(--sp-xxl);
  top: var(--sp-xxl);
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  z-index: 10;
  pointer-events: none;
`;

const BrandMark = styled.span`
  width: 3px;
  height: 30px;
  border-radius: 2px;
  background: linear-gradient(180deg, ${palette.cyan}, ${palette.indigo});
  box-shadow: 0 0 14px ${palette.cyan}80;
  flex: none;
`;

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.25;
`;

const BrandName = styled.span`
  font-size: var(--fs-md);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--c-text);
`;

const BrandSub = styled.span`
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.2em;
  color: var(--c-text-faint);
  text-transform: uppercase;
`;

/* ── 左侧：当前展台的说明 ─────────────────────────────────────── */

const Info = styled.section`
  position: absolute;
  left: var(--sp-xxl);
  top: 116px;
  width: 330px;
  z-index: 10;
  pointer-events: none;
`;

const GhostNo = styled.div<{ $v2: boolean }>`
  font-family: var(--font-mono);
  font-size: 72px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: ${({ $v2 }) => ($v2 ? palette.cyanDeep : palette.lineStrong)};
  opacity: 0.85;
`;

const InfoTitle = styled.h2`
  margin: 10px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--c-text);
`;

const InfoSub = styled.div`
  margin-top: 4px;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.2em;
  color: ${palette.cyan};
  text-transform: uppercase;
`;

const InfoDesc = styled.p`
  margin: 12px 0 0;
  font-size: var(--fs-base);
  line-height: 1.7;
  color: var(--c-text-dim);
  padding-top: 12px;
  border-top: 1px solid var(--c-line);
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
`;

const Chip = styled.span`
  padding: 3px 9px;
  font-size: var(--fs-micro);
  color: var(--c-text-dim);
  border: 1px solid var(--c-line);
  border-radius: 2px;
  background: rgba(11, 17, 32, 0.6);
  white-space: nowrap;
`;

/* ── 右上：操作提示 ───────────────────────────────────────────── */

const Hints = styled.aside`
  position: absolute;
  right: var(--sp-xxl);
  top: var(--sp-xxl);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
`;

const HintRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-micro);
  color: var(--c-text-faint);
`;

const Key = styled.kbd`
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--c-text-dim);
  border: 1px solid var(--c-line);
  border-radius: 2px;
  background: rgba(11, 17, 32, 0.7);
`;

const AutoTag = styled.div<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 3px 9px;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  color: ${({ $on }) => ($on ? palette.cyan : palette.textFaint)};
  border: 1px solid
    ${({ $on }) => ($on ? palette.cyanDeep : palette.line)};
  border-radius: 2px;
  background: ${({ $on }) =>
    $on ? "rgba(79,209,255,0.08)" : "transparent"};
  transition: all var(--e-base);
`;

const Led = styled.span<{ $on: boolean }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? palette.cyan : "transparent")};
  border: 1px solid ${({ $on }) => ($on ? palette.cyan : palette.lineStrong)};
  box-shadow: ${({ $on }) => ($on ? `0 0 6px ${palette.cyan}` : "none")};
  animation: ${({ $on }) => ($on ? pulse : "none")} 1.8s ease-in-out infinite;
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

/* ── 底部：进度条 + 进入提示 ──────────────────────────────────── */

const Dock = styled.footer`
  position: absolute;
  left: 50%;
  bottom: var(--sp-xl);
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-md);
`;

const Rail = styled.nav`
  display: flex;
  align-items: stretch;
  gap: 1px;
  padding: 1px;
  border: 1px solid var(--c-line);
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.78);
  backdrop-filter: blur(10px);
`;

const RailItem = styled.button<{ $on: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  color: ${({ $on }) => ($on ? palette.text : palette.textMute)};
  background: ${({ $on }) =>
    $on ? "rgba(79,209,255,0.1)" : "transparent"};
  transition:
    color var(--e-fast),
    background var(--e-fast);

  &:hover {
    color: ${palette.cyan};
    background: rgba(79, 209, 255, 0.07);
  }
`;

const RailNo = styled.span<{ $on: boolean }>`
  font-family: var(--font-mono);
  font-size: 10px;
  color: ${({ $on }) => ($on ? palette.cyan : palette.textFaint)};
`;

const RailLabel = styled.span`
  font-size: var(--fs-small);
  white-space: nowrap;
`;

/* 选中项顶部的一条短进度线，直观表达"当前" */
const RailMark = styled.span<{ $on: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  background: ${palette.cyan};
  opacity: ${({ $on }) => ($on ? 1 : 0)};
  box-shadow: ${({ $on }) => ($on ? `0 0 8px ${palette.cyan}` : "none")};
  transition: opacity var(--e-base);
`;

const EnterHint = styled.button<{ $v2: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  font-size: var(--fs-small);
  letter-spacing: 0.04em;
  color: ${({ $v2 }) => ($v2 ? "#06222E" : palette.text)};
  background: ${({ $v2 }) =>
    $v2 ? palette.cyan : "rgba(11,17,32,0.8)"};
  border: 1px solid ${({ $v2 }) => ($v2 ? palette.cyan : palette.lineStrong)};
  border-radius: 2px;
  backdrop-filter: blur(8px);
  transition:
    transform var(--e-fast),
    box-shadow var(--e-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px -6px ${palette.cyan}aa;
  }
`;

/* ── 加载遮罩 ─────────────────────────────────────────────────── */

const Loader = styled.div<{ $done: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: ${palette.void};
  opacity: ${({ $done }) => ($done ? 0 : 1)};
  visibility: ${({ $done }) => ($done ? "hidden" : "visible")};
  transition:
    opacity 420ms ease,
    visibility 420ms;
  pointer-events: none;
`;

const sweep = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
`;

const LoaderBar = styled.span`
  width: 120px;
  height: 2px;
  background: ${palette.line};
  overflow: hidden;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: ${palette.cyan};
    animation: ${sweep} 1.1s ease-in-out infinite;
  }
`;

const LoaderText = styled.span`
  font-size: var(--fs-micro);
  font-family: var(--font-mono);
  letter-spacing: 0.18em;
  color: var(--c-text-mute);
`;

/* ── 页面 ─────────────────────────────────────────────────────── */

export default function Index() {
  const active = useLanding((s) => s.active);
  const auto = useLanding((s) => s.auto);
  const ready = useLanding((s) => s.ready);
  const setReady = useLanding((s) => s.setReady);
  const goto = useLanding((s) => s.goto);
  const poke = useLanding((s) => s.poke);

  const demo = DEMOS[active];

  const enter = (route: string) => {
    window.location.hash = `#${route}`;
  };

  return (
    <Wrapper>
      <Canvas
        camera={{ position: [0, 0.2, 9.6], fov: 38, near: 0.1, far: 200 }}
        dpr={[1, 2]}
        onPointerMissed={() => poke()}
        onCreated={({ gl }) => {
          gl.setClearColor(palette.void, 0);
          // 预览图加载完成再撤遮罩，避免开场闪一下空环
          const imgs = DEMOS.map((d) => {
            const im = new Image();
            im.src = d.img;
            return im.decode?.().catch(() => undefined) ?? Promise.resolve();
          });
          Promise.all(imgs).then(() => setReady(true));
        }}>
        <fog attach="fog" args={[palette.void, 12, 30]} />
        <Suspense fallback={null}>
          <Ring />
        </Suspense>
        <Env />
      </Canvas>

      <LeftScrim />

      <Brand>
        <BrandMark />
        <BrandText>
          <BrandName>Kobin 数据大屏</BrandName>
          <BrandSub>Kobin Dataviz · Three.js</BrandSub>
        </BrandText>
      </Brand>

      <Info>
        <GhostNo $v2={demo.v2}>{demo.no}</GhostNo>
        <InfoTitle>{demo.title}</InfoTitle>
        <InfoSub>{demo.subtitle}</InfoSub>
        <InfoDesc>{demo.desc}</InfoDesc>
        <Chips>
          {demo.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </Chips>
      </Info>

      <Hints>
        <HintRow>
          <span>切换展台</span>
          <Key>←</Key>
          <Key>→</Key>
          <span>或拖拽 / 滚轮</span>
        </HintRow>
        <HintRow>
          <span>进入</span>
          <Key>Enter</Key>
          <span>或点击画面</span>
        </HintRow>
        <AutoTag $on={auto}>
          <Led $on={auto} />
          {auto ? "AUTO TOUR · 空闲 5s 后恢复" : "已接管 · 停止自动巡览"}
        </AutoTag>
      </Hints>

      <Dock>
        <Rail>
          {DEMOS.map((d, i) => (
            <RailItem
              key={d.id}
              $on={i === active}
              onClick={() => goto(i)}
              onPointerEnter={() => poke()}
              aria-current={i === active}>
              <RailMark $on={i === active} />
              <RailNo $on={i === active}>{d.no}</RailNo>
              <RailLabel>{d.title}</RailLabel>
            </RailItem>
          ))}
        </Rail>
        <EnterHint
          $v2={demo.v2}
          onClick={() => enter(demo.route)}
          title={`打开 ${demo.title}`}>
          {demo.v2 ? "进入体验" : "进入"} · {demo.title}
        </EnterHint>
      </Dock>

      <Loader $done={ready}>
        <LoaderBar />
        <LoaderText>LOADING PREVIEWS</LoaderText>
      </Loader>
    </Wrapper>
  );
}