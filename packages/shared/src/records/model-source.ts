// model-source record（spec 11 §A3/A4 数据契约单源，#356）：providers 页
// runtime tabs 的封套形状。pacman 自身不提供远程模型服务——页面语义 =
// 各 runtime 的模型来源直读：pi 段 = 用户配置的 custom provider 的
// models[] 投影；claude-code 段 = 各执行机 daemon 读本机
// ~/.claude/settings.json 经 presence/enroll 上报、server 按机器聚合
// （#707；文件缺失/解析失败 → installed:false，不空报不崩）。

import { z } from 'zod';

/** runtime 词表（providers tablist 的 data-runtime 值；machine
 *  enabledRuntimes PATCH 词表同源，spec 11 数据契约）。 */
export const MODEL_SOURCE_RUNTIMES = ['pi', 'claude-code'] as const;
export const modelSourceRuntimeSchema = z.enum(MODEL_SOURCE_RUNTIMES);
export type ModelSourceRuntime = z.infer<typeof modelSourceRuntimeSchema>;

/** runtime 显示名（品牌/runtime 名不译，不走 i18n）——单源：web
 * RUNTIME_LABELS（providers 页 tablist + toModelOptions 投影）与 server
 * chief models 工具（#627，providerLabel 行语义对齐 toModelOptions）共消费；
 * Codex 等后续 runtime 扩在此补（spec 11 §A1），两侧自动同更。 */
export const MODEL_SOURCE_RUNTIME_LABELS: Record<ModelSourceRuntime, string> = {
  pi: 'pi',
  'claude-code': 'Claude Code',
};

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
  /** claude-code：上报机器的 settings.json 存在且解析为对象；pi 恒 true
   *  （server 在跑 = pacman 自有 runtime 可用）。 */
  installed: z.boolean(),
  /** 上报机器的 hostname（os.hostname()）——「已安装在 <hostname>」文案源。
   *  #707 起跟随执行机，不再是 server 主机。 */
  hostname: z.string(),
  models: z.array(modelSourceModelSchema),
});
export type ModelSource = z.infer<typeof modelSourceSchema>;

/** GET /api/teams/{id}/model-sources 封套（pi 一段 + 每台已上报机器一段
 *  claude-code，#707；上报过的机器按 hostname 排序，序固定）。 */
export const modelSourcesEnvelopeSchema = z.object({
  sources: z.array(modelSourceSchema),
});
export type ModelSourcesEnvelope = z.infer<typeof modelSourcesEnvelopeSchema>;

/** claude-code 槽位键模式：env.ANTHROPIC_<SLOT>_MODEL。ANTHROPIC_MODEL
 *  本体无中段（`ANTHROPIC_` 与 `_MODEL` 之间需至少一段）天然不命中，
 *  不会与顶层 model 的 default 槽撞名。 */
export const CLAUDE_MODEL_SLOT_PATTERN = /^ANTHROPIC_([A-Z0-9_]+)_MODEL$/;

/** settings.json 原文 → claude-code 段（#707 纯函数：server 与 daemon 共吃——
 *  谁读谁机器的文件，不存在「server 远程读执行机文件」的通道）。
 *  文件缺失 / 非法 JSON / 非对象 JSON 一律 installed:false，不空报不崩。
 *  槽值非字符串或空串的项跳过（installed 仍为 true）。 */
export function parseClaudeCodeModelSource(raw: unknown, hostname: string): ModelSource {
  const notInstalled: ModelSource = {
    runtime: 'claude-code',
    installed: false,
    hostname,
    models: [],
  };
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return notInstalled;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return notInstalled;
  }
  const settings = parsed as { model?: unknown; env?: unknown };
  const models: ModelSourceModel[] = [];
  if (typeof settings.model === 'string' && settings.model !== '') {
    models.push({ id: settings.model, name: settings.model, slot: 'default' });
  }
  const env = settings.env;
  if (typeof env === 'object' && env !== null && !Array.isArray(env)) {
    for (const [key, value] of Object.entries(env)) {
      const match = CLAUDE_MODEL_SLOT_PATTERN.exec(key);
      const slot = match?.[1];
      if (slot === undefined || typeof value !== 'string' || value === '') continue;
      models.push({ id: value, name: value, slot: slot.toLowerCase().replace(/_/g, '-') });
    }
  }
  return { runtime: 'claude-code', installed: true, hostname, models };
}

/** daemon → server 上报载荷（presence / enroll body 的 claudeCode 位，#707）：
 *  本机 settings.json 的解析结果 + 本机 hostname。缺席 = 旧 daemon 未上报
 *  （server 视为未知，不下发假清单）。 */
export const claudeCodeReportSchema = z.object({
  installed: z.boolean(),
  hostname: z.string(),
  models: z.array(modelSourceModelSchema),
});
export type ClaudeCodeReport = z.infer<typeof claudeCodeReportSchema>;
