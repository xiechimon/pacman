// Scheduler 缝（01 §3 五缝之一）——02 §9.2 词表照抄的调度循环接口。
// 实现 = apps/server（cron-parser 纯解析 + 自建循环，01 §4.2；宿主自持不外包
// pi，00/D3）。闭环语义（02 §9.2/r3 §9/r5 §8）：
// - 触发 → 新 build 全新重跑（triggerSource:"schedule"）、到确认/审核关口暂停；
// - 触发时停驻关口的旧 build 标 errorMessage:"Cancelled"（r5 §8 实测）；
// - `once` 触发后自动出队（GET /api/schedules?team= → []，r3 §9）；
// - 周期档（hourly/daily/weekly [推断] 词，02 §6.2）触发后滚动 nextRunAt。

export interface Scheduler {
  /** 起真实时间循环（生产入口；tick 节奏 = server config）。 */
  start(): void;
  stop(): void;
  /** 单轮扫描：nextRunAt <= now 的 schedule 触发。测试面直接驱动（确定性）。 */
  tick(nowMs?: number): void;
}
