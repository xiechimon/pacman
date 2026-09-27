// Client-side deletion overlay for the fixture phase (#66): the delete
// flow removes a todo for the rest of the SPA session — card gone, column
// count back, URL home (r2 §5.4) — across the detail → board navigation.
// A reload restores the frozen fixture set; the backend line (03 §M2)
// replaces this with the real DELETE endpoint.

const deleted = new Set<string>();

export function markDeleted(id: string): void {
  deleted.add(id);
}

// #318 关闭面同律:fixture 无 phase wire,更多菜单「关闭」把 todo 记入
// 会话覆面(卡片立即隐藏,r1 09-16 Close 语义;closed 不占列 = 看板同隐)。
const closed = new Set<string>();

export function markClosed(id: string): void {
  closed.add(id);
}

/** #207: 项目删除覆面同律 — 侧栏项目行按本位隐去(删除后跳 /app,列表消失)。 */
export function isDeleted(id: string): boolean {
  return deleted.has(id);
}

/** 会话隐去覆面 = 删除 + 关闭两集合并(#318);isDeleted 保持仅删除集
 *  (#207 项目删除面语义,项目无关闭)。 */
export function withoutDeleted<T extends { id: string }>(todos: T[]): T[] {
  return todos.filter((t) => !deleted.has(t.id) && !closed.has(t.id));
}
