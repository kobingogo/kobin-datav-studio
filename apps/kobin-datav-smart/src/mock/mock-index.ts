import Mock from "mockjs";
//处理路径传参
import { parameteUrl } from "@/utils/query-param"
// 说明：本文件全部为 mockjs 随机生成的演示数据，不代表任何真实统计。
import dayjs from "dayjs"

/** 最近 n 个月（含本月），格式 YYYY-MM */
/** 最近若干小时内的随机时间，避免出现 1970 年之类的离谱时间 */
function recentTime(hours = 6): string {
    return dayjs().subtract(Math.floor(Math.random() * hours * 60), "minute").format("YYYY-MM-DD HH:mm:ss")
}
/** 生成同一省/市/区县一致的地址 */
function fillAddress(item: any) {
    const [provinceName, cityName, countyName] = String(Mock.mock("@county(true)")).split(" ")
    return Object.assign(item, { provinceName, cityName, countyName })
}
function recentMonths(n: number): string[] {
    return Array.from({ length: n }, (_, i) => dayjs().subtract(n - 1 - i, "month").format("YYYY-MM"))
}

function ArrSet(Arr: any[], id: string): any[] {
    let obj: any = {}
    const arrays = Arr.reduce((setArr, item) => {
        obj[item[id]] ? '' : (obj[item[id]] = true && setArr.push(item))
        return setArr
    }, [])
    return arrays
}
/**
* @description: min ≤ r ≤ max  随机数
* @param {*} Min
* @param {*} Max
* @return {*}
*/
function RandomNumBoth(Min: any, Max: any) {
    var Range = Max - Min;
    var Rand = Math.random();
    var num = Min + Math.round(Rand * Range); //四舍五入
    return num;
}
//左中
export default [
    {
        url: "/bigscreen/countUserNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    offlineNum: '@integer(50, 100)',
                    alarmNum: '@integer(20, 100)',
                    lockNum: '@integer(10, 50)',
                    totalNum: 368
                }
            })
            a.data.onlineNum = a.data.totalNum - a.data.offlineNum - a.data.lockNum - a.data.alarmNum
            return a
        },
    },
    {
        url: "/bigscreen/countDeviceNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    alarmNum: '@integer(100, 1000)',
                    offlineNum: '@integer(0, 50)',
                    totalNum: 698
                }
            })
            a.data.onlineNum = a.data.totalNum - a.data.offlineNum
            return a
        }
    },
    //左下
    {
        url: "/bigscreen/leftBottom",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    "list|20": [
                        {
                            deviceId: "6c512d754bbcd6d7cd86abce0e0cac58",
                            "gatewayno|+1": 10000,
                            "onlineState|1": [0, 1],

                        }
                    ]
                }
            })
            a.data.list.forEach((item: any) => { fillAddress(item); item.createTime = recentTime() })
            return a
        }
    },
    //右上
    {
        url: "/bigscreen/alarmNum",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    dateList: recentMonths(6),
                    "numList|6": [
                        '@integer(0, 1000)'
                    ],
                    "numList2|6": [
                        '@integer(0, 1000)'
                    ]
                }
            })
            return a
        }
    },
    //右中
    {
        url: "/bigscreen/ranking",
        type: "get",
        response: () => {
            let num = Mock.mock({ "list|80": [{ value: "@integer(50,1000)", name: "@city()" }] }).list
            //   console.log("ranking",num);
            let newNum: any = [], numObj: any = {}
            num.map((item: any) => {
                if (!numObj[item.name] && newNum.length < 8) {
                    numObj[item.name] = true
                    newNum.push(item)
                }
            })
            let arr = newNum.sort((a: any, b: any) => {
                return b.value - a.value
            })
            let a = {
                success: true,
                data: arr
            }
            return a
        }
    },
    //右下
    {
        url: "/bigscreen/rightBottom",
        type: "get",
        response: () => {
            const a = Mock.mock({
                success: true,
                data: {
                    "list|40": [{
                        "alertdetail|1": ["传感器读数超过阈值", "设备心跳超时", "现场视频研判为疑似异常", "同一点位 10 分钟内重复告警", "已自动派单至运维班组"],
                        "alertname|1": ["水浸告警", "烟感告警", "井盖位移", "路灯故障", "电梯困人", "燃气泄漏"],
                        alertvalue: "@float(60, 200)",
                        deviceid: null,
                        "gatewayno|+1": 10000,
                        phase: "A1",
                        sbInfo: "@csentence(10,18)",
                        "terminalno|1": ["KD-WS200", "KD-SM310", "KD-MC120", "KD-LT500"],
                    }],

                }
            })
            a.data.list.forEach((item: any) => { fillAddress(item); item.createtime = recentTime() })
            return a
        }
    },
    //安装计划
    {
        url: "/bigscreen/installationPlan",
        type: "get",
        response: () => {

            let num = RandomNumBoth(26, 32);
            const a = Mock.mock({
                ["category|" + num]: ["@city()"],
                ["barData|" + num]: ["@integer(10, 100)"],
            })
            let lineData = [], rateData = [];
            for (let index = 0; index < num; index++) {
                let lineNum = Mock.mock('@integer(0, 100)') + a.barData[index]
                lineData.push(lineNum)
                let rate = a.barData[index] / lineNum;
                rateData.push((rate * 100).toFixed(0))
            }
            a.lineData = lineData
            a.rateData = rateData
            return {
                success: true,
                data: a
            }
        }
    },
    {
        url: "/bigscreen/centerMap",
        type: "get",
        response: (options: any) => {
            let params = parameteUrl(options.url)
            //不是中国的时候
            if (params.regionCode && !["china"].includes(params.regionCode)) {
                const a = Mock.mock({
                    success: true,
                    data: {
                        "dataList|100": [
                            {
                                name: "@city()",
                                value: '@integer(1, 1000)'
                            }
                        ],
                        regionCode: params.regionCode,//-代表中国
                    }
                })
                return a
            } else {
                const a = Mock.mock({
                    success: true,
                    data: {
                        "dataList|12": [
                            {
                                name: "@province()",
                                value: '@integer(1, 1100)'
                            }
                        ],
                        regionCode: 'china',
                    }
                })
                // 去重
                a.data.dataList = ArrSet(a.data.dataList, "name")
                return a
            }
        }
    }
];

