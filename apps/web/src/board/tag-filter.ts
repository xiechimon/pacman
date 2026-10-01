// 看板类型筛选（#403 建轴，#445 收进顶栏动作区，XMON-57 词表动态化）：
// 多选 OR 并集。本文件 = 类型轴的**纯逻辑面**（URL 解析 / 命中判定 / 选项
// 集）；DOM 面在 filter-panel.tsx——两轴共用一个面板，但「有哪些、怎么判」
// 留在各自轴文件（单源，面板不写第二份）。
//
// 设计裁决：
//   - 多选 = OR 并集（「找某类活」直觉；AND 在「每任务至多 1 个标签」的
//     ADR 0002 D4 口径下恒退化为单选，无意义）；
//   - 无标签任务恒可见——筛选是附加收窄，不产生「任务凭空消失」的意外；
//   - 筛选态进 URL query（?tags=bug,docs，replace 写回不刷历史），
//     刷新/分享不丢；清空即删参回全量。
//
// XMON-57 词表动态化（补齐 ADR 0005 D2 已裁决、web 侧未落地的契约）：词表 =
// 作用域内项目标签集的并集，不是 FIXED_TAGS 静态 6 词。此前本文件按
// FIXED_TAGS 硬渲染选项、parseTagParam 按 FIXED_TAGS 白名单丢弃「词表外」
// 名——github 形态项目的真实 label 既进不了弹层、也活不过一次 URL 往返，
// 类型轴对这些项目等于失效。现在词表由调用面从有序投影派生
// （buildTagOptions），本文件不持静态表；「词表外名丢弃」的**语义不变**，
// 只是白名单从静态表换成真词表。
//   规范序 = 字典序（与仓库轴同律：无静态全序的轴以字节序为规范序，同选集
//   恒同 URL，与点击序无关）；同名不同色**取投影里首个**——投影按
//   projectIds 字典序 append（useProjectTags），先到先得。
//
// 消费面：parseTagParam / matchesTagFilter / cardTag / buildTagOptions 由
// board-page.tsx、filter-panel.tsx 与测试面消费。

import type { TagChipData } from '../components/ui/tag-chip.js';
import type { TodoRecord } from '../fixtures/records.js';

/** 面板选项（类型轴）：名称 + 词表色 + 计数。 */
export interface TagOption {
  name: string;
  color: string;
  /** 仓库轴收窄后、**不含类型轴自身**的命中卡数（勾上 bug 后其余选项
   *  不该全变 0——那样的计数失去导航意义）。 */
  count: number;
}

/** URL 参 → 选中词表名集。`vocab == null`（词表未就绪）= 空集：调用面的
 *  typeReady 闸据此不激活收窄（首载未就绪就收窄会让 tagged 卡闪隐）。
 *  词表外名/重复名/空段静默丢弃；返回序 = 字典序规范序（URL 确定性与点击
 *  序/书写序无关，同选集恒同 URL）。 */
export function parseTagParam(raw: string | null, vocab: readonly string[] | null): string[] {
  if (raw == null || raw === '' || vocab == null) return [];
  const known = new Set(vocab);
  return [...new Set(raw.split(','))].filter((name) => known.has(name)).sort();
}

/** 命中判定：空选中集 = 全量；无标签恒可见（裁决）；否则 tagIds 解析名
 *  与选中集求交（OR）。无法解析的 tagId（脏数据/首载未就绪）不命中也
 *  不误配——按可解析的名判。 */
export function matchesTagFilter(
  todo: TodoRecord,
  selected: ReadonlySet<string>,
  nameById: ReadonlyMap<string, string>,
): boolean {
  if (selected.size === 0) return true;
  if (todo.tagIds.length === 0) return true;
  return todo.tagIds.some((id) => {
    const name = nameById.get(id);
    return name != null && selected.has(name);
  });
}

/** 有序投影 → 选项集。投影序 = projectIds 字典序（useProjectTags 按该序
 *  append），故同名不同色**取首个**；选项序 = 字典序规范序（同 parseTagParam
 *  的序，弹层顺序与 URL 规范序一致）。count 由另一轴收窄后的卡集回填——
 *  「有哪些、什么色」是词表态，「多少张卡」是视图态，两者在同一次扫描里
 *  成形但不互相定义。 */
export function buildTagOptions(
  ordered: readonly TagChipData[],
  todos: readonly TodoRecord[],
  otherAxis: (todo: TodoRecord) => boolean,
  nameById: ReadonlyMap<string, string>,
): TagOption[] {
  const byName = new Map<string, TagOption>();
  for (const tag of ordered) {
    if (byName.has(tag.name)) continue;
    byName.set(tag.name, { name: tag.name, color: tag.color, count: 0 });
  }
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (!otherAxis(todo)) continue;
    const names = new Set<string>();
    for (const id of todo.tagIds) {
      const name = nameById.get(id);
      if (name != null && byName.has(name)) names.add(name);
    }
    // 一张卡计入它命中的每个选项——多选轴下它确实会因任一选项可见。
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...byName.values()]
    .map((option) => ({ ...option, count: counts.get(option.name) ?? 0 }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** #445 卡片标签解析：tagIds → 首个可解析的标签行（name+color 供 TagChip
 *  渲染）。每卡至多 1 个 = **渲染上限**而非数据假设（ADR 0005 Premortem
 *  护栏：github 形态多标签时版面问题交给卡片渲染的上限，不交给词表）；
 *  从 per-project tag 记录解析而非拿 FIXED_TAGS 按 name 硬配——label 镜像
 *  入库后同一路径自动正确。脏/未就绪 id 跳过，全不可解析 = null（卡不
 *  渲染占位）。 */
export function cardTag(
  todo: TodoRecord,
  tagById: ReadonlyMap<string, TagChipData>,
): TagChipData | null {
  for (const id of todo.tagIds) {
    const tag = tagById.get(id);
    if (tag != null) return tag;
  }
  return null;
}
