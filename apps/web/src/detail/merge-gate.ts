// 合并前置检查（XMON-89）：merge 弹层的「完成」是否该禁用、禁用时点名缺哪
// 几项，由本模块一个纯函数 + 一个读面钩子决定。两处入口（详情页 / 看板）共用
// 它——同一份判据只有一处实现，两处禁用态与文案因此不可能各说各的。
//
// 语义对齐 server 侧闸（XMON-26 实施②，services/builds.ts requestMerge）：闸读
// 的正是**将执行合并的那个 Agent** 的 tools —— merge 步走 build 槽
// （services/machines.ts agentForStep：`kind === 'plan' ? plan : build`）。所以
// 调用面传进来的是 assignment.build.agentId，不是「卡片上显示的那个 Agent」
// （显示投影是 build ?? plan 折算，两槽分设时两者会分叉）。
//
// 两条「不拦」的支：
//
// 1. 判据未知（无指派 / members 读面未到位）：server 侧闸对同一情形也是放行的
//    （无 Agent 可查 = 无闸可查），前端拦下就是纯误伤；
// 2. 授权集为空数组：**存量豁免**（2026-10-01 leader 裁决）。唯一权威存储是
//    `agent.tools` 列，形状 = `json<string[]>('tools').notNull().default('[]')`
//    （db/schema.ts）——「从未保存过权限 tab」与「显式全关」被压成同一个值
//    `[]`，wire 层面分不出来。判 `[]` 为「缺」= 把所有存量 Agent（含 chief
//    merge_builds 路径、集成栈 m5 脊柱 E2E 的执行 Agent）一刀切成禁按，是用户
//    没要的破坏性回归（PR #579 CI 红即此因）。
//
// 于是本闸只在**非空**授权集上逐项判：非空 = 至少保存过一次权限面，那份选择
// 是用户表达过的意图，缺哪个开关就点哪个名。空集 = 没有意图可读，放行。

import type { AgentRecord } from '@pacman/shared';
import { useMemo } from 'react';
import { ApiError } from '../api/client.js';
import { useMembers } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import type { TFunc } from '../i18n/translate.js';

/** merge 步的两个前置开关（值域词同 shared AGENT_TOOL_SWITCHES；数组序 =
 *  报缺序，稳定序才有可比对的截图与断言）。 */
export const MERGE_GATE_TOOLS = ['合并分支', '推送分支'] as const;

/** 缺哪几项授权才能合并；空数组 / null = 放行（存量豁免，见文件头）。 */
export function missingMergeTools(tools: readonly string[] | null | undefined): string[] {
  if (tools == null || tools.length === 0) return [];
  return MERGE_GATE_TOOLS.filter((tool) => !tools.includes(tool));
}

/** 服务端拒绝的可见文案。403 = 闸自己给的、点名缺哪项的句子，原样透出（它
 *  就是可操作的那一半）；其余失败（5xx / 网络）的原文对用户不可操作，且网络
 *  级的原文是英文串，混进中文面反而更糊——退一句固定话（同律见
 *  agent-detail-page 的保存失败文案）。 */
export function mergeRejectCopy(error: unknown, t: TFunc): string {
  return error instanceof ApiError && error.status === 403
    ? error.message
    : t('合并请求未送出，请重试。');
}

/** 执行 Agent 的授权集：live = GET teams/{id}/members 的 actor 投影（server
 *  侧 agentRecordOf 原样带出 tools 列）；fixture 面返回空（不拦）——fixture
 *  面的「完成」本就不发请求，拦它只会拦掉自己的静态态。 */
export function useMergeGate(agentId: string | null, fixtureAgents?: AgentRecord[]): string[] {
  const { live, teamId } = useLiveData();
  const membersQ = useMembers(teamId, live);
  return useMemo(() => {
    if (agentId == null) return [];
    if (!live) return missingMergeTools(fixtureAgents?.find((a) => a.id === agentId)?.tools);
    const member = (membersQ.data ?? []).find(
      (m) => m.memberType === 'agent' && m.actorId === agentId,
    );
    return missingMergeTools((member?.actor as { tools?: string[] } | undefined)?.tools);
  }, [live, agentId, membersQ.data, fixtureAgents]);
}
