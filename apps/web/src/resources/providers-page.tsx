// 模型服务 route（#356，spec 11 §A1-A4/A7）：runtime tablist（pi / Claude
// Code），tab 状态同步 ?runtime= search param（刷新/分享/深链回定位）。
// pacman 是 local-first，自身不提供远程模型服务——页面 = 各 runtime
// 的模型来源直读：pi 段 = 用户经「添加服务商」配置的 custom provider 的
// models[] 投影；claude-code 段 = 各执行机 daemon 读本机
// ~/.claude/settings.json 经 presence/enroll 上报、server 按机器聚合
// （#707；缺失/解析失败 → header 转「未安装」指引态，不空报不崩）。
// 每 tab = header 卡（runtime 名 + 一行说明 +
// 安装态）+ 模型行（显示名 → 模型 id）；claude-code tab 按机器分段
// （每台机器一张 header 卡 + 模型行）；「Pacman（内置）」facade 行与
// 38 项 preset 列表行已除（数据层全留，preset 仅在添加服务商 picker
// dialog 内出现，A5/A6）。A7 行可点感收编：模型行纯展示无 handler，
// 不渲染 chevron/三点装饰。
// #231 OAuth 着陆面：callback 302 回跳带 ?oauth=connected|error——error
// 自动重开添加弹窗并把 reason 文案喂进 connectError 行；connected 静默。
// #243：reason 三路 = denied（用户取消）/ exchange（交换失败）/ state
// （state 缺或过期——原裸 400 JSON 面退役，同律 302 着陆）。
import { MODEL_SOURCE_RUNTIMES, type ModelSource, type ModelSourceRuntime } from '@pacman/shared';
import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useModelSources } from '../api/hooks.js';
import { RUNTIME_LABELS } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { ClaudeMark, PiMark } from '../components/brand-marks.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { toastError } from '../components/ui/toaster.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { oauthReasonCopy } from '../i18n/oauth-reason.js';
import { useI18n } from '../i18n/provider.js';
import {
  SEG_GROUP_CLS,
  SEG_TAB_ACTIVE_CLS,
  SEG_TAB_CLS,
  SEG_TAB_IDLE_CLS,
} from '../pages/parts.js';
import { CreateProviderDialog } from './create-provider-dialog.js';
import { GroupCard, RowDesc, RowLine, RowText, RowTitle } from './parts.js';
import { ResourceShell } from './shell.js';

export const PROVIDERS_HREF = '/app/resources/providers';

// tab 文案 = RUNTIME_LABELS（api/mappers.ts 单源，spec 11 §A1：无「内置」
// 字样；品牌/runtime 名不译，chief 压缩模型选择器同源消费）。

/** runtime 一行说明（A2 header 卡）；词表闭包 = MODEL_SOURCE_RUNTIMES。 */
const RUNTIME_DESCRIPTIONS: Record<ModelSourceRuntime, string> = {
  pi: 'pacman 自有运行时。模型来自你添加的服务商。',
  'claude-code': '执行机 Claude Code 配置（~/.claude/settings.json）的模型槽。',
};

/** runtime → 官方品牌 mark（components/brand-marks.tsx 单源，机器行
 * RUNTIME_MARKS 同源消费）。键集钉 ModelSourceRuntime：词表扩项时此处
 * 编译期报错，不会静默退化成无 mark 的 tab。 */
const RUNTIME_MARKS: Record<ModelSourceRuntime, typeof PiMark> = {
  pi: PiMark,
  'claude-code': ClaudeMark,
};

const isRuntime = (value: string | null): value is ModelSourceRuntime =>
  value !== null && (MODEL_SOURCE_RUNTIMES as readonly string[]).includes(value);

/** ?runtime= 解析：缺省/未知值一律落 pi（A1 默认 tab）。 */
function parseRuntime(searchParams: URLSearchParams): ModelSourceRuntime {
  const raw = searchParams.get('runtime');
  return isRuntime(raw) ? raw : 'pi';
}

/** A2 header 卡：runtime 名 + 一行说明 + 安装态。安装态两分支（A4）：
 *  installed → 「已安装在 <hostname>」；否则 → 「未安装」+ 安装指引。
 *  data-testid="runtime-head" = #910 二级结构载体（卡片无 role，几何与
 *  安装态断言的锚；data-runtime 继续做 runtime 维度筛选）。 */
