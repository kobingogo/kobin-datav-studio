import { palette } from "../../../theme/tokens";

/**
 * 灯光
 * ------------------------------------------------------------------
 * 原版 ambient 2.0 + directional 12.0，是为米白底 + 高强度贴图调的。
 * 深空底色下需要整体压暗：环境光降到 0.55，主光降到 2.6，
 * 再补一盏冷色补光让挤出体的侧面有轮廓，避免纯黑场景里"面与面糊在一起"。
 */
export default function Lights() {
  return (
    <>
      {/* 环境光：近黑场景下不能太低，否则挤出体侧面与底座糊成一片 */}
      <ambientLight intensity={1.15} color={palette.surfaceHi} />
      {/* 主光：从正上方偏前，模拟"大屏投影"的均匀打光 */}
      <directionalLight
        intensity={2.4}
        position={[0, 200, 90]}
        color={palette.cyanSoft}
      />
      {/* 侧后方冷色补光：勾出挤出体侧壁与市界轮廓 */}
      <directionalLight
        intensity={1.1}
        position={[-140, 70, -90]}
        color={palette.indigo}
      />
      {/* 地照：让热力图覆盖区不至于死黑 */}
      <pointLight
        intensity={1.6}
        distance={460}
        decay={2}
        position={[0, 30, 0]}
        color={palette.cyanDeep}
      />
    </>
  );
}