// 脊柱 SSE/取数观测探针（XMON-58 诊断增强）。
//
// 为什么要有它：m5-web-e2e 在 CI 上间歇红的表现是「server 相位已推进、UI 文案
// 停在旧值」，而现有四环诊断只答得了「server 真值是什么」与「daemon 干到哪
// 一步」——UI 侧那条链（事件到达 → invalidate → 重取 → 渲染）断在哪一环，它
// 一个字都说不出。两种断法在日志里长得一模一样：
//   ① 事件根本没到浏览器（SSE 投递/解析丢帧）；
//   ② 事件到了、失效也发了，但重取取回旧值或压根没发出。
// 本探针在浏览器文档里只读地包一层 EventSource 与 fetch，超时那一刻把两侧的
// 计数读出来，把①②分开。
//
// 必须逐字节无副作用：EventSource 用 class extends 包装（静态量 CONNECTING/
// OPEN/CLOSED 经构造器原型链继承，实例的 onopen/onmessage/readyState 语义不
// 变）——sse.ts 的看门狗判据是 `es.readyState !== EventSource.OPEN`，包装一旦
// 丢了静态量，看门狗就被探针自己关掉，测的就变成探针了。fetch 同律：调用原
// 函数、原样返回其 promise，只在旁边记一笔。

import type { Page } from '@playwright/test';

/** 单条 EventSource 的观测面（时间字段读作「距快照那一刻多少毫秒」）。 */
export interface SseProbeStream {
  /** 建流路径（剥掉 query——鉴权开时 ?token= 不该进日志）。 */
  path: string;
  /** onopen 次数（> 1 = 重连发生过，按 sse.ts 语义随后必有一次 resync）。 */
  opened: number;
  /** onerror 次数。 */
  errors: number;
  /** 收到的帧数（含 ping——服务端每 pingIntervalMs 发一条）。 */
  messages: number;
  /** JSON.parse 失败的帧数（坏帧在 sse.ts 里被静默吞掉 = 事件永久丢失）。 */
  parseFailures: number;
  /** 最后一帧的 type；null = 一帧都没收到。 */
  lastType: string | null;
  /** 最后一帧距今毫秒；null = 一帧都没收到。 */
  lastTypeAgoMs: number | null;
  /** 最近 6 个 seq（服务端按连接递增；缺口 = 丢帧）。无 seq 位的事件不占号。 */
  seqTail: number[];
  /** 快照那一刻的 readyState（0 CONNECTING / 1 OPEN / 2 CLOSED）。 */
  readyState: number;
  /** 按 type 的收帧计数（ping 与业务事件同列，缺口一眼可见）。 */
  byType: Record<string, number>;
  /** 帧流水（时间正序，上限 40）：type + seq（无 seq 位 = null）+ 距今毫秒。
   *  **要的就是全量**——seq 由服务端按连接递增，漏掉一帧会在流水里留下缺口，
   *  而「尾部连续」的假象掩盖不了中段的洞。 */
  frames: { type: string | null; seq: number | null; agoMs: number }[];
}

/** 单次 /api/* 取数（含 EventSource 建流本身——同样是 fetch 语义的请求）。 */
export interface SseProbeFetch {
  path: string;
  /** null = 请求 reject（网络层失败）。 */
  status: number | null;
  /** 耗时毫秒。 */
  ms: number;
  /** 距今毫秒（响应落定那一刻起算）。 */
  agoMs: number;
}

export interface SseProbeSnapshot {
  /** 本会话装载过的文档数（> 1 = 页被重载过，与「UI 零 reload」契约冲突）。 */
  documents: number;
  /** navigator.onLine——React Query 的 networkMode 判据：false 时**所有**重取
   *  被挂起（fetchStatus=paused），表现为「事件到了也不取数」。 */
  onLine: boolean;
  /** document.visibilityState——背景标签页会节流定时器与事件派发。 */
  visibility: string;
  streams: SseProbeStream[];
  /** 最近 24 条 /api/* 取数，时间正序。 */
  fetches: SseProbeFetch[];
}

/** 注入脚本正文。用字符串而非函数序列化：探针跑在页面文档里，任何构建期注入
 *  的辅助符号（__name 之类）都会让它当场 ReferenceError。 */
