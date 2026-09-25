// 模型服务 route (issue #69, r7 07): grouped card with the built-in
// `Pacman（内置）` row (indigo sparkle tile, model count, 未启用 pill) above
// custom gateway rows (orange layers tile, orange 自定义 tag, overflow
// dots instead of the pill).
// #231 OAuth 着陆面：callback 302 回跳带 ?oauth=connected|error——error
// 自动重开添加弹窗并把 reason 文案喂进 connectError 行；connected 静默
// （新行已在首取真值里）。读后清参，刷新不重放。
// #243：reason 三路 = denied（用户取消）/ exchange（交换失败）/ state
// （state 缺或过期——原裸 400 JSON 面退役，同律 302 着陆）。
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useProviders } from '../api/hooks.js';
import { mapProviders } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { EllipsisVertical, Layers, Sparkle } from '../icons/index.js';
import { CreateProviderDialog } from './create-provider-dialog.js';
import { RowChevron, StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const PROVIDERS_HREF = '/app/resources/providers';

export function ProvidersPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：GET providers 封套（presets+providers）→ 内置行 + 自定义行。
  const { live, teamId } = useLiveData();
  const providersQ = useProviders(teamId, live);
  const providers = live
    ? mapProviders(providersQ.data?.providers ?? [])
    : (fixture.resources?.providers ?? []);
  // wayfinder #175: 添加 (topbar 新建) opens the add-provider dialog; live
  // submit = POST providers then close (invalidateAll refetches the rows),
  // fixture = accept 律
  const mutations = useApiMutations(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  // #231：连接订阅失败 inline 行（authorize 400 原文 / 落地 reason 文案）。
  const [connectError, setConnectError] = useState<string | null>(null);

  // OAuth callback 着陆参（?oauth=connected|error&reason=…）：error 重开弹窗
  // 喂文案；读后清参，刷新不重放。只删 oauth/reason 两键——scenario 等其余
  // 参保留，不翻动 fixture/live 判定。
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === null) return;
    if (oauth === 'error') {
      const reason = searchParams.get('reason');
      // #243 reason 三路分译；未知值落 exchange 兜底（与 #231 原else 行为同）。
      const copy =
        reason === 'denied'
          ? t('授权已被取消。')
          : reason === 'state'
            ? t('连接已过期，请重新发起。')
            : t('令牌交换失败，请稍后重试。');
      setConnectError(copy);
      setCreateOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('oauth');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  return (
    <ResourceShell
      title="模型服务"
      href={PROVIDERS_HREF}
      backHref="/app"
      selected={PROVIDERS_HREF}
      onNew={() => setCreateOpen(true)}
      fixture={fixture}
    >
      <div className="res-card res-group">
        {providers.map((provider, i) => (
          <div className={`res-grow${i > 0 ? ' res-grow--divided' : ''}`} key={provider.name}>
            <Tile
              Icon={provider.custom === true ? Layers : Sparkle}
              size="lg"
              tone={provider.custom === true ? 'orange' : 'indigo'}
            />
            <span className="res-row-text">
              <span className="res-row-line">
                <span className="res-row-title">{t(provider.name)}</span>
                {provider.custom === true && <span className="res-tag">{t('自定义')}</span>}
              </span>
              <span className="res-row-desc">{t(provider.models)}</span>
            </span>
            {provider.pill != null && <StatusPill label={provider.pill} />}
            {provider.custom === true && (
              <span className="res-row-more">
                <EllipsisVertical width={16} height={16} />
              </span>
            )}
            <RowChevron />
          </div>
        ))}
      </div>
      <CreateProviderDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setConnectError(null);
        }}
        pending={mutations.createProvider.isPending}
        onCreate={
          live
            ? (body) =>
                mutations.createProvider.mutate(body, {
                  onSuccess: () => setCreateOpen(false),
                })
            : undefined
        }
        onConnect={
          live
            ? (presetId) => {
                setConnectError(null);
                mutations.startProviderOAuth.mutate(presetId, {
                  // 成功 = 同页签跳授权页;dialog 随整页导航退场。
                  onSuccess: (data) => window.location.assign(data.authorizationUrl),
                  onError: (err) => setConnectError(err.message),
                });
              }
            : undefined
        }
        connectPending={mutations.startProviderOAuth.isPending}
        connectError={connectError}
      />
    </ResourceShell>
  );
}
