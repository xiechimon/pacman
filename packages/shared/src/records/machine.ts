// machine record（server 侧）——02 §6.2 未列字段表（「machine（server 侧记录）
// + 详情 tab（信息/构建、在线/离线、max 显示）」）；以下为观测支撑的最小投影，
// 未特写字段归 M2 实现期展开 [推断]（04 §3 不判负口径）。
// 机器 = 登记的执行主机（tds daemon + 内嵌 pi runtime，CONTEXT.md）；
// 一个机器可承载多个 Agent 的步，不是 Agent 的属性。

import { z } from 'zod';
import { recordId } from './common.js';

/** 并发上限默认值（02 §2.5：maxConcurrent 3 不是付费件，保留为 daemon 配置
 * 默认值；机器页文案 canon「领取构建、规划与审核任务并运行 Agent。并发上限 3」
 * r3 §4）。 */
export const MAX_CONCURRENT_DEFAULT = 3;

export const machineRecordSchema = z.object({
  /** machineId（r3 §1.2 观测形 `TlZ2sSD4EJCxjNJqVhdo_`；server 记录键名
   * [推断]）。 */
  id: recordId,
  /** tds start --name 默认 hostname（r3 §1.1）；机器页显示样 `r3-mbp 离线
   * …NJqVhdo_ · max 3`（r3 §1.2）。 */
  name: z.string(),
  teamId: recordId,
  /** presence（02 §1.2 machine_presence 事件 {machineId, online}）。 */
  online: z.boolean(),
  /** max 显示（r3 §4）；wire 字段名 [推断]。 */
  maxConcurrent: z.number().int(),
  /** 机器页数据含 latestCliVersion（r5 §8 实测 "0.1.53"）；用于 MCP/记忆等
   * 版本墙提示（02 §7.1/§8）。 */
  latestCliVersion: z.string().nullable(),
});
export type MachineRecord = z.infer<typeof machineRecordSchema>;

/** 机器页「构建」tab 文案 canon（r3 §4 原文）。 */
export const MACHINE_BUILDS_TAB_COPY = '领取构建、规划与审核任务并运行 Agent。并发上限 3';

/** 「添加机器」弹窗命令块（r2 11b/r3 §1.2）：安装 CLI + tds start；底部
 * 「在云服务器上运行？改用 API key 注册」展开 --api-key --team 命令 +
 * 「获取 API key →」跳 api-keys 页。品牌串走 brand.ts 槽。 */
export const MACHINE_ADD_DIALOG_COPY = {
  cloudHint: '在云服务器上运行？改用 API key 注册',
  getKeyLink: '获取 API key →',
} as const;
