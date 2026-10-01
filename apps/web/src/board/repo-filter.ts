// 看板仓库筛选（#445 建轴，XMON-57 并入统一筛选面板）：本文件 = 仓库轴的
// **纯逻辑面**（URL 解析 / 命中判定 / 选项集）；DOM 面在 filter-panel.tsx。
// #445 的顶栏左侧 chip 组已撤（逐个点选的第二个来源），仓库维度改为面板里
// 的一段，批次操作（全选/清除）与类型轴同形。
//
// 设计裁决（#445 轴 1，XMON-57 复核后保留）：
//   - 筛选态进 URL ?projects=（沿 ?tags= 既有先例：replace 写回不刷历史、
//     刷新/分享不丢）；清空即回全量；
//   - 多选 = OR 并集（**不换** todos.dev 的排除式：排除只在「几乎全要」时
//     占优，而并集 + 全选键已覆盖同一需求，换模型要重写 ?projects= 契约）；
//     与类型轴不同，**没有**「无标签恒可见」豁免——每张卡必属一个项目，
//     仓库收窄的语义就是「只看我的这几个仓库」，命中 = projectId 精确集成员；
//   - 规范序 = 字典序（项目无固定词表，字节序即规范序——同选集恒同 URL，
//     与点击序/书写序无关）；未知 id（已删项目/脏 URL）解析不丢弃——命中
//     判定天然不命中也不误配，收窄见底走板级空态 + 清除钮，不出空白看板。
//
// 消费面：parseProjectsParam / matchesProjectFilter / buildRepoOptions 由
// board-page.tsx、filter-panel.tsx 与测试面消费。

import type { TodoRecord } from '../fixtures/records.js';

/** 面板选项（仓库轴）。项目不带色彩位——词表配色专属 TagChip，仓库行渲染
 *  素文本（刻意的材质区分，沿 #445 原裁决）。 */
export interface RepoOption {
  id: string;
  name: string;
  /** 类型轴收窄后、**不含仓库轴自身**的命中卡数（勾上 A 之后 B/C 不该全
   *  变 0）。 */
  count: number;
}

/** URL 参 → 选中项目 id 集。去重 + 字典序规范序（同选集恒同 URL，与书写
 *  序无关）；空段丢弃。未知 id 不在解析层丢——项目无静态词表，解析保持
 *  纯函数不依赖异步数据面（直达 URL 在项目列表加载完成前即可正确收窄：
 *  projectId 在卡上，命中判定零异步依赖）。 */
export function parseProjectsParam(raw: string | null): string[] {
  if (raw == null || raw === '') return [];
  return [...new Set(raw.split(','))].filter((id) => id !== '').sort();
}

/** 命中判定：空选中集 = 全量；否则 projectId 精确集成员（多选 = OR 并集，
 *  无恒可见豁免——见模块头注）。 */
export function matchesProjectFilter(todo: TodoRecord, selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  return selected.has(todo.projectId);
}

/** 项目源 → 选项集 + 计数。entries 的序即行的序（调用面已按来源给出：
 *  live = useProjects 序，fixture = scenario.projectNames 书写序）；count =
 *  另一轴（类型）收窄后该项目的卡数，本轴自身的选中不参与（见 RepoOption）。
 *  不变式：两轴皆空选集时 Σcount = 全量卡数。 */
export function buildRepoOptions(
  entries: readonly { id: string; name: string }[],
  todos: readonly TodoRecord[],
  otherAxis: (todo: TodoRecord) => boolean,
): RepoOption[] {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (!otherAxis(todo)) continue;
    counts.set(todo.projectId, (counts.get(todo.projectId) ?? 0) + 1);
  }
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    count: counts.get(entry.id) ?? 0,
  }));
}
