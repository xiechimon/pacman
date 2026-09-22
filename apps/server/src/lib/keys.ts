// 凭证生成与哈希（02 §8 API 面：apiKey/machine token 服务端存哈希不存可逆值
// [设计]——登录校验只需匹配）。形状 canon：API key = `tds_<48hex>`（02 §5.8/
// r3 §6 掩码样例）；机器 token = 64hex 无前缀（r3 §1.3 machine.json 实测）；
// 设备指纹 = 32hex（r3 §1.3）。掩码展示规则 = 前缀 + 前 8 hex + `…`（r3 §6
// `tds_afe07565…`）。

import { createHash, randomBytes } from 'node:crypto';
import { BRAND } from '@pacman/shared';

export function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newApiKey(): { plain: string; hash: string; masked: string } {
  const plain = `${BRAND.apiKeyPrefix}${randomBytes(24).toString('hex')}`; // 48hex
  return { plain, hash: sha256hex(plain), masked: maskApiKey(plain) };
}

export function maskApiKey(plain: string): string {
  // `tds_afe07565…`（r3 §6 实测掩码：前缀 + 8 位 + 省略号）。
  return `${plain.slice(0, BRAND.apiKeyPrefix.length + 8)}…`;
}

export function newMachineToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString('hex'); // 64hex（02 §5.8 保持项）
  return { plain, hash: sha256hex(plain) };
}

export function newDeviceId(): string {
  return randomBytes(16).toString('hex'); // 32hex（r3 §1.3）
}
