// live 文本增量缓冲（M5 live streaming）：conversation stream 的 text_delta
// 事件按会话累积成「正在打字的助手行」；终稿 message 行落库后清空对应会话
// 的缓冲（以 message 行为准收敛，02 §1.2 双保险的流侧半）。
// useSyncExternalStore 消费——组件外单例，SSE 回调直写。

type Listener = () => void;

const buffers = new Map<string, string>();
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

export const liveTextStore = {
  append(conversationId: string, text: string): void {
    buffers.set(conversationId, (buffers.get(conversationId) ?? '') + text);
    emit();
  },
  /** 终稿行到达：整段缓冲作废（消息重取接管呈现）。 */
  clear(conversationId: string): void {
    if (buffers.delete(conversationId)) emit();
  },
  get(conversationId: string): string {
    return buffers.get(conversationId) ?? '';
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
