// document_diff record——GET /api/documents/{id}/diff 端点源（02 §4.2 驳回
// 回路改判：plan.md 文件级 unified diff）。wire 形状未实测；以下为 r5 §4
// UI 触点元素（chip `v1 → v2`、`1 个文件改动`、`+5 −8` 统计、文件行 plan.md、
// hunk 头 `@@ -1,17 +1,14 @@`、双侧行号、±行、`全部展开`）的 [推断] 投影，
// M2 实现期可改判。

import { z } from 'zod';

export const diffHunkSchema = z.object({
  /** `@@ -1,17 +1,14 @@`（r5 §4 实测 hunk 头）。 */
  header: z.string(),
  /** ±行与上下文行（双侧行号由渲染层展开，01 §4.1 diff 视图 = npm diff 数据
   * + 自建渲染）。 */
  lines: z.array(z.string()),
});

export const diffFileSchema = z.object({
  path: z.string(),
  additions: z.number().int(),
  deletions: z.number().int(),
  hunks: z.array(diffHunkSchema),
});
export type DocumentDiffFile = z.infer<typeof diffFileSchema>;

export const documentDiffSchema = z.object({
  /** chip `v1 → v2`（r5 §4）。 */
  fromVersion: z.number().int(),
  toVersion: z.number().int(),
  files: z.array(diffFileSchema),
});
export type DocumentDiff = z.infer<typeof documentDiffSchema>;

/** `GET /api/builds/{id}/changes/file?path=` 响应（#224：conv 分支头单文件
 * 全文按需取，docpane「显示完整文件」数据源）。#219 裁决 A = 独立端点——
 * diffFileSchema 不内联 fullContent，changes 列表面不被全文撑爆；web 接线
 * 归 #225。封套形状镜像 projectFileResponseSchema（file-at-ref 读面同款）。 */
export const diffFileContentSchema = z.object({
  /** conv 分支名（brand.ts conversationBranch(buildId)）。 */
  ref: z.string(),
  /** 解析后的 conv 分支头 commit sha。 */
  commit: z.string(),
  path: z.string(),
  size: z.number().int(),
  /** 二进制（首 8KB 含 NUL，git 同款启发式）→ base64；超 1 MiB 闸门 = 413
   * 不落本封套（server 侧 DIFF_FILE_MAX_BYTES）。 */
  encoding: z.enum(['utf-8', 'base64']),
  content: z.string(),
});
export type DiffFileContent = z.infer<typeof diffFileContentSchema>;

/** diff 视图 UI 词（r5 §4 实测：`N 个文件改动` / `预览` 切换 / `全部展开` /
 * 对比二级菜单 `与其他版本对比…` + `上一版本`）。 */
export const DIFF_UI_COPY = {
  compareWith: '与其他版本对比…',
  previousVersion: '上一版本',
  expandAll: '全部展开',
  preview: '预览',
} as const;
