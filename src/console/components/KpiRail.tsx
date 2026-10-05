/**
 * KpiRail —— 主指标带
 * ------------------------------------------------------------------
 * 解决原设计"中心是空的"问题：地图悬在一片空白里，用户第一眼没有落点。
 * 一排 Hero 指标横跨顶部第二行，明确回答"现在整体是什么状态"。
 *
 * 关键交互：鼠标悬停某个 KPI → 全场进入该指标的联动态，
 * 下方所有图表按该指标重排/高亮。这让顶部不再只是数字，而是控制把手。
 */
import { useMemo } from "react";
import styled, { css } from "styled-components";
import { useConsole } from "../store";
import { cityMetrics, cityNames, fmt, getCity } from "../data";
import { palette } from "@/theme/tokens";
import Icon, { type IconName } from "./Icon";

const Root = styled.div`
  flex: none;
  display: grid;
  /* 6 列在 1366 宽下每格仅约 200px，数字会被挤掉；
     改用 auto-fit + minmax，让窄屏自动折行成 3 列 */
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--sp-md);
  padding: var(--sp-md) var(--sp-xl) var(--sp-sm);
  position: relative;
  z-index: 2;
  pointer-events: auto;
`;

const KpiBase = styled.div<{ $active?: boolean }>`
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: var(--sp-md) var(--sp-lg);
  background: linear-gradient(
    180deg,
    ${({ $active }) => ($active ? "rgba(79,209,255,0.1)" : "rgba(16,24,41,0.6)")},
    rgba(11, 17, 32, 0.4)
  );
  border: 1px solid
    ${({ $active }) => ($active ? palette.cyanDeep : palette.line)};
  border-radius: 2px;
  transition:
    border-color var(--e-base),
    background var(--e-base),
    opacity var(--e-base);
  overflow: hidden;

  /* 左侧一条随联动亮起的竖线 */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${({ $active }) => ($active ? palette.cyan : "transparent")};
    transition: background var(--e-base);
  }

  &:hover {
    border-color: ${palette.lineStrong};
    background: linear-gradient(
      180deg,
      rgba(22, 32, 52, 0.8),
      rgba(11, 17, 32, 0.5)
    );
  }
`;

/** 语义图标块 —— 内发光圆角底，让一排 KPI 的类别可扫读 */
const Ic = styled.i<{ $c: string }>`
  flex: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: ${({ $c }) => $c};
  background: radial-gradient(
    circle at 35% 30%,
    ${({ $c }) => `${$c}57`},
    ${({ $c }) => `${$c}14`}
  );
  border: 1px solid ${({ $c }) => `${$c}4d`};
  box-shadow: inset 0 0 12px ${({ $c }) => `${$c}33`};
  transition: box-shadow var(--e-base);
`;

/** 异常 / 预警：整卡转色，而不是只把数字染红 */
const Kpi = styled(KpiBase)<{ $bad?: boolean; $good?: boolean; $ac?: string }>`
  padding: 0 var(--sp-lg);
  display: flex;
  align-items: center;
  gap: var(--sp-lg);

  &::before {
    background: ${({ $bad, $good, $active, $ac }) =>
      $bad
        ? palette.critical
        : $good
          ? palette.good
          : $active
            ? $ac || palette.cyan
            : $ac || "transparent"};
  }

  /* 负向指标（故障/告警/待办）整卡随「趋势方向」着色：
     上升是坏消息 → 红；下降是好消息 → 绿。
     之前一律标红，等于把「故障减少」也报成异常。 */
  ${({ $bad, $good }) =>
    $bad
      ? css`
          border-color: ${palette.critical}59;
          background: linear-gradient(
            180deg,
            ${palette.critical}14,
            rgba(11, 17, 32, 0.4)
          );
        `
      : $good
        ? css`
            border-color: ${palette.good}47;
            background: linear-gradient(
              180deg,
              ${palette.good}12,
              rgba(11, 17, 32, 0.4)
            );
          `
        : null}
`;

const Label = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  min-width: 0;
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/** 图标右侧的文字列 */
const KpiBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
`;

const ValueRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
`;

