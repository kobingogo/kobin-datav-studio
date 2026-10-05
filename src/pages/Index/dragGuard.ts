/**
 * 拖拽抑制
 * ------------------------------------------------------------------
 * 展台支持拖拽擦洗之后，"拖一下再松手"与"点一下"在浏览器看来都是一次 click。
 * R3F 的点击容差不足以覆盖这种情况 —— 实际测试里拖动 480px 松手仍然触发了
 * 展台的 onClick，直接跳进了对应的大屏。
 *
 * 与其依赖 R3F 内部的位移阈值，不如自己记账：
 * 拖拽过程中打标记，点击时消费标记并跳过本次跳转。
 * 标记存在模块级变量而不是 store —— 它每帧都可能变，
 * 不该引起任何 React 重渲染。
 */

let draggedAt = 0;
/** 超过这个时间窗内的拖拽仍算"刚刚拖过"（覆盖松手瞬间的竞态） */
const WINDOW = 220;

export function markDrag() {
  draggedAt = Date.now();
}

/** 返回 true 表示"刚刚发生过拖拽，本次点击应被忽略"，并消费掉标记 */
export function consumeDrag(): boolean {
  if (!draggedAt) return false;
  const hit = Date.now() - draggedAt < WINDOW;
  draggedAt = 0;
  return hit;
}

export function resetDrag() {
  draggedAt = 0;
}