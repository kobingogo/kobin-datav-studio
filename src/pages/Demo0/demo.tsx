import styled from "styled-components";
import Panel from "./panel";
import Map from "./map";
import { palette } from "../../theme/tokens";

const Wrapper = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: ${palette.void};
`;

/**
 * 不要在 Map 与 Panel 之间再包一层 pointer-events:auto 的全屏容器：
 * Panel 内层的 ConsoleFrame.Root 已经是
 * `position:absolute; inset:0; pointer-events:none`，
 * 多包一层会把 Canvas 盖住，3D 地图收不到任何指针事件。
 * （这个坑在 demo1 踩过一次。）
 */
export default function Demo() {
  return (
    <Wrapper>
      <Map />
      <Panel />
    </Wrapper>
  );
}
