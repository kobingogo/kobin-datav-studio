import React, {
  type Ref,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import styled from "styled-components";
import useSize from "@/hooks/useSize";
import { useDebounceEffect } from "@/hooks/useDebounceEffect";

echarts.use(CanvasRenderer);

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
`;

export interface ChartEvents {
  /** 数据项被悬停时回调，参数为该项的 name（作为联动 key） */
  onHover?: (name: string | null) => void;
  /** 点击数据项 */
  onSelect?: (name: string | null) => void;
}

export interface ChartProps<T> {
  ref?: Ref<echarts.EChartsType>;
  option: T;
  use: Parameters<typeof echarts.use>[0];
  style?: React.CSSProperties;
  theme?: string | object | undefined;
  /** 事件桥：用于把图表的悬停/点击反向广播到全局联动状态 */
  events?: ChartEvents;
}

function Chart<T extends echarts.EChartsCoreOption>(props: ChartProps<T>) {
  const chartBox = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);
  const size = useSize(chartBox);
  const { events } = props;

  echarts.use(props.use);

  const memoOption = useMemo(() => props.option, [props.option]);

  useImperativeHandle(props.ref, () => chart.current!);

  useLayoutEffect(() => {
    chart.current = echarts.init(chartBox.current as HTMLElement);

    return () => {
      chart.current?.dispose();
      chart.current = null;
      chartBox.current = null;
    };
  }, []);

  useDebounceEffect(
    () => {
      if (size?.width !== 0 && size?.height !== 0) chart.current?.resize();
    },
    [size],
    300
  );

  useEffect(() => {
    if (!chart.current) return;

    chart.current.setOption(memoOption, {
      notMerge: false,
      lazyUpdate: true,
      replaceMerge: ["series"],
    });
  }, [memoOption]);

  /**
   * 图表 → 全场的联动桥。
   * 原组件只有单向的 setOption，图表内部发生什么都传不出去，
   * 于是"地图能高亮图表、图表却不能高亮地图"——联动只做了一半。
   *
   * 关键：清空只挂在 zrender 的 globalout（指针真正离开画布）上，
   * 不能挂在 series 的 mouseout 上。因为高亮会触发一次 setOption 重绘，
   * 重绘过程中当前项会先收到一次 mouseout，导致 hover 被立刻清空，
   * 状态来回抖动，联动看起来"没生效"。
   */
  useEffect(() => {
    const c = chart.current;
    if (!c || !events) return;

    const over = (p: unknown) => {
      const name = (p as { name?: string })?.name;
      if (typeof name === "string") events.onHover?.(name);
    };
    const leave = () => events.onHover?.(null);
    const click = (p: unknown) => {
      const name = (p as { name?: string })?.name;
      events.onSelect?.(typeof name === "string" ? name : null);
    };

    c.on("mouseover", over);
    c.on("click", click);
    const zr = c.getZr();
    zr.on("globalout", leave);

    return () => {
      c.off("mouseover", over);
      c.off("click", click);
      zr.off("globalout", leave);
    };
  }, [events, chart.current]);

  return <Wrapper ref={chartBox} style={props.style} />;
}

export default Chart;