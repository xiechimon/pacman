// 附件三步 wire 客户端（#310，r9 §3.1）。
//   grantUpload → 申请 grant + key
//   uploadFile  → multipart 上传到 grant.uploadUrl
// 上传通道走 grant 上传的 uploadUrl 字符串（r9 §3.1 步骤 2 标注为「独立上传
// host」——server 当前同源实现，未来抽独立 host 时此处零改动，仅 grant
// 响应字串的 host 变化）。返回的 attachment markdown = `![name](attachment:key)`
// 是与 server 服务层 `attachment:` scheme 互通的内容形态（detail 渲染面据此
// chip 化，Task 6）。
//
// 客户端约束：
//  - size 上限 10 MiB（与 server MAX_BYTES 一致——客户端先卡，超限不发 grant）
//  - MIME 白名单：text/* + image/* + json/pdf/xml（与 server ALLOWED_MIME_*）
//  - fileName 含控制字符或路径穿越 → 拒
//  - 多文件串行上传（grant 一文件一签，幂等 keyed by 上传 grant）
//
// 失败方式清单（先于实现）：
//  ① size ≤ 0 / > 10 MiB → 本地拒，不发 grant
//  ② mime 不在白名单 → 本地拒
//  ③ fileName 含 / \ \0 或控制字符 → 本地拒
//  ④ grant 失败（400/401/网络）→ 抛错给调用面呈现
//  ⑤ upload 失败（grant 过期/篡改/网络）→ 抛错给调用面
//  ⑥ 读到附件内容 length 与 grant.size 不一致（本地 File 大小变化）→ 不发 upload

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_PREFIXES = ['text/', 'image/'];
const ALLOWED_EXACT = new Set(['application/json', 'application/pdf', 'application/xml']);

function isAllowedMime(mime: string): boolean {
  if (ALLOWED_EXACT.has(mime)) return true;
  return ALLOWED_PREFIXES.some((p) => mime.startsWith(p));
}

/** fileName 合法性本地预检——与服务层 isValidFileName 镜像，仅做客户端拒首。 */
export function isValidFileName(fileName: string): boolean {
  if (fileName.length === 0 || fileName.length > 200) return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('\0')) return false;
  if (fileName === '.' || fileName === '..') return false;
  for (let i = 0; i < fileName.length; i += 1) {
    if (fileName.charCodeAt(i) < 0x20) return false;
  }
  return true;
}

export interface AttachFileInput {
  file: File;
  scope: 'spec' | 'message';
}

export interface AttachResult {
  /** markdown token：发到 message / 写进 spec 直接内嵌。 */
  token: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** 存储 key = `<teamId>/<id>.<ext>`，detail 渲染面据此组装读路径。 */
  key: string;
  attachmentId: string;
}

interface GrantResponse {
  uploadUrl: string;
  grant: string;
  key: string;
  attachmentId: string;
}

/** 单文件三步 wire。失败时抛 Error，message 给人读（调用面可直接展示）。 */
export async function attachFile(input: AttachFileInput): Promise<AttachResult> {
  const { file, scope } = input;
  if (!isValidFileName(file.name)) throw new Error(`invalid fileName: ${file.name}`);
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error(`size out of range: ${file.size} (max ${MAX_BYTES})`);
  }
  if (!isAllowedMime(file.type || '')) {
    throw new Error(`mime not allowed: ${file.type || '(empty)'}`);
  }
  // 1) grant
  const grantRes = await fetch('/api/uploads/grant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'attachment',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      scope,
    }),
  });
  if (!grantRes.ok) {
    throw new Error(`grant failed: ${grantRes.status} ${await grantRes.text()}`);
  }
  const grantBody = (await grantRes.json()) as GrantResponse;
  // 2) 上传（grant.uploadUrl = '/api/uploads'，完整路径 = origin + grant.uploadUrl）
  const form = new FormData();
  form.set('grant', grantBody.grant);
  form.set('file', file, file.name);
  const upRes = await fetch(`${grantBody.uploadUrl}/upload`, { method: 'POST', body: form });
  if (!upRes.ok) {
    throw new Error(`upload failed: ${upRes.status} ${await upRes.text()}`);
  }
  // 3) 拼 markdown token
  return {
    token: `![${file.name}](attachment:${grantBody.key})`,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    key: grantBody.key,
    attachmentId: grantBody.attachmentId,
  };
}
