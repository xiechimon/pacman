// 错误形状 = {"error": "<message>"}（r5 §1 实测 400 样本
// `{"error":"unrecognized push service endpoint"}`；04 §3 错误形状对拍面）。

import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
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
