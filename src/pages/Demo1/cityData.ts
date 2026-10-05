import { cityGeoJSON, provinceName } from "@/geo";

/**
 * 城市基础指标
 * ------------------------------------------------------------------
 * 原实现是一份手工列的成都/绵阳/德阳…阿坝共 21 项的常量，
 * 和 `assets/sc.json` 之间没有任何一致性校验 ——
 * 换一份 GeoJSON 之后 TS 不会报错，只会在运行时得到一堆 undefined 指标。
 *
 * 现在改为「按 GeoJSON 的地区列表生成」，并由 `assertRegions` 在开发期
 * 校验任何手写表与行政区一一对应。以后换省只需要换 geo 数据文件。
 */

/** 手写基础信息：人口（万人）。缺项会由 assertRegions 报出来 */
const POPULATION: Record<string, number> = {
  杭州市: 1252,
  宁波市: 969,
  温州市: 979,
  嘉兴市: 553,
  湖州市: 347,
  绍兴市: 533,
  金华市: 713,
  衢州市: 229,
  舟山市: 117,
  台州市: 667,
  丽水市: 253,
};

export interface CityBase {
  population: number;
  gdp: string;
  area: string;
}

/**
 * 以 GeoJSON 为准构建基础表。
 * 人口优先取手写值；GeoJSON 里有而手写表漏掉的项，给 0 并由
 * assertRegions 在控制台明确报出，而不是静默产生 undefined。
 */
const cityData = Object.fromEntries(
  cityGeoJSON.features.map((f) => {
    const name = f.properties.name;
    const population = POPULATION[name] ?? 0;
    return [
      name,
      {
        population,
        // 下面的 gdp / area 由 console/data.ts 按确定性规则派生，
        // 这里保留字段形状是为了兼容既有读取方
        gdp: "",
        area: "",
      },
    ];
  })
) as Record<string, CityBase>;

export default cityData;

/** 开发期一致性闸门：手写人口表必须覆盖全部行政区 */
export function checkCityData() {
  const missing = Object.keys(cityData).filter((n) => !POPULATION[n]);
  const extra = Object.keys(POPULATION).filter(
    (n) => !(n in cityData)
  );
  if (missing.length || extra.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[geo] POPULATION 与 ${provinceName} 不一致 —— 缺少：${
        missing.join("、") || "无"
      }；多出：${extra.join("、") || "无"}`
    );
  }
  return cityData;
}