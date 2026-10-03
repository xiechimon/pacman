// 附件 token 语法单源（#730）：`![name](attachment:<teamId>/<id>.<ext>)` 是
// web 写侧（apps/web/src/api/attachments.ts）、server 服务层
// （WORKER_ATTACHMENT_TOOL 描述词）与 daemon 读侧三方共用的内容约定。
// daemon 展开图片附件时按本语法解析——**只认整行形态**（web 渲染面
// ATTACHMENT_LINE 同纪律：token 独占一行才渲染 chip）；行内形态保留原文
// （已知限制，票面失败方式 4 的最小裁定）。
// key 语法钉死为 `<teamId>/<id>.<ext>`（段 = recordId 字母表
// [A-Za-z0-9_-]，ext = 小写字母数字 ≤8）——daemon 侧的独立路径复验
// （server 面 isValidFileName 已挡一遍；纵深防御同 team-skills 律：
// 语法外的 key 一律不解析、不下载，防止 `../` 与绝对路径拼进 materialize
// 路径）。

/** 整行 token 形态（web chat-markdown ATTACHMENT_LINE 同纪律：≤3 前导空格）。 */
export const ATTACHMENT_TOKEN_LINE = /^ {0,3}!\[([^\]\n]*)\]\(attachment:([^)\s]+)\)\s*$/;

/** key 语法：`<teamId>/<id>.<ext>`，两段 recordId 字母表 + 小写扩展名。 */
const ATTACHMENT_KEY = /^([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\.([a-z0-9]{1,8})$/;

/** 整行图片附件 token 的引用（daemon 解析产物）。 */
export interface AttachmentTokenRef {
  /** 原始整行（含 markdown 形态，用于替换/保留）。 */
  line: string;
  /** token label（`![label]` 的 label 段，即 web 侧的 fileName）。 */
  label: string;
  /** storageKey（`<teamId>/<id>.<ext>`）。 */
  key: string;
  /** 附件 id（key 中段——attachment 工具同款裸 id）。 */
  attachmentId: string;
  /** 扩展名（小写）。 */
  ext: string;
}

/** 解析整行附件 token 引用（非整行/语法外形态一律不产——已知限制与纵深
 * 防御共用该面：行内 token 不解析，key 越界不解析）。 */
export function parseAttachmentTokenLines(text: string): AttachmentTokenRef[] {
  const refs: AttachmentTokenRef[] = [];
  for (const line of text.split('\n')) {
    const m = ATTACHMENT_TOKEN_LINE.exec(line);
    if (m === null) continue;
    const key = m[2] ?? '';
    const km = ATTACHMENT_KEY.exec(key);
    if (km === null) continue;
    refs.push({
      line,
      label: m[1] ?? '',
      key,
      attachmentId: km[2] ?? '',
      ext: km[3] ?? '',
    });
  }
  return refs;
}

/** web 写侧同形 token 构造（对拍测试与 fixture 生成共用）。 */
export function formatAttachmentToken(fileName: string, key: string): string {
  return `![${fileName}](attachment:${key})`;
}

/** 内联图片支持面（Claude Code 本尊 inline = png/jpeg/gif/webp，parent 正典
 * §Part 2；pi processImage 同面）。这四个 ext 走 inline image content block。 */
export const INLINE_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

/** ext → 内联 mime（jpg 归一 image/jpeg）。inline 面外的 ext 无映射。 */
export const INLINE_IMAGE_MIME_BY_EXT: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** 附件白名单里的全部图片 ext（MIME 白名单 image/* 对应 ext 面）：
 * inline 四件 + svg/bmp/ico/avif（素材化 + Read 路线交付面）。 */
export const IMAGE_ATTACHMENT_EXTS = [...INLINE_IMAGE_EXTS, 'svg', 'bmp', 'ico', 'avif'] as const;

/** ext 是否图片附件（text/pdf 族 = false——既有 attachment 工具路径不动）。 */
export function isImageAttachmentExt(ext: string): boolean {
  return (IMAGE_ATTACHMENT_EXTS as readonly string[]).includes(ext);
}
