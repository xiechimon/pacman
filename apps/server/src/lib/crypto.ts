// 凭证哈希（02 §8 API 面：apiKey/machine token 服务端存哈希不存可逆值
// [设计]——登录校验只需匹配）。sha256 hex；M2c key 发行端点与 git Basic auth
// 共用同一函数（单源防两套哈希）。

import { createHash } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
