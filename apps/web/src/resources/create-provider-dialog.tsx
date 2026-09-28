// 添加模型服务 dialog（#355，spec 11 §A6 picker 形态）：搜索框 + 38 行
// preset + 底部「自定义端点」入口。preset 目录 wire 真值仅 {id, auth,
// oauthLabel}（r3 §2 盘点序 = server providerPresets() 原样；目录外字段
// baseUrl/api 未采不发明）→ 显示名以 spec 11 实测 38 名表为文案源（品牌名
// 不译），api_key 行的「密钥表单」= 现有自定义表单（字段权威 = shared
// createProviderBodySchema / r3 §2）+ providerId/label 预填。
// OAuth 链（#231/#243）原样保留：徽标行 = shared PROVIDER_OAUTH_PRESET_IDS
// 两项，点击 = onConnect(preset id)——live 面 POST authorize → 同页签跳
// 授权页（族表外 preset 由 server 404，原文落错误行）；fixture 面 accept 律
// 关窗。失败 inline：connectError 行由 providers-page 喂入（authorize 400
// 原文 / callback 落地 reason 三译），本组件只渲染。xai 双通道：picker 行
// 无徽标，oauthLabel 展示在其密钥表单内（族表外无后端面，不做钮 #222）。
// Rides DialogShell（#68 family law — X / Esc / backdrop）。#193：字段骑
// .dlg-body，submit 骑 footer 槽；picker 面无必填字段 → 不渲染 footer
// （禁用态死 submit 不出现，#222）。State 重置在 open→false 边（live 失败
// 不关窗、输入保全）；form 视图每次进入 = 干净表单（入口边重置，列表 ↔
// 表单往返不带残值）。

import {
  PROVIDER_OAUTH_PRESET_IDS,
  PROVIDER_PRESET_IDS,
  PROVIDER_XAI_PRESET,
  type ProviderApi,
} from '@pacman/shared';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite, ChevronLeft, PlusSmall } from '../icons/index.js';
import { DialogShell } from '../ui/dialog-shell.js';
import { Input } from '../ui/input.js';

/** API 协议段（r3 §2 实测文案与顺序；wire 值 = providerApiSchema）。 */
const API_OPTIONS: readonly { value: ProviderApi; label: string }[] = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
];

/** 上游 38 项 preset 显示名（spec 11 §A6 实测名表，2026-09-28）。键型 =
 * 目录 id 联合——1:1 完整性由编译器钉（漏名/多名即 typecheck 红）。 */
const PRESET_LABELS: Record<(typeof PROVIDER_PRESET_IDS)[number], string> = {
  'github-copilot': 'GitHub Copilot',
  'openai-codex': 'OpenAI Codex',
  xai: 'xAI',
  'amazon-bedrock': 'Amazon Bedrock',
  'ant-ling': 'Ant Ling',
  anthropic: 'Anthropic',
  baseten: 'Baseten',
  cerebras: 'Cerebras',
  'cloudflare-ai-gateway': 'Cloudflare AI Gateway',
  'cloudflare-workers-ai': 'Cloudflare Workers AI',
  deepseek: 'DeepSeek',
  fireworks: 'Fireworks',
  google: 'Google',
  'google-vertex': 'Google Vertex AI',
  groq: 'Groq',
  huggingface: 'Hugging Face',
  'kimi-coding': 'Kimi For Coding',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax CN',
  mistral: 'Mistral',
  moonshotai: 'Moonshot AI',
  'moonshotai-cn': 'Moonshot AI CN',
  nvidia: 'NVIDIA',
  openai: 'OpenAI',
  opencode: 'OpenCode Zen',
  'opencode-go': 'OpenCode Go',
  openrouter: 'OpenRouter',
  'qwen-token-plan': 'Qwen Token Plan',
  'qwen-token-plan-cn': 'Qwen Token Plan CN',
  'qwen-token-plan-individual': 'Qwen Token Plan Individual',
  together: 'Together',
  'vercel-ai-gateway': 'Vercel AI Gateway',
  xiaomi: 'Xiaomi',
  'xiaomi-token-plan-ams': 'Xiaomi Token Plan AMS',
  'xiaomi-token-plan-cn': 'Xiaomi Token Plan CN',
  'xiaomi-token-plan-sgp': 'Xiaomi Token Plan SGP',
  'z-ai': 'Z.AI',
  'z-ai-coding-cn': 'Z.AI Coding CN',
};

/** picker 行（静态投影，目录序 = wire 序）。oauth 位 = 徽标 + 点击分支；
 * 展宽 readonly string[] = .includes 收下 38-id 联合的入参位。 */
