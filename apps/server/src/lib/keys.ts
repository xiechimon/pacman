// 机器面凭证生成（02 §5.8/§8）：机器 token = 64hex 无前缀（r3 §1.3
// machine.json 实测；保持项非品牌槽）、设备指纹 = 32hex（r3 §1.3）。
// 哈希单源 = lib/hash.ts hashCredential（apiKey 发行/掩码面归 services/api-keys.ts
// + shared maskApiKey，M2c 单源纪律——本文件不重复实现）。

import { randomBytes } from 'node:crypto';
import { hashCredential } from './hash.js';

export function newMachineToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString('hex'); // 64hex（02 §5.8 保持项）
  return { plain, hash: hashCredential(plain) };
}

export function newDeviceId(): string {
  return randomBytes(16).toString('hex'); // 32hex（r3 §1.3）
}
