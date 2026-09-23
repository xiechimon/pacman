// SSE 接线（M5，02 §1.2 全 SSE 无 WS）：原生 EventSource（同源 cookie 会话，
// 01 §4.1 锁定）。策略 = S8 canon「SSE 事件仅作 invalidateQueries 提示信号，
// server state 全走查询失效重取」；conversation stream 的 text_delta 例外
// 进 liveTextStore（流式打字面，终稿 message 行落库后收敛）。
// 通知 divergence（04 §5/A5）：in-app 事件 1:1 + document.hidden 时页内
// new Notification()（无 Web Push）。

import type { NotificationRecord } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { liveTextStore } from './live-text.js';

function connect(path: string, onEvent: (ev: Record<string, unknown>) => void): () => void {
  const es = new EventSource(path);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string) as Record<string, unknown>);
    } catch {
      // 坏帧静默（心跳/半帧防御）
    }
  };
  // EventSource 自持重连（浏览器内建退避）；onerror 不关闭。
  return () => es.close();
}

/** team stream：todo/build 文档事件 + notification + machine_presence →
 *  相关查询失效重取（02 §1.2 双保险的重取半）；notification 事件兼发桌面
 *  通知（document.hidden 时弹，02 §9.1 canon）。 */
export function useTeamStream(teamId: string | undefined, enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (teamId === undefined || !enabled) return;
    return connect(`/api/teams/${teamId}/stream`, (ev) => {
      switch (ev.type) {
        case 'todo': {
          const doc = ev.doc as { id: string };
          void qc.invalidateQueries({ queryKey: ['todos'] });
          void qc.invalidateQueries({ queryKey: ['todo', doc.id] });
          void qc.invalidateQueries({ queryKey: ['schedules'] });
          break;
        }
        case 'build': {
          const doc = ev.doc as { id: string; todoId: string };
          void qc.invalidateQueries({ queryKey: ['build', doc.id] });
          void qc.invalidateQueries({ queryKey: ['steps', doc.id] });
          void qc.invalidateQueries({ queryKey: ['todos'] });
          void qc.invalidateQueries({ queryKey: ['todo', doc.todoId] });
          break;
        }
        case 'notification': {
          const record = ev.notification as NotificationRecord;
          void qc.invalidateQueries({ queryKey: ['notifications', teamId] });
          void qc.invalidateQueries({ queryKey: ['chiefThreads', teamId] });
          void qc.invalidateQueries({ queryKey: ['todos'] });
          fireDesktopNotification(record);
          break;
        }
        case 'machine_presence':
          void qc.invalidateQueries({ queryKey: ['machines', teamId] });
          break;
        default:
          break; // ping
      }
    });
  }, [teamId, enabled, qc]);
}

/** 桌面通知（04 §5 divergence 口径）：仅 document.hidden 时弹页内
 *  Notification；权限未授予静默跳过（权限请求面 = 真人一次项，M6 清单）。 */
function fireDesktopNotification(record: NotificationRecord): void {
  if (!document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title =
    record.type === 'plan_ready'
      ? '方案已就绪'
      : record.type === 'build_review'
        ? '构建待审核'
        : record.entityRef.title;
  const body =
    record.snippet ??
    (record.entityRef.seqNum !== null
      ? `#${record.entityRef.seqNum} ${record.entityRef.title}`
      : record.entityRef.title);
  try {
    new Notification(title, { body, tag: record.id });
  } catch {
    // 平台拒绝（移动端等）静默——in-app 未读面兜底
  }
}

export interface ConversationStreamHandlers {
  onMessage?: () => void;
  onStep?: () => void;
}

/** conversation stream（详情页 live transcript）：text_delta → liveTextStore；
 *  message/step → 失效重取（messages/steps/todo/build）。挂载即订阅——
 *  build 未启时为空流 + ping（服务端容忍）。 */
export function useConversationStream(
  conversationId: string | undefined,
  enabled: boolean,
  handlers: ConversationStreamHandlers,
): void {
  const qc = useQueryClient();
  const onMessage = handlers.onMessage;
  const onStep = handlers.onStep;
  useEffect(() => {
    if (conversationId === undefined || !enabled) return;
    return connect(`/api/conversations/${conversationId}/stream`, (ev) => {
      switch (ev.type) {
        case 'text_delta':
          liveTextStore.append(conversationId, ev.text as string);
          break;
        case 'message':
          // 终稿行到达：live 缓冲作废，消息面重取接管（收敛律）。
          liveTextStore.clear(conversationId);
          void qc.invalidateQueries({ queryKey: ['messages', conversationId] });
          void qc.invalidateQueries({ queryKey: ['plans'] });
          onMessage?.();
          break;
        case 'step':
          void qc.invalidateQueries({ queryKey: ['steps', conversationId] });
          void qc.invalidateQueries({ queryKey: ['build', conversationId] });
          void qc.invalidateQueries({ queryKey: ['changes', conversationId] });
          onStep?.();
          break;
        default:
          break; // ping
      }
    });
  }, [conversationId, enabled, qc, onMessage, onStep]);
}
