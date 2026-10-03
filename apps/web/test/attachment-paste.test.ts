// 剪贴板粘贴 → 既有附件链（#729，正典 #727 Part 2 + r9 §3.1）的共享纯函数
// 单测。detail composer 与新建任务对话框两面消费同一模块——票面失败方式
// 第 9 条「双面实现漂移」的防线 = 这些函数只有一份。
//
// 逐条钉住的失败方式（票面编号）：
//  FM1  token 不独占行 → ATTACHMENT_LINE 整行锚定失配 → chip 静默退化成
//       字面文本。caret 行首/行中/行尾/空 draft 四态全部断行插入；用真
//       渲染解析器 parseChatMarkdown 钉「插入结果必须解析出 attachment
//       块」，并钉反面（行中内联 token 不解析成块）。
//  FM2  paste 事件里 files 与 items 同源双份 → 只读一个源，不合并去重。
//  FM6  文件名合成：无名/通名 blob → pasted-image-<n>.<ext>；同 draft
//       多图不重名；快速连贴（前一批上传未完）不得重置编号；draft 清空
//       后重新从 1 起（CC 每 draft 编号精神，#727 Part 2）。
//  FM7  纯文本粘贴（无文件）→ 提取结果为空集，handler 不动事件。
//  FM9  双面同源：本文件即「共享函数」那一档。
//  附加：上传中用户继续打字 → caret 偏移过期，插入仍保持行原子性。

import { describe, expect, it } from 'vitest';
import { isValidFileName } from '../src/api/attachments.js';
import { parseChatMarkdown } from '../src/detail/chat-markdown.js';
import {
  createPastedNameCounter,
  filesFromClipboardData,
  insertAttachmentTokens,
  isGenericClipboardName,
  pastedImageExt,
  preparePastedFiles,
} from '../src/overlay/attachment-paste.js';

const TOKEN = '![pasted-image-1.png](attachment:team-1/att-1.png)';
const TOKEN2 = '![pasted-image-2.png](attachment:team-1/att-2.png)';

/** 结果里每个 token 必须独占一行（ATTACHMENT_LINE 的行原子性前提）。 */
function tokenLines(value: string): string[] {
  return value.split('\n').filter((line) => line.includes('attachment:'));
}

