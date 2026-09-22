// record schema 公共基元。
// 纪律（01 §6）：不发明 02 之外的字段形状——观测不到的字段不收；
// [推断] 项按 02/rN 标注原样保留注记（04 §3 不判负口径），实现期补采真值后
// 回写 02 §11 再收紧。

import { z } from 'zod';
import { PHASE_VALUES } from '../phase.js';

/** 时间戳 = epoch 毫秒（r3 §8.3 schedule `at:<ms>`/`nextRunAt:<ms>` 实测先行；
 * r5 §7.2 notification createdAt 同族）。 */
export const epochMs = z.number().int();

/** 记录 id。观测到的 id 形态不一：UUIDv7（build/conversation，r3 §1.4）、
 * nanoid 样（team/agent/machine，r3 §1.2/§4）、base64 样（step，r3 §9）。
 * 逐字段格式断言未采齐，不收窄 [推断]。 */
export const recordId = z.string();

/** phase 九值枚举（02 §4.1 单源 = phase.ts PHASE_VALUES）。 */
export const phaseSchema = z.enum(PHASE_VALUES);
