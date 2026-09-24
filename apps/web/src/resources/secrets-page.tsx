// 密钥 route (issue #69, r7 10): the capture — and the only recorded state
// of this surface — is the empty state: 48px hero key tile, heading,
// write-only description, 添加密钥 primary + 查看文档, 总管 hint row.
// (r2 §6.3 records the add dialog; the row list was never captured.)
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useSecrets } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { KeyThin } from '../icons/index.js';
import { CreateSecretDialog } from './create-secret-dialog.js';
import { EmptyState, RowChevron, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const SECRETS_HREF = '/app/resources/secrets';

export function SecretsPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：GET secrets（只读掩码面，02 §8 值只写不读）。有行 = 复用
  // 资源行卡语言（r7 08 同款 res-card 行；行列表无观测截图，r7 10 仅空态
  // ——[设计] 呈现，04 §3 口径）；fixture 面保持 r7 10 空态字节不变。
  const { live, teamId } = useLiveData();
  const secretsQ = useSecrets(teamId, live);
  const secrets = live ? (secretsQ.data ?? []) : [];
  // wayfinder #173: 新建 (topbar + empty-state primary) opens the
  // 添加密钥 dialog; live submit = POST secrets then close
  // (invalidateAll refetches the masked rows), fixture = accept 律
  const mutations = useApiMutations(teamId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <ResourceShell
      title="密钥"
      href={SECRETS_HREF}
      backHref="/app"
      selected={SECRETS_HREF}
      onNew={() => setCreateOpen(true)}
      fixture={fixture}
    >
      {secrets.length === 0 ? (
        <EmptyState
          Icon={KeyThin}
          title="尚无密钥。"
          description="团队密钥将以环境变量注入每个任务的 shell。值只写不读：保存后只能覆盖或删除，无法再次查看。"
          actionLabel="添加密钥"
          onAction={() => setCreateOpen(true)}
          hint="也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话。"
        />
      ) : (
        secrets.map((secret) => (
          <div className="res-card res-rowcard" key={secret.id}>
            <Tile Icon={KeyThin} size="sm" tone="orange" />
            <span className="res-row-text">
              <span className="res-row-title">{secret.name}</span>
              {secret.description != null && (
                <span className="res-row-desc res-row-desc--strong">{secret.description}</span>
              )}
            </span>
            <RowChevron />
          </div>
        ))
      )}
      <CreateSecretDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={
          live
            ? (input) =>
                mutations.createSecret.mutate(input, {
                  onSuccess: () => setCreateOpen(false),
                })
            : undefined
        }
      />
    </ResourceShell>
  );
}
