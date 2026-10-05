/**
 * PanelShell —— 深空数据台的卡片基元
 * ------------------------------------------------------------------
 * 替换原项目两种过时的边框方案：
 *   Demo1 的 L 形角标描边（hover 时角标撑满卡片，纯装饰）
 *   Demo2 的内嵌 SVG 路径边框（占满 viewBox，随卡片比例拉伸变形）
 * 改为：单层发丝描边 + 顶部一道渐变高光 + 标题左侧 2px 强调条。
 * 强调条同时承载"联动中"语义 —— 有卡片被联动命中时，
 * 它的强调条与描边会亮起来，其余卡片标题降透明，让视线知道该看哪张。
 */
import styled, { css } from "styled-components";
import { palette } from "@/theme/tokens";
import Icon, { type IconName } from "./Icon";

export interface CardState {
  /** 该卡片是否处于联动命中态 */
  $active?: boolean;
  /** 是否处于联动未命中态（全场有联动，但该卡片不相关） */
  $muted?: boolean;
  /** 可点击下钻 */
  $drillable?: boolean;
  /** 紧凑模式：用于 KPI rail 里的窄卡 */
  $compact?: boolean;
}

const Root = styled.section<CardState>`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: ${({ $compact }) => ($compact ? "10px 12px" : "0")};
  background: ${({ $compact }) =>
    $compact
      ? `linear-gradient(180deg, ${palette.surfaceHi}cc, ${palette.surface}b3)`
      : `linear-gradient(180deg, rgba(16, 24, 41, 0.72), rgba(11, 17, 32, 0.58))`};
  border: 1px solid
    ${({ $active, $muted }) =>
      $active ? palette.cyanDeep : $muted ? palette.lineSoft : palette.line};
  border-radius: 2px;
  backdrop-filter: blur(12px) saturate(120%);
  pointer-events: auto;
  transition:
    border-color var(--e-base),
    background var(--e-base),
    opacity var(--e-base);
  overflow: hidden;

  ${({ $active }) =>
    $active &&
    css`
      box-shadow:
        0 0 0 1px ${palette.cyanDeep} inset,
        0 0 24px -8px ${palette.cyan}66;
    `}

  ${({ $drillable }) =>
    $drillable &&
    css`
      cursor: pointer;

      &:hover {
        border-color: ${palette.lineStrong};
        background: linear-gradient(
          180deg,
          rgba(22, 32, 52, 0.86),
          rgba(13, 20, 35, 0.72)
        );

        &::after {
          opacity: 1;
        }
      }
    `}

  /* 顶部一道 1px 高光：让卡片在近黑背景上有"面板"感而不是"色块"感 */
  &::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    top: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      ${palette.lineStrong} 22%,
      ${palette.lineStrong} 78%,
      transparent
    );
    opacity: 0.9;
    pointer-events: none;
  }

  /* hover 时的扫描线，替代原项目撑满卡片的角标动画 */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      transparent 30%,
      ${palette.cyan}0f 50%,
      transparent 70%
    );
    opacity: 0;
    transition: opacity var(--e-base);
    pointer-events: none;
  }
`;

const Head = styled.header<{ $compact?: boolean }>`
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-md);
  padding: ${({ $compact }) => ($compact ? "0" : "10px 12px 8px")};
  border-bottom: ${({ $compact }) =>
    $compact ? "none" : `1px solid ${palette.lineSoft}`};
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  min-width: 0;
`;

/** 标题左侧的 2px 强调条 —— 联动状态的唯一强指示 */
const Accent = styled.span<{ $active?: boolean; $muted?: boolean }>`
  flex: none;
  align-self: stretch;
  width: 2px;
  min-height: ${({ $active }) => ($active ? "18px" : "14px")};
  border-radius: 1px;
  background: ${({ $active, $muted }) =>
    $active ? palette.cyan : $muted ? palette.line : palette.textMute};
  transition:
    background var(--e-base),
    height var(--e-base),
    box-shadow var(--e-base);
  box-shadow: ${({ $active }) =>
    $active ? `0 0 8px ${palette.cyan}` : "none"};
`;

/** 标题图标 —— 字色跟随强调条，联动时一起亮 */
const TitleIc = styled(Icon)<{ $active?: boolean; $muted?: boolean }>`
  color: ${({ $active, $muted }) =>
    $active ? palette.cyan : $muted ? palette.textFaint : palette.textMute};
  align-self: center;
  margin-top: -1px;
  transition: color var(--e-base);
`;

const Titles = styled.div`
  min-width: 0;
`;

const Kicker = styled.div<{ $muted?: boolean }>`
  font-size: var(--fs-kicker);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ $muted }) => ($muted ? palette.textFaint : palette.cyanDeep)};
  font-family: var(--font-mono);
  white-space: nowrap;
  transition: color var(--e-base);
`;

const Title = styled.h3<{ $muted?: boolean; $compact?: boolean }>`
  margin: 0;
  font-size: ${({ $compact }) =>
    $compact ? "var(--fs-base)" : "var(--fs-md)"};
  font-weight: 600;
  line-height: 1.3;
  color: ${({ $muted }) => ($muted ? palette.textMute : palette.text)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--e-base);
`;

const Aside = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  padding-top: 2px;
`;

const Body = styled.div<{ $compact?: boolean }>`
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: ${({ $compact }) => ($compact ? "0" : "8px 12px 12px")};
  display: flex;
  flex-direction: column;
`;

export interface CardProps extends CardState {
  title: string;
  /** 英文小标题，用于建立双语锚点 */
  kicker?: string;
  /** 标题图标：让一排面板的"类别"可扫读，不必逐字读标题 */
  icon?: IconName;
  /** 标题右侧插槽：图例、单位、操作按钮 */
  aside?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  title,
  kicker,
  icon,
  aside,
  children,
  onClick,
  className,
  style,
  ...state
}: CardProps) {
  return (
    <Root
      className={className}
      style={style}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      {...state}
    >
      {!state.$compact && (
        <Head $compact={state.$compact}>
          <TitleGroup>
            <Accent $active={state.$active} $muted={state.$muted} />
            {icon && (
              <TitleIc
                name={icon}
                size={14}
                $active={state.$active}
                $muted={state.$muted}
              />
            )}
            <Titles>
              {kicker && <Kicker $muted={state.$muted}>{kicker}</Kicker>}
              <Title $muted={state.$muted} $compact={state.$compact}>
                {title}
              </Title>
            </Titles>
          </TitleGroup>
          {aside && <Aside>{aside}</Aside>}
        </Head>
      )}
      <Body $compact={state.$compact}>{children}</Body>
    </Root>
  );
}

export default Card;