const PRESET_ROWS = PROVIDER_PRESET_IDS.map((id) => ({
  id,
  label: PRESET_LABELS[id],
  oauth: (PROVIDER_OAUTH_PRESET_IDS as readonly string[]).includes(id),
}));

interface CreateProviderDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** Live 提交进行中（mutation isPending）——禁用 submit 防双击重发。 */
  pending?: boolean;
  /** M5 live 面：添加 = POST providers；缺省 = fixture 律（提交即关）。 */
  onCreate?: (body: {
    providerId: string;
    label: string;
    baseUrl: string;
    api: ProviderApi;
    authHeader?: boolean;
    models?: { id: string; name: string }[];
    apiKey?: string;
  }) => void;
  /** #231 live 面：OAuth 徽标行 = POST authorize → 同页签跳授权页；缺省 =
   *  fixture 律（点连接即关窗，等价 accept）。 */
  onConnect?: (presetId: string) => void;
  /** authorize POST 进行中——禁用徽标行防重发。 */
  connectPending?: boolean;
  /** 连接失败 inline 行（authorize 400 原文 / callback 落地 reason 文案）；
   *  null/缺省 = 无错误。 */
  connectError?: string | null;
}

export function CreateProviderDialog({
  open,
  onClose,
  pending,
  onCreate,
  onConnect,
  connectPending,
  connectError,
}: CreateProviderDialogProps) {
  const { t } = useI18n();
  const [view, setView] = useState<'picker' | 'form'>('picker');
  const [query, setQuery] = useState('');
  /** form 视图入口：null = 自定义端点；否则 = api_key preset（预填身份 +
   * xai oauthLabel note 判定位）。 */
  const [preset, setPreset] = useState<{ id: string; label: string } | null>(null);
  const [providerId, setProviderId] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [api, setApi] = useState<ProviderApi>('openai-completions');
  const [apiKey, setApiKey] = useState('');
  const [authHeader, setAuthHeader] = useState(true);
  const [modelIds, setModelIds] = useState<string[]>([]);

  const ready = providerId.trim() !== '' && label.trim() !== '' && baseUrl.trim() !== '';

  // open→false 边重置：live 失败（不关窗）输入保全；任何关闭路径后重开皆
  // 干净 picker 面。
  useEffect(() => {
    if (open) return;
    setView('picker');
    setQuery('');
    setPreset(null);
    setProviderId('');
    setLabel('');
    setBaseUrl('');
    setApi('openai-completions');
    setApiKey('');
    setAuthHeader(true);
    setModelIds([]);
  }, [open]);

  const rows =
    query.trim() === ''
      ? PRESET_ROWS
      : PRESET_ROWS.filter((row) => {
          const q = query.trim().toLowerCase();
          return row.label.toLowerCase().includes(q) || row.id.includes(q);
        });

  /** form 视图入口边 = 干净表单 + 按入口预填（自定义端点空值；preset 行落
   * 身份两字段，baseUrl/api 目录未采留用户填）。 */
  const enterForm = (entry: { id: string; label: string } | null) => {
    setPreset(entry);
    setProviderId(entry?.id ?? '');
    setLabel(entry?.label ?? '');
    setBaseUrl('');
    setApi('openai-completions');
    setApiKey('');
    setAuthHeader(true);
    setModelIds([]);
    setView('form');
  };

  const submit = () => {
    if (!ready || pending === true) return;
    if (onCreate != null) {
      const models = modelIds
        .map((id) => id.trim())
        .filter((id) => id !== '')
        .map((id) => ({ id, name: id }));
      onCreate({
        providerId: providerId.trim(),
        label: label.trim(),
        baseUrl: baseUrl.trim(),
        api,
        authHeader,
        ...(models.length > 0 ? { models } : {}),
        // 空串 = 无密钥网关（「无密钥网关可留空」），不落 apiKey 字段。
        ...(apiKey !== '' ? { apiKey } : {}),
      });
    } else {
      onClose();
    }
  };

  return (
    <DialogShell
      title={t('添加模型服务')}
      open={open}
      onClose={onClose}
      footer={
        view === 'form' ? (
          <div className="dlg-form-foot">
            <button
              type="button"
              className="dlg-provider-create"
              disabled={!ready || pending === true}
              onClick={submit}
            >
              {t('添加模型服务')}
            </button>
          </div>
        ) : undefined
      }
    >
      {view === 'picker' ? (
        <div className="dlg-form">
          <Input
            // dlg-picker-search = T0 契约句柄（verify features/provider-
            // picker.md 与 providers-tabs.md 的探针锚点）；dlg-provider-
            // search = #355 样式/e2e 钩。双挂收编两侧引用。
            className="dlg-form-input dlg-provider-search dlg-picker-search"
            aria-label={t('搜索服务商...')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('搜索服务商...')}
          />
          {/* #231 错误行：authorize 失败原文 / callback 落地 reason 三译
              （providers-page 喂入）。列表前渲染——着陆重开即可见。 */}
          {connectError != null && connectError !== '' && (
            <div className="dlg-provider-oauth-error">{connectError}</div>
          )}
          <div className="dlg-provider-list">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                // dlg-picker-row[data-preset-id] / dlg-picker-custom =
                // T0 契约句柄（verify features/provider-picker.md，类名以
                // map 为准）；dlg-provider-* = #355 样式/e2e 钩，双挂收编。
                className="dlg-provider-preset dlg-picker-row"
                data-preset-id={row.id}
                disabled={row.oauth && connectPending === true}
                onClick={() =>
                  row.oauth
                    ? onConnect != null
                      ? onConnect(row.id)
                      : onClose()
                    : enterForm({ id: row.id, label: row.label })
                }
              >
                {row.label}
                {/* T0 map：'(OAuth)' 后缀进名称文本（行 textContent 等值
                    断言，JSX 折叠换行空白故显式 {' '}）；xai 行不带后缀
                    （负向钉）。视觉间距由 badge 的 margin-left:auto 承担。 */}
                {row.oauth && <span className="dlg-provider-badge">{' (OAuth)'}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dlg-provider-custom dlg-picker-custom"
            onClick={() => enterForm(null)}
          >
            {t('自定义端点')}
          </button>
        </div>
      ) : (
        <div className="dlg-form">
          <button type="button" className="dlg-provider-back" onClick={() => setView('picker')}>
            <ChevronLeft width={12} height={12} />
            {t('返回')}
          </button>
          {/* xai 双通道（r3 §2）：oauthLabel 在密钥表单内展示；族表外无
              后端面 → note 不做钮（#222）。 */}
          {preset?.id === PROVIDER_XAI_PRESET.id && (
            <div className="dlg-form-note">{PROVIDER_XAI_PRESET.oauthLabel}</div>
          )}
          <label className="dlg-form-label" htmlFor="dlg-provider-id">
            {t('服务商 ID')}
          </label>
          <Input
            id="dlg-provider-id"
            className="dlg-form-input"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            placeholder={t('例如 my-relay')}
          />
          <label className="dlg-form-label" htmlFor="dlg-provider-label">
            {t('名称')}
          </label>
          <Input
            id="dlg-provider-label"
            className="dlg-form-input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <label className="dlg-form-label" htmlFor="dlg-provider-baseurl">
            Base URL
          </label>
          <Input
            id="dlg-provider-baseurl"
            className="dlg-form-input"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.example.com/v1"
          />
          <div className="dlg-form-label">{t('API 协议')}</div>
          <div className="dlg-form-seg" role="tablist" aria-label={t('API 协议')}>
            {API_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={api === option.value}
                className="dlg-provider-seg-tab"
                data-active={api === option.value}
                onClick={() => setApi(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="dlg-form-label" htmlFor="dlg-provider-apikey">
            {t('API 密钥')}
          </label>
          <Input
            id="dlg-provider-apikey"
            className="dlg-form-input"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t('无密钥网关可留空')}
          />
          <div className="dlg-provider-authrow">
            <label className="dlg-provider-check" data-on={authHeader}>
              <input
                id="dlg-provider-authheader"
                type="checkbox"
                checked={authHeader}
                onChange={(event) => setAuthHeader(event.target.checked)}
              />
              <CheckWhite width={12} height={12} />
            </label>
            <span className="dlg-provider-authlabel">
              {t('以 Authorization: Bearer 请求头发送 API 密钥')}
            </span>
          </div>
          <div className="dlg-form-note">{t('密钥将加密存储，保存后无法再次查看。')}</div>
          <div className="dlg-form-label">{t('模型（可选）')}</div>
          {modelIds.map((id, i) => (
            <Input
              key={i}
              className="dlg-form-input"
              aria-label={t('模型 ID')}
              value={id}
              placeholder="claude-sonnet-5"
              onChange={(event) =>
                setModelIds((rows) => rows.map((r, j) => (i === j ? event.target.value : r)))
              }
            />
          ))}
          <button
            type="button"
            className="dlg-provider-model-add"
            onClick={() => setModelIds((rows) => [...rows, ''])}
          >
            <PlusSmall width={12} height={12} />
            {t('添加模型')}
          </button>
        </div>
      )}
    </DialogShell>
  );
}
