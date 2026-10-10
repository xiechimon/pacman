// Clipboard-paste → attachment chain shared logic (issue #729, canon #727
// Part 2 + r9 §3.1). Both composer faces — the detail conversation composer
// (useComposerWire) and the new-task dialog — consume this single module so
// the line-atomic insertion discipline can never drift apart (the
// ATTACHMENT_LINE parser in detail/chat-markdown.tsx is whole-line
// anchored: a token sharing its line with prose silently degrades to
// literal text).
//
// Scope = pure functions + one small stateful counter, no JSX. #1127 扩界：
// 逐文件 grant + upload + 失败 toast 的**循环配方**此前在 detail composer 与
// chief drawer 两处复制（靠「同款配方」注释手工同步）——收编为本模块的
// uploadMessageAttachments，toast 文案由调用面的 t 参数化（模块自身不进
// i18n provider）；语义单源：失败 toast 点名 + 成功 token 仍落、draft 不动。
//
// Rulings honored here (issue #729):
//  - tokens land at the captured caret, each on its own line; a paste at
//    mid-line breaks the line (CC inserts at cursor, not append-only);
//  - clipboard blobs with no name / a generic name (image.png, blob) get a
//    synthesized pasted-image-<n>.<ext> name, n incrementing per draft
//    (CC numbers [Image #N] per draft); real file names pass through;
//  - mixed clipboard (files + text): files win, the text is dropped — the
//    paste handler preventDefaults once files are seen;
//  - a text-only paste extracts to the empty set and the handler never
//    touches the event, so plain text pasting stays byte-identical.

import { toast } from 'sonner';
import { AttachmentError, attachFile } from '../api/attachments.js';

/** Structural stand-in for DataTransfer so the extraction stays testable
 *  outside a DOM (the real clipboardData is assignable by shape). */
export interface ClipboardFileItem {
  kind: string;
  getAsFile(): File | null;
}

export interface ClipboardDataLike {
  files?: ArrayLike<File>;
  items?: ArrayLike<ClipboardFileItem>;
}

/** Single-source file extraction (failure mode 2: some platforms expose the
 *  same pasted image through both `files` and `items` — merging the two
 *  sources would upload it twice). `files` wins; `items` is the fallback
 *  for engines that only populate the item list (failure mode 4). */
export function filesFromClipboardData(data: ClipboardDataLike | null | undefined): File[] {
  if (data == null) return [];
  const direct = Array.from(data.files ?? []);
  if (direct.length > 0) return direct;
  const fromItems: File[] = [];
  const items = data.items ?? [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item != null && item.kind === 'file') {
      const file = item.getAsFile();
      if (file != null) fromItems.push(file);
    }
  }
  return fromItems;
}

/** Line-atomic token insertion at the caret. Guarantees every token
 *  occupies a whole line (leading newline unless the caret already sits at
 *  a line start; trailing newline unless the following text already starts
 *  one) and returns the caret to place after the block — the start of the
 *  line below it, so continued typing can never glue onto a token.
 *  caret = null appends at the end, byte-identical to the pre-#729 clip
 *  flow (each token on its own line, trailing newline). */
export function insertAttachmentTokens(
  value: string,
  tokens: string[],
  caret: number | null,
): { value: string; caret: number } {
  const at = caret == null || caret < 0 || caret > value.length ? value.length : caret;
  if (tokens.length === 0) return { value, caret: at };
  const before = value.slice(0, at);
  const after = value.slice(at);
  const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const trail = after.startsWith('\n') ? '' : '\n';
  const block = tokens.join('\n');
  // No trailing newline added only when the existing text already opens the
  // next line — then the caret still hops over that newline (+1) so it
  // never rests inside the token line.
  const nextCaret =
    before.length + lead.length + block.length + trail.length + (trail === '' ? 1 : 0);
  return { value: before + lead + block + trail + after, caret: nextCaret };
}

// (English-only note: keep this span free of CJK — the i18n coverage
// scanner walks raw TS tokens and misreads quote characters in comments
// next to regex literals.)
const GENERIC_IMAGE_NAME = /^image\.[a-z0-9]+$/i;

/** Whole-line attachment token (the #310 spec-block shape): key rides
 *  teamId/id.ext, the read endpoint is the last segment minus extension.
 *  Single source since #757 — detail/chat-markdown.tsx imports this instead
 *  of carrying its own copy, so the composer strip and the transcript
 *  renderer can never disagree on what counts as a chip line.
 *  (English-only note: this span sits between the backticks the i18n
 *  coverage scanner misreads out of the FENCE regex in chat-markdown —
 *  CJK here would be swallowed as a template quasi.) */
export const ATTACHMENT_LINE = /^ {0,3}!\[([^\]]*)\]\(attachment:([^)]+)\)\s*$/;

export interface AttachmentToken {
  name: string;
  key: string;
}

