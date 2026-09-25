// 可选 token 鉴权中间件（#251，spec #247 Implementation Decisions——全仓
// 唯一新缝：app 组装处一道 HTTP 中间件，路由面零散鉴权检查禁止）。
// PACMAN_TOKEN 设 = 开、未设 = 关（关 = 不注册，行为与现状完全一致）。
//
// 传输：Bearer 头为主干道；唯一例外 = 两条 SSE stream 端点接受 `?token=`
// query（原生 EventSource 无法设 header 的协议限制）——其余端点拒收 query
// token（防日志泄漏面扩散）。比对 = sha256 定长哈希 + timingSafeEqual
// （routes.ts git Basic 面同款哈希卫生）。
//
// 豁免清单（绕过面 = 仅此四条，spec #247 钉死）：
//   1. `/api/machine/*`——自有 Bearer（apiKey enroll + 机器 token 哈希比对）；
//   2. `/git/*`——自有 Basic → api_key(gitAccess) 哈希比对；
//   3. `/api/oauth/callback`——state 参数担 CSRF，豁免后 state 校验仍强制；
//   4. `/_mp/*` + 静态 SPA 壳——204 no-op 与非密 UI。
// 路径判定用 URL pathname（WHATWG URL 已归一化 `..` 段；豁免判定不 decode——
// 编码变体不落入豁免，只会更严）。豁免谓词 = 非 `/api/` 前缀整面放行
// （2/4 条与静态壳同判），`/api/` 内仅 1/3 条两前缀。

import { timingSafeEqual } from 'node:crypto';
import type { Hono } from 'hono';
import { sha256Hex } from './crypto.js';

/** 两条 SSE stream 端点（`?token=` 仅此二处；:id 段不含 `/`）。 */
const STREAM_PATH_PATTERNS = [
  /^\/api\/teams\/[^/]+\/stream$/,
  /^\/api\/conversations\/[^/]+\/stream$/,
];

function isExempt(pathname: string): boolean {
  // 非 /api/ 面 = /git/*、/_mp/*、静态 SPA 壳（豁免条 2/4 的并集；SPA 壳本身
  // 即「所有非 API 前缀路径」开放集，app.ts API_PREFIXES 为界）。守卫性质：
  // 大小写/双斜杠变体（/API/、//api/）落入本豁免但 Hono 路由不命中 → 404，
  // 不达保护面（test/token-auth.test.ts 钉住）。**新增任何非 /api/ 协议前缀
  // 路由时必须回访本谓词**——否则会静默绕过闸。
  if (!pathname.startsWith('/api/')) return true;
  // 机器面（豁免条 1）——前缀严格到段边界，/api/machinefoo 不豁免
  if (pathname === '/api/machine' || pathname.startsWith('/api/machine/')) return true;
  // OAuth 回跳（豁免条 3）
  if (pathname === '/api/oauth/callback') return true;
  return false;
}

/** 定长哈希比对（明文长度不泄漏；timingSafeEqual 前置长度恒等）。 */
function makeVerifier(token: string): (provided: string) => boolean {
  const expected = Buffer.from(sha256Hex(token));
  return (provided) => {
    const actual = Buffer.from(sha256Hex(provided));
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
  };
}

/** token = null（默认关）→ 不注册任何中间件；设值 → `*` 面一道闸。
 * 401 形状 = 既有 `{error}` 单形状同形（app.onError 族）。 */
export function registerTokenAuth(app: Hono, token: string | null): void {
  if (token === null) return;
  const verify = makeVerifier(token);
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    if (isExempt(pathname)) return next();
    const authorization = c.req.header('authorization');
    if (authorization !== undefined) {
      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (match !== null && verify(match[1] ?? '')) return next();
    }
    if (STREAM_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
      const queryToken = url.searchParams.get('token');
      if (queryToken !== null && verify(queryToken)) return next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  });
}
