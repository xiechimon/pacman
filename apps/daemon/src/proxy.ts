// 代理探测（02 §5.6/r3 §1.5：启动读系统/环境代理并打印 `[tds] Proxy: <url>`；
// 代理死持续重试不退出——重试纪律在 machine-loop）。env 词表 = undici
// EnvHttpProxyAgent honor 三件（01 §4.3：HTTP_PROXY/HTTPS_PROXY/NO_PROXY）。

import { BRAND, PROXY_ENV_VARS } from '@pacman/shared';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import type { DaemonLogger } from './log.js';

export function detectProxyEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of PROXY_ENV_VARS.slice(0, 2)) {
    // PROXY_ENV_VARS = [HTTP_PROXY, HTTPS_PROXY, NO_PROXY]；小写变体同读。
    const value = env[name] ?? env[name.toLowerCase()];
    if (value) return value;
  }
  return null;
}

export function setupProxy(logger: DaemonLogger, env: NodeJS.ProcessEnv = process.env): void {
  const proxy = detectProxyEnv(env);
  if (!proxy) return;
  setGlobalDispatcher(new EnvHttpProxyAgent());
  // 行形 canon（r3 §1.5 实测 `[tds] Proxy: http://127.0.0.1:7890`；前缀品牌槽）。
  logger.raw(`[${BRAND.cliCommandName}] Proxy: ${proxy}`);
}
