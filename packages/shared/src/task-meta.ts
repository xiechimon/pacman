// 任务元信息（spec 15 #394 / ADR 0002）：占位标题派生 + 固定标签词表。
// 单源理由：web fixture 面与 server createTodo 共用同一派生规则（行为不漂移）；
// server 播种与 daemon prompt 注入共用同一词表（改一处全链路生效）。

import { ATTACHMENT_TOKEN_LINE, renderAttachmentTokensToLabels } from './attachment-token.js';

/** 占位标题兜底（正文全空白的理论边缘——web 保存闸拦截在前，server/
 *  fixture 双面的防御共用此单源，防两处文案漂移）。 */
export const PLACEHOLDER_TITLE_FALLBACK = '未命名任务';

/** 占位标题 = 正文首个非空行，截断 ≤50 字符、超长追加省略号（ADR 0002 D2）。
 *  全空白返回空串，由调用面兜底（server 落库有默认值；web 保存闸已拦截）。
 *  #757：附件 token 行不成标题（它们的渲染面是 chip，不是文字）——独占一行
 *  的 token 行跳过，行中夹带的 token 只留文件名；全文只剩 token 行时取首个
 *  文件名（chip 名），总比裸 scheme 强。 */
export function derivePlaceholderTitle(spec: string): string {
  let fallback = '';
  for (const raw of spec.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const token = ATTACHMENT_TOKEN_LINE.exec(line);
    if (token !== null) {
      if (fallback === '') fallback = token[1] ?? '';
      continue;
    }
    const rendered = renderAttachmentTokensToLabels(line);
    if (rendered === '') continue;
    return rendered.length > 50 ? `${rendered.slice(0, 50)}…` : rendered;
  }
  return fallback.length > 50 ? `${fallback.slice(0, 50)}…` : fallback;
}

/** 固定标签词表（ADR 0002 D4）：per 项目播种，执行 agent 派发时按 name 回填，
 *  每任务至多 1 个。description 面向 agent 的归类判定（进 worker prompt）。 */
export interface FixedTag {
  readonly name: string;
  readonly description: string;
  readonly color: string;
}

export const FIXED_TAGS: readonly FixedTag[] = [
  { name: 'bug', description: '修坏的东西', color: '#ef4444' },
  { name: 'feature', description: '新功能', color: '#8b5cf6' },
  { name: 'improvement', description: '改进既有功能', color: '#3b82f6' },
  { name: 'refactor', description: '重构（不改行为）', color: '#f59e0b' },
  { name: 'docs', description: '文档', color: '#0ea5e9' },
  { name: 'chore', description: '杂务/依赖/配置', color: '#71717a' },
];
