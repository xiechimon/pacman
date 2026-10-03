// daemon 侧图片附件解析下载（#730）失败方式先于实现固化：
//   1. spec 整行 png token → 下载 → 内联交付（images 携带 base64 + 锚行替换文本）
//   2. svg/bmp/ico/avif → 素材化到 worktree 外目录 + token 行替换为绝对路径
//      （materialize 目录绝不在 worktree 内——git status clean 的构造性保证）
//   3. 下载失败（pending 409 / 未知 404）→ 步不崩：token 原样保留 + 文本注明
//      不可用 + 日志行
//   4. 路径穿越 key → 独立复验拒绝（不发起下载、token 保留 + 注记）
//   5. text/pdf token → 零触碰（既有 attachment 工具路径，token 原样）
//   6. 行内 token → 零触碰（已知限制）
//   7. 素材化文件名安全化（fileName 含路径段/控制字符 → 落 basename 形）

import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import type { MachineAttachmentResponse } from '@pacman/shared';
import { formatAttachmentToken } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { resolveStepImages } from '../src/step-attachments.js';

function fakeClient(attachments: Record<string, MachineAttachmentResponse | Error>): {
  client: { attachment: (stepId: string, id: string) => Promise<MachineAttachmentResponse> };
  requested: string[];
} {
  const requested: string[] = [];
  return {
    requested,
    client: {
      async attachment(_stepId: string, id: string) {
        requested.push(id);
        const hit = attachments[id];
        if (hit === undefined) throw new Error(`machine api 404: attachment ${id}`);
        if (hit instanceof Error) throw hit;
        return hit;
      },
    },
  };
}

const PNG_BYTES = Buffer.from('89504e470d0a1a0a', 'hex');

function pngResponse(): MachineAttachmentResponse {
  return {
    fileName: 'shot.png',
    mimeType: 'image/png',
    sizeBytes: PNG_BYTES.byteLength,
    contentBase64: PNG_BYTES.toString('base64'),
  };
}

function setup() {
  const home = mkdtempSync(join(tmpdir(), 'pacman-step-att-'));
  const materializeDir = join(home, 'step-attachments');
  const worktree = join(home, 'workspaces', 'conv-1');
  mkdirSync(worktree, { recursive: true });
  const lines: string[] = [];
  return {
    home,
    materializeDir,
    worktree,
    log: (msg: string) => lines.push(msg),
    lines,
  };
}

