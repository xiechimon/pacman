// GitOps 缝实现（shared git-ops.ts 接口；01 §4.2 锁定：spawn 系统 git，
// `git http-backend` CGI + bare repo 读树/单文件，isomorphic-git/simple-git
// 不引入）。缝纪律：本模块是 server 内唯一 git spawn 点。
// 注入安全：全程 argv 数组（无 shell）；ref 先经 `rev-parse --end-of-options`
// 解析为 sha 再消费（防 flag 样 ref）；path 拒绝 NUL/绝对路径/`..` 段。

import { spawn } from 'node:child_process';
import type {
  GitCgiRequest,
  GitCgiResponse,
  GitFileAtRef,
  GitOps,
  GitRefInfo,
  GitTreeEntry,
} from '@pacman/shared';

export interface GitRunResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

/** spawn 系统 git 并收齐 stdout/stderr；不抛非零（调用方按 code 判定）。 */
export function runGit(
  args: string[],
  opts: { cwd?: string; stdin?: Uint8Array; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      windowsHide: true,
      ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
    });
    const stdout: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({ code: code ?? 0, stdout: Buffer.concat(stdout), stderr }),
    );
    if (opts.stdin !== undefined) {
      child.stdin.end(Buffer.from(opts.stdin));
    } else {
      child.stdin.end();
    }
  });
}

const META_TIMEOUT_MS = 15_000;
const DEFAULT_HEAD_BRANCH = 'main'; // r3 §3.6 merge `origin/main` / 83 main README 实测

/** path 段护栏：仓库根相对、无 `..`、无 NUL、非绝对。 */
export function isSafeRepoPath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\0')) return false;
  return !path.split('/').includes('..');
}

/** CGI 响应解码：头区（CRLF/LF 双容忍）+ Status 头 + chunked 体解码。 */
export function decodeCgiResponse(raw: Buffer): GitCgiResponse {
  // 头/体分界 = 首个空行（git http-backend 用 \r\n\r\n；容忍 \n\n）。
  let split = -1;
  let splitLen = 0;
  for (const [needle, len] of [
    ['\r\n\r\n', 4],
    ['\n\n', 2],
  ] as const) {
    const idx = raw.indexOf(needle);
    if (idx >= 0 && (split === -1 || idx < split)) {
      split = idx;
      splitLen = len;
    }
  }
  const headText = split === -1 ? raw.toString('utf8') : raw.subarray(0, split).toString('utf8');
  let body = split === -1 ? Buffer.alloc(0) : raw.subarray(split + splitLen);

  let status = 200;
  const headers: [string, string][] = [];
  let chunked = false;
  for (const line of headText.split(/\r?\n/)) {
    if (line === '') continue;
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const name = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (name.toLowerCase() === 'status') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed)) status = parsed;
      continue; // Status 是 CGI 伪头，不透传
    }
    if (name.toLowerCase() === 'transfer-encoding') {
      chunked = value.toLowerCase().includes('chunked');
      continue; // 分帧由 HTTP server 重新负责
    }
    headers.push([name, value]);
  }
  if (chunked) body = decodeChunked(body);
  return { status, headers, body };
}

/** HTTP/1.1 chunked 解码（CGI 缓冲态 → 原样字节）。 */
export function decodeChunked(buf: Buffer): Buffer {
  const out: Buffer[] = [];
  let pos = 0;
  for (;;) {
    const lineEnd = buf.indexOf('\n', pos);
    if (lineEnd === -1) break;
    const sizeHex = buf.subarray(pos, lineEnd).toString('ascii').trim();
    const size = Number.parseInt(sizeHex.split(';')[0] ?? '', 16);
    if (!Number.isFinite(size) || Number.isNaN(size)) break;
    pos = lineEnd + 1;
    if (size === 0) break;
    out.push(buf.subarray(pos, pos + size));
    pos += size;
    // 跳过 chunk 尾 CRLF
    if (buf[pos] === 0x0d) pos += 1;
    if (buf[pos] === 0x0a) pos += 1;
  }
  return Buffer.concat(out);
}