describe('insertAttachmentTokens —— 行原子 caret 插入（FM1）', () => {
  it('空 draft：token 独占首行，caret 落在块后行首', () => {
    const r = insertAttachmentTokens('', [TOKEN], 0);
    expect(r.value).toBe(`${TOKEN}\n`);
    expect(r.caret).toBe(TOKEN.length + 1);
  });

  it('caret 在行首（偏移 0）：token 行插在原文前，不断原文', () => {
    const r = insertAttachmentTokens('abc', [TOKEN], 0);
    expect(r.value).toBe(`${TOKEN}\nabc`);
    expect(r.caret).toBe(TOKEN.length + 1);
  });

  it('caret 在行中：两侧断行，token 独占一行', () => {
    const r = insertAttachmentTokens('hello world', [TOKEN], 5);
    expect(r.value).toBe(`hello\n${TOKEN}\n world`);
    expect(r.caret).toBe('hello\n'.length + TOKEN.length + '\n'.length);
    for (const line of tokenLines(r.value)) {
      expect(line.trim()).toBe(TOKEN);
    }
  });

  it('caret 在文末（无换行结尾）：前补断行 + 尾补换行', () => {
    const r = insertAttachmentTokens('abc', [TOKEN], 3);
    expect(r.value).toBe(`abc\n${TOKEN}\n`);
    expect(r.caret).toBe(r.value.length);
  });

  it('caret 后紧邻换行：不叠双空行，caret 跳过既有换行落下一行首', () => {
    const r = insertAttachmentTokens('abc\ndef', [TOKEN], 3);
    expect(r.value).toBe(`abc\n${TOKEN}\ndef`);
    expect(r.caret).toBe('abc\n'.length + TOKEN.length + '\n'.length);
  });

  it('caret = null（clip 尾追路径）与旧 appendAttachmentTokens 逐字节等价', () => {
    // 旧实现：joiner = draft 为空或以 \n 结尾时 ''，否则 '\n'；尾恒 '\n'。
    const legacyAppend = (draft: string, tokens: string[]) => {
      const joiner = draft === '' || draft.endsWith('\n') ? '' : '\n';
      return `${draft}${joiner}${tokens.join('\n')}\n`;
    };
    for (const draft of ['', 'abc', 'abc\n', 'abc\ndef']) {
      expect(insertAttachmentTokens(draft, [TOKEN], null).value).toBe(legacyAppend(draft, [TOKEN]));
    }
  });

  it('多图一次粘贴：每个 token 各自成行', () => {
    const r = insertAttachmentTokens('x', [TOKEN, TOKEN2], 1);
    expect(r.value).toBe(`x\n${TOKEN}\n${TOKEN2}\n`);
    expect(tokenLines(r.value)).toHaveLength(2);
    for (const line of tokenLines(r.value)) {
      expect(line.trim() === TOKEN || line.trim() === TOKEN2).toBe(true);
    }
  });

  it('空 token 集：原值原 caret，不动 draft', () => {
    const r = insertAttachmentTokens('abc', [], 1);
    expect(r.value).toBe('abc');
    expect(r.caret).toBe(1);
  });

  it('caret 越界（过期偏移）按文末处理，仍行原子', () => {
    const r = insertAttachmentTokens('abc', [TOKEN], 99);
    expect(r.value).toBe(`abc\n${TOKEN}\n`);
  });

  it('上传中用户继续打字：过期 caret 插入仍保持 token 独占行', () => {
    // 粘贴时 draft='abcdef' caret=3；上传期间用户在文末补了 XY →
    // 完成时实际文本 'abcXYdef'，仍按捕获的 caret=3 断行插入。
    const r = insertAttachmentTokens('abcXYdef', [TOKEN], 3);
    expect(r.value).toBe(`abc\n${TOKEN}\nXYdef`);
    for (const line of tokenLines(r.value)) {
      expect(line.trim()).toBe(TOKEN);
    }
  });

  it('插入结果被真渲染解析器解析出 attachment 块（chip 不退化）', () => {
    const r = insertAttachmentTokens('hello world', [TOKEN], 5);
    const blocks = parseChatMarkdown(r.value);
    const attachment = blocks.find((b) => b.kind === 'attachment');
    expect(attachment).toBeDefined();
    expect(attachment?.kind === 'attachment' && attachment.name).toBe('pasted-image-1.png');
    expect(attachment?.kind === 'attachment' && attachment.key).toBe('team-1/att-1.png');
  });

  it('反面钉：token 挤进行中 = 解析不出 attachment 块（字面文本退化）', () => {
    const blocks = parseChatMarkdown(`hello ${TOKEN} world`);
    expect(blocks.some((b) => b.kind === 'attachment')).toBe(false);
  });
});

