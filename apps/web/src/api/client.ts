// REST 客户端（M5 汇合，#83）：同源 fetch（02/A1 server 静态托管 → cookie
// 会话自动随行；dev 期经 vite proxy 同源化）。错误形状 = {error} 单形状
// （04 §3），非 2xx 一律抛 ApiError 供 TanStack Query 重试/呈现。
// 鉴权面（#253）：有存量 token 即附 Bearer 头；401 → demandGate 落门页并把
// 本请求停车（awaitGate），放行后原请求重试一次；重试仍 401（token 又换了）
// → 重开门页并照常抛错，Query 的 retry 面再次停车于门。demandGate 带同值
// 守卫：只有「失败请求携带的 token 仍是当前存量」才落门——迟到的 401（发出
// 时带旧 token，响应回来时门页已放行写入新 token）不得清掉刚存的好值。
// 鉴权关 = 永无 401，本缝零行为差。

import { awaitGate, demandGate, readStoredToken } from './auth.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function send(
  path: string,
  token: string | null,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers['content-type'] = 'application/json';
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return fetch(path, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function settle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 401 → 落门（同值守卫见模块头注）；门未开 = 立即通过。 */
function demandIfCurrent(sentWith: string | null): void {
  if (readStoredToken() === sentWith) demandGate();
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let token = readStoredToken();
  const first = await send(path, token, init);
  if (first.status !== 401) return settle<T>(first);
  demandIfCurrent(token);
  await awaitGate();
  token = readStoredToken();
  const second = await send(path, token, init);
  if (second.status === 401) demandIfCurrent(token);
  return settle<T>(second);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
