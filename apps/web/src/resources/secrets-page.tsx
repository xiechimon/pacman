// 密钥 route (issue #69, r7 10): the capture — and the only recorded state
// of this surface — is the empty state: 48px hero key tile, heading,
// write-only description, 添加密钥 primary + 查看文档, 总管 hint row.
// (r2 §6.3 records the add dialog; the row list was never captured.)
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { KeyThin } from '../icons/index.js';
import { EmptyState } from './parts.js';
import { ResourceShell } from './shell.js';

export const SECRETS_HREF = '/app/resources/secrets';

export function SecretsPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);

  return (
    <ResourceShell title="密钥" href={SECRETS_HREF} backHref="/app" fixture={fixture}>
      <EmptyState
        Icon={KeyThin}
        title="尚无密钥。"
        description="团队密钥将以环境变量注入每个任务的 shell。值只写不读：保存后只能覆盖或删除，无法再次查看。"
        actionLabel="添加密钥"
        hint="也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话。"
      />
    </ResourceShell>
  );
}
