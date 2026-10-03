// attachFile 客户端预检与失败分类（#729 失败方式 FM5 / FM12）。
//
// 逐条钉住的失败方式：
//  FM5  白名单与 cap：边界值 10*1024*1024 整 = 过、+1 = 拒；拒必须在本地
//       发生（fetch 一次都不许发）；mime 白名单外拒；文件名非法拒。
//  FM12 上传失败草稿保全的前提 = 失败可被调用面分类呈现：grant/upload
//       网络失败各归其类，toast 文案映射（attachmentFailureTitle）钉死。
//  附加：token 形态 ![name](attachment:key) 是渲染面 ATTACHMENT_LINE 的
//  唯一输入，序列化形状在这里钉住。

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachmentError, attachFile } from '../src/api/attachments.js';
import { attachmentFailureTitle } from '../src/overlay/attachment-paste.js';

const MAX = 10 * 1024 * 1024;

function pngFile(size: number, name = 'a.png'): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

function stubFetch(grantOk = true, uploadOk = true) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/grant')) {
      return grantOk
        ? new Response(
            JSON.stringify({
              uploadUrl: '/api/uploads',
              grant: 'g-1',
              key: 'team-1/att-9.png',
              attachmentId: 'att-9',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : new Response('bad grant', { status: 400 });
    }
    return uploadOk ? new Response('{}', { status: 200 }) : new Response('boom', { status: 500 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('attachFile 本地预检（FM5：拒了就不许发请求）', () => {
  it('size 恰为 10MiB 整 = 过（走完 grant+upload，返回 token）', async () => {
    const fetchMock = stubFetch();
    const r = await attachFile({ file: pngFile(MAX), scope: 'message' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.token).toBe('![a.png](attachment:team-1/att-9.png)');
    expect(r.attachmentId).toBe('att-9');
    expect(r.key).toBe('team-1/att-9.png');
  });

  it('size = 10MiB + 1 = 拒（reason=size，fetch 零调用）', async () => {
    const fetchMock = stubFetch();
    const err = await attachFile({ file: pngFile(MAX + 1), scope: 'message' }).catch((e) => e);
    expect(err).toBeInstanceOf(AttachmentError);
    expect((err as AttachmentError).reason).toBe('size');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('size = 0 = 拒（reason=size）', async () => {
    const fetchMock = stubFetch();
    const err = await attachFile({ file: pngFile(0), scope: 'spec' }).catch((e) => e);
    expect((err as AttachmentError).reason).toBe('size');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mime 白名单外（application/zip）= 拒（reason=mime，fetch 零调用）', async () => {
    const fetchMock = stubFetch();
    const zip = new File([new Uint8Array(10)], 'a.zip', { type: 'application/zip' });
    const err = await attachFile({ file: zip, scope: 'message' }).catch((e) => e);
    expect((err as AttachmentError).reason).toBe('mime');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('文件名含路径穿越 = 拒（reason=invalid-name）', async () => {
    const fetchMock = stubFetch();
    const bad = new File([new Uint8Array(10)], '../a.png', { type: 'image/png' });
    const err = await attachFile({ file: bad, scope: 'message' }).catch((e) => e);
    expect((err as AttachmentError).reason).toBe('invalid-name');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('attachFile 网络失败分类（FM12）', () => {
  it('grant 400 → reason=grant，不再发 upload', async () => {
    const fetchMock = stubFetch(false, true);
    const err = await attachFile({ file: pngFile(64), scope: 'message' }).catch((e) => e);
    expect((err as AttachmentError).reason).toBe('grant');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('upload 500 → reason=upload', async () => {
    const fetchMock = stubFetch(true, false);
    const err = await attachFile({ file: pngFile(64), scope: 'message' }).catch((e) => e);
    expect((err as AttachmentError).reason).toBe('upload');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('attachmentFailureTitle —— toast 文案映射（zh 键 = en 词典键）', () => {
  it('size → 大小上限文案', () => {
    expect(attachmentFailureTitle(new AttachmentError('size', 'x'))).toBe('附件超过 10MB 上限');
  });

  it('mime → 类型不支持文案', () => {
    expect(attachmentFailureTitle(new AttachmentError('mime', 'x'))).toBe('不支持该文件类型');
  });

  it('grant / upload / invalid-name → 上传失败文案', () => {
    expect(attachmentFailureTitle(new AttachmentError('grant', 'x'))).toBe('附件上传失败');
    expect(attachmentFailureTitle(new AttachmentError('upload', 'x'))).toBe('附件上传失败');
    expect(attachmentFailureTitle(new AttachmentError('invalid-name', 'x'))).toBe('附件上传失败');
  });

  it('非 AttachmentError（未知异常）→ 上传失败文案，不吞不炸', () => {
    expect(attachmentFailureTitle(new Error('network down'))).toBe('附件上传失败');
    expect(attachmentFailureTitle(undefined)).toBe('附件上传失败');
  });
});
