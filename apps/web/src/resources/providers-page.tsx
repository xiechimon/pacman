// 模型服务 route（#356，spec 11 §A1-A4/A7）：runtime tablist（pi / Claude
// Code），tab 状态同步 ?runtime= search param（刷新/分享/深链回定位）。
// pacman 是 local-first，自身不提供远程模型服务——页面 = 本机各 runtime
// 的模型来源直读：pi 段 = 用户经「添加服务商」配置的 custom provider 的
// models[] 投影；claude-code 段 = server 端 fs 直读本机
// ~/.claude/settings.json 的模型槽（缺失/解析失败 → header 转「未安装」
// 指引态，不空报不崩）。每 tab = header 卡（runtime 名 + 一行说明 +
// 安装态）+ 模型行（显示名 → 模型 id）；「Pacman（内置）」facade 行与
// 38 项 preset 列表行已除（数据层全留，preset 仅在添加服务商 picker
// dialog 内出现，A5/A6）。A7 行可点感收编：模型行纯展示无 handler，
// 不渲染 chevron/三点装饰。
// #231 OAuth 着陆面：callback 302 回跳带 ?oauth=connected|error——error
// 自动重开添加弹窗并把 reason 文案喂进 connectError 行；connected 静默。
// #243：reason 三路 = denied（用户取消）/ exchange（交换失败）/ state
// （state 缺或过期——原裸 400 JSON 面退役，同律 302 着陆）。
import { MODEL_SOURCE_RUNTIMES, type ModelSource, type ModelSourceRuntime } from '@pacman/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useModelSources } from '../api/hooks.js';
import { RUNTIME_LABELS } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Button } from '../ui/button.js';
import { CreateProviderDialog } from './create-provider-dialog.js';
import { ResourceShell } from './shell.js';

export const PROVIDERS_HREF = '/app/resources/providers';

// tab 文案 = RUNTIME_LABELS（api/mappers.ts 单源，spec 11 §A1：无「内置」
// 字样；品牌/runtime 名不译，chief 压缩模型选择器同源消费）。

/** runtime 一行说明（A2 header 卡）；词表闭包 = MODEL_SOURCE_RUNTIMES。 */
const RUNTIME_DESCRIPTIONS: Record<ModelSourceRuntime, string> = {
  pi: 'pacman 自有运行时。模型来自你添加的服务商。',
  'claude-code': '本机 Claude Code 配置（~/.claude/settings.json）的模型槽。',
};

const isRuntime = (value: string | null): value is ModelSourceRuntime =>
  value !== null && (MODEL_SOURCE_RUNTIMES as readonly string[]).includes(value);

/** ?runtime= 解析：缺省/未知值一律落 pi（A1 默认 tab）。 */
function parseRuntime(searchParams: URLSearchParams): ModelSourceRuntime {
  const raw = searchParams.get('runtime');
  return isRuntime(raw) ? raw : 'pi';
}

/** A2 header 卡：runtime 名 + 一行说明 + 安装态。安装态两分支（A4）：
 *  installed → 「已安装在 <hostname>」；否则 → 「未安装」+ 安装指引。 */
function RuntimeHead({ source }: { source: ModelSource }) {
  const { t } = useI18n();
  return (
    <div className="res-runtime-head" data-runtime={source.runtime}>
      <div className="res-runtime-head-line">
        <span className="res-runtime-head-name">{RUNTIME_LABELS[source.runtime]}</span>
        {source.installed ? (
          <span className="res-runtime-head-status">
            {t('已安装在 {hostname}', { hostname: source.hostname })}
          </span>
        ) : (
          <span className="res-runtime-head-status res-runtime-head-status--missing">
            {t('未安装')}
          </span>
        )}
      </div>
      <p className="res-runtime-head-desc">{t(RUNTIME_DESCRIPTIONS[source.runtime])}</p>
      {!source.installed && (
        <p className="res-runtime-head-hint">
          {t('安装 Claude Code 并完成一次登录后，此处自动展示其模型槽。')}
        </p>
      )}
    </div>
  );
}

export function ProvidersPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const { live, teamId } = useLiveData();
  // live = GET model-sources 封套；fixture = scenario 资源集（canon 展示）。
  const sourcesQ = useModelSources(teamId, live);
  const sources = live
    ? (sourcesQ.data?.sources ?? [])
    : (fixture.resources?.providerSources ?? []);
  const runtime = parseRuntime(searchParams);
  const active = sources.find((source) => source.runtime === runtime);
  // 添加 (topbar 新建 / pi 空态引导钮) opens the picker dialog; live
  // submit = POST providers then close (invalidateAll refetches 两封套)，
  // fixture = accept 律
  const mutations = useApiMutations(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  // #231：连接订阅失败 inline 行（authorize 400 原文 / 落地 reason 文案）。
  const [connectError, setConnectError] = useState<string | null>(null);

  // OAuth callback 着陆参（?oauth=connected|error&reason=…）：error 重开弹窗
  // 喂文案；读后清参，刷新不重放。只删 oauth/reason 两键——scenario/runtime
  // 等其余参保留，不翻动 fixture/live 判定与 tab 定位。
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

  // tab 切换 = 写 ?runtime=（保留 scenario 等其余参）；历史入栈，回退键可用。
  const selectRuntime = (next: ModelSourceRuntime) => {
    const params = new URLSearchParams(searchParams);
    params.set('runtime', next);
    setSearchParams(params);
  };

  return (
    <ResourceShell
      title="模型服务"
      href={PROVIDERS_HREF}
      backHref="/app"
      selected={PROVIDERS_HREF}
      onNew={() => setCreateOpen(true)}
      fixture={fixture}
    >
      <div className="res-tabs" role="tablist" aria-label={t('模型服务')}>
        {MODEL_SOURCE_RUNTIMES.map((rt) => (
          <button
            key={rt}
            type="button"
            role="tab"
            data-runtime={rt}
            aria-selected={runtime === rt}
            className="res-tab"
            onClick={() => selectRuntime(rt)}
          >
            {RUNTIME_LABELS[rt]}
          </button>
        ))}
      </div>
      {active != null && (
        <>
          <RuntimeHead source={active} />
          {active.models.length > 0 ? (
            <div className="res-card res-group">
              {active.models.map((model, i) => (
                <div
                  // pi 段跨 provider 平铺，模型 id 偶发撞名——索引兜底保唯一。
                  key={`${model.id}:${i}`}
                  className={`res-model-row${i > 0 ? ' res-model-row--divided' : ''}`}
                  data-runtime={active.runtime}
                  data-model-id={model.id}
                >
                  <span className="res-row-text">
                    <span className="res-row-line">
                      <span className="res-row-title">{model.name}</span>
                      {model.slot != null && <span className="res-tag">{model.slot}</span>}
                    </span>
                    <span className="res-row-desc">{model.id}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : active.runtime === 'pi' ? (
            // A3 空态：引导开添加服务商 picker（picker 面见
            // verify features/provider-picker.md）。
            <div className="res-runtime-empty">
              <p className="res-runtime-empty-text">
                {t('尚未添加服务商。添加后，服务商的模型会出现在这里。')}
              </p>
              <Button
                variant="primary"
                size="compact"
                className="res-runtime-empty-action"
                onClick={() => setCreateOpen(true)}
              >
                {t('添加模型服务')}
              </Button>
            </div>
          ) : (
            active.installed && (
              <div className="res-runtime-empty">
                <p className="res-runtime-empty-text">{t('settings.json 未配置模型槽。')}</p>
              </div>
            )
          )}
        </>
      )}
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
