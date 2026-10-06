// 段缓冲（#955 / ADR 0011）：把模型的连续输出按「一段连续同类型增量」封成
// transcript 行——流式期与落库期同源，同一段既是流式期即时出现的那条行，也
// 是终稿里的那条行。封口的**触发**归调用方（类型变化 / 工具到达 / 消息结束 /
// 步收尾），本模块只管「累积 + 封」这一层。
//
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   F1 同 kind 连追加被误封：同一段内的多次 append 只累积、不产出行。
//   F2 异 kind 未先封：kind 切换必须先封上一段再开新段，否则上一段文本丢失。
//   F3 封后不清：封段必须清空缓冲，否则下一段把上一段文本重复带上（双份）。
//   F4 空段出行：无内容（或从未开段）时返回 null，不产出空行噪声。
//   F5 全文与增量双计：thinking 有「增量流」与「块终全文」两个来源，全文到达
//      时是**权威替换**而非再追加（否则该段文本翻倍）。
//   F6 封后复用：封段之后 append 正常开新段。
//   F7 逐字保留：内容不做 trim/裁剪——空串才判空，空白文本原样保留（读侧
//      另有 trim 判空，不在这里代劳）。

/** 段的类型：模型输出里会进 transcript 的两种连续增量。工具调用不是段
 *  （它自有 toolcall 行）。 */
export type SegmentKind = 'text' | 'thinking';

export interface SealedSegment {
  kind: SegmentKind;
  text: string;
}

/** 段 → transcript 行 content（单类型块数组形，ADR 0011 D3）。
 *  形状刻意与 SDK 的 content 块对齐：`text` 走既有的 `textOfContent` 抽取，
 *  `thinking` 是新读面。 */
export function segmentContent(seg: SealedSegment): Record<string, string>[] {
  return seg.kind === 'thinking'
    ? [{ type: 'thinking', thinking: seg.text }]
    : [{ type: 'text', text: seg.text }];
}

export class SegmentBuffer {
  private kind: SegmentKind | null = null;
  private text = '';

  /** 追加增量。kind 与当前段不同 → 先把当前段封出并返回（调用方负责落行），
   *  再以新 kind 开段。返回 null = 本调用未触发封段（F1/F4）。 */
  append(kind: SegmentKind, text: string): SealedSegment | null {
    if (text === '') return null;
    const sealed = this.kind !== null && this.kind !== kind ? this.seal() : null;
    this.kind = kind;
    this.text += text;
    return sealed;
  }

  /** 全文事件（thinking 块终全文）。同 kind = 权威替换（F5）；异 kind 先封
   *  当前段（F2）再以全文开段。 */
  replace(kind: SegmentKind, text: string): SealedSegment | null {
    if (text === '') return null;
    const sealed = this.kind !== null && this.kind !== kind ? this.seal() : null;
    this.kind = kind;
    this.text = text;
    return sealed;
  }

  /** 封出当前段（空段不派出，F4）；封后缓冲清空（F3）。 */
  seal(): SealedSegment | null {
    if (this.kind === null || this.text === '') {
      this.kind = null;
      this.text = '';
      return null;
    }
    const seg: SealedSegment = { kind: this.kind, text: this.text };
    this.kind = null;
    this.text = '';
    return seg;
  }

  /** 当前未封段（读用，不改状态）。 */
  current(): SealedSegment | null {
    return this.kind === null || this.text === '' ? null : { kind: this.kind, text: this.text };
  }
}
