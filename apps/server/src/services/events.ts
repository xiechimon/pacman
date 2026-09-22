// team stream 事件 hub（02 §1.2 + r5 §7.2 实测形状）。
// 通道载荷词表单源 = shared teamStreamEventSchema：
// - {"type":"ping","seq":n} ~15s 心跳（r3 §8.1）
// - {"type":"todo"|"build",seq,v,doc} 全文档推送（r5 §7.2；seq = 连接内递增
//   序号，v = 记录版本号）
// - machine_presence / notification 事件面归 M3/M2c（hub 通道已具备）。
// SSE 写入按连接串行化（promise 链），避免交错。

import type { BuildRecord, TodoRecord } from '@pacman/shared';

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
