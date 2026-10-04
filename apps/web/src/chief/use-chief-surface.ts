// Chief surface wiring (issue #129): the view state + live-data block the
// board route carried inline, lifted into one hook so every shell family
// (board / pages / resources / secondary / detail) drives the same drawer
// from its FAB. The hook owns the three-state view (`none | drawer |
// settings` — the settings swap stays a board-route render decision), the
// live envelope/threads/messages queries, the conversation SSE while the
// drawer is open, the unread badge count and the send/thread callbacks.
// #631 失败反馈也归它：发送/恢复/PATCH 被拒 + 回合异步失败 → toast（sonner）。
// Fixture mode stays fully inert (queries enabled = live), so fixture
// captures keep their zero-request guarantee.
// #389/#442/#468: the ⌘J hotkey joins the wake path as the FAB's keyboard
// cousin — a toggle (open ↔ close) while the FAB click stays open-only;
// the editable-outside-drawer guard lives in overlays/hotkeys. Every page
// runs exactly one instance of this hook, so the listener stays a
// singleton per route.

import type { ChiefCompactionModel, TranscriptRow } from '@pacman/shared';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  useApiMutations,
  useChief,
  useChiefThreads,
  useMessages,
  useModelSources,
  useNotifications,
} from '../api/hooks.js';
import { liveTextStore } from '../api/live-text.js';
import { chiefTurnErrorOfContent, mapChief, toModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { toastError } from '../components/ui/toaster.js';
import { chiefDefault } from '../fixtures/fixtures.js';
import type { ChiefContent, FixtureSet, ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
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
   *  draft + inert send). 返回 Promise = 异步发送（#631：rejected 时
   *  drawer 保留 draft 不丢字，detail composer 同契）。 */
  onSend?: (text: string) => void | Promise<void>;
  /** Thread switch (live only). */
  onThread?: (title: string, index: number) => void;
  /** 新主题 (#146, live only): drop back to the fresh-thread view — hero
   *  examples + `新主题` chip; the next send opens a new chief thread
   *  (threadId null, same wire as the hero-example click). */
  onNewThread?: () => void;
  /** #615 主模型覆盖槽当前值（live = 封套真值；null = 继承绑定 Agent）。 */
  modelValue: ChiefCompactionModel | null;
  /** #615 主模型候选（live = toModelOptions 投影，非 pi runtime 段；未决 = 空清单）。 */
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
  const { t } = useI18n();
  const chiefQ = useChief(teamId, live);
  const chiefThreadsQ = useChiefThreads(teamId, live);
  const notificationsQ = useNotifications(teamId, live);
  // #615 主模型候选数据源（chief-settings 同配方：model-sources 非 pi 段，
  // spec 11 §A10；#770 起 providers 段已除）——查询 enabled=live，fixture
  // 面零请求不动。
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
  // #631 失败闭环（异步半）：chief_turn_error 行经会话流 message 事件到达
  // → 即时 toast；持久行由该事件的 messages 失效重取渲染（mapChiefStream
  // error 项）。handlers 必须引用稳定（sse.ts effect 依赖位——内联箭头会
  // 逐 render 重订阅流）。
  const streamHandlers = useMemo(
    () => ({
      onMessage: (row: TranscriptRow) => {
        const reason = chiefTurnErrorOfContent(row.content);
        if (reason === null) return;
        toast.error(t('总管本轮执行失败'), { description: reason });
      },
    }),
    [t],
  );
  useConversationStream(
    live ? (activeThread?.id ?? undefined) : undefined,
    live && chiefViewOpen,
    streamHandlers,
  );
  // #651 打字面读侧：conversation stream 的 text_delta 已由 sse.ts 按会话
  // 累积进 liveTextStore（终稿 message 事件落库即 clear + messages 失效
  // 重取）。此前抽屉从不读该缓冲——增量全丢，回复只能等重取整段一次性蹦出。
  // 读法与详情页同款（todo-detail-page useSyncExternalStore），键 = 活动
  // 线程 id（chief 步 buildId ≡ conv id ≡ thread id，server chief.ts）。
  const activeThreadId = live ? (activeThread?.id ?? null) : null;
  const liveText = useSyncExternalStore(liveTextStore.subscribe, () =>
    activeThreadId !== null ? liveTextStore.get(activeThreadId) : '',
  );
  const liveChief = useMemo(() => {
    if (!live || !chiefQ.data) return null;
    return mapChief(chiefQ.data, {
      threads: liveThreads,
      activeThreadId: activeThread?.id ?? null,
      messages: chiefMessagesQ.data?.messages ?? [],
      liveText,
    });
  }, [live, chiefQ.data, liveThreads, activeThread, chiefMessagesQ.data, liveText]);

  const chiefData = live ? (liveChief ?? chiefDefault) : (chief ?? chiefDefault);
  const liveUnread = live
    ? (notificationsQ.data?.unreadThreadIds ?? []).filter((id) => id.startsWith('chief-')).length
    : 0;
  const chiefUnread = live ? liveUnread : (fixture.chiefUnread ?? 0);

  // #615 主模型闭环三件：槽值（封套真值）/ 候选并集 / 选定即 PATCH。
  // #631 失败反馈（同步半）：PATCH / rewind / 发送失败 → toastError（共享
  // 原语住 components/ui/toaster.tsx：server 原因进 description 透传不翻译
  // ——server 数据同 user 内容律；#638 由本文件局部版提为全站单源）。
  const modelValue = live ? (chiefQ.data?.chief.model ?? null) : null;
  const modelOptions = live ? toModelOptions(modelSourcesQ.data?.sources ?? []) : undefined;
  const onPickModel = live
    ? (value: ChiefCompactionModel | null) =>
        mutations.patchChief.mutate(
          { model: value },
          { onError: (e) => toastError(t('保存失败，请重试。'), e) },
        )
    : undefined;
  const onRewind = live
    ? (messageId: string) => {
        if (activeThread === null) return;
        mutations.chiefRewind.mutate(
          { threadId: activeThread.id, messageId },
          { onError: (e) => toastError(t('恢复失败，请重试。'), e) },
        );
      }
    : undefined;

  const onSend = live
    ? (text: string) => {
        // #631：mutateAsync → promise 契约（drawer 被拒保留 draft）；失败
        // toast 在此承担后 rethrow 交契约面。
        return mutations.chiefSend
          .mutateAsync({ threadId: activeThread?.id ?? null, content: text })
          .then((result) => {
            // #774 收单回落显式告知（用户裁决：静默不要）：server 在存量槽失效
            // 时已同步愈合，响应带回原值 → 成功 toast 点名 stale 值；发送本身
            // 成功，draft 照常清空（下行新主题切 0 位同）。
            if (result.modelFallback != null) {
              const { provider, modelId } = result.modelFallback;
              toast.success(t('模型已回落到默认'), {
                description: t('“{stale}”已不可用，本次改用默认模型（与绑定 Agent 相同）发送。', {
                  stale: `${provider}/${modelId}`,
                }),
              });
            }
            // 新主题落线程首位（listChiefThreads 新在前）——切回 0 位。
            if (activeThread === null) setActiveThreadIdx(0);
          })
          .catch((error: unknown) => {
            toastError(t('发送失败，请重试。'), error);
            throw error;
          });
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
