// 附件回收 GC（issue #759，策略正本 docs/spec/20-附件回收策略.md）。
// 失败方式清单（先固化，代码是让场景通过的手段）：
// ① 未引用 ready 件超 grace → 文件 + 行皆被收（stats.orphan+1）
// ② spec / message / chief_message / steer / plan 任一引用 → 不动
// ③ 行内 token（非整行形态）→ 仍算引用（多留不多删）
// ④ 删任务本身不动附件（R1）；零引用孤儿超 grace 才被收
// ⑤ pending 超 24h → 行被收；新鲜 pending → 留
// ⑥ 配额满时 grant → 400；旧件不受影响
// ⑦ scheduler tick gen：首 tick 扫、1h 内不重扫、1h 后再扫

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import {
  attachment as attachmentTable,
  build as buildTable,
  chiefMessage as chiefMessageTable,
  chiefThread as chiefThreadTable,
  message as messageTable,
  plan as planTable,
  project as projectTable,
  steerPending as steerPendingTable,
  todo as todoTable,
} from '../src/db/schema.js';
import { newRecordId } from '../src/lib/ids.js';
import {
  ATTACHMENT_ORPHAN_GRACE_MS,
  ATTACHMENT_PENDING_TTL_MS,
  type GcLogger,
  sweepAttachments,
  TEAM_ATTACHMENTS_QUOTA_BYTES,
} from '../src/services/attachment-gc.js';
import { bootServer, req, type TestServer } from './helpers.js';

const disposables: (() => void)[] = [];
afterAll(() => {
  for (const d of disposables) d();
});

const DAY = 24 * 60 * 60 * 1000;

function makeLogger(): GcLogger & { infos: string[]; debugs: string[] } {
  const infos: string[] = [];
  const debugs: string[] = [];
  return {
    infos,
    debugs,
    info: (_meta: unknown, msg: string) => {
      infos.push(msg);
    },
    debug: (_meta: unknown, msg: string) => {
      debugs.push(msg);
    },
  };
}

/** 直插附件行 + 落盘（创建面走真实 grant/upload 的见 attachments.test.ts；
 * 本文件只测回收面）。 */
function putAttachment(
  s: TestServer,
  opts: {
    status?: 'pending' | 'ready';
    createdAgo?: number;
    fileName?: string;
    bytes?: Uint8Array;
    scope?: 'spec' | 'message';
  } = {},
): { id: string; key: string } {
  const id = newRecordId();
  const fileName = opts.fileName ?? 'note.md';
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1) : 'md';
  const key = `${s.team.id}/${id}.${ext}`;
  const bytes = opts.bytes ?? new TextEncoder().encode('# hello\n');
  s.db
    .insert(attachmentTable)
    .values({
      id,
      teamId: s.team.id,
      createdBy: s.user.id,
      fileName,
      mimeType: 'text/markdown',
      sizeBytes: bytes.byteLength,
      storageKey: key,
      grantId: newRecordId(),
      scope: opts.scope ?? 'message',
      status: opts.status ?? 'ready',
      createdAt: Date.now() - (opts.createdAgo ?? 0),
    })
    .run();
  if ((opts.status ?? 'ready') === 'ready') {
    mkdirSync(join(s.attachmentsDir, s.team.id), { recursive: true });
    writeFileSync(join(s.attachmentsDir, key), bytes);
  }
  return { id, key };
}

function tokenFor(fileName: string, key: string): string {
  return `![${fileName}](attachment:${key})`;
}

/** 直插 project + todo（spec 可带 token）。 */
function putTodo(s: TestServer, spec: string): string {
  const todoId = newRecordId();
  const projectId = newRecordId();
  s.db.insert(projectTable).values({ id: projectId, name: 'gc', teamId: s.team.id }).run();
  s.db
    .insert(todoTable)
    .values({
      id: todoId,
      teamId: s.team.id,
      projectId,
      title: 'gc target',
      spec,
      phaseAt: Date.now(),
      seqNum: 1,
    })
    .run();
  return todoId;
}

function rowOf(s: TestServer, id: string) {
  return s.db.select().from(attachmentTable).where(eq(attachmentTable.id, id)).get();
}

