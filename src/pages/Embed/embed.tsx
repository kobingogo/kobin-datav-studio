import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { palette } from "@/theme/tokens";

/**
 * 外挂大屏宿主 —— 用 iframe 挂载独立 Vue 工程构建出来的静态产物。
 *
 * 为什么要 iframe 而不是把 Vue 组件接进来
 * ------------------------------------------------------------------
 * kobin-datav-hangzhou / kobin-datav-smart 是两套独立的 Vue + Vite 工程，
 * 带 Element Plus、mockjs、自己的 ECharts 主题与 2000 行视图层。
 * 它们的品牌色、字体栈、布局基准（1920×1080 定点缩放）与 Kobin Datav 的
 * token 体系是两套东西，硬接进 React 树要付出重写样式的代价，且两边
 * 各自迭代时会持续互相打断。
 *
 * iframe 的代价是**失去样式与状态共享**：进站后是另一套设计语言，
 * 所以落地页铭牌上用靛色「静态集成」标签明确区分，不让它伪装成原生页。
 *
 * 产物位置与前置条件见 tools/build-embedded.mjs 的注释。
 */

/**
 * 产物 URL。
 *
 * 两个要点：
 *  1. 用 import.meta.env.BASE_URL 跟着 vite base 走，不写死基路径
 *  2. 必须显式带 index.html —— 目录形式（…/dir/）在 vite dev 下会被 SPA
 *     fallback 吃掉，返回 Kobin Datav 自己的 index.html，于是 iframe 里会
 *     再套一个落地页；静态托管与 dev 对目录 URL 的处理也不一致。
 */
export const embeddedUrl = (dir: string) =>
  `${import.meta.env.BASE_URL}${dir}/index.html`;

/*
 * 铺满整屏，但不能用 position: fixed。
 *
 * App.tsx 给外层 wrapper 加了 willChange: "transform"，而 transform /
 * will-change:transform / filter / perspective 会让该元素成为
 * position:fixed 子元素的包含块 —— 于是这里的 inset:0 参照的是 wrapper
 * 而不是视口。wrapper 的高度由其常规流内容决定，而唯一的子元素（Frame）
 * 本身是 fixed、脱离文档流，于是 wrapper 高度为 0，Frame 也被算成 0 高：
 * 表现为嵌入页一片纯底色，iframe 明明已加载完成。
 *
 * 落地页 Index 的 Wrapper 用的是 100vw/100vh 而非 fixed，正是因为这个坑。
 */
const Frame = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: ${palette.void};
`;

const Surface = styled.iframe`
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  /* 嵌入页是另一套设计语言，宿主只负责把它完整铺满，不做任何修饰 */
  background: ${palette.void};
`;

/**
 * 载入进度：这两块大屏首屏要拉 map-geojson（两个工程各约 7.8MB）
 * 再起 ECharts，实测冷启动 3~6 秒。空窗期不给反馈会被当成白屏。
 */
const Bar = styled.div<{ $done: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  z-index: 30;
  overflow: hidden;
  opacity: ${({ $done }) => ($done ? 0 : 1)};
  transition: opacity 420ms ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 32%;
    background: ${palette.cyan};
    box-shadow: 0 0 10px ${palette.cyan};
    animation: sweep 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes sweep {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(320%);
    }
  }
`;

const Hint = styled.div<{ $done: boolean }>`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
  opacity: ${({ $done }) => ($done ? 0 : 1)};
  transition: opacity 420ms ease;
`;

const HintTitle = styled.div`
  font-size: var(--fs-lg);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--c-text-dim);
`;

const HintSub = styled.div`
  font-size: var(--fs-micro);
  font-family: var(--font-mono);
  letter-spacing: 0.18em;
  color: var(--c-text-faint);
`;

/**
 * 返回控件。
 *
 * 位置选在右下角而不是左上：被嵌入的两块大屏左上角有 kobin-datav logo、
 * 右上角有日期时间与设置齿轮、左下角有 mock 数据声明，
 * 四个角都被占了，右下是唯一空位。
 * 默认压到 38% 不透明度，鼠标移上去才亮起 —— 大屏本身是主角，
 * 常驻一个高对比按钮会一直把它压住。
 */
const Back = styled.button`
  position: absolute;
  right: var(--sp-xl);
  bottom: var(--sp-xl);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  letter-spacing: 0.04em;
  color: var(--c-text-dim);
  background: rgba(7, 11, 20, 0.72);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-sm);
  backdrop-filter: blur(8px);
  opacity: 0.38;
  transition:
    opacity var(--e-fast),
    color var(--e-fast),
    border-color var(--e-fast);

  &:hover,
  &:focus-visible {
    opacity: 1;
    color: ${palette.cyan};
    border-color: ${palette.cyanDeep};
  }
`;

export interface EmbedProps {
  /** public/ 下的产物目录名 */
  dir: string;
  /** 大屏标题，用于载入提示 */
  title: string;
}

export default function Embed({ dir, title }: EmbedProps) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);

  const url = embeddedUrl(dir);

  // 切站时把载入态复位：同一组件复用时 ready 会一直是 true
  useEffect(() => {
    setReady(false);
  }, [url]);

  // Esc 返回展廊。大屏是全屏场景，键盘出口比鼠标更符合预期，
  // 且被嵌入的 Vue 工程自己也在用键盘，两边不冲突（事件各在自己的 document）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <Frame>
      <Bar $done={ready} />
      <Hint $done={ready}>
        <HintTitle>{title}</HintTitle>
        <HintSub>LOADING</HintSub>
      </Hint>
      <Surface
        src={url}
        title={title}
        onLoad={() => setReady(true)}
        /* 嵌入页与落地页是两个独立应用，禁掉 referrer 顺手减少一点外部依赖 */
        referrerPolicy="no-referrer"
      />
      <Back ref={backRef} onClick={() => navigate("/")} title="返回展廊（Esc）">
        ← 返回展廊
      </Back>
    </Frame>
  );
}