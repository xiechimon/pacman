// 应用内目录浏览 wire 契约（ADR 0003 D5/D6 / #441）：server readdir 只读
// 投影，remote/headless 形态下 POST /api/fs/pick 422 unavailable 的兜底
// 浏览器数据源。浏览范围不设白名单（单租户，D5）；只列目录（localPath 只收
// 目录）；git 标记只是提示不硬过滤（真值仍是 rev-parse，票面钉死）。

/** `GET /api/fs/list` 错误 reason 值域（#386 reason code 三端单源模式）：
 *  not_absolute = dir 非绝对路径（`~` 前缀不在此展开——那是创建校验
 *  validateLocalRepoPath 的语义）；not_found = realpath ENOENT（含断链/
 *  符号链接环 ELOOP）；not_dir = 目标是普通文件（或路径段穿过文件）；
 *  not_readable = 存在但 readdir/stat 被拒（EACCES/EPERM）。 */
export const FS_LIST_ERROR_REASONS = [
  'not_absolute',
  'not_found',
  'not_dir',
  'not_readable',
] as const;
export type FsListErrorReason = (typeof FS_LIST_ERROR_REASONS)[number];

/** 容量闸 [设计]：排序后截前 N 条，truncated=true 让 web 落提示行——
 *  超大目录不炸 wire（skills.ts MAX_SKILL_FILE_BYTES 容量闸同律）。 */
export const FS_LIST_MAX_ENTRIES = 2000;

/** 单条目：name = 目录内名字（dotfiles 全量返回，隐藏/toggle 是 web 显示
 *  层语义）；git = 该目录下 `.git` 在盘（目录或文件——worktree/submodule
 *  形态是文件），提示性标记。 */
export type FsListEntry = { name: string; git: boolean };

/** 200 应答封套：path = realpath 正规化后的绝对路径真值（面包屑/记住上次
 *  位置同源；符号链接目录不产生别名漂移）；entries 按 name 字典序。 */
export type FsListResult = { path: string; entries: FsListEntry[]; truncated: boolean };
