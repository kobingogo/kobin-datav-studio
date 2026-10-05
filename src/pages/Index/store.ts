import { create } from "zustand";

import { provinceShort } from "@/geo";

/* 预览图路径跟随 vite base，避免改名/改部署路径后 404 */
const shot = (i: number) => `${import.meta.env.BASE_URL}demo_${i}.jpg`;

export interface DemoEntry {
  id: string;
  no: string;
  title: string;
  /** 英文副标题，与大屏内顶栏的 kicker 形成呼应 */
  subtitle: string;
  /** 一句话说明：这块大屏在做什么 */
  desc: string;
  /** 技术标签 */
  chips: string[];
  route: string;
  /** 预览图 */
  img: string;
  /** v2 重构标记 */
  v2: boolean;
  /** 状态标签 */
  status: string;
  /**
   * 这块大屏怎么进。
   *   native —— sc-datav 内的 React 路由，整屏由本应用渲染
   *   embed  —— 独立 Vue 工程构建成静态产物放进 public/，整屏是一个 iframe
   *
   * 两者进站后画面差别很大（前者与落地页同一套 token，后者是另一套设计语言），
   * 所以状态标签要能区分，否则读者会以为进了同一套东西。
   */
  kind: "native" | "embed";
}

export const DEMOS: DemoEntry[] = [
  {
    id: "demo0",
    no: "01",
    title: `${provinceShort}经济运行监测`,
    subtitle: `${provinceShort} Economic Monitor`,
    desc: "真实卫星影像 + DEM 位移地形做 2.5D 起伏，行政区可悬停下钻，出口/进口排名随选中地区实时联动。",
    chips: ["卫星底图", "位移地形", "出口排名", "地图联动"],
    route: "/demo0",
    img: shot(0),
    v2: true,
    status: "v2 重构",
    kind: "native",
  },
  {
    id: "demo1",
    no: "02",
    title: `${provinceShort}智慧城市数据大脑`,
    subtitle: `${provinceShort} Smart City Brain`,
    desc: "3D 挤出行政区 + 指标热力，地图、图表、KPI 三向联动，点击任一地市州即可下钻到明细。",
    chips: ["地图×图表联动", "点击下钻", "指标带", "口径自证"],
    route: "/demo1",
    img: shot(1),
    v2: true,
    status: "v2 重构",
    kind: "native",
  },
  {
    id: "demo2",
    no: "03",
    title: `${provinceShort}电力全景感知平台`,
    subtitle: `${provinceShort} Power Grid Overview`,
    desc: "自研扫光 shader 打出挤出体侧光，飞线与轨迹描边呈现电网拓扑，与面板共用同一套联动机制。",
    chips: ["扫光 shader", "飞线拓扑", "反射地面", "联动下钻"],
    route: "/demo2",
    img: shot(2),
    v2: true,
    status: "v2 重构",
    kind: "native",
  },
  {
    id: "demo3",
    no: "04",
    title: "3D 模型展示",
    subtitle: "MODEL VIEWER",
    desc: "Stage 三点光 + HDRI 环境光 + Bloom。52 个部件可沿轴分层拆解、悬停高亮、线框透视。",
    chips: ["分层拆解", "部件高亮", "线框切换", "Bloom 后处理"],
    route: "/demo3",
    img: shot(3),
    v2: true,
    status: "v2 重构",
    kind: "native",
  },
  {
    id: "hangzhou",
    no: "05",
    title: "杭州市城市运行大屏",
    subtitle: "Hangzhou City Operations",
    desc: "以感知设备与城市事件为主线：各区设备在线率、事件处置饼图与 TOP8 排名，中心为杭州市 13 区县分级着色。",
    chips: ["Vue 静态集成", "iframe 挂载", "13 区县", "事件处置"],
    route: "/hangzhou",
    img: shot(4),
    v2: true,
    status: "静态集成",
    kind: "embed",
  },
  {
    id: "smart",
    no: "06",
    title: "智慧城市运营大屏",
    subtitle: "National IoT Operations",
    desc: "全国物联设备分布，可下钻到省；终端状态、告警排名与 6 月事件趋势共用同一套联动面板。",
    chips: ["Vue 静态集成", "全国下钻", "终端状态", "告警排名"],
    route: "/smart",
    img: shot(5),
    v2: true,
    status: "静态集成",
    kind: "embed",
  },
];

interface LandingState {
  /** 当前正对相机的展台序号（0..DEMOS.length-1） */
  active: number;
  /** 指针悬停的展台，null = 未悬停 */
  hover: number | null;
  /** 自动巡览是否在跑 */
  auto: boolean;
  /** 上次输入的时间戳（ms） */
  lastInput: number;
  /** 预览图是否就绪 */
  ready: boolean;

  step: (dir: number) => void;
  goto: (i: number) => void;
  setHover: (i: number | null) => void;
  /** 任何用户输入都会停掉自动巡览并重置空闲计时 */
  poke: () => void;
  setReady: (v: boolean) => void;
}

const N = DEMOS.length;
const AUTO_AFTER = 5000;

export const useLanding = create<LandingState>()((set, get) => ({
  active: 0,
  hover: null,
  auto: true,
  lastInput: Date.now(),
  ready: false,

  step: (dir: number) => {
    const s = get();
    set({
      active: (s.active + dir + N) % N,
      lastInput: Date.now(),
      auto: false,
    });
  },

  goto: (i) => {
    const target = ((i % N) + N) % N;
    set({ active: target, lastInput: Date.now(), auto: false });
  },

  setHover: (hover) => set({ hover }),

  poke: () => set({ lastInput: Date.now(), auto: false }),

  setReady: (ready) => set({ ready }),
}));

/** 空闲多久可以恢复自动巡览 */
export const AUTO_IDLE_MS = AUTO_AFTER;