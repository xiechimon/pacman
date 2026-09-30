// secret record（团队密钥）——CONTEXT.md 强制拆两义：secret（团队密钥）
// ≠ apiKey（访问令牌）。02 §8：值按 Agent 授权、在需要它的执行步经取用通道
// 下发（不预置进任务 shell 环境）、只写不读（保存后只能覆盖或删除，无法再次
// 查看，r2 §6.3）、密文经 SecretBox（AES-256-GCM + 本地 keyfile，01 §4.2）。
// wire record 未实测；字段证据 = r2 §6.3 表单（名称（密钥名）/描述
// （可选）/值），[推断] 投影。

import { z } from 'zod';
import { recordId } from './common.js';

/** 读取面记录：值永不出现（02 §8 API 面纪律）。 */
export const secretRecordSchema = z.object({
  id: recordId,
  teamId: recordId,
  /** 密钥名（表单 ph `STRIPE_API_KEY`，r2 §6.3；名形 = 环境变量风格的标识符，
   * 取用通道按此名寻址）。 */
  name: z.string(),
  description: z.string().nullable(),
});
export type SecretRecord = z.infer<typeof secretRecordSchema>;

/** 写入面 body：含值（只写；字段名 [推断]，r2 §6.3 表单三字段 +
 * 说明「值将加密存储，保存后无法再次查看。」）。 */
export const setSecretBodySchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  value: z.string(),
});
export type SetSecretBody = z.infer<typeof setSecretBodySchema>;

/** 版本门（02 §8：「所在机器需要 tds CLI 0.1.28 及以上」形状保留；
 * CLI 名走品牌槽，数值随复刻版本线自定归 M2/M3）。 */
export const SECRET_MIN_CLI_VERSION = '0.1.28';

/** 页文案 canon（r2 §6.3 原文）。 */
export const SECRET_PAGE_COPY = {
  empty: '尚无密钥。',
  inject:
    '团队密钥按 Agent 授权，在需要它的执行步中下发，不预置进任务 shell 环境。值只写不读：保存后只能覆盖或删除，无法再次查看。',
  encryptedNotice: '值将加密存储，保存后无法再次查看。',
  chiefHint: '也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话。',
} as const;
