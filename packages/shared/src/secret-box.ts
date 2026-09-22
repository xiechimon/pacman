// SecretBox 缝（01 §3/§4.4 五缝之一：接口定义落 shared，实现各归其端）——
// 02 §8 at-rest 层：server 侧凭证类数据统一加密存储；密钥源 = 本地 keyfile
// （首次启动生成，不引外部 KMS/口令派生，Q5 锁定）。
// 加密对象 = provider key、team secret 值、git 凭证；apiKey/machine token
// 存哈希不入 SecretBox（02 §8：登录校验只需匹配，用户视角同为掩码）。
// 信封 = `v1` 版本头 + iv + ciphertext + authTag（AES-256-GCM，01 §4.2 锁定；
// 串编码细节 = 实现面，缝只钉版本词与两动词）。
// 恢复口径护栏（02 §8 原话）：keyfile 丢失 = 全部存量 provider key 报废，
// 需重录——文档落 apps/server/README.md。

/** 信封版本头（01 §4.2 `v1`；将来换算法 = 新版本头，旧信封按版本分派）。 */
export const SECRET_BOX_ENVELOPE_VERSION = 'v1';

/** at-rest 加密缝接口（深模块：seal/open 两动词，信封布局不出接口）。 */
export interface SecretBox {
  /** 明文 → 信封串（落库形态；同明文两次 seal 结果不同 = iv 随机）。 */
  seal(plaintext: string): string;
  /** 信封 → 明文。篡改 / 错 key / 版本不符 / 编码坏 → 抛错（GCM 认证）。 */
  open(envelope: string): string;
}
