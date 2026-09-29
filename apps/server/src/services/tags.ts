// 固定标签词表播种（spec 15 #394 / ADR 0002 D4）：词表 = shared FIXED_TAGS
// 单源，per 项目成行。两个调用面：项目创建时播种（routes POST /api/projects、
// chief create_project 工具）、server 启动时补齐存量项目（index.ts）。
// 幂等 = 按 (projectId, name) 查重，缺谁补谁——二次启动/重复调用不重复插。

import { FIXED_TAGS } from '@pacman/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { project, tag } from '../db/schema.js';
import { newRecordId, nowMs } from '../lib/ids.js';

/** 为单个项目补齐固定词表标签（缺谁补谁）。返回新插入的行数。 */
export function seedFixedTags(db: Db, projectId: string): number {
  const existing = new Set(
    db
      .select({ name: tag.name })
      .from(tag)
      .where(eq(tag.projectId, projectId))
      .all()
      .map((r) => r.name),
  );
  let inserted = 0;
  for (const def of FIXED_TAGS) {
    if (existing.has(def.name)) continue;
    db.insert(tag)
      .values({
        id: newRecordId(),
        projectId,
        name: def.name,
        color: def.color,
        createdAt: nowMs(),
        v: 1,
      })
      .run();
    inserted += 1;
  }
  return inserted;
}

/** 启动补齐：存量项目逐个 seedFixedTags（幂等，空集零动作）。 */
export function backfillFixedTags(db: Db): void {
  const rows = db.select({ id: project.id }).from(project).all();
  for (const row of rows) seedFixedTags(db, row.id);
}

/** 按词表 name 解析本项目的 tag 行 id（set_task_meta 工具面）；词表外 name
 *  或未播种（启动补齐前的手工建库等边缘）= null，调用面译 400。 */
export function resolveFixedTagId(db: Db, projectId: string, name: string): string | null {
  const row = db
    .select({ id: tag.id })
    .from(tag)
    .where(and(eq(tag.projectId, projectId), eq(tag.name, name)))
    .get();
  return row?.id ?? null;
}
