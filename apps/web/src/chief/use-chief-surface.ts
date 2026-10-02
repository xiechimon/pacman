// Chief surface wiring (issue #129): the view state + live-data block the
// board route carried inline, lifted into one hook so every shell family
// (board / pages / resources / secondary / detail) drives the same drawer
// from its FAB. The hook owns the three-state view (`none | drawer |
// settings` — the settings swap stays a board-route render decision), the
// live envelope/threads/messages queries, the conversation SSE while the
// drawer is open, the unread badge count and the send/thread callbacks.
// Fixture mode stays fully inert (queries enabled = live), so fixture
// captures keep their zero-request guarantee.
// #389/#442/#468: the ⌘J hotkey joins the wake path as the FAB's keyboard
// cousin — a toggle (open ↔ close) while the FAB click stays open-only;
// the editable-outside-drawer guard lives in overlays/hotkeys. Every page
// runs exactly one instance of this hook, so the listener stays a
// singleton per route.

import type { ChiefCompactionModel } from '@pacman/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useApiMutations,
  useChief,
  useChiefThreads,
  useMessages,
  useModelSources,
  useNotifications,
  useProviders,
} from '../api/hooks.js';
import { mapChief, toModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { chiefDefault } from '../fixtures/fixtures.js';
import type { ChiefContent, FixtureSet, ModelOption } from '../fixtures/records.js';
import { useChiefToggleHotkey } from '../overlays/hotkeys.js';

/** One three-state view: drawer and settings are mutually exclusive by
 *  construction (r5: the gear swaps the drawer for the full-content view). */
export type ChiefView = 'none' | 'drawer' | 'settings';

export interface ChiefSurface {
  chiefView: ChiefView;
  setChiefView: (view: ChiefView) => void;
  chiefData: ChiefContent;
  /** Unread chief threads — the FAB badge (live: notifications; fixture:
   *  the capture's chiefUnread field). */
  chiefUnread: number;
  /** Composer send (live only; absent = fixture static face, read-only
   *  draft + inert send). */
  onSend?: (text: string) => void;
  /** Thread switch (live only). */
  onThread?: (title: string, index: number) => void;
  /** 新主题 (#146, live only): drop back to the fresh-thread view — hero
   *  examples + `新主题` chip; the next send opens a new chief thread
   *  (threadId null, same wire as the hero-example click). */
  onNewThread?: () => void;
  /** #615 主模型覆盖槽当前值（live = 封套真值；null = 继承绑定 Agent）。 */
  modelValue: ChiefCompactionModel | null;
  /** #615 主模型候选（live = toModelOptions 并集投影；未决 = 空清单）。 */
  modelOptions?: ModelOption[];
  /** #615 live only：模型 dialog 选定 = PATCH chief model 槽（invalidateAll
   *  重取回显，S8 不持本地乐观态）。 */
  onPickModel?: (value: ChiefCompactionModel | null) => void;
  /** #615 返工 live only：恢复钮「恢复到此处」= POST chief threads rewind
   *  （threadId 由 surface 持活动线程闭包携带）。 */
  onRewind?: (messageId: string) => void;
}

/** activeThreadIdx sentinel (#146): the fresh-thread view while threads
 *  exist — `null` keeps the list default (newest first), `-1` opts out. */
const NEW_THREAD = -1;

/** XMON-106 chief 深链（通知点击落地 `/app?chief=<threadId>`）：live 面等
 *  线程列表落定后按 id 定位——命中则开 drawer 切到该线程；未命中（线程已
 *  删）安静降级不开。两路结局都调 onConsumed（调用方剥 URL 参，一次性
 *  消费，防刷新/残留参重开）。fixture 面无线程 id，不消费（采集确定性）。 */
export interface ChiefDeepLink {
  threadId: string | null;
  onConsumed: () => void;
}

export function useChiefSurface(fixture: FixtureSet, deepLink?: ChiefDeepLink): ChiefSurface {
  const { live, teamId } = useLiveData();
  const chiefQ = useChief(teamId, live);
  const chiefThreadsQ = useChiefThreads(teamId, live);
  const notificationsQ = useNotifications(teamId, live);
  // #615 主模型候选数据源（chief-settings 同配方：model-sources ∪ custom
  // providers 并集，spec 11 §A10）——查询 enabled=live，fixture 面零请求不动。
  const providersQ = useProviders(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const mutations = useApiMutations(teamId);

  const chief = fixture.chief;
  const [chiefView, setChiefView] = useState<ChiefView>(chief?.view ?? 'none');
  const chiefViewOpen = chiefView === 'drawer';
  // #389/#442/#468: ⌘J = toggle，再按一次收起（每页恰好一个本 hook 实例，
  // 监听单点注册；守卫归 hotkeys 模块——drawer 外输入态不误触，drawer 内
  // 豁免，否则和弦关不上自己打开的面）。开后焦点落草稿框（drawer 的
  // autofocus 律）。settings 面按 ⌘J 同样换到 drawer（三态单值，drawer
  // 与 settings 本就互斥）。
  const toggleDrawer = useCallback(
    () => setChiefView((prev) => (prev === 'drawer' ? 'none' : 'drawer')),
    [],
  );
  useChiefToggleHotkey(toggleDrawer);

  // —— chief live 面（r5 §2/§3.6）：envelope + threads + 活动线程消息 +
  // 会话流订阅；发送 = POST threads / conversations messages。——
  const [activeThreadIdx, setActiveThreadIdx] = useState<number | null>(null);
  const liveThreads = chiefThreadsQ.data ?? [];
  const activeThread =
    live && liveThreads.length > 0 && activeThreadIdx !== NEW_THREAD
      ? (liveThreads[activeThreadIdx ?? 0] ?? null)
      : null;
  // XMON-106 chief 深链消费（定义见 ChiefDeepLink）：等线程查询落定再定位，
  // 未决期间不动作（误开新主题面比晚开一拍更糟）。
  const deepLinkId = deepLink?.threadId ?? null;
  const onDeepLinkConsumed = deepLink?.onConsumed;
  useEffect(() => {
    // #615: `?chief=settings` 哨兵（非 board 面 gear 的落点）——不等线程
    // 查询（与线程定位无关），fixture 面同消费（零请求，仅视图态）。
    if (deepLinkId === 'settings') {
      setChiefView('settings');
      onDeepLinkConsumed?.();
      return;
    }
    if (!live || deepLinkId === null || !chiefThreadsQ.isSuccess) return;
    const idx = liveThreads.findIndex((thread) => thread.id === deepLinkId);
    if (idx >= 0) {
      setActiveThreadIdx(idx);
      setChiefView('drawer');
    }
    onDeepLinkConsumed?.();
  }, [live, deepLinkId, chiefThreadsQ.isSuccess, liveThreads, onDeepLinkConsumed]);
  const chiefMessagesQ = useMessages(live ? (activeThread?.id ?? null) : null, live);
  useConversationStream(
    live ? (activeThread?.id ?? undefined) : undefined,
    live && chiefViewOpen,
    {},
  );
  const liveChief = useMemo(() => {
    if (!live || !chiefQ.data) return null;
    return mapChief(chiefQ.data, {
      threads: liveThreads,
      activeThreadId: activeThread?.id ?? null,
      messages: chiefMessagesQ.data?.messages ?? [],
    });
  }, [live, chiefQ.data, liveThreads, activeThread, chiefMessagesQ.data]);

  const chiefData = live ? (liveChief ?? chiefDefault) : (chief ?? chiefDefault);
  const liveUnread = live
    ? (notificationsQ.data?.unreadThreadIds ?? []).filter((id) => id.startsWith('chief-')).length
    : 0;
  const chiefUnread = live ? liveUnread : (fixture.chiefUnread ?? 0);

  // #615 主模型闭环三件：槽值（封套真值）/ 候选并集 / 选定即 PATCH。
  const modelValue = live ? (chiefQ.data?.chief.model ?? null) : null;
  const modelOptions = live
    ? toModelOptions(providersQ.data?.providers ?? [], modelSourcesQ.data?.sources ?? [])
    : undefined;
  const onPickModel = live
    ? (value: ChiefCompactionModel | null) => mutations.patchChief.mutate({ model: value })
    : undefined;
  const onRewind = live
    ? (messageId: string) => {
        if (activeThread === null) return;
        mutations.chiefRewind.mutate({ threadId: activeThread.id, messageId });
      }
    : undefined;

  const onSend = live
    ? (text: string) => {
        mutations.chiefSend.mutate(
          { threadId: activeThread?.id ?? null, content: text },
          {
            onSuccess: () => {
              // 新主题落线程首位（listChiefThreads 新在前）——切回 0 位。
              if (activeThread === null) setActiveThreadIdx(0);
            },
          },
        );
      }
    : undefined;
  const onThread = live ? (_title: string, index: number) => setActiveThreadIdx(index) : undefined;
  const onNewThread = live ? () => setActiveThreadIdx(NEW_THREAD) : undefined;

  return {
    chiefView,
    setChiefView,
    chiefData,
    chiefUnread,
    onSend,
    onThread,
    onNewThread,
    modelValue,
    modelOptions,
    onPickModel,
    onRewind,
  };
}
