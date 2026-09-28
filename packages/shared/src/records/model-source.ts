// model-source record（spec 11 §A3/A4 数据契约单源，#356）：providers 页
// runtime tabs 的封套形状。pacman 自身不提供远程模型服务——页面语义 =
// 本机各 runtime 的模型来源直读：pi 段 = 用户配置的 custom provider 的
// models[] 投影；claude-code 段 = server 端 fs 直读 ~/.claude/settings.json
// 的模型槽映射（文件缺失/解析失败 → installed:false，不空报不崩）。

import { z } from 'zod';

/** runtime 词表（providers tablist 的 data-runtime 值；machine
 *  enabledRuntimes PATCH 词表同源，spec 11 数据契约）。 */
export const MODEL_SOURCE_RUNTIMES = ['pi', 'claude-code'] as const;
export const modelSourceRuntimeSchema = z.enum(MODEL_SOURCE_RUNTIMES);
export type ModelSourceRuntime = z.infer<typeof modelSourceRuntimeSchema>;

export const modelSourceModelSchema = z.object({
  /** 模型 id（pi = custom provider models[] 的 id；claude-code = settings.json
   *  槽值原样）。 */
  id: z.string().min(1),
  /** 显示名（pi = models[] 的 name；claude-code = 模型 id 原样）。 */
  name: z.string().min(1),
  /** 槽位名（claude-code：default / opus / sonnet / …，env.ANTHROPIC_*_MODEL
   *  中段小写化；pi 段缺省）。 */
  slot: z.string().optional(),
});
export type ModelSourceModel = z.infer<typeof modelSourceModelSchema>;

export const modelSourceSchema = z.object({
  runtime: modelSourceRuntimeSchema,
  /** claude-code：~/.claude/settings.json 存在且解析为对象；pi 恒 true
   *  （server 在跑 = pacman 自有 runtime 可用）。 */
  installed: z.boolean(),
  /** server 机器 hostname（os.hostname()）——「已安装在 <hostname>」文案源。 */
  hostname: z.string(),
  models: z.array(modelSourceModelSchema),
});
export type ModelSource = z.infer<typeof modelSourceSchema>;

/** GET /api/teams/{id}/model-sources 封套（恰 pi + claude-code 两段）。 */
export const modelSourcesEnvelopeSchema = z.object({
  sources: z.array(modelSourceSchema),
});
export type ModelSourcesEnvelope = z.infer<typeof modelSourcesEnvelopeSchema>;