/**
 * 数值字号用 clamp 随视口收敛：
 * 固定 26px 在 1366 宽下会把 "20,048" 截成 "20,0…"，
 * 而大屏恰恰要求数字永远完整可读。
 */
const Value = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: clamp(17px, 1.36vw, 26px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: ${palette.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
`;

const Unit = styled.span`
  flex: none;
  font-size: var(--fs-micro);
  color: var(--c-text-mute);
  white-space: nowrap;
`;

const Delta = styled.span<{ $up: boolean }>`
  position: absolute;
  right: var(--sp-lg);
  top: 9px;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
  white-space: nowrap;
  color: ${({ $up }) => ($up ? palette.good : palette.critical)};
`;

interface KpiDef {
  key: string;
  label: string;
  icon: IconName;
  value: number;
  fmt: (v: number) => string;
  unit: string;
  delta: number;
  color: string;
  /** bad = 负向指标（故障/告警/待办），整卡转色并把 delta 反向解读 */
  tone: "ok" | "bad";
}

export interface KpiRailProps {
  /** 演示主题：城市治理 / 电力 / 外经贸 */
  domain: "city" | "power" | "trade";
  /**
   * 整屏主色，作用于图标块与左侧竖条。
   * 三块屏各给一个主色（电力冷蓝 / 贸易琥珀 / 治理紫罗兰），
   * 并排时不必靠标题才知道是哪一屏。负向指标仍走语义色，不受影响。
   */
  accent?: string;
}

export default function KpiRail({ domain, accent }: KpiRailProps) {
  const hover = useConsole((s) => s.hover);
  const setHover = useConsole((s) => s.setHover);
  const link = useConsole((s) => s.hover ?? s.pinned);

  // 跟随联动实体（hover 优先，其次 pinned）：
  // 只读 pinned 会出现"hover 某市、图表已切口径、顶部数字仍是全省"的割裂
  const city = getCity(link);

  const kpis = useMemo<KpiDef[]>(() => {
    if (domain === "trade") {
      return [
        {
          key: "exportValue",
          label: "出口总额",
          icon: "flow",
          value: city.exportValue,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿元",
          delta: city.growth,
          tone: "ok",
          color: palette.cyan,
        },
        {
          key: "importValue",
          label: "进口总额",
          icon: "layers",
          value: city.importValue,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿元",
          delta: city.growth * 0.6,
          tone: "ok",
          color: palette.indigo,
        },
        {
          key: "tertiary",
          label: "三产增加值",
          icon: "building",
          value: city.tertiary,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿元",
          delta: city.growth * 0.8,
          tone: "ok",
          color: palette.good,
        },
        {
          key: "primary",
          label: "一产增加值",
          icon: "leaf",
          value: city.primary,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿元",
          delta: city.growth * 0.3,
          tone: "ok",
          color: palette.amber,
        },
        {
          key: "gdp",
          label: "地区生产总值",
        icon: "trend",
          value: city.gdp,
          fmt: fmt.moneyShort,
          unit: "元",
          delta: city.growth,
          tone: "ok",
          color: palette.violet,
        },
        {
          key: "score",
          label: "运行健康度",
          icon: "target",
          value: city.score,
          fmt: fmt.int,
          unit: "/100",
          delta: city.growth * 0.2,
          tone: "ok",
          color: palette.critical,
        },
      ];
    }

    if (domain === "power") {
      return [
        {
          key: "output",
          label: "全省发电量",
          icon: "bolt",
          value: city.output,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿千瓦时",
          delta: city.growth,
          tone: "ok",
          color: palette.cyan,
        },
        {
          key: "power",
          label: "全省用电量",
          icon: "gauge",
          value: city.power,
          fmt: (v: number) => fmt.dec(v),
          unit: "亿千瓦时",
          delta: city.growth * 0.7,
          tone: "ok",
          color: palette.indigo,
        },
        {
          key: "faults",
          label: "设备故障",
          icon: "warn",
          value: city.faults,
          fmt: (v: number) => fmt.int(v),
          unit: "次",
          delta: -city.growth * 0.4,
          tone: "bad",
          color: palette.critical,
        },
        {
          key: "enterprises",
          label: "接入企业",
          icon: "building",
          value: city.enterprises,
          fmt: (v: number) => fmt.int(v),
          unit: "家",
          delta: city.growth * 0.3,
          tone: "ok",
          color: palette.good,
        },
        {
          key: "score",
          label: "运行健康度",
          icon: "target",
          value: city.score,
          fmt: (v: number) => fmt.int(v),
          unit: "/100",
          delta: city.growth * 0.2,
          tone: "ok",
          color: palette.amber,
        },
        {
          key: "penalties",
          label: "待处理事项",
          icon: "clock",
          value: city.penalties,
          fmt: (v: number) => fmt.int(v),
          unit: "项",
          delta: -city.growth * 0.15,
          tone: "bad",
          color: palette.violet,
        },
      ];
    }
    return [
      {
        key: "gdp",
        label: "地区生产总值",
        icon: "trend",
        value: city.gdp,
        fmt: fmt.moneyShort,
        unit: "元",
        delta: city.growth,
        tone: "ok",
        color: palette.cyan,
      },
      {
        key: "population",
        label: "常住人口",
        icon: "users",
        value: city.population,
        fmt: fmt.int,
        unit: "万人",
        delta: city.growth * 0.2,
        tone: "ok",
        color: palette.indigo,
      },
      {
        key: "enterprises",
        label: "在册企业",
        icon: "building",
        value: city.enterprises,
        fmt: fmt.int,
        unit: "家",
        delta: city.growth * 0.35,
        tone: "ok",
        color: palette.good,
      },
      {
        key: "tax",
        label: "税收总额",
        icon: "target",
        value: city.tax,
        fmt: fmt.moneyShort,
        unit: "元",
        delta: city.growth * 0.5,
        tone: "ok",
        color: palette.amber,
      },
      {
        key: "energy",
        label: "综合能耗",
        icon: "bolt",
        value: city.energy,
        fmt: (v: number) => fmt.int(v),
        unit: "万吨标煤",
        delta: -city.growth * 0.3,
        tone: "ok",
        color: palette.violet,
      },
      {
        key: "penalties",
        label: "行政处罚",
        icon: "warn",
        value: city.penalties,
        fmt: fmt.int,
        unit: "条",
        delta: -city.growth * 0.1,
        tone: "bad",
          color: palette.critical,
      },
    ];
  }, [city, domain]);

  // 每个 KPI 各自算出"该指标最高的市" —— 悬停 KPI 即把全场注意力导向那个市
  const leaders = useMemo(() => {
    const byMetric = cityNames.map((n) => ({ n, m: cityMetrics[n] }));
    const out = new Map<string, string>();
    for (const k of kpis) {
      const sorted = [...byMetric].sort(
        (a, b) => (b.m as any)[k.key] - (a.m as any)[k.key]
      );
      if (sorted[0]) out.set(k.key, sorted[0].n);
    }
    return out;
  }, [kpis]);

  return (
    <Root>
      {kpis.map((k) => {
        const leader = leaders.get(k.key) ?? null;
        return (
          <Kpi
            key={k.key}
            $active={leader !== null && hover === leader}
            $bad={k.tone === "bad" && k.delta > 0}
            $good={k.tone === "bad" && k.delta <= 0}
            $ac={accent}
            onPointerEnter={() => setHover(leader)}
            onPointerLeave={() => setHover(null)}
            title={`${k.label} · ${k.unit}${leader ? ` · 居首 ${leader}` : ""}`}
          >
            <Ic $c={k.tone === "ok" && accent ? accent : k.color}>
              {/* 图标色：ok 卡跟随整屏主色，负向卡保持语义色 */}
              <Icon name={k.icon} size={17} />
            </Ic>
            <KpiBody>
              <Label>{k.label}</Label>
              <ValueRow>
                <Value className="num">{k.fmt(k.value)}</Value>
                <Unit>{k.unit}</Unit>
              </ValueRow>
            </KpiBody>
            {/* 负向指标的 delta 极性相反：故障下降是好事 */}
            <Delta $up={k.tone === "bad" ? k.delta <= 0 : k.delta >= 0}>
              {fmt.pct(k.delta)}
            </Delta>
          </Kpi>
        );
      })}
    </Root>
  );
}