describe('attachment gc — 未引用 ready 件', () => {
  test('超 grace → 文件 + 行被收，stats 记 orphan + bytes', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const log = makeLogger();
    const { id, key } = putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: log },
      Date.now(),
    );
    expect(stats.orphan).toBe(1);
    expect(stats.pending).toBe(0);
    expect(stats.reclaimedBytes).toBeGreaterThan(0);
    expect(rowOf(s, id)).toBeUndefined();
    expect(existsSync(join(s.attachmentsDir, key))).toBe(false);
    expect(log.infos.length).toBeGreaterThanOrEqual(1);
  });

  test('grace 内 → 留（文件 + 行皆在，stats 全零）', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const log = makeLogger();
    const { id, key } = putAttachment(s, { createdAgo: DAY });
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: log },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(stats.pending).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
    expect(existsSync(join(s.attachmentsDir, key))).toBe(true);
  });
});

describe('attachment gc — 有引用一律保留', () => {
  test('todo.spec 整行 token 引用 → 不动', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id, key } = putAttachment(s, {
      createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY,
    });
    putTodo(s, `需求正文\n${tokenFor('note.md', key)}\n`);
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
    expect(existsSync(join(s.attachmentsDir, key))).toBe(true);
  });

  test('message.content JSON 内引用 → 不动', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id, key } = putAttachment(s, {
      createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY,
    });
    s.db
      .insert(messageTable)
      .values({
        id: newRecordId(),
        conversationId: 'conv-gc',
        role: 'user',
        content: { text: `看这张图\n${tokenFor('note.md', key)}` },
        createdAt: Date.now(),
      })
      .run();
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
  });

  test('行内 token（非整行形态）→ 仍算引用，不动', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id } = putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    // 行内形态渲染面退化成字面文本，但用户意图仍在——多留不多删。
    putTodo(s, `正文里顺手一提 ${tokenFor('note.md', `${s.team.id}/${id}.md`)} 别删`);
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
  });

  test('chief_message 引用 → 不动', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id, key } = putAttachment(s, {
      createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY,
    });
    const threadId = `chief-${newRecordId()}`;
    s.db
      .insert(chiefThreadTable)
      .values({
        id: threadId,
        chiefId: `chief-${s.user.id}-${s.team.id}`,
        userId: s.user.id,
        teamId: s.team.id,
        title: 'gc thread',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sessionId: 'sess-gc',
        sessionOpenedAt: Date.now(),
      })
      .run();
    s.db
      .insert(chiefMessageTable)
      .values({
        id: newRecordId(),
        threadId,
        role: 'user',
        content: { text: tokenFor('note.md', key) },
        createdAt: Date.now(),
      })
      .run();
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
  });

  test('steer_pending / plan 引用 → 不动', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const a = putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    const b = putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    s.db
      .insert(steerPendingTable)
      .values({
        conversationId: 'conv-steer',
        stepId: 'step-steer',
        content: `补充说明 ${tokenFor('a.md', a.key)}`,
        createdAt: Date.now(),
      })
      .run();
    const todoId = putTodo(s, 'plan host');
    const buildId = newRecordId();
    s.db
      .insert(buildTable)
      .values({
        id: buildId,
        todoId,
        withPlan: true,
        triggerSource: 'user',
        createdAt: Date.now(),
      })
      .run();
    s.db
      .insert(planTable)
      .values({
        id: newRecordId(),
        buildId,
        version: 1,
        content: `方案\n${tokenFor('b.md', b.key)}`,
        createdAt: Date.now(),
      })
      .run();
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, a.id)).toBeTruthy();
    expect(rowOf(s, b.id)).toBeTruthy();
  });
});

