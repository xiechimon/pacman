// provider record——02 §6.2（r3 §2 实测原样，key 打码）。
// 密钥纪律（02 §8）：apiKey 只写不读，GET 永不返回——record schema 刻意不含
// apiKey 字段。presets 38 项目录照抄 r3 §2 清单（与 pi-ai provider 集合同源
// [推断]）；内置 built-in 模型走 Pro，不在复刻范围（02 §2.4 排除项）。

import { z } from 'zod';
import { epochMs, recordId } from './common.js';

/** 自定义端点三协议（02 §6.2：OpenAI Completions / OpenAI Responses /
 * Anthropic Messages）。wire 值 `anthropic-messages` 为 r3 §2 实测；
 * 另两值按同形逆推 [推断]，可改判。 */
export const providerApiSchema = z.enum([
  'anthropic-messages',
  'openai-completions',
  'openai-responses',
]);
export type ProviderApi = z.infer<typeof providerApiSchema>;

export const providerModelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** custom provider 记录（r3 §2 GET /api/teams/{id}/providers 实测原样）。 */
export const providerRecordSchema = z.object({
  kind: z.literal('custom'),
  providerId: z.string(), // 服务商 ID（表单 ph `例如 my-relay`，r3 §2）
  label: z.string(),
  baseUrl: z.string(), // 表单 ph `https://api.example.com/v1`（r3 §2）
  api: providerApiSchema,
  /** 「以 Authorization: Bearer 请求头发送 API 密钥」复选（r3 §2/§6.2）。 */
  authHeader: z.boolean(),
  compat: z.object({ supportsDeveloperRole: z.boolean() }),
  models: z.array(providerModelSchema), // `探测模型` 对 /v1/models 拉列表（r3 §2）
  id: recordId,
  createdBy: recordId,
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type ProviderRecord = z.infer<typeof providerRecordSchema>;

/** presets 目录 38 项（r3 §2 盘点序：oauth 2 + xai 双通道 1 + api_key 35）。 */
export const PROVIDER_PRESET_IDS = [
  'github-copilot',
  'openai-codex',
  'xai',
  'amazon-bedrock',
  'ant-ling',
  'anthropic',
  'baseten',
  'cerebras',
  'cloudflare-ai-gateway',
  'cloudflare-workers-ai',
  'deepseek',
  'fireworks',
  'google',
  'google-vertex',
  'groq',
  'huggingface',
  'kimi-coding',
  'minimax',
  'minimax-cn',
  'mistral',
  'moonshotai',
  'moonshotai-cn',
  'nvidia',
  'openai',
  'opencode',
  'opencode-go',
  'openrouter',
  'qwen-token-plan',
  'qwen-token-plan-cn',
  'qwen-token-plan-individual',
  'together',
  'vercel-ai-gateway',
  'xiaomi',
  'xiaomi-token-plan-ams',
  'xiaomi-token-plan-cn',
  'xiaomi-token-plan-sgp',
  'z-ai',
  'z-ai-coding-cn',
] as const;

/** `auth:"oauth"` 仅此二项（= ChatGPT/Codex 与 Copilot 订阅连接，r3 §2；
 * 04 §4 M6 真人一次项：OAuth 连自有订阅）。 */
export const PROVIDER_OAUTH_PRESET_IDS = ['github-copilot', 'openai-codex'] as const;

/** xai 双通道（r3 §2：auth:"api_key" + oauthLabel 原文）。 */
export const PROVIDER_XAI_PRESET = {
  id: 'xai',
  auth: 'api_key',
  oauthLabel: 'Sign in with SuperGrok or X Premium',
} as const;

/** preset 条目最小形状（r3 §2 观测字段：id/auth/oauthLabel；其余目录字段
 * 未逐一采集 [推断]）。 */
export const providerPresetSchema = z.object({
  id: z.string(),
  auth: z.enum(['api_key', 'oauth']),
  oauthLabel: z.string().optional(),
});
export type ProviderPreset = z.infer<typeof providerPresetSchema>;

/** 表单行为词表（r3 §2 实测）：「无密钥网关可留空」+ Bearer 复选 +
 * `探测模型`（Anthropic 协议亦走 /v1/models）+ `保存前验证` 开关；
 * 表单注 canon「密钥将加密存储，保存后无法再次查看。」（02 §8 文案 parity）。 */
export const PROVIDER_FORM_COPY = {
  apiKeyOptional: '无密钥网关可留空',
  probeModels: '探测模型',
  validateBeforeSave: '保存前验证',
  encryptedNotice: '密钥将加密存储，保存后无法再次查看。',
} as const;
