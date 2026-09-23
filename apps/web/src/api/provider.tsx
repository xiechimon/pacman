// live 数据源桥（M5 汇合，#83）：路由树顶的 pathless layout——判定
// fixture/live 模式（api/mode.ts）、解析 seed team/用户（02 §2 恒一行）、
// 挂 team stream 全局订阅（SSE → invalidateQueries + 桌面通知，02 §1.2/§9.1）。
// fixture 模式下本桥完全惰性（不发请求、不开流），parity/dev 场景数据面
// 与既有行为字节一致。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSession, useTeams } from './hooks.js';
import { isFixtureMode } from './mode.js';
import { useTeamStream } from './sse.js';

export interface LiveData {
  /** true = 真 API 数据源；false = fixture（scenario）数据源。 */
  live: boolean;
  /** seed 团队 id（live 且 /api/teams 已解析）。 */
  teamId: string | undefined;
  /** seed 用户显示名（时间线 actor 拼装用，r3 §3.6）。 */
  userName: string;
}

const LiveDataContext = createContext<LiveData>({
  live: false,
  teamId: undefined,
  userName: '我',
});

export function useLiveData(): LiveData {
  return useContext(LiveDataContext);
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
    () => ({ live, teamId, userName: session.data?.displayName ?? '我' }),
    [live, teamId, session.data],
  );
  return (
    <LiveDataContext.Provider value={value}>
      <Outlet />
    </LiveDataContext.Provider>
  );
}
