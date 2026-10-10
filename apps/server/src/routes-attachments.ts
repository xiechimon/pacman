// attachments 域（#1125 拆分自 routes.ts）：附件三步 wire（#310，r9 §3.1/§4：
// grant → upload → content 内嵌 `attachment:<key>`）。grant 端返回 uploadUrl +
// HMAC 签名 token；upload 端验签 + 写盘 + DB 状态 ready；read 端供详情页/工具
// 面拉原始字节。scope 跨 composer（message）与新建任务 dialog（spec）——非
// 会话专属，独立成域。readAttachment/readFileSync 原为路由体内 inline import，
// 拆分落位时提升为 top-level（仓规禁 inline import；行为不变——同一模块
// 绑定，无环）。

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

export function registerAttachmentRoutes(app: Hono, ctx: AppContext): void {
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
