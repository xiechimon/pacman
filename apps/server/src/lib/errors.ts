// 错误形状 = {"error": "<message>"}（r5 §1 实测 400 样本
// `{"error":"unrecognized push service endpoint"}`；04 §3 错误形状对拍面）。
// #386：可分类错误额外携带 `reason` code（可选字段，{error} 单形状的超集
// ——wire.test 的 Object.keys 恰等断言只覆盖无 reason 的路由面）。

import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** 结构化分类 code（#386）；仅可分类的错误面携带（当前 =
     *  validateLocalRepoPath 三态）。 */
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(what: string): HttpError {
  return new HttpError(404, `${what} not found`);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

/** zod 校验失败 → 400（body/query 形状即契约，02/A9）。 */
export function parseWith<T extends z.ZodType>(
  schema: T,
  value: unknown,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const at = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new HttpError(400, `invalid ${label}${at}: ${issue?.message ?? 'validation failed'}`);
  }
  return result.data;
}
