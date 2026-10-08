# tools —— 构建编排与视觉验证脚本

两类脚本，性质不同：

| 类别 | 脚本 | 是否影响产品 |
|---|---|---|
| **构建编排** | `build-embedded.mjs` | **是** —— `pnpm build` 会调用它 |
| **验证** | `smoke.mjs` / `walkthrough.mjs` / `shot.mjs` / `shoot-previews.mjs` / `arc-fit.mjs` | 否 —— 只用于验证与生成 |

`build-embedded.mjs` 必须在仓库内：Vercel 只能看到仓库里的文件，
而产物不入 git、靠构建时现场生成，脚本本身当然也得在仓库里。

验证脚本依赖 playwright，**刻意不进 `package.json`** —— 它的 postinstall
会下载浏览器，放在依赖里会让 Vercel 每次构建多拉一百多兆。
本机跑验证时用工作区根的 `node_modules`（Node 逐级向上查找，能解析到）：

```bash
# 工作区根（w3-dataV/）
pnpm install                     # 只装 playwright
pnpm smoke                       # 转发到 kobin-datav/tools/smoke.mjs
```

---

## 构建编排

### `node tools/build-embedded.mjs`

构建 `apps/` 下的两个 Vue 工程，把`dist/` 拷进 `public/`。

```
pnpm build:embedded              # 构建 + 拷贝
node tools/build-embedded.mjs --copy-only   # 只重新拷贝，跳过构建
```

先删后拷，避免上一版残留的 hash 文件名堆积。找不到工程时报错退出而非静默跳过
—— 静默跳过会让 `vite build` 成功、产物却缺失，线上表现为 iframe 白屏而不是
构建失败。

体积参考：两个产物各约 9.5M，其中 `map-geojson` 占 7.7M（83%）。

---

## 验证

### 前置

```bash
# 起 dev server（端口与下面一致，或用 BASE_URL 覆盖）
cd kobin-datav && pnpm dev --port 5180   # http://localhost:5180/kobin-datav/
```

换端口：`BASE_URL=http://localhost:3000/kobin-datav/# node tools/smoke.mjs`

| 脚本 | 作用 | 产物 |
|---|---|---|
| `smoke.mjs` | **回归检查**。12 组断言，失败时退出码非零，可接 CI | `shots/smoke-*.png` |
| `walkthrough.mjs` | 落地页各交互态截图走查，人工比对用 | `shots/landing-*.png` |
| `shot.mjs` | 任意路由截图 | `shots/<name>.png` |
| `shoot-previews.mjs` | 为外挂大屏生成落地页预览图 | `public/demo_4.jpg` `demo_5.jpg` |
| `arc-fit.mjs` | 落地页圆弧布局的透视投影评估器 | 无（终端输出） |

### `node tools/smoke.mjs`

```
[视口]     2560/1600/1366/1280 四档：无横向溢出、无 console error
[方向键]   中央那块始终等于进度条选中的那一项（走满 6 站）
[回绕]     06 → 01 之后中央仍是 01
[展台渲染] 6 个铭牌全部挂载、正面站不透明（守"空展台"回归）
[滚轮]     3 档后落在 04
[拖拽]     换站了，但没跳页
[自动巡览] 空闲后自动前进一站
[reduced-motion] 无报错
[进入]     按钮跳到 /demo0
[Demo0/3]  联动、部件计数、拆解还原
[静态集成] 两个 iframe 铺满视口、指向 index.html、产物有实际内容、Esc 可回
[各页]     demo0/1/2/3 均无 console error
```

### `node tools/arc-fit.mjs`

落地页展台的投影几何评估。展台能不能读清取决于三个量：投影后的像素宽度、
相邻块在屏幕上是否相交、亮度衰减后还剩多少对比度 —— 都要过一遍透视投影
才算得出来，肉眼看截图只能看出"好像挤了"。

```bash
node tools/arc-fit.mjs                    # 对比若干候选参数
node tools/arc-fit.mjs --n 6 --sweep      # 扫 6 站的参数网格
node tools/arc-fit.mjs --active 3         # 指定选中站，看那一瞬的排布
```

布局参数本身在 `src/pages/Index/layout.ts`，改之前先跑这个。

---

## 为什么验证脚本值得留着

这个项目出过的问题**静止截图完全正常**，全靠跑交互才定位得到：

| 检查项 | 当初对应的真实 bug |
|---|---|
| 回绕 | 站位间距 68° 不整除 360°，且角度按增量累加，回绕时环差 88°——画面中央和底部进度条显示的不是同一个 |
| 方向键 | `useRef` 的 `ref` 从未挂到任何对象上，`rotation.y` 全部作用在 null，环根本不转 |
| 拖拽 | 浏览器把"拖完松手"也当 click，R3F 位移容差不够覆盖，拖 480px 松手直接跳进 demo3 |
| 各页 | 面板层多包了一层 `pointer-events: auto` 的全屏 div，3D 地图完全收不到指针事件 |
| 展台渲染 | `facing` 被当普通 prop 传递且来源是"原地改的数组"，React 永不重渲染 → prop 冻结在全 0 → 画面只剩环境 |
| 静态集成 | `App.tsx` 外层 wrapper 的 `willChange: transform` 成为 fixed 子元素的包含块，iframe 高度算成 0 |

## 已知未覆盖

- 3D 场景的几何正确性（比如"环的角度对不对"）目前靠 `arc-fit.mjs` 的数值预测
  + 人工看截图，脚本没有把预测值与真实渲染做自动比对
- 没有像素级基线对比，改动视觉后无法自动判断"是否还和上次一致"
- 嵌入页只验证了 iframe 层，两个 Vue 大屏自身的正确性不在本仓库范围内