describe('daemon 图片附件解析下载（#730）', () => {
  test('失败方式 1：整行 png token → 下载 + 内联交付 + token 行换锚行', async () => {
    const s = setup();
    const { client } = fakeClient({ id1: pngResponse() });
    const text = `标题\n\n${formatAttachmentToken('shot.png', 't1/id1.png')}\n\n后文`;
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.images).toHaveLength(1);
    expect(out.images[0]).toMatchObject({
      data: PNG_BYTES.toString('base64'),
      mimeType: 'image/png',
    });
    expect(out.text).toContain('[image attached: shot.png]');
    expect(out.text).not.toContain('attachment:t1/id1.png');
    expect(out.text).toContain('标题');
    expect(out.text).toContain('后文');
  });

  test('失败方式 2：svg → 素材化到 worktree 外 + 路径行（git clean 的构造保证）', async () => {
    const s = setup();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const { client } = fakeClient({
      id1: {
        fileName: 'diagram.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: svg.byteLength,
        contentBase64: svg.toString('base64'),
      },
    });
    const text = `任务\n\n${formatAttachmentToken('diagram.svg', 't1/id1.svg')}`;
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.images).toHaveLength(0); // 不内联
    expect(out.text).not.toContain('attachment:t1/id1.svg');
    const m = /查看图片：(\/[^\s`\]]+)/.exec(out.text);
    expect(m).not.toBeNull();
    const path = m![1]!;
    expect(isAbsolute(path)).toBe(true);
    expect(path.startsWith(s.materializeDir)).toBe(true);
    // 素材化目录在 worktree 外（git status clean 的构造性断言）
    const rel = relative(s.worktree, path);
    expect(rel.startsWith('..')).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).toString()).toContain('<svg');
  });

  test('失败方式 3：下载 409（pending）→ 步不崩：token 原样保留 + 不可用注记 + 日志', async () => {
    const s = setup();
    const { client } = fakeClient({
      id1: new Error('machine api 409: attachment id1 not ready (pending)'),
    });
    const token = formatAttachmentToken('shot.png', 't1/id1.png');
    const text = `任务\n\n${token}`;
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.images).toHaveLength(0);
    expect(out.text).toContain(token); // token 原样保留
    expect(out.text).toContain('不可用');
    expect(out.text).toContain('pending');
    expect(s.log.length).toBeGreaterThan(0);
  });

  test('失败方式 3：下载 404（未知 id）→ 同形：token 保留 + 注记', async () => {
    const s = setup();
    const { client } = fakeClient({});
    const token = formatAttachmentToken('gone.png', 't1/id404.png');
    const out = await resolveStepImages({
      text: token,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.text).toBe(
      `${token}\n[图片附件 t1/id404.png 不可用：machine api 404: attachment id404 — 该图片未交付]`,
    );
  });

  test('失败方式 4：路径穿越 key → 不发起下载，token 保留 + 注记', async () => {
    const s = setup();
    const { client, requested } = fakeClient({});
    const token = '![x](attachment:t1/../id1.png)';
    const out = await resolveStepImages({
      text: token,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(requested).toHaveLength(0);
    expect(out.text).toContain(token);
    expect(out.text).toContain('未交付');
  });

  test('失败方式 5：text/pdf token → 零触碰（文本逐字节不变）', async () => {
    const s = setup();
    const { client, requested } = fakeClient({});
    const text = [
      'spec:',
      '',
      '![notes](attachment:t1/id1.md)',
      '',
      '![doc](attachment:t1/id2.pdf)',
    ].join('\n');
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.text).toBe(text);
    expect(out.images).toHaveLength(0);
    expect(requested).toHaveLength(0);
  });

  test('失败方式 6：行内 token → 零触碰', async () => {
    const s = setup();
    const { client, requested } = fakeClient({ id1: pngResponse() });
    const text = `看 ![inline](attachment:t1/id1.png) 这张`;
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.text).toBe(text);
    expect(out.images).toHaveLength(0);
    expect(requested).toHaveLength(0);
  });

  test('失败方式 7：素材化文件名安全化——fileName 带路径段时落 basename', async () => {
    const s = setup();
    const bmp = Buffer.from('424d');
    const { client } = fakeClient({
      id1: {
        fileName: '../evil/name.bmp',
        mimeType: 'image/bmp',
        sizeBytes: bmp.byteLength,
        contentBase64: bmp.toString('base64'),
      },
    });
    const out = await resolveStepImages({
      text: formatAttachmentToken('../evil/name.bmp', 't1/id1.bmp'),
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    const m = /查看图片：(\/[^\s`\]]+)/.exec(out.text);
    expect(m).not.toBeNull();
    const path = m![1]!;
    // 落点是 materialize 根下（不因 fileName 的 ../ 逃逸）
    expect(path.startsWith(s.materializeDir)).toBe(true);
    expect(existsSync(path)).toBe(true);
  });

  test('mime 与 ext 漂移：key 说 png、响应说 svg+xml → 按响应 mime 走素材化', async () => {
    const s = setup();
    const svg = Buffer.from('<svg/>');
    const { client } = fakeClient({
      id1: {
        fileName: 'shot.png',
        mimeType: 'image/svg+xml',
        sizeBytes: svg.byteLength,
        contentBase64: svg.toString('base64'),
      },
    });
    const out = await resolveStepImages({
      text: formatAttachmentToken('shot.png', 't1/id1.png'),
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.images).toHaveLength(0);
    expect(out.text).toMatch(/\.svg\b/);
  });

  test('同文本多图片：下载顺序 = token 行序（锚行与 images 序一致）', async () => {
    const s = setup();
    const { client } = fakeClient({
      id1: { ...pngResponse(), fileName: 'a.png' },
      id2: { ...pngResponse(), fileName: 'b.png' },
    });
    const text = [
      formatAttachmentToken('a.png', 't1/id1.png'),
      formatAttachmentToken('b.png', 't1/id2.png'),
    ].join('\n');
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.text.indexOf('a.png')).toBeLessThan(out.text.indexOf('b.png'));
  });

  test('无 token 文本 → 原文与零图片（零回归基线）', async () => {
    const s = setup();
    const { client } = fakeClient({});
    const text = '普通任务文本，无附件。';
    const out = await resolveStepImages({
      text,
      stepId: 's1',
      client,
      materializeDir: s.materializeDir,
      log: s.log,
    });
    expect(out.text).toBe(text);
    expect(out.images).toHaveLength(0);
  });
});

// 直接物化辅助（materialize 步的独立单测）：文件已存在时幂等覆写。
describe('materializeAttachmentFile', () => {
  test('同名重复物化 → 覆写不报错', async () => {
    const s = setup();
    const { materializeFile } = await import('../src/step-attachments.js');
    const p1 = materializeFile(s.materializeDir, 's1', 'pic.png', Buffer.from('abc'));
    const p2 = materializeFile(s.materializeDir, 's1', 'pic.png', Buffer.from('def'));
    expect(p1).toBe(p2);
    expect(readFileSync(p1).toString()).toBe('def');
  });
});
