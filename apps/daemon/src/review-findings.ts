// AI 审核步 findings 提取（M7 #330，r8 §3.1）：daemon 在 done 回传前从
// transcript 终稿的最后一条 assistant 消息里解析结构化 JSON（review
// Verdict 形态）。仅 review 步调用——其它步类无该输出契约，强制 null 避免
// 假阳。
//
// 解析策略（r8 §3.1 输出契约）：
//   - 取最后一条 role='assistant' 消息，content 形如 string | array | object；
//     pi 后端的 message_end 载荷经文本归一得到 textOfContent（text blocks
//     拼合）。
//   - 优先匹配末尾 ```json ...``` code fence；解析失败回退到整段 JSON.parse；
//     两次都失败 = null（agent 未按契约输出，server 侧 verdict 兜底）。
//   - zod reviewVerdictSchema 校验（shared 单源）确保 wire 合法性。

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

/** 从末尾 ```json ...``` code fence 取一段；无 fence = null。 */
function extractCodeFence(text: string): string | null {
  // 抓最后一个 ```json ... ``` 块；容忍空尾行与 windows 换行。
  const matches = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last ? (last[1] ?? '').trim() : null;
}

/** 从消息行集中提取审核 verdict。规则：取最后一条 assistant 消息，
 * 优先末尾 JSON code fence，回退整段 JSON.parse，两次都失败 = null
 * （agent 未按契约输出 JSON）。 */
export function extractReviewVerdict(
  messages: readonly TranscriptMessageLike[],
): ReviewVerdict | null {
  // 从尾向头找第一条 assistant 消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant') continue;
    const text = contentToText(m.content).trim();
    if (text === '') return null;
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
      // 容错：被 markdown 表格、注释等修饰 = 先取首段 `{...}` 跨度。
      const slice = raw.startsWith('{') ? raw : extractJsonSpan(raw);
      if (slice === null) continue;
      try {
        const parsed = JSON.parse(slice);
        const verdict = reviewVerdictSchema.safeParse(parsed);
        if (verdict.success) return verdict.data;
      } catch {
        // 解析失败继续下一个候选
      }
    }
    return null;
  }
  return null;
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
