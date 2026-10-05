import Mock from "mockjs";
import dayjs from "dayjs";
// 说明：本文件全部为 mockjs 随机生成的演示数据，不代表杭州市任何真实统计。
// 区县名称与 DataV GeoAtlas 330100 geojson 的 properties.name 保持一致，便于地图打点。

const DISTRICTS = [
    "上城区", "拱墅区", "西湖区", "滨江区", "萧山区", "余杭区", "临平区",
    "钱塘区", "富阳区", "临安区", "桐庐县", "淳安县", "建德市",
];
// 每个区挑 1~2 个街道/镇名，仅用于让地址看起来自然
const STREETS: Record<string, string[]> = {
    上城区: ["湖滨街道", "清波街道"],
    拱墅区: ["米市巷街道", "大关街道"],
    西湖区: ["北山街道", "灵隐街道"],
    滨江区: ["西兴街道", "长河街道"],
    萧山区: ["城厢街道", "北干街道"],
    余杭区: ["五常街道", "良渚街道"],
    临平区: ["临平街道", "南苑街道"],
    钱塘区: ["下沙街道", "白杨街道"],
    富阳区: ["富春街道", "银湖街道"],
    临安区: ["锦城街道", "青山湖街道"],
    桐庐县: ["桐君街道"],
    淳安县: ["千岛湖镇"],
    建德市: ["新安江街道"],
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
function RandomNumBoth(Min: number, Max: number) {
    return Min + Math.round(Math.random() * (Max - Min));
}
function recentMonths(n: number): string[] {
    return Array.from({ length: n }, (_, i) => dayjs().subtract(n - 1 - i, "month").format("YYYY-MM"));
}
/** 最近若干小时内的随机时间 */
function recentTime(hours = 6): string {
    return dayjs().subtract(Math.floor(Math.random() * hours * 60), "minute").format("YYYY-MM-DD HH:mm:ss");
}
function randomAddress() {
    const district = pick(DISTRICTS);
    return { provinceName: "杭州市", cityName: district, countyName: pick(STREETS[district]) };
}

export default [
    // 左中：城市事件处置状态
    {
        url: "/bigscreen/countUserNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    offlineNum: "@integer(320, 460)", // 处置中
                    lockNum: "@integer(130, 210)", // 待派单
                    alarmNum: "@integer(50, 90)", // 超时
                    totalNum: 1680,
                },
            });
            a.data.onlineNum = a.data.totalNum - a.data.offlineNum - a.data.lockNum - a.data.alarmNum; // 已办结
            return a;
        },
    },
    // 左上：城市感知设备总览
    {
        url: "/bigscreen/countDeviceNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    alarmNum: "@integer(60, 400)",
                    offlineNum: "@integer(20, 120)",
                    totalNum: 8640,
                },
            });
            a.data.onlineNum = a.data.totalNum - a.data.offlineNum;
            return a;
        },
    },
    // 左下：各区设备动态
    {
        url: "/bigscreen/leftBottom",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    "list|20": [
                        {
                            "gatewayno|+1": 33010001,
                            "onlineState|1": [0, 1],
                        },
                    ],
                },
            });
            a.data.list.forEach((item: any) => Object.assign(item, randomAddress(), { createTime: recentTime() }));
            return a;
        },
    },
    // 右上：近 6 月交通与文旅客流（万人次）
    {
        url: "/bigscreen/alarmNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    "numList|6": ["@integer(900, 1500)"],
                    "numList2|6": ["@integer(300, 1100)"],
                },
            });
            a.data.dateList = recentMonths(6);
            return a;
        },
    },
    // 右中：各区事件量排名 TOP8
    {
        url: "/bigscreen/ranking",
        type: "get",
        response: () => {
            const list = DISTRICTS.map((name) => ({ name, value: RandomNumBoth(80, 1200) }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8);
            return { success: true, data: list };
        },
    },
    // 右下：城市运行实时告警
    {
        url: "/bigscreen/rightBottom",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    "list|40": [
                        {
                            "alertname|1": ["道路积水", "交通拥堵", "井盖异常", "景区客流预警", "河道水位", "共享单车淤积"],
                            "alertdetail|1": [
                                "监测值超过预警阈值",
                                "已推送至区城市运行中心",
                                "视频研判为疑似异常，待人工复核",
                                "同一点位 10 分钟内重复告警",
                                "已自动派单至属地街道",
                            ],
                            alertvalue: "@float(60, 200)",
                            "gatewayno|+1": 33020001,
                            "terminalno|1": ["路口卡口", "易涝点", "景区入口", "河道断面", "地铁站口"],
                        },
                    ],
                },
            });
            a.data.list.forEach((item: any) => Object.assign(item, randomAddress(), { createtime: recentTime() }));
            return a;
        },
    },
    // 中下：各区事件受理与办结
    {
        url: "/bigscreen/installationPlan",
        type: "get",
        response: () => {
            const category = [...DISTRICTS];
            const barData: number[] = [], lineData: number[] = [], rateData: string[] = [];
            category.forEach(() => {
                const total = RandomNumBoth(120, 600);
                const done = Math.round(total * (0.7 + Math.random() * 0.28));
                lineData.push(total);
                barData.push(done);
                rateData.push(((done / total) * 100).toFixed(0));
            });
            return { success: true, data: { category, barData, lineData, rateData } };
        },
    },
    // 中上：杭州市各区感知设备分布（固定 330100，不下钻）
    {
        url: "/bigscreen/centerMap",
        type: "get",
        response: () => {
            return {
                success: true,
                data: {
                    regionCode: "330100",
                    dataList: DISTRICTS.map((name) => ({ name, value: RandomNumBoth(80, 1100) })),
                },
            };
        },
    },
];
