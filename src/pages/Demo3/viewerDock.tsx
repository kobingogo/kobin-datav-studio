/**
 * 模型查看器控制条
 * ------------------------------------------------------------------
 * 原来的所有操作都在 leva 面板里：产品环境下那是一个开发期调试浮窗，
 * 用户既不知道"拆解/还原"存在，也没有键盘入口、没有状态反馈。
 *
 * 这里给出正式控件：每个开关都带文字标签 + LED 状态点 + title 说明，
 * 并接上快捷键（E 拆解 / W 线框 / Space 自转 / R 复位视角）。
 */
import { useEffect } from "react";
import styled from "styled-components";
import { useViewer } from "../../console/viewerStore";
import { palette } from "@/theme/tokens";

const Root = styled.div`
  position: absolute;
  left: 50%;
  bottom: var(--sp-xl);
  transform: translateX(-50%);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  pointer-events: auto;
`;

const Bar = styled.div`
  display: flex;
  align-items: stretch;
  gap: 1px;
  padding: 1px;
  border: 1px solid ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(10px);
`;

const Item = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  white-space: nowrap;
  font-size: var(--fs-micro);
  color: ${({ $on }) => ($on ? palette.cyanSoft : palette.textFaint)};
  background: ${({ $on }) => ($on ? "rgba(79,209,255,0.07)" : "transparent")};
  transition:
    color var(--e-fast),
    background var(--e-fast);

  &:hover {
    color: ${palette.cyan};
    background: rgba(79, 209, 255, 0.09);
  }
`;

const Led = styled.span<{ $on: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: ${({ $on }) => ($on ? palette.cyan : "transparent")};
  border: 1px solid ${({ $on }) => ($on ? palette.cyan : palette.lineStrong)};
  box-shadow: ${({ $on }) => ($on ? `0 0 6px ${palette.cyan}` : "none")};
  transition: all var(--e-fast);
`;

const Key = styled.kbd`
  margin-left: 2px;
  padding: 0 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--c-text-faint);
  border: 1px solid ${palette.line};
  border-radius: 2px;
`;

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  padding: 0 var(--sp-md);
  height: 28px;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
  border: 1px solid ${palette.line};
  border-radius: 2px;
  background: rgba(7, 11, 20, 0.86);
  backdrop-filter: blur(10px);
  white-space: nowrap;
`;

const Num = styled.span`
  color: ${palette.cyan};
`;

export default function ViewerDock() {
  const {
    explode,
    wireframe,
    spin,
    partCount,
    setExplode,
    setWireframe,
    setSpin,
    resetView,
  } = useViewer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入框里打字时不要触发快捷键
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case "e":
          setExplode(!explode);
          break;
        case "w":
          setWireframe(!wireframe);
          break;
        case " ":
          setSpin(!spin);
          e.preventDefault();
          break;
        case "r":
          resetView();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explode, wireframe, spin, setExplode, setWireframe, setSpin, resetView]);

  return (
    <Root>
      <Bar>
        <Item
          $on={explode}
          onClick={() => setExplode(!explode)}
          aria-pressed={explode}
          title={explode ? "收拢模型（E）" : "沿轴分层拆解（E）"}>
          <Led $on={explode} />
          {explode ? "还原" : "拆解"}
          <Key>E</Key>
        </Item>
        <Item
          $on={wireframe}
          onClick={() => setWireframe(!wireframe)}
          aria-pressed={wireframe}
          title={wireframe ? "关闭线框（W）" : "开启线框（W）"}>
          <Led $on={wireframe} />
          线框
          <Key>W</Key>
        </Item>
        <Item
          $on={spin}
          onClick={() => setSpin(!spin)}
          aria-pressed={spin}
          title={spin ? "停止自转（空格）" : "开启自转（空格）"}>
          <Led $on={spin} />
          自转
          <Key>␣</Key>
        </Item>
        <Item $on={false} onClick={resetView} title="复位视角（R）">
          复位视角
          <Key>R</Key>
        </Item>
      </Bar>

      <Meta>
        部件 <Num>{partCount}</Num>
      </Meta>
    </Root>
  );
}