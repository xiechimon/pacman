// 技能事实分类器（#918）：从工具调用流识别「读了哪些技能」（判定源 = 工具
// 事实，不是 agent 自述）。失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   S1 误报面：非 SKILL.md 的 read / 其它工具 / 技能目录下的引用文件读取
//      都不得分类成技能事实（汇总被污染 = 判定源失信）。
//   S2 双后端读形：pi 的 read {path} 与 claude-code 的 Read {file_path}
//      同一分类（backend 词表差异不得漏报）。
//   S3 Skill 原生工具：{skill} 与 {command} 两种入参形都识别，`skill:` 前缀
//      剥掉（CLI deny 规则实测两形并存，docs/verify/917 probe B5）。
//   S4 大小写敏感：`skill.md` / `Skill.md` 不是事实（SKILL.md 是唯一正典名）。
//   S5 半程调用（无 result）：classifySkillFact = null（读取尚未成为事实），
//      但 skillCallName 有值（活行头标签的进行态显示名不依赖终态）。
//   S6 deny 判定：isError=true → denied（pi 门控 read 的 tool error 与
//      claude-code deny 规则的 is_error tool_result 同律）；成功 → 非 denied。
//      接受的边界：SKILL.md 读的真实 I/O 错误（文件缺失）会显示为已挡下——
//      catalog 刚注入过的路径缺失属病态场景，宁可多报一条可见事实。
//   S7 路径边界：Windows 分隔符、裸 `SKILL.md`（无父目录 = 无名可取 →
//      null）、深层嵌套 SKILL.md（名 = 直接父目录）。
//   S8 脏入参：arguments 缺失 / 非对象 / 路径非字符串 → null，不抛。

import { describe, expect, test } from 'vitest';
import type { ToolCallRecord } from '../src/agent-backend.js';
import { classifySkillFact, skillCallName } from '../src/skill-facts.js';

function call(partial: Partial<ToolCallRecord> & { name: string }): ToolCallRecord {
  return { id: 'call-1', arguments: {}, ...partial };
}

const done = { result: 'ok', isError: false } as const;

describe('skillCallName（进行态显示名，S5）', () => {
  test('pi read 形：{path} 指向 SKILL.md → 父目录名', () => {
    expect(
      skillCallName(call({ name: 'read', arguments: { path: '/skills/to-spec/SKILL.md' } })),
    ).toBe('to-spec');
  });

  test('claude-code Read 形：{file_path}', () => {
    expect(
      skillCallName(
        call({ name: 'Read', arguments: { file_path: '/home/u/.claude/skills/kami/SKILL.md' } }),
      ),
    ).toBe('kami');
  });

  test('Skill 原生工具：{skill} / {command} / skill: 前缀（S3）', () => {
    expect(skillCallName(call({ name: 'Skill', arguments: { skill: 'probe-skill' } }))).toBe(
      'probe-skill',
    );
    expect(skillCallName(call({ name: 'Skill', arguments: { command: 'to-spec' } }))).toBe(
      'to-spec',
    );
    expect(skillCallName(call({ name: 'Skill', arguments: { skill: 'skill:to-spec' } }))).toBe(
      'to-spec',
    );
  });

  test('半程调用（无 result）仍有显示名（S5）', () => {
    expect(
      skillCallName(call({ name: 'read', arguments: { path: '/s/implement/SKILL.md' } })),
    ).toBe('implement');
  });

  test('非技能调用 → null（S1）', () => {
    expect(
      skillCallName(call({ name: 'bash', arguments: { command: 'cat SKILL.md' } })),
    ).toBeNull();
    expect(
      skillCallName(call({ name: 'read', arguments: { path: '/s/to-spec/refs/deep.md' } })),
    ).toBeNull();
    expect(skillCallName(call({ name: 'read', arguments: { path: '/src/main.ts' } }))).toBeNull();
    expect(skillCallName(call({ name: 'edit', arguments: { path: '/s/x/SKILL.md' } }))).toBeNull();
  });

  test('大小写敏感：skill.md / Skill.md 不是事实（S4）', () => {
    expect(skillCallName(call({ name: 'read', arguments: { path: '/s/x/skill.md' } }))).toBeNull();
    expect(skillCallName(call({ name: 'read', arguments: { path: '/s/x/Skill.md' } }))).toBeNull();
  });

  test('路径边界：Windows 分隔符 / 裸 SKILL.md / 深层嵌套（S7）', () => {
    expect(
      skillCallName(call({ name: 'read', arguments: { path: 'C:\\skills\\to-spec\\SKILL.md' } })),
    ).toBe('to-spec');
    expect(skillCallName(call({ name: 'read', arguments: { path: 'SKILL.md' } }))).toBeNull();
    expect(
      skillCallName(call({ name: 'read', arguments: { path: '/a/b/c/deep-skill/SKILL.md' } })),
    ).toBe('deep-skill');
  });

  test('脏入参不抛（S8）', () => {
    expect(skillCallName(call({ name: 'read' }))).toBeNull();
    expect(skillCallName(call({ name: 'read', arguments: null }))).toBeNull();
    expect(skillCallName(call({ name: 'read', arguments: { path: 42 } }))).toBeNull();
    expect(skillCallName(call({ name: 'Skill', arguments: {} }))).toBeNull();
    expect(skillCallName(call({ name: '' }))).toBeNull();
  });
});

describe('classifySkillFact（终态事实，S5/S6）', () => {
  test('成功读取 → {name, denied:false}', () => {
    expect(
      classifySkillFact(
        call({ name: 'read', arguments: { path: '/s/demo-skill/SKILL.md' }, ...done }),
      ),
    ).toEqual({ name: 'demo-skill', denied: false });
  });

  test('pi 门控 read 拒绝（tool error）→ denied:true（S6）', () => {
    expect(
      classifySkillFact(
        call({
          name: 'read',
          arguments: { path: '/s/extra-skill/SKILL.md' },
          result: "read denied: skill 'extra-skill' is not in the agent allowlist",
          isError: true,
        }),
      ),
    ).toEqual({ name: 'extra-skill', denied: true });
  });

  test('claude-code deny 规则（is_error tool_result）→ denied:true（S6）', () => {
    expect(
      classifySkillFact(
        call({
          name: 'Read',
          arguments: { file_path: '/skills/beta/SKILL.md' },
          result: [
            {
              type: 'text',
              text: "Permission to read /skills/beta/SKILL.md has been denied by permission rule 'Read(//skills/beta/**)'.",
            },
          ],
          isError: true,
        }),
      ),
    ).toEqual({ name: 'beta', denied: true });
  });

  test('Skill 原生调用被 deny 规则挡下 → denied:true', () => {
    expect(
      classifySkillFact(
        call({
          name: 'Skill',
          arguments: { skill: 'probe-skill' },
          result: 'denied',
          isError: true,
        }),
      ),
    ).toEqual({ name: 'probe-skill', denied: true });
  });

  test('半程调用（无 result）不是事实（S5）', () => {
    expect(
      classifySkillFact(call({ name: 'read', arguments: { path: '/s/x/SKILL.md' } })),
    ).toBeNull();
  });

  test('非技能调用 → null（S1）', () => {
    expect(
      classifySkillFact(call({ name: 'bash', arguments: { command: 'ls' }, ...done })),
    ).toBeNull();
  });

  test('isError 缺省 = 非 denied（旧记录 / 部分后端不带该位）', () => {
    expect(
      classifySkillFact(
        call({ name: 'read', arguments: { path: '/s/x/SKILL.md' }, result: 'body' }),
      ),
    ).toEqual({ name: 'x', denied: false });
  });
});
