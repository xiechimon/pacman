// 开始任务单出口（#640 / r14 §5.7，用户 2026-10-02 裁决：入口不再给
// 「先做规划/立即执行」与指派选择，编排为唯一默认路径）。三个 live 入口
// 共用一条发射路径：board 卡片 开始/拖入执行中、detail 主按钮、新建对话框
// 保存并开始——POST /todos/:id/orchestrate 直发总管编排回合。
// T0 反馈（r12 §5.3 / r14 §5.4「我的东西去哪了」）：短命 toast + 查看会话
// 动作（board `?chief=<threadId>` 深链，XMON-106 机制）；失败同样 toast
// 显性化（#631 律：server 原因进 description 透传不翻译）。
// 深链竞态护栏：新线程必须先进 chiefThreads 缓存再导航——深链消费等
// isSuccess，陈旧成功集会 idx=-1 静默吃掉参数（use-chief-surface 消费律），
// 故 onSuccess 先把响应里的 thread 行 seed 进查询缓存。

import type { ChiefThread } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useApiMutations } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { useI18n } from '../i18n/provider.js';

export interface OrchestrateStart {
  /** 发射一次编排回合（在飞时忽略重入——双击 = 一轮）。live 专属。 */
  orchestrate: (todoId: string, opts?: { savedTitle?: string }) => void;
  /** 在飞的 todo id（null = 空闲）——主按钮禁用位。 */
  pendingId: string | null;
}

export function useOrchestrateStart(): OrchestrateStart {
  const { live, teamId } = useLiveData();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutations = useApiMutations(teamId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const orchestrate = useCallback(
    (todoId: string, opts?: { savedTitle?: string }) => {
      if (!live || inFlight.current) return;
      inFlight.current = true;
      setPendingId(todoId);
      mutations.orchestrateTodo.mutate(todoId, {
        onSuccess: (res) => {
          // 深链竞态护栏（文件头）：先 seed 线程缓存再进 toast 动作。
          queryClient.setQueryData<ChiefThread[]>(['chiefThreads', teamId], (old) =>
            old === undefined
              ? [res.thread]
              : [res.thread, ...old.filter((x) => x.id !== res.thread.id)],
          );
          const threadId = res.thread.id;
          toast.success(opts?.savedTitle ?? t('已交给总管编排'), {
            description: t('总管将直接规划，并按活的类型派发执行。'),
            action: {
              label: t('查看会话'),
              onClick: () => navigate(`/app?chief=${encodeURIComponent(threadId)}`),
            },
          });
        },
        onError: (error) => {
          const reason = error instanceof Error && error.message !== '' ? error.message : null;
          toast.error(t('未能开始编排'), reason !== null ? { description: reason } : undefined);
        },
        onSettled: () => {
          inFlight.current = false;
          setPendingId(null);
        },
      });
    },
    [live, teamId, mutations.orchestrateTodo, queryClient, navigate, t],
  );

  return { orchestrate, pendingId };
}
