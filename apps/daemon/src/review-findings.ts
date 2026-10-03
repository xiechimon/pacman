// AI 审核步 findings 提取（M7 #330，r8 §3.1；#700 回溯扫描）：daemon 在
// done 回传前从 transcript 里解析结构化 JSON（review Verdict 形态）。
// 仅 review 步调用——其它步类无该输出契约，不提取避免假阳。
//
// 提取语义（#700：verdict 是审核步的产物本体，提取器的职责是把契约产物
// 取出来，不是猜最后一条消息）：
//   - 从尾向头扫**全部**消息：空文本 assistant 行（纯工具调用，#519 实测
//     形状：verdict JSON 之后又调了 set_task_meta）跳过继续向前扫；
//   - 消息级候选 = 末尾 ```json ...``` code fence → fence 后尾段 → 整段
//     （string | array | object 归一为 text 后解析）；
//   - 取**最后一条**含有效 verdict 的消息（契约终稿语义——续轮修订后的
//     那条才是终稿）；非 verdict 消息不挡回溯；
//   - 全程无有效 verdict = 提取失败（reason 上浮 wire findingsError，web
//     审核面区分「判定提取失败」与「审核未返回结论」）；JSON 在但
//     reviewVerdictSchema 不过 = 提取失败附 zod 原因（shared 单源校验）。

import { type ReviewVerdict, reviewVerdictSchema } from '@pacman/shared';

type TranscriptMessageLike = {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
};

/** 把 content 归一为纯文本（与 web mappers.ts textOfContent 同形——内容可
 * 是 string / {type:"text", text} / text block 数组）。 */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b !== null && typeof b === 'object') {
          const block = b as { type?: string; text?: string };
          if (block.type === 'text' && typeof block.text === 'string') return block.text;
        }
        return '';
      })
      .join('');
  }
  if (content !== null && typeof content === 'object') {
    const block = content as { type?: string; text?: string };
    if (block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return '';
}

/** verdict 提取结果（#700）：ok = 契约产物取出（done body findings 位）；
 * failed = 提取失败（reason 走 done body findingsError——server / web 据此
 * 区分「判定提取失败」与「审核真的没返回」）。 */
export type ReviewVerdictExtraction =
  | { status: 'ok'; verdict: ReviewVerdict }
  | { status: 'failed'; reason: string };

/** 提取失败原因长度上限（wire findingsError 上限之内留足余量；超长截断
 * 带省略号标记——zod issues 可枚举出长串，不值得整段上浮）。 */
const REASON_CHAR_LIMIT = 500;

function capReason(text: string): string {
  return text.length > REASON_CHAR_LIMIT ? `${text.slice(0, REASON_CHAR_LIMIT)}…` : text;
}

/** 从末尾 ```json ...``` code fence 取一段；无 fence = null。 */
function extractCodeFence(text: string): string | null {
  // 抓最后一个 ```json ... ``` 块；容忍空尾行与 windows 换行。
  const matches = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last ? (last[1] ?? '').trim() : null;
}

/** 从消息行集中提取审核 verdict（#700 失败方式先列于此）：
 *  1. 尾部纯工具调用消息击穿（#519 现状 bug）→ 空文本 assistant 行跳过
 *     继续向前扫；
 *  2. 全程无 JSON（agent 真没按契约输出）→ failed「未找到」，诚实报
 *     提取失败，不折叠成「未返回」；
 *  3. 前面消息里有多个 JSON → 取最后一条**含有效 verdict** 的（终稿
 *     语义）——非 verdict 消息（坏 JSON / 尾部散文）不挡回溯；
 *  4. JSON 在但 schema 不过 → failed 附 zod 原因（若无更早有效 verdict）。 */
export function extractReviewVerdict(
  messages: readonly TranscriptMessageLike[],
): ReviewVerdictExtraction {
  // 最新的 schema 失败原因（尾→头扫首次遇到 = 最末一次 JSON 尝试）；
  // 有更早有效 verdict 时作废，全程无有效 verdict 时作为失败原因上浮。
  let schemaFailure: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant') continue;
    // 空文本 assistant 行（纯工具调用 / pi 空轮）不挡回溯（#700 失败方式 1）
    const text = contentToText(m.content).trim();
    if (text === '') continue;
    const candidates: string[] = [];
    const fence = extractCodeFence(text);
    if (fence !== null) candidates.push(fence);
    // fence 之后的「尾段」也试一次（agent 在 JSON 前先写解释段的情形）
    if (fence !== null) {
      const tail =
        text
          .split(/```[\s\S]*?```/g)
          .pop()
          ?.trim() ?? '';
      if (tail !== '' && tail !== fence) candidates.push(tail);
    }
    candidates.push(text);
    for (const raw of candidates) {
      // 候选切片两枚都试：整段（纯净 JSON 直接过）+ 首 `{...}` 跨度（JSON
      // 前后带解释段 / 尾随散文的真实输出——此前 `{` 开头的整段 parse 必败
      // 且无跨度回退，一并收口）。
      const span = extractJsonSpan(raw);
      for (const slice of [raw, span]) {
        if (slice === null) continue;
        try {
          const parsed = JSON.parse(slice);
          const verdict = reviewVerdictSchema.safeParse(parsed);
          if (verdict.success) return { status: 'ok', verdict: verdict.data };
          if (schemaFailure === null) {
            const parts = verdict.error.issues.map(
              (issue) =>
                `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
            );
            schemaFailure = capReason(parts.join('; '));
          }
        } catch {
          // 解析失败继续下一个候选切片
        }
      }
    }
  }
  return {
    status: 'failed',
    reason:
      schemaFailure !== null
        ? capReason(`verdict JSON 契约校验失败：${schemaFailure}`)
        : '审核步输出中未找到 verdict JSON（agent 未按契约输出）',
  };
}

/** 从文本中抠出首段 `{...}` 顶层 JSON 跨度（粗略花括号配对——LLM 偶尔在
 * JSON 外补说明段）。 */
function extractJsonSpan(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
