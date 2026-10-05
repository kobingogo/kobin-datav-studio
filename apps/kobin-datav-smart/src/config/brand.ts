/**
 * kobin-datav 品牌与主题配置（智慧城市运营版）
 * 页面上的所有数值均为 mockjs 随机生成的演示数据，不代表任何真实统计。
 */
export const brand = {
  name: "kobin-datav",
  title: "kobin-datav · 智慧城市运营大屏",
  // 中心地图：china = 全国，可下钻省份
  map: { rootCode: "china", rootName: "全国", allowDrill: true },
  panels: {
    leftTop: "物联感知设备总览",
    leftCenter: "感知终端状态",
    leftBottom: "设备上下线动态",
    centerMap: "全国物联设备分布",
    centerBottom: "各城市终端接入计划",
    rightTop: "近 6 月事件趋势",
    rightCenter: "城市告警排名(TOP8)",
    rightBottom: "实时告警明细",
  },
  labels: {
    leftTop: ["接入设备", "在线", "离线", "告警"],
    pie: ["运行", "停用", "维护", "异常"],
    pieCenter: "终端数",
    unit: "个",
    centerBottom: ["已接入", "计划接入", "接入率"],
    rightTop: ["设备告警", "工单事件"],
    rightTopShort: ["告警", "工单"],
    rankUnit: "次",
    rbValue: "告警值：",
    rbModel: "型号：",
    rbContent: "告警内容：",
  },
  theme: {
    border: ["#3b8cff", "#2cf7fe"] as [string, string],
    mapEdge: "rgba(120, 230, 255, .85)",
    mapGlow: "rgba(80, 210, 255, .35)",
    mapVisual: [
      "rgba(230,250,255,.85)",
      "rgba(170,235,255,.9)",
      "rgba(100,210,250,.9)",
      "rgba(30,170,240,.9)",
      "rgba(15,120,200,.9)",
      "rgba(10,75,150,.9)",
    ],
    bar: ["#2ad6ff", "#1a6cff"],
    barPlan: "rgba(42,160,255,",
    rateLine: "#ffd04a",
  },
};
export default brand;
