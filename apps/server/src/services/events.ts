// team stream 事件 hub（02 §1.2 + r5 §7.2 实测形状）。
// 通道载荷词表单源 = shared teamStreamEventSchema：
// - {"type":"ping","seq":n} ~15s 心跳（r3 §8.1）
// - {"type":"todo"|"build",seq,v,doc} 全文档推送（r5 §7.2；seq = 连接内递增
//   序号，v = 记录版本号）
// - {"type":"notification",notification} 通知事件（r5 §7.2 原样，无 seq/v 位）
// - machine_presence 事件面归 M3（hub 通道已具备）。
// SSE 写入按连接串行化（promise 链），避免交错。

import type {
  BuildRecord,
  ConversationStepEvent,
  NotificationRecord,
  TodoRecord,
  TranscriptRow,
} from '@pacman/shared';

/** 单条 SSE 连接的写入口；seq 由 hub 按连接分配。 */
export interface TeamStreamConnection {
  nextSeq(): number;
  /** 写一条已成型事件对象（JSON 序列化后作为 SSE data）。 */
  send(payload: object): Promise<void>;
}

export class TeamStreamHub {
  private readonly byTeam = new Map<string, Set<TeamStreamConnection>>();

  subscribe(teamId: string, conn: TeamStreamConnection): () => void {
    let set = this.byTeam.get(teamId);
    if (!set) {
      set = new Set();
      this.byTeam.set(teamId, set);
    }
    set.add(conn);
    return () => {
      set?.delete(conn);
      if (set && set.size === 0) this.byTeam.delete(teamId);
    };
  }

  subscriberCount(teamId: string): number {
    return this.byTeam.get(teamId)?.size ?? 0;
  }

  /** todo 全文档事件（r5 §7.2：{type:"todo",seq,v,doc}）。 */
  publishTodoDoc(teamId: string, doc: TodoRecord): void {
    this.publish(teamId, (conn) => ({ type: 'todo', seq: conn.nextSeq(), v: doc.v, doc }));
  }

  /** build 全文档事件（r5 §7.2：{type:"build",seq,v,doc}；build 记录无 v 字段，
   * 事件版本位取 1 [推断]——观测样本 v 值未随 build doc 采齐）。 */
  publishBuildDoc(teamId: string, doc: BuildRecord): void {
    this.publish(teamId, (conn) => ({ type: 'build', seq: conn.nextSeq(), v: 1, doc }));
  }

  /** notification 事件（r5 §7.2 原样：{type:"notification",notification:{…}}，
   * 观测形状无 seq/v 位——不消耗连接序号）。三事件触发矩阵与站内未读联动见
   * services/notifications.ts。 */
  publishNotification(teamId: string, record: NotificationRecord): void {
    this.publish(teamId, () => ({ type: 'notification', notification: record }));
  }

  /** 通用发布：每连接独立组帧（seq 连接内递增）。 */
  publish(teamId: string, frame: (conn: TeamStreamConnection) => object): void {
    const set = this.byTeam.get(teamId);
    if (!set) return;
    for (const conn of set) {
      void conn.send(frame(conn));
    }
  }
}

/** 串行化包装：Hono SSE stream 的 write 按序落盘。 */
export function createSerialConnection(
  write: (payload: object) => Promise<void>,
): TeamStreamConnection {
  let seq = 0;
  let tail: Promise<void> = Promise.resolve();
  return {
    nextSeq: () => ++seq,
    send(payload) {
      tail = tail.then(() => write(payload)).catch(() => {});
      return tail;
    },
  };
}

// —— conversation stream hub（GET /api/conversations/{id}/stream，02 §1.2 会话
// 流；事件词表单源 = shared conversationStreamEventSchema [推断] 定型四事件）。
// 键 = conversationId（build 会话 = buildId；chief 会话 = chief-<threadId>，
// buildId ≡ conversationId 等式两翼同用）。text_delta 为瞬态转发不落库
// （终稿经 transcript 上传兜底，02 §1.3）。

export class ConversationStreamHub {
  private readonly byConv = new Map<string, Set<TeamStreamConnection>>();

  subscribe(conversationId: string, conn: TeamStreamConnection): () => void {
    let set = this.byConv.get(conversationId);
    if (!set) {
      set = new Set();
      this.byConv.set(conversationId, set);
    }
    set.add(conn);
    return () => {
      set?.delete(conn);
      if (set && set.size === 0) this.byConv.delete(conversationId);
    };
  }

  subscriberCount(conversationId: string): number {
    return this.byConv.get(conversationId)?.size ?? 0;
  }

  /** transcript 行落库推送（live 工具行 / 终稿行 / 用户行同事件）。 */
  publishMessage(conversationId: string, message: TranscriptRow): void {
    this.publish(conversationId, { type: 'message', message });
  }

  /** pi text_delta 节流批量转发（瞬态，不落库）。 */
  publishTextDelta(conversationId: string, text: string): void {
    this.publish(conversationId, { type: 'text_delta', text });
  }

  /** 步状态流转（pending/claimed/done/failed）。 */
  publishStep(conversationId: string, step: ConversationStepEvent['step']): void {
    this.publish(conversationId, { type: 'step', step });
  }

  publish(conversationId: string, payload: object): void {
    const set = this.byConv.get(conversationId);
    if (!set) return;
    for (const conn of set) {
      void conn.send(payload);
    }
  }
}
