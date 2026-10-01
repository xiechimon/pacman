// SSE 连接生命周期 + 「漏掉的事件」对账策略（#462 的断线补偿 + XMON-60 的对账
// 兜底）。单缝：team stream 与 conversation stream 共用一份。
//
// 独立成模块（不引 React / react-query）：这里全是帧计数与定时器状态机，与
// 查询层无关；对账动作与闸门由调用方以 StreamGuards 注入。测试可在 node 环境
// 用替身 EventSource 直接驱动 connect()，不必起 jsdom。

/** 完全静默看门狗阈值（#462）：连接名义 OPEN 却超过此时长收不到任何事件
 *  （含心跳）= 疑似哑连接（TCP 活着但事件不再到达的形态——onerror 永不触发，
 *  浏览器不会自重连），主动重建并走重连 resync。生产心跳 15s
 *  （TEAM_STREAM_PING_INTERVAL_MS）恒小于阈值 ⇒ 健康连接不误触；误触代价 =
 *  一次重建 + 一次重取，无语义损失。 */
export const SSE_SILENCE_WATCHDOG_MS = 20_000;

/** 业务帧静默阈值（XMON-60）：心跳不算「服务端在推业务」。 */
export const SSE_BIZ_SILENCE_BASE_MS = 20_000;

/** 静默持续时对账间隔的增长上限。翻倍是为了不让对账退化成定频全量重取。 */
export const SSE_BIZ_SILENCE_MAX_MS = 300_000;

/** 对账面。`inFlight` 是静默是否可疑的闸门（见 sse.ts 的实现与理由）；
 *  `reconcile` 是失效重取动作。seq 空洞路径不读闸门——那是证据不是猜测。 */
export interface StreamGuards {
  inFlight: () => boolean;
  reconcile: () => void;
}

/**
 * 建一条 SSE 连接并挂两层看护，返回拆除函数。
 *
 * 服务端语义（apps/server/src/services/events.ts / routes.ts，XMON-58 实测）：
 * 每连接一条串行取号链 `conn.nextSeq()`，业务帧（todo/build）与 ping 共用；
 * notification / branch_sync / machine_presence 不带 seq、不占号。所以
 * 「连接内 seq 跳号」只有一种解释——那一帧取了号却没送达（`createSerialConnection`
 * 把写错 catch 成空，连接仍留在 hub 订阅集里）。这是可依赖的证据信号。
 *
 * 但空洞抓不到 XMON-58 实测的那一类：相位已落库、事件压根没发（seq 1-6 是
 * 业务帧、7-16 全是 ping，无洞）。那类只有「业务帧静默」看得见——而 ping
 * 每 15s 一条会让 #462 的完全静默看门狗永不触发，所以业务静默必须单独计时，
 * 且必须过 `inFlight` 闸门：闲团队整场只有 ping 是常态，不是故障。
 *
 * 开销：正常流量（持续有业务帧）与空闲（无在飞的活）都是零额外请求；异常时
 * 每次对账 = 一轮失效重取，间隔逐次翻倍封顶 5 分钟。
 */
export function connect(
  path: string,
  onEvent: (ev: Record<string, unknown>) => void,
  onResync: () => void,
  guards: StreamGuards,
): () => void {
  let es: EventSource | null = null;
  let openedOnce = false;
  let disposed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let bizTimer: ReturnType<typeof setTimeout> | null = null;
  let bizWindow = SSE_BIZ_SILENCE_BASE_MS;
  /** 本连接已见的最大 seq；0 = 还没见过带 seq 的帧。 */
  let lastSeq = 0;

  const armWatchdog = (): void => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      watchdog = null;
      // 只处理「OPEN 却静默」的哑连接态：CONNECTING 时浏览器在自重连（其
      // onopen 会 resync）；fatal CLOSED 走 #253 门页恢复流——两者不接管，
      // 保持既有 401 语义（不对 fatal 连接做无限重建）。
      if (disposed || es === null || es.readyState !== EventSource.OPEN) return;
      es.close();
      open();
    }, SSE_SILENCE_WATCHDOG_MS);
  };

  /** 重排业务静默计时（按当前窗口长度）。 */
  const armBizTimer = (): void => {
    if (bizTimer !== null) clearTimeout(bizTimer);
    bizTimer = setTimeout(() => {
      bizTimer = null;
      if (disposed || es === null || es.readyState !== EventSource.OPEN) return;
      if (guards.inFlight()) {
        guards.reconcile();
        // 对账后仍无业务帧 = 这一轮静默比预想的长（或服务端持续不发）：下一次
        // 判定往后推一倍，封顶 5 分钟。业务帧一回来就恢复基准窗口。
        bizWindow = Math.min(bizWindow * 2, SSE_BIZ_SILENCE_MAX_MS);
      }
      // 闸门关着也继续计时（不发请求）：闸门可能在静默期间被打开——用户按下
      // 「开始」后相位进 planning 却收不到事件，正是要兜的那一态。
      armBizTimer();
    }, bizWindow);
  };

  /** 业务帧到达 = 服务端在推：窗口归位。 */
  const noteBusiness = (): void => {
    bizWindow = SSE_BIZ_SILENCE_BASE_MS;
    armBizTimer();
  };

  function open(): void {
    if (disposed) return;
    es = new EventSource(path);
    es.onopen = () => {
      // 重连成功（非首开）= 断线窗口内的事件已永久丢失（服务端只发给当前
      // 订阅者，无重放）——全量失效重取补齐（SSE 事件本就只是 invalidate
      // 提示信号，S8 canon 的重取半；resync = 把丢失的提示补成一次全量）。
      if (openedOnce) onResync();
      openedOnce = true;
      // 新连接 = 服务端新的取号链（seq 从 1 起重来），旧水位作废。
      lastSeq = 0;
      bizWindow = SSE_BIZ_SILENCE_BASE_MS;
      armWatchdog();
      armBizTimer();
    };
    es.onmessage = (e) => {
      armWatchdog();
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(e.data as string) as Record<string, unknown>;
      } catch {
        return; // 坏帧静默（心跳/半帧防御）
      }
      const seq = ev.seq;
      if (typeof seq === 'number') {
        if (lastSeq > 0 && seq > lastSeq + 1) {
          // 跳号 = 取了号却没送达（见 connect() 头注）。证据，不需要闸门；
          // 顺带把静默窗口归位——连接有漏帧史，下一次判定该更警觉。
          bizWindow = SSE_BIZ_SILENCE_BASE_MS;
          guards.reconcile();
        }
        lastSeq = seq;
      }
      // 心跳只证连接活着，不证服务端在推业务——不计入业务静默。
      if (ev.type !== 'ping') noteBusiness();
      onEvent(ev);
    };
    // 建流后的网络断线由 EventSource 自持重连（浏览器内建退避），onerror 不
    // 关闭；HTTP 级失败（含 401）则是 fatal（CLOSED，不自动重连），恢复走
    // REST 面 401 → 门页 → passGate 触发的 effect 重跑（#253）。
  }
  open();

  return () => {
    disposed = true;
    if (watchdog !== null) clearTimeout(watchdog);
    if (bizTimer !== null) clearTimeout(bizTimer);
    es?.close();
  };
}
