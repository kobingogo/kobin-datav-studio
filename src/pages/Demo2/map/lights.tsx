import { palette } from "../../../theme/tokens";

/**
 * 灯光
 * ------------------------------------------------------------------
 * 原版 ambient 2.0 + directional 10.0 的纯白组合，是给纯黑背景 +
 * 高对比扫光 shader 配的，整体过曝。改为冷色分层：
 * 低位环境光铺底、顶部主光造型、背侧靛蓝补光勾轮廓，
 * 让挤出体侧壁、底座与飞线在同一套冷色体系里。
 */
export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.9} color={palette.surfaceHi} />
      <directionalLight
        intensity={2.2}
        position={[0, 50, -20]}
        color={palette.cyanSoft}
      />
      <directionalLight
        intensity={1.0}
        position={[-30, 20, 40]}
        color={palette.indigo}
      />
    </>
  );
}