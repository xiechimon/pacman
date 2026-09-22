// 缝实现的宿主可见错误面（无引擎依赖——runner 等宿主模块可安全 import，
// 不触 @earendil-works/* 缝纪律）。

/** continueSession 解析失败（会话文件未落盘/异机）——调用方回退 new session
 * 重发任务文本 [设计]（journal.prompt 持久面兜底，T2 恢复语义不破）。 */
export class SessionNotResumableError extends Error {
  constructor(sessionId: string) {
    super(`session ${sessionId} not found on this machine (continue session impossible)`);
    this.name = 'SessionNotResumableError';
  }
}