function RuntimeHead({ source }: { source: ModelSource }) {
  const { t } = useI18n();
  return (
    <div
      data-testid="runtime-head"
      data-runtime={source.runtime}
      className="mt-4 rounded-(--radius-popover) border border-(--border) bg-(--secondary) px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 font-semibold text-(--foreground)">
          {RUNTIME_LABELS[source.runtime]}
        </span>
        {source.installed ? (
          <span className="text-xs leading-4 text-(--text-tertiary)">
            {t('已安装在 {hostname}', { hostname: source.hostname })}
          </span>
        ) : (
          <span className="text-xs leading-4 text-(--tile-orange-fg)">{t('未安装')}</span>
        )}
      </div>
      <p className="mt-1 mb-0 text-xs leading-4 text-(--text-tertiary)">
        {t(RUNTIME_DESCRIPTIONS[source.runtime])}
      </p>
      {!source.installed && (
        <p className="mt-1.5 mb-0 text-xs leading-4 text-(--text-tertiary)">
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
  // #707：claude-code 段按机器分段——同 runtime 可多段（每台机器一段），
  // pi 恒一段。单机形态下 matching 恰一段，与旧单段渲染等价。
  const matching = sources.filter((source) => source.runtime === runtime);
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
      // #243 reason 三路分译单源 = i18n/oauth-reason.ts（#361 两着陆面共用）。
      setConnectError(oauthReasonCopy(searchParams.get('reason'), t));
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
      {/* #423 Tabs 收编（#422 裁决：runtime tab 由 ?runtime= 驱动）：受控
          value/onValueChange 落回原 selectRuntime（写 ?runtime=、历史入栈、
          回退键可用），role=tablist/tab 与 aria-selected 由 Base UI 承载，
          data-runtime 句柄原样透出（.res-tabs/.res-tab 类名句柄随 #944
          per-face 清零退役——spec 载体 = role/文案/data-runtime）。
          XMON-73：形态 = 分段控制器；#946 起皮肤正本 = pages/parts 的
          SEG_* 配方（原 pages.css .page-tabs-group/.page-tab 规则的
          utility 等值，与 topbar「任务|文件」同一份），本域不持有它。
          两 tab 前置各自品牌 mark
          （components/brand-marks.tsx，机器行 #503 同源消费；尺寸走
          tabs.tsx 基类的 size-4，此处只补 8px 的 mark/名间距）。mark
          aria-hidden，文案照常渲染——可访问名 = RUNTIME_LABELS，读屏与
          e2e 的 toHaveText('pi'/'Claude Code') 都不受影响。 */}
      <Tabs value={runtime} onValueChange={(value) => selectRuntime(value as ModelSourceRuntime)}>
        <TabsList aria-label={t('模型服务')} className={SEG_GROUP_CLS}>
          {MODEL_SOURCE_RUNTIMES.map((rt) => {
            const Mark = RUNTIME_MARKS[rt];
            return (
              <TabsTrigger
                key={rt}
                value={rt}
                data-runtime={rt}
                className={`${SEG_TAB_CLS} ${
                  rt === runtime ? SEG_TAB_ACTIVE_CLS : SEG_TAB_IDLE_CLS
                }`}
              >
                <Mark className="mr-2 block flex-none" />
                {RUNTIME_LABELS[rt]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {matching.map((source, si) => (
        // 多机同 hostname 时 header 文案可撞——key 用索引兜底保唯一。
        <div key={`${source.hostname}:${si}`}>
          <RuntimeHead source={source} />
          {source.models.length > 0 ? (
            <GroupCard>
              {source.models.map((model, i) => (
                <div
                  // pi 段跨 provider 平铺，模型 id 偶发撞名——索引兜底保唯一。
                  key={`${model.id}:${i}`}
                  className={cn(
                    'flex min-h-[52px] items-center px-4 py-2',
                    i > 0 && 'border-t border-(--border)',
                  )}
                  data-runtime={source.runtime}
                  data-model-id={model.id}
                >
                  <RowText className="ml-0">
                    <RowLine>
                      <RowTitle>{model.name}</RowTitle>
                      {/* #423 Badge 收编（#422 裁决）：橙色 slot tag = 无底
                          无框无垫的纯文字 tag，Badge outline 档的 border/pad/
                          几何就地并掉（原 .res-tag per-face 形等值迁移）。 */}
                      {model.slot != null && (
                        <Badge
                          variant="outline"
                          className="h-auto rounded-none border-none bg-transparent p-0 text-xs leading-4 font-normal text-(--tile-orange-fg)"
                        >
                          {model.slot}
                        </Badge>
                      )}
                    </RowLine>
                    <RowDesc>{model.id}</RowDesc>
                  </RowText>
                </div>
              ))}
            </GroupCard>
          ) : source.runtime === 'pi' ? (
            // A3 空态：引导开添加服务商 picker（picker 面见
            // verify features/provider-picker.md）。data-testid =
            // #910 二级结构载体（原 .res-runtime-empty）。
            <div
              data-testid="runtime-empty"
              className="mt-4 rounded-lg border border-dashed border-(--input) px-4 py-6"
            >
              <p className="m-0 text-[13px] leading-5 text-(--text-tertiary)">
                {t('尚未添加服务商。添加后，服务商的模型会出现在这里。')}
              </p>
              {/* #423 原语消费点切换（#422 清单）：轨 A3 ui/Button primary/
                  compact → components/ui Button default/sm（A3 等价档，
                  button.tsx 偏离注 3）；12px 垫/13px 常规字重是 A3 compact
                  同值的消费面差异（原 .res-runtime-empty-action 等值）。 */}
              <Button
                size="sm"
                className="mt-3 px-3 text-[13px] font-normal"
                onClick={() => setCreateOpen(true)}
              >
                {t('添加模型服务')}
              </Button>
            </div>
          ) : (
            source.installed && (
              <div
                data-testid="runtime-empty"
                className="mt-4 rounded-lg border border-dashed border-(--input) px-4 py-6"
              >
                <p className="m-0 text-[13px] leading-5 text-(--text-tertiary)">
                  {t('settings.json 未配置模型槽。')}
                </p>
              </div>
            )
          )}
        </div>
      ))}
      {matching.length === 0 && (
        // #707：尚无执行机上报过（旧 daemon / 未注册）——缺席不断言未安装。
        <div
          data-testid="runtime-empty"
          className="mt-4 rounded-lg border border-dashed border-(--input) px-4 py-6"
        >
          <p className="m-0 text-[13px] leading-5 text-(--text-tertiary)">
            {t('尚无执行机上报模型信息。')}
          </p>
        </div>
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
                  // #638：失败 = 弹窗留着但零反馈（connectError 行是 OAuth
                  // 专属语义位，不复用）——toast 点名。
                  onError: (error) => toastError(t('添加模型服务失败，请重试。'), error),
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
