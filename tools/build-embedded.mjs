#!/usr/bin/env node
/**
 * 外挂大屏产物编排：构建两个 Vue 项目 → 拷贝进 sc-datav/public/。
 *
 * 为什么需要这一步
 * ------------------------------------------------------------------
 * kobin-datav-hangzhou / kobin-datav-smart 是两套独立的 Vue + Vite 工程，
 * 无法被 sc-datav（React + TS）直接 import。采用的方案是「构建成静态产物
 * 放进 sc-datav/public/」，由落地页用 iframe 挂载：
 *
 *   sc-datav/public/kobin-datav-hangzhou/index.html
 *   sc-datav/public/kobin-datav-smart/index.html
 *
 * 之所以能这么放，前提是两个工程各自的 vite.config.ts 都满足三条：
 *   1. base: "./'                 → 资源用相对路径，落在任何子目录都能解析
 *   2. createWebHashHistory(BASE_URL) → 不需要服务端 rewrite
 *   3. geojson 走 fetch("./map-geojson/…")  → 同样是相对路径
 * 三条中任何一条不满足，产物放进子目录就会 404。改动这两个工程的构建配置
 * 前请先回到这里复核。
 *
 * 产物不进 git（见 sc-datav/.gitignore），所以 Vercel 上必须在 build 之前
 * 跑一次本脚本 —— vercel.json 里已经串好。
 *
 *   node tools/build-embedded.mjs            # 构建并拷贝
 *   node tools/build-embedded.mjs --copy-only  # 跳过构建，只重新拷贝
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");

/** 站位目录名 → 工程目录名。目录名同时是 iframe 的 URL 段。 */
const TARGETS = [
  { dir: "kobin-datav-hangzhou", project: "kobin-datav-hangzhou" },
  { dir: "kobin-datav-smart", project: "kobin-datav-smart" },
];

/**
 * 定位工程目录。
 *
 * 产物要进 git 仓库才能被 Vercel 构建，而两个 Vue 工程的源码必须与
 * sc-datav 同处一个仓库，所以约定放在 apps/<name>/。这里保留对
 * 同级目录的兼容，方便还没重组时在别处临时构建。
 *
 * 找不到就报错而不是静默跳过：静默跳过会让 vite build 成功、
 * 产物却缺失，线上表现为 iframe 白屏而不是构建失败 —— 很难定位。
 */
function locate(name) {
  const candidates = [path.join(ROOT, "apps", name), path.join(ROOT, name)];
  return candidates.find((d) => existsSync(path.join(d, "package.json"))) ?? null;
}

const copyOnly = process.argv.includes("--copy-only");

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} 在 ${cwd} 下退出码 ${r.status}`);
  }
};

/** 递归目录体积，用于在日志里点出「哪一块把产物撑大了」 */
function dirSize(dir) {
  let total = 0;
  const per = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    const size = st.isDirectory() ? dirSize(p).total : st.size;
    total += size;
    per.push({ name, size });
  }
  return { total, per };
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)}M`;

let failed = 0;
for (const { dir, project } of TARGETS) {
  const cwd = locate(project);
  const dest = path.join(PUBLIC_DIR, dir);

  if (!cwd) {
    console.error(
      `✗ 找不到工程 ${project}。已尝试：\n` +
        `    sc-datav/apps/${project}\n    apps/${project}\n    ${project}`
    );
    failed++;
    continue;
  }

  if (!copyOnly) {
    console.log(`\n▸ 构建 ${path.relative(ROOT, cwd)}`);
    try {
      run("pnpm", ["build"], cwd);
    } catch (e) {
      console.error(`✗ ${project} 构建失败：${e.message}`);
      failed++;
      continue;
    }
  }

  const dist = path.join(cwd, "dist");
  if (!existsSync(path.join(dist, "index.html"))) {
    console.error(`✗ ${project} 没有产出 dist/index.html，跳过拷贝`);
    failed++;
    continue;
  }

  // 先删后拷：避免上一版残留的文件（尤其 assets/ 里的 hash 文件名）堆积
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  cpSync(dist, dest, { recursive: true });

  const { total, per } = dirSize(dest);
  const top = [...per]
    .sort((a, b) => b.size - a.size)
    .slice(0, 4)
    .map((p) => `${p.name} ${mb(p.size)}`)
    .join("  ");
  console.log(`✓ ${path.relative(ROOT, cwd)} → public/${dir}  ${mb(total)}`);
  console.log(`    最大几块：${top}`);
}

if (failed) {
  console.error(`\n${failed} 个工程失败`);
  process.exit(1);
}
console.log("\n全部产物就位。sc-datav dev server 下访问：");
for (const { dir } of TARGETS) {
  console.log(`  /kobin-dataviz/${dir}/`);
}