/** Draft-order whole-line attachment tokens (#757 composer strip data).
 *  Inline tokens sharing a line with prose are skipped — the renderer leaves
 *  those as literal text (ATTACHMENT_LINE is whole-line anchored), and the
 *  strip must mirror that rather than chip-ify what the transcript shows as
 *  text. */
export function parseAttachmentTokens(text: string): AttachmentToken[] {
  const out: AttachmentToken[] = [];
  for (const line of text.split('\n')) {
    const hit = ATTACHMENT_LINE.exec(line);
    if (hit !== null) out.push({ name: hit[1] ?? '', key: hit[2] ?? '' });
  }
  return out;
}

/** One file with an upload in flight (#757 in-transit placeholder). `url` is
 *  a blob object URL for image/* (the strip renders the real bytes at chip
 *  size, so landing the token never moves layout); null for the typeless
 *  shapes the chip renders as a name link. */
export interface PendingAttachment {
  uid: string;
  name: string;
  mime: string;
  url: string | null;
}

/** Clipboard blobs that carry no user-meaningful name: empty, the browser
 *  screenshot default image.<ext>, or a bare blob. */
export function isGenericClipboardName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === '') return true;
  if (trimmed.toLowerCase() === 'blob') return true;
  return GENERIC_IMAGE_NAME.test(trimmed);
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif',
};

/** mime → file extension for synthesized names. The extension must survive
 *  the server ALLOWED_EXTS gate (services/attachments.ts derives the
 *  storage extension from the file name), so unknown shapes return null
 *  instead of guessing. */
export function pastedImageExt(mime: string): string | null {
  const normalized = mime.trim().toLowerCase();
  const mapped = MIME_EXT[normalized];
  if (mapped !== undefined) return mapped;
  if (normalized.startsWith('image/')) {
    const sub = normalized.slice('image/'.length);
    // (English-only note: bare alnum subtypes only — same shape as the
    // server extOf guard.)
    if (/^[a-z0-9]{1,8}$/.test(sub)) return sub;
  }
  return null;
}

/** Extension from a file name's last dot segment (server extOf mirror). */
function extOfName(name: string): string | null {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) return null;
  const ext = name.slice(lastDot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : null;
}

/** Per-draft paste numbering (CC numbers image chips per draft). begin()
 *  resets the count when a fresh draft starts — blank draft AND no upload
 *  in flight; the in-flight guard is what keeps two rapid pastes into a
 *  still-empty draft from colliding on the same number (failure mode 6). */
export interface PastedNameCounter {
  begin(draftBlank: boolean): void;
  end(): void;
  next(ext: string): string;
}

export function createPastedNameCounter(): PastedNameCounter {
  let count = 0;
  let inFlight = 0;
  return {
    begin(draftBlank: boolean) {
      if (draftBlank && inFlight === 0) count = 0;
      inFlight += 1;
    },
    end() {
      inFlight = Math.max(0, inFlight - 1);
    },
    next(ext: string) {
      count += 1;
      return `pasted-image-${count}.${ext}`;
    },
  };
}

/** Rename generic clipboard blobs to synthesized pasted-image names;
 *  real names pass through as the same File object (bytes untouched).
 *  A generic blob whose extension cannot be derived stays as-is — the
 *  chain's validation will reject it with a toast rather than invent a
 *  name the server whitelist would refuse anyway. */
export function preparePastedFiles(files: readonly File[], counter: PastedNameCounter): File[] {
  return files.map((file) => {
    if (!isGenericClipboardName(file.name)) return file;
    const ext = pastedImageExt(file.type) ?? extOfName(file.name);
    if (ext === null) return file;
    return new File([file], counter.next(ext), {
      type: file.type,
      lastModified: file.lastModified,
    });
  });
}

/** Failure → user-facing toast title (zh source string = the en dict key;
 *  surfaces wrap it in t()). Size and type rejections get their own copy —
 *  they are local validation the user can act on; everything else folds
 *  into the generic upload failure (failure mode 12: the draft survives,
 *  the toast says why nothing landed). */
export function attachmentFailureTitle(err: unknown): string {
  if (err instanceof AttachmentError) {
    if (err.reason === 'size') return '附件超过 10MB 上限';
    if (err.reason === 'mime') return '不支持该文件类型';
  }
  return '附件上传失败';
}

/** #1127: 逐文件 grant + upload 循环（scope 'message'）的单源——detail
 *  composer 与 chief drawer 共用。失败 toast 点名 + 成功文件的 token 仍落
 *  （#729 失败方式 5/12 律：draft 一字不动）；t 参数化文案，模块不进
 *  i18n provider。 */
export async function uploadMessageAttachments(
  files: File[],
  t: (key: string) => string,
): Promise<string[]> {
  const tokens: string[] = [];
  for (const file of files) {
    try {
      const r = await attachFile({ file, scope: 'message' });
      tokens.push(r.token);
    } catch (err) {
      console.error('attachment failed', file.name, err);
      toast.error(t(attachmentFailureTitle(err)), {
        description: file.name,
      });
    }
  }
  return tokens;
}
