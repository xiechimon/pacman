// 合并前置检查（XMON-89）的判据单测：merge 弹层的「完成」是否该禁用、以及
// 禁用时点名缺哪几项，全由这一个纯函数决定——两处入口（详情页 / 看板）共用
// 它，禁用态与文案因此不可能各说各的。
//
// 逐条钉住的失败方式：
//  1. 授权未知（无指派 / members 未到位）时误判为「缺」——用户被一个查不出
//     执行者的弹层挡住，而 server 侧闸对同一情形是放行的（machines.ts
//     agentForStep 无 agent = 无闸可查），前端拦下就是纯误伤；
//  2. **空数组当成「全关」**——存量豁免：唯一权威存储是 `agent.tools`
//     列，`json<string[]>('tools').notNull().default('[]')`（db/schema.ts）
//     把「从未保存过权限 tab」与「显式全关」压成同一个值 `[]`，wire 分不
//     出来。判缺 = 把所有存量 Agent（含 chief merge_builds 路径、m5 脊柱
//     E2E 的执行 Agent）一刀切成禁按，是用户没要的破坏性回归（2026-10-01
//     leader 裁决；PR #579 CI 红即此因）；
//  3. 全开仍报缺——用户明明有权限却点不动（比静默吞掉更糟：连绕都绕不过去）；
//  4. 只缺一项时把两项都点名——文案指错开关，用户按提示开完还是点不动；
//  5. 值域外的工具串（skills / mcp 的授权项混在同一个数组里）被当成开关；
//  6. 报缺序不稳定——两次渲染文案掉序，截图与断言都失去可比性。

import { describe, expect, it } from 'vitest';
import { MERGE_GATE_TOOLS, missingMergeTools } from '../src/detail/merge-gate.js';

describe('missingMergeTools', () => {
  it('授权未知（null / undefined）不拦——与 server 侧闸的无从查证即放行同口径', () => {
    expect(missingMergeTools(null)).toEqual([]);
    expect(missingMergeTools(undefined)).toEqual([]);
  });

  it('两项全开不报缺', () => {
    expect(missingMergeTools([...MERGE_GATE_TOOLS])).toEqual([]);
    expect(missingMergeTools(['远程 shell', '合并分支', '推送分支', '创建标签'])).toEqual([]);
  });

  it('空数组放行——存量豁免：从未保存过权限 tab 的 Agent 在库里就是 []（不拦）', () => {
    expect(missingMergeTools([])).toEqual([]);
  });

  it('非空但两项都不含时两项都报，序 = MERGE_GATE_TOOLS 序（合并分支在前）', () => {
    expect(missingMergeTools(['远程 shell'])).toEqual(['合并分支', '推送分支']);
  });

  it('只缺推送分支时只报推送分支', () => {
    expect(missingMergeTools(['合并分支'])).toEqual(['推送分支']);
  });

  it('只缺合并分支时只报合并分支', () => {
    expect(missingMergeTools(['推送分支'])).toEqual(['合并分支']);
  });

  it('值域外的授权项（技能 / 密钥等）不算开关', () => {
    expect(missingMergeTools(['远程 shell', '创建技能', '更新技能', '创建标签'])).toEqual([
      '合并分支',
      '推送分支',
    ]);
  });
});