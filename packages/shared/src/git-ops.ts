// GitOps 缝（01 §3 五缝之一）——server 托管面词表：02 §3/A4（本地 bare repo +
// `git http-backend` CGI + 读树/单文件）。实现 = apps/server（spawn 系统 git，
// 01 §4.2「isomorphic-git/simple-git 不引入」）；daemon 侧 worktree 词表
// （02 §5.5 全表）随 M3 并入本缝。缝纪律（01 §7.3）：实现模块之外不得直接
// spawn/import git 包装依赖。
// 字节面用 Uint8Array（shared 零 node 依赖）。

/** `ls-tree` 行投影（tree?ref= 端点源，02 §3 文件浏览面）。 */
export interface GitTreeEntry {
  name: string;
  /** 仓库根相对路径。 */
  path: string;
  type: 'blob' | 'tree';
  /** blob 字节数；tree 为 null（ls-tree -l 对目录出 `-`）。 */
  size: number | null;
}

/** 单文件读取结果（file?path=&ref= 端点源）。 */
export interface GitFileAtRef {
  size: number;
  content: Uint8Array;
}

export interface GitRefInfo {
  /** 短名（refs/heads/ 去前缀）。 */
  name: string;
  /** 默认分支位（bare HEAD symbolic-ref）。 */
  isDefault: boolean;
}

/** `git http-backend` CGI 调用形状（env + stdio 管道，01 §4.2）。 */
export interface GitCgiRequest {
  /** GIT_PROJECT_ROOT（bare repo 的父目录）。 */
  projectRoot: string;
  /** PATH_INFO（`/<repoName>.git/<rest>`）。 */
  pathInfo: string;
  queryString: string;
  method: 'GET' | 'POST';
  contentType?: string;
  /** 已认证远端用户（http-backend 据此放开 receive-pack）；匿名不设。 */
  remoteUser?: string;
  /** 请求体（POST upload-pack/receive-pack 载荷），原样进 stdin。 */
  body: Uint8Array;
}

export interface GitCgiResponse {
  status: number;
  headers: [string, string][];
  /** 响应体原样字节（git 协议 pkt-line 为二进制，不做文本化）。 */
  body: Uint8Array;
}

export interface GitOps {
  /** init 本地 bare repo（托管形态落地，02 §3；HEAD 指默认分支——main 正典
   * 值（r3 §3.6 `origin/main`），实现在 server 侧）。 */
  initBareRepo(dir: string): Promise<void>;
  /** ref → commit sha 解析（`rev-parse --verify`）；解析失败 null。 */
  resolveCommit(dir: string, ref: string): Promise<string | null>;
  /** 读树（`ls-tree -l`）；subPath 空 = 仓库根。 */
  lsTree(dir: string, commit: string, subPath?: string): Promise<GitTreeEntry[]>;
  /** 读单文件（`cat-file blob`）；缺失 null。 */
  readFileAt(dir: string, commit: string, path: string): Promise<GitFileAtRef | null>;
  /** 分支面（`for-each-ref refs/heads` + HEAD symbolic-ref）。 */
  listBranches(dir: string): Promise<{ defaultBranch: string | null; branches: GitRefInfo[] }>;
  /** `git http-backend` CGI 一次调用（spawn + env + stdin/stdout 管道）。 */
  httpBackend(req: GitCgiRequest): Promise<GitCgiResponse>;
}
