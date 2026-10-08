<div align="center">

# Kobin 数据大屏 · Kobin Datav

**Three.js 多场景数据可视化大屏**

地图 · 图表 · KPI 三向联动 · 点击下钻 · 统一深空设计语言

</div>

---

## 这是什么

一套基于 Three.js 的数据可视化大屏，包含 6 个可独立进入的场景。当前数据覆盖 **浙江省** 11 个地级市。

| 场景 | 说明 | 技术要点 |
|---|---|---|
| **01 经济运行监测** | 浙江省外经贸运行 | 卫星影像 + 真实 DEM 位移地形、行政区悬停下钻、出口/进口排名实时联动 |
| **02 智慧城市数据大脑** | 城市治理指标 | 3D 挤出行政区、指标热力、柱体、地图↔图表↔KPI 双向联动 |
| **03 电力全景感知平台** | 电网运行感知 | 自研扫光 shader、飞线拓扑、反射地面、轨迹描边 |
| **04 航空发动机查看器** | 通用模型链路 | 52 部件分层拆解、悬停高亮、线框切换、Bloom 后处理 |
| **05 杭州市城市运行大屏** | 城市感知与事件处置 | 独立 Vue 工程构建成静态产物，iframe 挂载 |
| **06 智慧城市运营大屏** | 全国物联设备运营 | 独立 Vue 工程构建成静态产物，iframe 挂载 |

前 4 个是本仓库的 React 场景，后 2 个由 `apps/` 下的 Vue 工程构建而来，
详见[外挂大屏](#外挂大屏-05--06)。

## 快速开始

```bash
pnpm install       # 或 npm install
pnpm dev           # 开发
pnpm build         # 生产构建（含两个外挂大屏的产物）
pnpm preview       # 预览产物
```

要求 Node ≥ 18。

要求 Node ≥ 18。

## 设计系统

四个原生场景共用一套 token（`src/theme/tokens.ts`），同时驱动 CSS 变量、Three.js 材质与 ECharts：

- **色彩** —— 近黑底层（`#04060C`→`#0B1120`）+ 青蓝主色 + 琥珀/红语义色
- **字体** —— 7 档字阶；所有指标数字使用等宽 tabular-nums，实时刷新不抖动
- **量级换算** —— 万/亿/万亿自动折算，避免大屏上出现 30,000,000,000 这类不可读数字

## 交互模型

```
                       ┌──────────────────────────────┐
                       │      useConsole (zustand)     │
                       │  hover / pinned / layers      │
                       └──────────────────────────────┘
                         ↑        ↑         ↓        ↓
                地图 hover  KPI hover  图表 hover  表格 hover
```

- **双向联动** —— 悬停任一入口，其余全部高亮命中项、其余降到 22% 不透明度
- **点击下钻** —— 锁定地市州，顶栏出现 SCOPE 徽章，右侧抽屉展开该地区明细
- **图层控制** —— 热力 / 柱体 / 飞线 / 标注 / 底座 / 云层，带文字标签与状态指示
- **键盘** —— `Esc` 取消锁定 · `R` 重播入场 · `C` 纯净模式（Demo0）
- **可访问** —— 完整响应 `prefers-reduced-motion`

## 外挂大屏（05 / 06）

`apps/` 下挂了两套独立的 Vue + Vite 大屏工程，它们不参与 React 构建，
而是在 `pnpm build` 时先各自构建成静态产物、拷进 `public/`，由落地页用
iframe 挂载：

| 场景 | 源码 | 产物 |
|---|---|---|
| **05 杭州市城市运行大屏** | `apps/kobin-datav-hangzhou` | `public/kobin-datav-hangzhou/` |
| **06 智慧城市运营大屏** | `apps/kobin-datav-smart` | `public/kobin-datav-smart/` |

用 iframe 而不是把 Vue 组件接进 React 树，是因为两者的品牌色、字体栈与
布局基准（1920×1080 定点缩放）完全是两套设计语言，硬接需要重写样式，
且各自迭代时会持续互相打断。代价是进站后不共用 token —— 落地页铭牌用
靛色「静态集成」标签明确区分，不让它伪装成原生页。

产物**不入 git**（见 `.gitignore`），改由 Vercel 在构建时现场生成。
三个工程共享一个 lockfile（`pnpm-workspace.yaml`）。

改完嵌入页需要重跑一次：

```bash
pnpm build:embedded   # 只重建两个 Vue 产物
pnpm previews         # 重新生成落地页预览图 demo_4/5.jpg
```

产物能放进子目录依赖三个前提，改动 `apps/*/vite.config.ts` 前请先复核：
`base: "./"` · `createWebHashHistory(BASE_URL)` · geojson 走相对路径。

## 换一个省

地理数据、投影尺度、指标表三者已解耦，换省只需要三步：

1. 把 GeoJSON 放进 `src/geo/`（行政区 + 省界轮廓）
2. 在 `src/geo/index.ts` 的 `REGIONS` 里注册，并在 `PROVINCE_ID` 指向它
3. 跑 `node tools/buildProvince.mjs` 生成卫星图 / 法线图 / 位移图

投影 scale 由数据 bbox 自动反算（锁定投影后宽度 160 世界单位），
所以换省后三个场景的相机机位不需要重新试。
指标表与行政区的一致性由 `assertRegions` 在开发期校验，
缺项会直接点名报错，而不是运行时静默产出 `undefined`。

## 目录结构

```
src/
├── theme/          design token + ECharts 桥接
├── geo/            地理数据层（行政区 / 省界 / 投影 / 一致性校验）
├── console/        跨场景共用的状态、数据、卡片、图表基元
└── pages/
    ├── Index/      落地页：6 站展台弧线轮盘
    ├── Demo0/      经济运行监测
    ├── Demo1/      智慧城市数据大脑
    ├── Demo2/      电力全景感知平台
    ├── Demo3/      航空发动机查看器
    ├── Embed/      外挂大屏的 iframe 宿主（05 / 06 共用）
    ├── Hangzhou/   05 路由
    └── Smart/      06 路由

apps/               外挂大屏工程（Vue，构建时并入 public/）
tools/              视觉与交互验证脚本（不属于产品，见 tools/README.md）
shots/              验证脚本的截图产物（不入库）
```

## 部署

`vercel.json` 已配好：Vercel 项目Root Directory 指向本仓库根，
`pnpm build` 会先构建两个外挂大屏再构建本应用，输出到 `dist/`。

部署基路径由 `vite.config.ts` 的 `base` 决定（本地默认 `/kobin-datav/`，Vercel 上由 `BASE_PATH=/` 覆盖）。
挂到子路径时改这一处即可，落地页的预览图与 iframe 地址都跟着 `BASE_URL` 走。

## 数据来源

- 行政区边界：[DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)
- 卫星影像：ESRI World Imagery
- 高程：AWS Terrain Tiles（terrarium）
- 面板内指标为**演示数据**，非真实统计口径

## 致谢

本项目基于 [knight-L/sc-datav](https://github.com/knight-L/sc-datav) 深度改造，
原项目基于 Apache License 2.0，原始版权声明保留于 [LICENSE](./LICENSE)。

原作者 knight-L 提供了 3D 地图可视化的实现思路与 GeoJSON→Shape→UV 的
核心渲染链路，本项目在视觉语言、联动机制、地理数据层与工程结构上做了重构。

其中「地图轮廓贴图下载工具」原作者另有独立项目：
<https://github.com/knight-L/sat-hunter>

## License

Apache License 2.0