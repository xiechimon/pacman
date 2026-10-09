// live 数据源桥（M5 汇合，#83）：路由树顶的 pathless layout——判定
// fixture/live 模式（api/mode.ts）、解析 seed team/用户（02 §2 恒一行）、
// 挂 team stream 全局订阅（SSE → invalidateQueries + 桌面通知，02 §1.2/§9.1）。
// fixture 模式下本桥完全惰性（不发请求、不开流），fixture/dev 场景数据面
// 与既有行为字节一致。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router';
import { USER_NAME } from '../fixtures/fixtures.js';
import { SCENARIO_PARAM } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { useMembers, useSession, useTeams } from './hooks.js';
import { isFixtureMode } from './mode.js';
import { useTeamStream } from './sse.js';

/** 当前登录用户的头像身份（XMON-105 单源）：所有「用户自己」头像位（侧栏
 *  chip / 用户菜单 / 帐号头 / 对话用户行 / 任务行 owner 位）经此一处解析，
 *  与 agent 头像同律（avatarUrl 覆盖 > dicebear 名字种子 > 静态兜底由
 *  SeededAvatar 承载）。live = /api/user/me；fixture = canon 常量，e2e
 *  种子断言（avatar-dicebear.spec）据此不变。 */
export interface CurrentUser {
  displayName: string;
  avatarUrl: string | null;
}

const FIXTURE_USER: CurrentUser = { displayName: USER_NAME, avatarUrl: null };

export interface LiveData {
  /** true = 真 API 数据源；false = fixture（scenario）数据源。 */
  live: boolean;
  /** seed 团队 id（live 且 /api/teams 已解析）。 */
  teamId: string | undefined;
  /** seed 用户显示名（时间线 actor 拼装用，r3 §3.6）。 */
  userName: string;
  /** 当前用户头像身份单源（见 CurrentUser）。 */
  user: CurrentUser;
}

const LiveDataContext = createContext<LiveData>({
  live: false,
  teamId: undefined,
  userName: '我',
  user: FIXTURE_USER,
});

export function useLiveData(): LiveData {
  return useContext(LiveDataContext);
}

/** XMON-105: agent avatarUrl 覆盖位 join。todo wire 的 agent 位只投影
 *  {id,displayName}（server 投影如此，非缺口），而团队页/Agent 详情直接吃
 *  members 全记录（含 avatarUrl）——todo 系面（看板卡 / chip popover / 对话
 *  行 / 重跑 dialog）经此一处 join 同一覆盖位，保证同一 agent 在所有面恒同
 *  像。members 读面全 app 缓存单请求；live 未到位或 fixture = 空表（退名字
 *  种子，与覆盖位为 null 时逐字节同路）。 */
export function useAgentAvatarUrlById(): Map<string, string | null> {
  const { live, teamId } = useLiveData();
  const members = useMembers(teamId, live);
  return useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members.data ?? []) {
      if (m.memberType !== 'agent') continue;
      map.set(m.actorId, (m.actor as { avatarUrl?: string | null } | undefined)?.avatarUrl ?? null);
    }
    return map;
  }, [members.data]);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2_000,
    },
  },
});

export function ApiProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function LiveDataBridge() {
  const { search } = useLocation();
  const live = useMemo(() => !isFixtureMode(new URLSearchParams(search)), [search]);
  const teams = useTeams(live);
  const session = useSession(live);
  const teamId = teams.data?.[0]?.id;
  useTeamStream(teamId, live);
  const value = useMemo<LiveData>(
    () => ({
      live,
      teamId,
      userName: session.data?.displayName ?? '我',
      user: live
        ? {
            displayName: session.data?.displayName ?? USER_NAME,
            avatarUrl: session.data?.avatarUrl ?? null,
          }
        : FIXTURE_USER,
    }),
    [live, teamId, session.data],
  );
  // #1037 传播契约：`?scenario=` 随侧栏跳转传播是设计行为（sidebar 携带
  // live search，fixture/e2e 数据源要活过导航；sidebar-nav / shell-consistency
  // 等 18+ 断言钉住 URL 携带），生产 build 编译期折叠该参数、永不受影响。
  // dev/fixture build 里误入该模式的代价是整站换成冻结样例数据——模式必须
  // 自我声明：这枚 chip 就是可见提示。
  const scenarioId = live ? null : new URLSearchParams(search).get(SCENARIO_PARAM);
  return (
    <LiveDataContext.Provider value={value}>
      {scenarioId != null && <FixtureModeChip id={scenarioId} />}
      <Outlet />
    </LiveDataContext.Provider>
  );
}

/** #1037：fixture 模式的自我声明 chip——底部居中悬浮、pointer-events-none
 *  （一个模式提示自己绝不能成为下一个点不动的控件）、z 档压在 dialog 族
 *  （z-50）与 chief 悬浮窗（--z-floating）之下：模态开着时让位，关层即回。
 *  仅 fixture 模式渲染（isFixtureMode = scenario 机制存活位 + URL 带参），
 *  生产 build 编译期折叠恒不可见。 */
function FixtureModeChip({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <div className="fixture-mode-chip pointer-events-none fixed bottom-2 left-1/2 z-40 -translate-x-1/2 rounded-full bg-popover px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/10">
      {t('示例数据（scenario {id}）', { id })}
    </div>
  );
}
