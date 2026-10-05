import styled from "styled-components";
import Map from "./map";
import Panel from "./panel";

const Wrapper = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

/**
 * 注意：不在这里包一层带 pointer-events:auto 的全屏容器。
 * Panel 内层的 ConsoleFrame.Root 已经是
 * `position:absolute; inset:0; pointer-events:none`，
 * 多包一层会把 Canvas 盖住，导致 3D 地图完全收不到指针事件。
 */
export default function Index() {
  return (
    <Wrapper>
      <Map />
      <Panel />
    </Wrapper>
  );
}