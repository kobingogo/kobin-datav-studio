/**
 * kobin-datav 品牌与主题配置（杭州市城市运行版）
 * 页面上的所有数值均为 mockjs 随机生成的演示数据，不代表杭州任何真实统计。
 */
export const brand = {
  name: "kobin-datav",
  title: "kobin-datav · 杭州市城市运行大屏",
  // 中心地图：杭州市（adcode 330100），geojson 来自 DataV GeoAtlas，不再下钻
  map: { rootCode: "330100", rootName: "杭州市", allowDrill: false },
  panels: {
    leftTop: "城市感知设备总览",
    leftCenter: "城市事件处置状态",
    leftBottom: "各区设备动态",
    centerMap: "杭州市各区感知设备分布",
    centerBottom: "各区事件受理与办结",
    rightTop: "近 6 月交通与文旅客流",
    rightCenter: "各区事件量排名(TOP8)",
    rightBottom: "城市运行实时告警",
  },
  labels: {
    leftTop: ["感知设备", "在线", "离线", "告警"],
    pie: ["已办结", "处置中", "待派单", "超时"],
    pieCenter: "事件数",
    unit: "件",
    centerBottom: ["已办结", "受理量", "办结率"],
    rightTop: ["地铁客运量(万人次)", "重点景区客流(万人次)"],
    rightTopShort: ["地铁", "景区"],
    rankUnit: "件",
    rbValue: "指标值：",
    rbModel: "点位：",
    rbContent: "告警内容：",
  },
  theme: {
    border: ["#1fb5a3", "#7ff5e1"] as [string, string],
    mapEdge: "rgba(140, 245, 225, .85)",
    mapGlow: "rgba(60, 220, 190, .35)",
    mapVisual: [
      "rgba(225,252,245,.85)",
      "rgba(170,240,225,.9)",
      "rgba(105,220,200,.9)",
      "rgba(40,185,170,.9)",
      "rgba(18,135,135,.9)",
      "rgba(10,88,100,.9)",
    ],
    bar: ["#5ff0d2", "#139aa6"],
    barPlan: "rgba(40,200,190,",
    rateLine: "#ffc857",
  },
};
export default brand;
