// SSE 接线（M5，02 §1.2 全 SSE 无 WS）：原生 EventSource（同源 cookie 会话，
// 01 §4.1 锁定）。策略 = S8 canon「SSE 事件仅作 invalidateQueries 提示信号，
// server state 全走查询失效重取」；conversation stream 的 text_delta 例外
// 进 liveTextStore（流式打字面，终稿 message 行落库后收敛）。
// 通知 divergence（04 §5/A5）：in-app 事件 1:1 + document.hidden 时页内
// new Notification()（无 Web Push）。鉴权开时（#253）两条流以 ?token= 建流
// （streamUrl，协议例外见 api/auth.ts 头注）；门页开着不建流，放行即重连。

import type { NotificationRecord } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { EN } from '../i18n/en.js';
import { readStoredLocale } from '../i18n/locale.js';
import { translate } from '../i18n/translate.js';
import { readStoredToken, useAuth } from './auth.js';
import { liveTextStore } from './live-text.js';

/** 鉴权开时 stream URL 附 ?token=（#253）——EventSource 无法设 header 的协议
 *  例外，server 仅对两条 stream 端点收 query token（token-auth.ts 契约）。
 *  无存量 token（鉴权关 / 门页未过）= 原样 URL，零行为差。 */
function streamUrl(path: string): string {
  const token = readStoredToken();
  return token === null ? path : `${path}?token=${encodeURIComponent(token)}`;
}

function connect(path: string, onEvent: (ev: Record<string, unknown>) => void): () => void {
  const es = new EventSource(path);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data as string) as Record<string, unknown>);
    } catch {
      // 坏帧静默（心跳/半帧防御）
    }
  };
  // 建流后的网络断线由 EventSource 自持重连（浏览器内建退避），onerror 不
  // 关闭；HTTP 级失败（含 401）则是 fatal（CLOSED，不自动重连），恢复走
  // REST 面 401 → 门页 → passGate 触发的 effect 重跑（#253）。
  return () => es.close();
}

/** team stream：todo/build 文档事件 + notification + machine_presence →
 *  相关查询失效重取（02 §1.2 双保险的重取半）；notification 事件兼发桌面
 *  通知（document.hidden 时弹，02 §9.1 canon）。 */
export function useTeamStream(teamId: string | undefined, enabled: boolean): void {
  const qc = useQueryClient();
  // 门页开着 = token 缺/坏，不建流——对 401 建流只会立即 fatal CLOSED
  // （connect() 处注）；passGate 的 snapshot 换引用触发本 effect 重跑，
  // 以新 token 建流（#253）。
  const auth = useAuth();
  useEffect(() => {
    if (teamId === undefined || !enabled || auth.gateOpen) return;
    return connect(streamUrl(`/api/teams/${teamId}/stream`), (ev) => {
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
        case 'branch_sync': {
          // M7 #319（08 册附录 B）：分支对话框「同步到机器」结果落账→ team
          // stream 推回 web，按 buildId 键失效结果卡查询（pending → running
          // → synced/failed 四态）。事件载荷 = BranchSyncRecord（shared 单源，
          // `sync` 字段非 `doc`，区别于 todo/build 文档事件 [设计]）。
          const rec = ev.sync as { buildId: string };
          void qc.invalidateQueries({ queryKey: ['branchSync', rec.buildId] });
          break;
        }
        default:
          break; // ping
      }
    });
  }, [teamId, enabled, qc, auth]);
}

/** 桌面通知（04 §5 divergence 口径）：仅 document.hidden 时弹页内
 *  Notification；权限未授予静默跳过（权限请求面 = 真人一次项，M6 清单）。
 *  标题文案走 i18n 纯函数面（非组件位——zh 权威 + en 兜底，01/S6）。 */
function fireDesktopNotification(record: NotificationRecord): void {
  if (!document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const t = (source: string) => translate(readStoredLocale(localStorage), EN, source);
  const title =
    record.type === 'plan_ready'
      ? t('方案已就绪')
      : record.type === 'build_review'
        ? t('构建待审核')
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
  // 门页/token 面同 useTeamStream（#253）：gateOpen 不建流，passGate 重建。
  const auth = useAuth();
  useEffect(() => {
    if (conversationId === undefined || !enabled || auth.gateOpen) return;
    return connect(streamUrl(`/api/conversations/${conversationId}/stream`), (ev) => {
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
          // plan 行经 upload 缝静默落库（routes-machine PUT upload 不发事件），
          // 仅 message 事件失效 plans 会与 daemon 的 plan.md/transcript 并发
          // 上传赛跑：message 先到时该轮重取落空，其后无人再失效。step 事件
          // （finishStep 发，恒在 plan 落库后）补一次失效兜住该 race。
          void qc.invalidateQueries({ queryKey: ['plans'] });
          onStep?.();
          break;
        default:
          break; // ping
      }
    });
  }, [conversationId, enabled, qc, onMessage, onStep, auth]);
}
