import { createGlobalStyle } from "styled-components";
import { cssVars, fontSize, type } from "./tokens";

export const GlobalStyle = createGlobalStyle`
  :root {
    ${Object.entries(cssVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join("\n    ")}

    color-scheme: dark;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }

  body {
    background: var(--c-void);
    color: var(--c-text);
    font-family: ${type.sans};
    font-size: ${fontSize.base}px;
    line-height: 1.5;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* 所有数字使用等宽 + 表格数字，避免实时刷新时字宽抖动 */
  .num,
  input[type="number"] {
    font-family: ${type.mono};
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    letter-spacing: -0.01em;
  }

  /* 深空皮肤下的滚动条：细、暗、低对比，不与数据抢注意力 */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--c-line-strong);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--c-cyan-deep);
  }

  button {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  ::selection {
    background: rgba(79, 209, 255, 0.28);
  }

  canvas {
    display: block;
    outline: none;
  }

  /* 尊重系统动效偏好：关闭所有过渡与动画 */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;