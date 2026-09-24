// Chief surface wiring (issue #129): the view state + live-data block the
// board route carried inline, lifted into one hook so every shell family
// (board / pages / resources / secondary / detail) drives the same drawer
// from its FAB. The hook owns the three-state view (`none | drawer |
// settings` — the settings swap stays a board-route render decision), the
// live envelope/threads/messages queries, the conversation SSE while the
// drawer is open, the unread badge count and the send/thread callbacks.
// Fixture mode stays fully inert (queries enabled = live), so parity
// captures keep their zero-request guarantee.

import { useMemo, useState } from 'react';
import {
  useApiMutations,
  useChief,
  useChiefThreads,
  useMessages,
  useNotifications,
} from '../api/hooks.js';
import { mapChief } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { chiefDefault } from '../fixtures/fixtures.js';
import type { ChiefContent, FixtureSet } from '../fixtures/records.js';

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
}

export function useChiefSurface(fixture: FixtureSet): ChiefSurface {
  const { live, teamId } = useLiveData();
  const chiefQ = useChief(teamId, live);
  const chiefThreadsQ = useChiefThreads(teamId, live);
  const notificationsQ = useNotifications(teamId, live);
  const mutations = useApiMutations(teamId);

  const chief = fixture.chief;
  const [chiefView, setChiefView] = useState<ChiefView>(chief?.view ?? 'none');
  const chiefViewOpen = chiefView === 'drawer';

  // —— chief live 面（r5 §2/§3.6）：envelope + threads + 活动线程消息 +
  // 会话流订阅；发送 = POST threads / conversations messages。——
  const [activeThreadIdx, setActiveThreadIdx] = useState<number | null>(null);
  const liveThreads = chiefThreadsQ.data ?? [];
  const activeThread =
    live && liveThreads.length > 0 ? (liveThreads[activeThreadIdx ?? 0] ?? null) : null;
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

  return { chiefView, setChiefView, chiefData, chiefUnread, onSend, onThread };
}