describe('attachment gc — 删任务语义（R1）', () => {
  test('删任务本身不动附件；孤儿超 grace 后被收', async () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id, key } = putAttachment(s, {
      createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY,
    });
    const todoId = putTodo(s, `带图任务\n${tokenFor('note.md', key)}\n`);
    // 删任务：附件行与文件当场不动（R1：不连带删）。
    const { deleteTodo } = await import('../src/services/todos.js');
    const deleted = deleteTodo({ db: s.db, hub: s.hub, user: s.user }, todoId);
    expect(deleted).toBe(true);
    expect(rowOf(s, id)).toBeTruthy();
    expect(existsSync(join(s.attachmentsDir, key))).toBe(true);
    // 引用源消失 → 下一次 sweep 收走孤儿。
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(1);
    expect(rowOf(s, id)).toBeUndefined();
  });

  test('删任务但附件仍被他处引用 → 不动', async () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id } = putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    const todoId = putTodo(s, `任务A\n${tokenFor('note.md', `${s.team.id}/${id}.md`)}\n`);
    putTodo(s, `任务B转发的同一张图\n${tokenFor('note.md', `${s.team.id}/${id}.md`)}\n`);
    const { deleteTodo } = await import('../src/services/todos.js');
    deleteTodo({ db: s.db, hub: s.hub, user: s.user }, todoId);
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
  });
});

describe('attachment gc — pending 件', () => {
  test('pending 超 24h → 行被收（无文件、无引用、grant 已死）', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id } = putAttachment(s, {
      status: 'pending',
      createdAgo: ATTACHMENT_PENDING_TTL_MS + DAY,
    });
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.pending).toBe(1);
    expect(stats.orphan).toBe(0);
    expect(rowOf(s, id)).toBeUndefined();
  });

  test('新鲜 pending → 留（上传在途）', () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { id } = putAttachment(s, { status: 'pending', createdAgo: 60_000 });
    const stats = sweepAttachments(
      { db: s.db, attachmentsDir: s.attachmentsDir, logger: makeLogger() },
      Date.now(),
    );
    expect(stats.pending).toBe(0);
    expect(rowOf(s, id)).toBeTruthy();
  });
});

describe('attachment gc — 配额（R4：准入卡，不删有引用）', () => {
  test('team 用量满 1GiB 时 grant → 400；旧件不受影响', async () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    // 直插一行占满配额的行（grant 面只读 DB 求和，不碰盘）。
    s.db
      .insert(attachmentTable)
      .values({
        id: newRecordId(),
        teamId: s.team.id,
        createdBy: s.user.id,
        fileName: 'hog.bin',
        mimeType: 'text/plain',
        sizeBytes: TEAM_ATTACHMENTS_QUOTA_BYTES,
        storageKey: `${s.team.id}/${newRecordId()}.txt`,
        grantId: newRecordId(),
        scope: 'message',
        status: 'ready',
        createdAt: Date.now(),
      })
      .run();
    const res = await req(s.app, 'POST', '/api/uploads/grant', {
      kind: 'attachment',
      fileName: 'one-more.md',
      mimeType: 'text/markdown',
      size: 8,
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/quota/);
  });
});

describe('attachment gc — scheduler 节奏', () => {
  test('首 tick 扫；1h 内不重扫；1h 后再扫', async () => {
    const s = bootServer();
    disposables.push(() => s.dispose());
    const { createScheduler } = await import('../src/services/scheduler.js');
    const infos: string[] = [];
    const logger = {
      info: (_m: unknown, msg: string) => {
        infos.push(msg);
      },
      debug: () => {},
    };
    const base = Date.now();
    putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    const scheduler = createScheduler(
      { db: s.db, hub: s.hub, user: s.user },
      { tickMs: 15_000 },
      { attachmentsDir: s.attachmentsDir, logger },
    );
    scheduler.tick(base);
    expect(
      s.db
        .select()
        .from(attachmentTable)
        .all()
        .filter((r) => r.status === 'ready'),
    ).toHaveLength(0);
    // 第二件孤儿在 1min 后到来 → 卡住不扫。
    putAttachment(s, { createdAgo: ATTACHMENT_ORPHAN_GRACE_MS + DAY });
    scheduler.tick(base + 60_000);
    expect(
      s.db
        .select()
        .from(attachmentTable)
        .all()
        .filter((r) => r.status === 'ready'),
    ).toHaveLength(1);
    // 1h 后 → 扫走。
    scheduler.tick(base + 61 * 60_000);
    expect(
      s.db
        .select()
        .from(attachmentTable)
        .all()
        .filter((r) => r.status === 'ready'),
    ).toHaveLength(0);
    scheduler.stop();
  });
});