export const systemGitOps: GitOps = {
  async initBareRepo(dir) {
    const init = await runGit(['init', '--bare', dir], { timeoutMs: META_TIMEOUT_MS });
    if (init.code !== 0) throw new Error(`git init --bare failed: ${init.stderr}`);
    const steps: string[][] = [
      ['symbolic-ref', 'HEAD', `refs/heads/${DEFAULT_HEAD_BRANCH}`],
      // http-backend 双服务放开（匿名侧由 server Basic auth 层把关，02 §3 凭证纪律）。
      ['config', 'http.receivepack', 'true'],
      ['config', 'http.uploadpack', 'true'],
    ];
    for (const args of steps) {
      const r = await runGit(args, { cwd: dir, timeoutMs: META_TIMEOUT_MS });
      if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr}`);
    }
  },

  async resolveCommit(dir, ref) {
    // --end-of-options：ref 位的 flag 样串不被当选项消费（git ≥ 2.24）。
    const r = await runGit(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code !== 0) return null;
    const sha = r.stdout.toString('utf8').trim();
    return /^[0-9a-f]{40,64}$/.test(sha) ? sha : null;
  },

  async lsTree(dir, commit, subPath) {
    const args = ['ls-tree', '-l', commit];
    if (subPath !== undefined && subPath !== '') {
      if (!isSafeRepoPath(subPath)) throw new Error(`unsafe path: ${subPath}`);
      // 目录内容列举 = 尾斜杠语义；blob 直查亦容忍。
      args.push('--', subPath.endsWith('/') ? subPath : `${subPath}/`);
    }
    const r = await runGit(args, { cwd: dir, timeoutMs: META_TIMEOUT_MS });
    if (r.code !== 0) return [];
    const entries: GitTreeEntry[] = [];
    for (const line of r.stdout.toString('utf8').split('\n')) {
      if (line === '') continue;
      // `<mode> <type> <sha> <size|->\t<path>`（-l 出 size；tree 为 `-`；
      // size 右对齐空格填充 → 按空白段切分）
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const meta = line.slice(0, tab).split(/\s+/);
      const path = line.slice(tab + 1);
      const type = meta[1] === 'tree' ? 'tree' : 'blob';
      const rawSize = meta[3];
      const size = rawSize !== undefined && rawSize !== '-' ? Number.parseInt(rawSize, 10) : null;
      const name = path.split('/').filter(Boolean).pop() ?? path;
      entries.push({
        name,
        path,
        type,
        size: Number.isNaN(size) ? null : size,
      });
    }
    return entries;
  },

  async readFileAt(dir, commit, path): Promise<GitFileAtRef | null> {
    if (!isSafeRepoPath(path)) throw new Error(`unsafe path: ${path}`);
    const r = await runGit(['cat-file', 'blob', `${commit}:${path}`], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    if (r.code !== 0) return null; // missing file / not a blob
    return { size: r.stdout.byteLength, content: new Uint8Array(r.stdout) };
  },

  async listBranches(dir) {
    const head = await runGit(['symbolic-ref', '--short', 'HEAD'], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    const defaultBranch = head.code === 0 ? head.stdout.toString('utf8').trim() || null : null;
    const refs = await runGit(['for-each-ref', 'refs/heads', '--format=%(refname:short)'], {
      cwd: dir,
      timeoutMs: META_TIMEOUT_MS,
    });
    const branches: GitRefInfo[] = refs.stdout
      .toString('utf8')
      .split('\n')
      .filter((l) => l !== '')
      .map((name) => ({ name, isDefault: name === defaultBranch }));
    return { defaultBranch, branches };
  },

  async httpBackend(req: GitCgiRequest): Promise<GitCgiResponse> {
    const env: NodeJS.ProcessEnv = {
      GIT_PROJECT_ROOT: req.projectRoot,
      GIT_HTTP_EXPORT_ALL: '1', // 免 git-daemon-export-ok 逐库置位
      PATH_INFO: req.pathInfo,
      QUERY_STRING: req.queryString,
      REQUEST_METHOD: req.method,
      // receive-pack ref 更新落 committer 身份 [设计]（server 侧固定值，品牌槽
      // 归 #44；daemon push 侧身份归 M3 per-step 面）。
      GIT_COMMITTER_NAME: 'pacman-git',
      GIT_COMMITTER_EMAIL: 'git@localhost',
      ...(req.contentType !== undefined ? { CONTENT_TYPE: req.contentType } : {}),
      ...(req.method === 'POST' ? { CONTENT_LENGTH: String(req.body.byteLength) } : {}),
      ...(req.remoteUser !== undefined ? { REMOTE_USER: req.remoteUser } : {}),
    };
    const r = await runGit(['http-backend'], { env, stdin: req.body });
    if (r.code !== 0 && r.stdout.byteLength === 0) {
      throw new Error(`git http-backend failed: ${r.stderr}`);
    }
    return decodeCgiResponse(r.stdout);
  },
};