export const SSE_PROBE_SOURCE = `
(() => {
  var CAP = 24;
  var docs = 1;
  try {
    docs = Number(sessionStorage.getItem('__pacmanProbeDocs') || '0') + 1;
    sessionStorage.setItem('__pacmanProbeDocs', String(docs));
  } catch (err) { docs = 1; }

  var probe = { documents: docs, streams: [], fetches: [] };
  window.__pacmanProbe = probe;

  function pathOf(raw) {
    try { return new URL(String(raw), window.location.href).pathname; } catch (err) { return String(raw); }
  }
  function pushFetch(rec) {
    probe.fetches.push(rec);
    if (probe.fetches.length > CAP) probe.fetches.shift();
  }

  var NativeEventSource = window.EventSource;
  if (typeof NativeEventSource === 'function') {
    class ProbedEventSource extends NativeEventSource {
      constructor(url, init) {
        super(url, init);
        var rec = {
          path: pathOf(url), opened: 0, errors: 0, messages: 0, parseFailures: 0,
          lastType: null, lastAt: null, seqs: [], byType: {}, frames: [], es: this,
        };
        probe.streams.push(rec);
        this.addEventListener('open', function () { rec.opened += 1; });
        this.addEventListener('error', function () { rec.errors += 1; });
        this.addEventListener('message', function (ev) {
          rec.messages += 1;
          try {
            var frame = JSON.parse(ev.data);
            var type = typeof frame.type === 'string' ? frame.type : null;
            rec.lastType = type;
            rec.lastAt = Date.now();
            var key = type === null ? '<无 type>' : type;
            rec.byType[key] = (rec.byType[key] || 0) + 1;
            var seq = typeof frame.seq === 'number' ? frame.seq : null;
            if (seq !== null) {
              rec.seqs.push(seq);
              if (rec.seqs.length > 6) rec.seqs.shift();
            }
            rec.frames.push({ type: type, seq: seq, at: Date.now() });
            if (rec.frames.length > 40) rec.frames.shift();
          } catch (err) { rec.parseFailures += 1; }
        });
      }
    }
    window.EventSource = ProbedEventSource;
  }

  var nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      var path = pathOf(input && typeof input === 'object' && 'url' in input ? input.url : input);
      var startedAt = Date.now();
      var p = nativeFetch.apply(this, arguments);
      if (path.indexOf('/api/') === 0) {
        p.then(
          function (res) { pushFetch({ path: path, status: res.status, ms: Date.now() - startedAt, at: Date.now() }); },
          function () { pushFetch({ path: path, status: null, ms: Date.now() - startedAt, at: Date.now() }); },
        );
      }
      return p;
    };
  }

  window.__pacmanProbeSnapshot = function () {
    var now = Date.now();
    return {
      documents: probe.documents,
      onLine: navigator.onLine,
      visibility: document.visibilityState,
      streams: probe.streams.map(function (r) {
        return {
          path: r.path, opened: r.opened, errors: r.errors, messages: r.messages,
          parseFailures: r.parseFailures, lastType: r.lastType,
          lastTypeAgoMs: r.lastAt === null ? null : now - r.lastAt,
          seqTail: r.seqs.slice(), readyState: r.es.readyState,
          byType: r.byType,
          frames: r.frames.map(function (f) {
            return { type: f.type, seq: f.seq, agoMs: now - f.at };
          }),
        };
      }),
      fetches: probe.fetches.map(function (f) {
        return { path: f.path, status: f.status, ms: f.ms, agoMs: now - f.at };
      }),
    };
  };
})();
`;

/** 读回探针快照。页已崩 / 探针没装上（注入被 CSP 挡、文档早于探针存在）时返回
 *  一句人话，不抛——诊断本身不该成为新的失败源。 */
export async function readSseProbe(page: Page): Promise<SseProbeSnapshot | string> {
  try {
    const raw = await page.evaluate((): SseProbeSnapshot | null => {
      const host = globalThis as unknown as { __pacmanProbeSnapshot?: () => SseProbeSnapshot };
      return host.__pacmanProbeSnapshot?.() ?? null;
    });
    return raw ?? '探针未装上（__pacmanProbeSnapshot 缺失）';
  } catch (err) {
    return `探针读不到: ${String(err).slice(0, 160)}`;
  }
}

/** 快照 → 诊断日志行（多行字符串，调用方原样拼进 out）。 */
export function formatSseProbe(snapshot: SseProbeSnapshot | string): string {
  if (typeof snapshot === 'string') return snapshot;
  const lines: string[] = [
    `文档装载数 = ${snapshot.documents}（> 1 = 发生过整页重载）`,
    `navigator.onLine=${snapshot.onLine} visibility=${snapshot.visibility}`,
  ];
  if (snapshot.streams.length === 0) lines.push('无 EventSource 实例——UI 从未建流');
  for (const s of snapshot.streams) {
    const last =
      s.lastTypeAgoMs === null
        ? '一帧未收'
        : `${s.lastType ?? '<无 type>'} 距今 ${s.lastTypeAgoMs}ms`;
    lines.push(
      `流 ${s.path}: readyState=${s.readyState} opened=${s.opened} errors=${s.errors} ` +
        `frames=${s.messages} 坏帧=${s.parseFailures} 末帧=${last} seq尾=[${s.seqTail.join(',')}]`,
    );
    lines.push(
      `  分类计数=${JSON.stringify(s.byType)}`,
      `  帧流水=${s.frames
        .map((f) => `${f.type ?? '<无 type>'}#${f.seq ?? '-'}(${f.agoMs}ms前)`)
        .join(' → ')}`,
    );
  }
  if (snapshot.fetches.length === 0) lines.push('无 /api/* 取数记录');
  for (const f of snapshot.fetches) {
    lines.push(`取数 ${f.path} → ${f.status ?? 'reject'} ${f.ms}ms（距今 ${f.agoMs}ms）`);
  }
  return lines.join('\n');
}