describe('filesFromClipboardData —— 单一源提取（FM2 / FM7）', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' });

  it('null / undefined → 空集', () => {
    expect(filesFromClipboardData(null)).toEqual([]);
    expect(filesFromClipboardData(undefined)).toEqual([]);
  });

  it('files 有值 → 只读 files，items 里的同源副本不再计入（双触发防线）', () => {
    const out = filesFromClipboardData({
      files: [file],
      items: [{ kind: 'file', getAsFile: () => file }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(file);
  });

  it('files 空、items 有 file 项 → 兜底读 items（Firefox/Safari 形态差异）', () => {
    const out = filesFromClipboardData({
      files: [],
      items: [
        { kind: 'file', getAsFile: () => file },
        { kind: 'string', getAsFile: () => null },
      ],
    });
    expect(out).toEqual([file]);
  });

  it('纯文本剪贴板 → 空集（handler 由此不动事件，文本粘贴零变化）', () => {
    expect(filesFromClipboardData({ files: [], items: [{ kind: 'string', getAsFile: () => null }] })).toEqual([]);
  });
});

describe('isGenericClipboardName —— 通名判定（FM6）', () => {
  it('无名 / image.<ext> / blob = 通名', () => {
    expect(isGenericClipboardName('')).toBe(true);
    expect(isGenericClipboardName('image.png')).toBe(true);
    expect(isGenericClipboardName('Image.PNG')).toBe(true);
    expect(isGenericClipboardName('blob')).toBe(true);
    expect(isGenericClipboardName('BLOB')).toBe(true);
  });

  it('真实文件名不判通名（含 OS 截图名 / 多段扩展名）', () => {
    expect(isGenericClipboardName('photo.png')).toBe(false);
    expect(isGenericClipboardName('report.pdf')).toBe(false);
    expect(isGenericClipboardName('my-image.png')).toBe(false);
    expect(isGenericClipboardName('image.tar.gz')).toBe(false);
    expect(isGenericClipboardName('截屏2026-10-03 14.25.30.png')).toBe(false);
  });
});

describe('pastedImageExt —— mime → 扩展名（FM6，须过 server ALLOWED_EXTS）', () => {
  it('常见图片 mime 映射到白名单扩展名', () => {
    expect(pastedImageExt('image/png')).toBe('png');
    expect(pastedImageExt('image/jpeg')).toBe('jpg');
    expect(pastedImageExt('image/gif')).toBe('gif');
    expect(pastedImageExt('image/webp')).toBe('webp');
    expect(pastedImageExt('image/svg+xml')).toBe('svg');
    expect(pastedImageExt('image/bmp')).toBe('bmp');
    expect(pastedImageExt('image/x-icon')).toBe('ico');
    expect(pastedImageExt('image/avif')).toBe('avif');
  });

  it('非图片 mime / 空 mime / 怪 subtype → null（不硬造扩展名）', () => {
    expect(pastedImageExt('application/pdf')).toBeNull();
    expect(pastedImageExt('')).toBeNull();
    expect(pastedImageExt('image/x-foo-bar')).toBeNull();
  });
});

describe('createPastedNameCounter —— 每 draft 递增编号（FM6 / FM2）', () => {
  it('同一 draft 内多图编号递增不重名', () => {
    const c = createPastedNameCounter();
    c.begin(false);
    expect(c.next('png')).toBe('pasted-image-1.png');
    expect(c.next('png')).toBe('pasted-image-2.png');
    c.end();
  });

  it('draft 清空且无在途上传 → 重新从 1 起（CC 每 draft 编号精神）', () => {
    const c = createPastedNameCounter();
    c.begin(true);
    c.next('png');
    c.next('png');
    c.end();
    c.begin(true);
    expect(c.next('png')).toBe('pasted-image-1.png');
    c.end();
  });

  it('快速连贴：前一批在途时 draft 仍空也不重置（同 draft 不重名）', () => {
    const c = createPastedNameCounter();
    c.begin(true); // 第一批：空 draft → 重置 → 1
    expect(c.next('png')).toBe('pasted-image-1.png');
    // 第一批还没 end()，用户又贴了一张（draft 此刻仍是空）
    c.begin(true);
    expect(c.next('png')).toBe('pasted-image-2.png');
    c.end();
    c.end();
  });

  it('draft 非空 → 继续递增', () => {
    const c = createPastedNameCounter();
    c.begin(false);
    expect(c.next('jpg')).toBe('pasted-image-1.jpg');
    c.end();
    c.begin(false);
    expect(c.next('jpg')).toBe('pasted-image-2.jpg');
    c.end();
  });

  it('end 多调不下溢为负（finally 双保险不炸后续重置判定）', () => {
    const c = createPastedNameCounter();
    c.begin(true);
    c.end();
    c.end();
    c.begin(true);
    expect(c.next('png')).toBe('pasted-image-1.png');
    c.end();
  });
});

describe('preparePastedFiles —— 通名 blob 重命名（FM6）', () => {
  const counter = () => {
    const c = createPastedNameCounter();
    c.begin(true);
    return c;
  };

  it('通名截图 blob → pasted-image-<n>.<ext>，type 与字节保留', () => {
    const blob = new File([new Uint8Array([9, 8, 7])], 'image.png', { type: 'image/png' });
    const [out] = preparePastedFiles([blob], counter());
    expect(out?.name).toBe('pasted-image-1.png');
    expect(out?.type).toBe('image/png');
    expect(out?.size).toBe(3);
  });

  it('无名 blob 按 mime 补扩展名', () => {
    const blob = new File([new Uint8Array([1])], '', { type: 'image/jpeg' });
    const [out] = preparePastedFiles([blob], counter());
    expect(out?.name).toBe('pasted-image-1.jpg');
  });

  it('mime 推不出扩展名时退回原文件名末段扩展名', () => {
    const blob = new File([new Uint8Array([1])], 'image.png', { type: '' });
    const [out] = preparePastedFiles([blob], counter());
    expect(out?.name).toBe('pasted-image-1.png');
  });

  it('真实文件名不动（同对象直通，不复制字节）', () => {
    const named = new File([new Uint8Array([1])], 'report.pdf', { type: 'application/pdf' });
    const [out] = preparePastedFiles([named], counter());
    expect(out).toBe(named);
  });

  it('多图一次粘贴：合成名互不重复且全部过 isValidFileName', () => {
    const mk = () => new File([new Uint8Array([1])], 'image.png', { type: 'image/png' });
    const out = preparePastedFiles([mk(), mk(), mk()], counter());
    const names = out.map((f) => f.name);
    expect(new Set(names).size).toBe(3);
    for (const name of names) {
      expect(isValidFileName(name)).toBe(true);
    }
  });
});
