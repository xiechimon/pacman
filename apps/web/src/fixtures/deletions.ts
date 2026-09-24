// Client-side deletion overlay for the fixture phase (#66): the delete
// flow removes a todo for the rest of the SPA session — card gone, column
// count back, URL home (r2 §5.4) — across the detail → board navigation.
// A reload restores the frozen fixture set; the backend line (03 §M2)
// replaces this with the real DELETE endpoint.

const deleted = new Set<string>();

export function markDeleted(id: string): void {
  deleted.add(id);
}

/** #207: 项目删除覆面同律 — 侧栏项目行按本位隐去(删除后跳 /app,列表消失)。 */
export function isDeleted(id: string): boolean {
  return deleted.has(id);
}

export function withoutDeleted<T extends { id: string }>(todos: T[]): T[] {
  return todos.filter((t) => !deleted.has(t.id));
}
