// 记录 id 生成。观测形态（records/common.ts recordId 注）：
// - nanoid 样 21 字符 base64 字母表（team/agent/machine，r3 §1.2/§4；step
//   base64 样 `LFnKO1KhDH4F1HylsEAfY`，r5 §3.1）→ newRecordId()
// - UUIDv7（build/conversation，r3 §3.0；chief thread，r5 §3.6）→ newUuidv7()
// crypto.randomUUIDv7 在 engines 底线 Node 22.19 不可用，UUIDv7 自建（RFC 9562：
// 48 位毫秒时间戳 + ver 7 + variant 10 + 74 位随机）。

import { randomBytes } from 'node:crypto';

/** nanoid 样字母表（64 字符，观测样本含 `-_`，r3 §1.2 `TlZ2sSD4EJCxjNJqVhdo_`）。 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function newRecordId(size = 21): string {
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i++) {
    // bytes[i] 必存在（size 长度分配）；& 63 = 均匀映射 64 字母表。
    out += ALPHABET[(bytes[i] as number) & 63];
  }
  return out;
}

export function newUuidv7(): string {
  let ms = Date.now();
  const bytes = randomBytes(16);
  // 前 48 位 = 大端毫秒时间戳。
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms & 0xff;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowMs(): number {
  return Date.now();
}
