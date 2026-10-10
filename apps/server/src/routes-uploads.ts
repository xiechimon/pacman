// 附件面（#310，r9 §3.1/§4 三步 wire：grant → upload → content 内嵌）。
// #1125 顺带按仓规把两处 inline import 提为顶层（拆域前唯一例外位）。
// #1125 拆域：本模块是 routes.ts 的一个资源域切片（词表单源与
// 对拍契约不变——shared WEB_REST_ENDPOINTS + test/wire.test.ts 拍的是组合
// 后的 app，不是文件布局）。编排位 = routes.ts 的 registerRoutes。

import { readFileSync } from 'node:fs';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from './context.js';
import { HttpError, parseWith } from './lib/errors.js';
import { jsonBody } from './routes-helpers.js';
import {
  grantUpload as grantAttachmentUpload,
  readAttachment,
  uploadFile as uploadAttachmentFile,
} from './services/attachments.js';

export function registerUploadRoutes(app: Hono, ctx: AppContext): void {
  // —— 附件面（#310，r9 §3.1/§4 三步 wire：grant → upload → content 内嵌
  // `attachment:<key>`）。grant 端返回 uploadUrl + HMAC 签名 token；upload 端
  // 验签 + 写盘 + DB 状态 ready；read 端供详情页/工具面拉原始字节。—————————————

  const grantBodySchema = z.object({
    kind: z.literal('attachment'),
    fileName: z.string(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    scope: z.enum(['spec', 'message']).optional(),
  });

  app.post('/api/uploads/grant', async (c) => {
    const body = parseWith(grantBodySchema, await jsonBody(c), 'body');
    const out = grantAttachmentUpload(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      {
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
        scope: body.scope ?? 'message',
      },
    );
    return c.json(out, 200);
  });

  app.post('/api/uploads/upload', async (c) => {
    const form = await c.req.formData();
    const grant = form.get('grant');
    const file = form.get('file');
    if (typeof grant !== 'string' || grant === '') {
      throw new HttpError(401, 'grant missing');
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, 'file missing');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const out = uploadAttachmentFile(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      {
        grant,
        fileBytes: bytes,
        fileMimeType: file.type || 'application/octet-stream',
        fileName: file.name || '',
      },
    );
    return c.json(out, 201);
  });

  app.get('/api/attachments/:id', async (c) => {
    const id = c.req.param('id');
    const { row, absPath } = readAttachment(
      {
        db: ctx.db,
        secretBox: ctx.secretBox,
        attachmentsDir: ctx.attachmentsDir,
        userId: ctx.user.id,
        teamId: ctx.team.id,
      },
      id,
    );
    const bytes = readFileSync(absPath);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': row.mimeType,
        'content-length': String(row.sizeBytes),
        'cache-control': 'private, max-age=300',
      },
    });
  });
}
