import { Vector2 } from "three";

/**
 * 碎岛过滤
 * ------------------------------------------------------------------
 * 浙江省的舟山群岛有一千多个小岛，其中绝大多数是几百米级的礁石。
 * 它们在 GeoJSON 里是极细的多边形环，挤出（ExtrudeGeometry）之后
 * 会变成一堆针尖状竖刺 —— 视觉上像渲染出错，而不是海岛。
 *
 * 按「投影后的面积」过滤而不是按经纬度跨度：投影面积与屏幕观感
 * 直接相关，且与省无关，换省也照样成立。
 */

/**
 * 面积阈值（投影世界单位²）。
 *
 * 取 4 的依据：挤出深度是 6，等效边长 sqrt(A)。
 * A < 4 时边长 < 2，宽高比 > 3，看上去就是一根针。
 * 实测浙江：舟山 94 个环，最大岛 56.1，按 4 过滤后保留 9 个 ——
 * 主岛与主要岛屿都在，85 个礁石被剔除。
 */
const DEFAULT_MIN_AREA = 4;

/** 投影平面上的多边形面积（鞋带公式绝对值） */
export function ringArea(ring: Vector2[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  }
  return Math.abs(a / 2);
}

/**
 * 丢掉小于阈值的环。
 *
 * @param points 每个环的投影坐标
 * @param minArea 投影面积阈值（世界单位²），默认见 DEFAULT_MIN_AREA。
 */
export function dropSlivers(
  points: Vector2[][],
  minArea = DEFAULT_MIN_AREA
): Vector2[][] {
  return points.filter((ring) => ringArea(ring) >= minArea);
}

/** 统计被丢弃的环数，用于确认阈值是否合理 */
export function sliverCount(
  points: Vector2[][],
  minArea = DEFAULT_MIN_AREA
): { kept: number; dropped: number } {
  const kept = dropSlivers(points, minArea).length;
  return { kept, dropped: points.length - kept };
}