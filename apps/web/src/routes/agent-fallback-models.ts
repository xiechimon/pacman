// 兜底模型列表的纯逻辑（XMON-46）——agent 概览编辑面与创建弹窗共用一个面，
// 逻辑不各写一份（`toModelOptions` 投影先例：面可以有两个，规则只有一个）。
//
// 值形 = shared `FallbackModel` `{provider: string|null, modelId}`（provider
// 空槽 = 沿用 agent.provider，preset 直投同形）；列表有序，空 = 现行为。
//
// 与 server 写面的关系：去重不变式「兜底列表恒不含主模型」由 server 写面
// 兜底成立（shared `stripFallbackModelDupes`），本层是同一规则的前端镜像——
// 候选里先挖掉主模型与已选条目，换主模型时再剥一次存量，界面回显才与服务端
// 真值同步（只在 server 剥会出现「界面上还在、刷新后没了」的分叉）。

import { type FallbackModel, stripFallbackModelDupes } from '@pacman/shared';
import type { ModelOption } from '../fixtures/records.js';

export type FallbackEntry = FallbackModel;

/** 主模型槽（agent.provider / agent.modelId 的当前值；未配 = null）。 */
export interface MainModel {
  provider: string | null;
  modelId: string | null;
}

/** 槽值 key：provider 空槽与实串不同槽，不互消（`?? ''` 而非解析到主模型
 *  ——候选过滤比对的是「选出来的条目」，其 provider 恒来自选项实串）。 */
function slotKey(provider: string | null, modelId: string): string {
  return `${provider ?? ''}\u0000${modelId}`;
}

/** 添加位的候选 = 选项集挖去主模型与已选条目（同一模型不重复出现）。 */
export function fallbackCandidates(
  options: ModelOption[],
  main: MainModel,
  picked: FallbackEntry[],
): ModelOption[] {
  const mainKey = main.modelId === null ? null : slotKey(main.provider, main.modelId);
  const taken = new Set(picked.map((row) => slotKey(row.provider, row.modelId)));
  return options.filter((option) => {
    const key = slotKey(option.provider, option.modelId);
    return key !== mainKey && !taken.has(key);
  });
}

/** 追加一条；已在列表（同槽）→ 原样返回（幂等）。 */
export function addFallback(list: FallbackEntry[], entry: FallbackEntry): FallbackEntry[] {
  const key = slotKey(entry.provider, entry.modelId);
  return list.some((row) => slotKey(row.provider, row.modelId) === key) ? list : [...list, entry];
}

/** 删除第 index 条；其余保序。 */
export function removeFallback(list: FallbackEntry[], index: number): FallbackEntry[] {
  return list.filter((_, i) => i !== index);
}

/** 相邻换位（delta = ±1）；越界 = 空操作。纯函数，不改入参。 */
export function moveFallback(list: FallbackEntry[], index: number, delta: -1 | 1): FallbackEntry[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(index, 1);
  if (row === undefined) return list;
  next.splice(target, 0, row);
  return next;
}

/** 换主模型后的再剥离——规则真值在 shared，前端不另写一份比较逻辑。 */
export function pruneMainDupe(list: FallbackEntry[], main: MainModel): FallbackEntry[] {
  return stripFallbackModelDupes(list, main.provider, main.modelId);
}

/** 换主模型时要一并提交的剥离结果；没剥掉任何条目 → null（这一槽无需携带，
 *  避免每次改主模型都白写一次兜底列表）。 */
export function mainChangePrune(list: FallbackEntry[], next: MainModel): FallbackEntry[] | null {
  const pruned = pruneMainDupe(list, next);
  return pruned.length === list.length ? null : pruned;
}

/** 行标签：选项命中 → 模型名；未命中（provider 已改名/删除）→ 裸
 *  `provider/modelId`；两侧都无 provider → 只剩模型名，不出空前缀。 */
export function fallbackLabel(
  entry: FallbackEntry,
  main: MainModel,
  options: ModelOption[],
): string {
  const provider = entry.provider ?? main.provider;
  const hit = options.find((row) => row.provider === provider && row.modelId === entry.modelId);
  if (hit !== undefined) return hit.modelName;
  return provider === null || provider === '' ? entry.modelId : `${provider}/${entry.modelId}`;
}

/** 行右侧的 provider 标签（与选择器行同律：名字在左、provider 在右）。
 *  没有它，两个 provider 提供的同名模型（r3-gw/claude-sonnet-5 与
 *  claude-code/claude-sonnet-5）在列表里长得一模一样——「按序换用」的序
 *  就读不出来了。选项未命中 → null：此时 fallbackLabel 已是 `provider/modelId`
 *  裸串，再挂一个 provider 标签是同一信息写两遍。 */
export function fallbackProvider(
  entry: FallbackEntry,
  main: MainModel,
  options: ModelOption[],
): string | null {
  const provider = entry.provider ?? main.provider;
  const hit = options.find((row) => row.provider === provider && row.modelId === entry.modelId);
  return hit?.providerLabel ?? null;
}

/** create 面 body 片：空列表 = 不携带字段（现行为 = 无兜底）。 */
export function createFallbackBody(list: FallbackEntry[]): { fallbackModels?: FallbackEntry[] } {
  return list.length === 0 ? {} : { fallbackModels: list };
}

/** patch 面 body 片：恒携带——[] 是「清空」，不是「未动」（吞成缺省会让
 *  用户删掉最后一档后服务端留着旧值）。 */
export function patchFallbackBody(list: FallbackEntry[]): { fallbackModels: FallbackEntry[] } {
  return { fallbackModels: list };
}
