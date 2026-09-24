// 添加模型服务 dialog (wayfinder #175, r8 75 built-in detail as the family
// reference; geometry [推断] per family form — capture PNGs unreadable on
// this API line; field authority = server createProviderBodySchema / r3 §2):
// rides DialogShell (#68 family law — X / Esc / backdrop). Fields in the
// r3 §2 observed order: 服务商 ID / 名称 / Base URL / API 协议 (three-
// protocol segment, default OpenAI Completions [推断]) / API 密钥 (可选,
// 只写不读 02 §8 — the key never echoes back) + Bearer 复选 (default on,
// r3 §2 sample value and the server default) / 模型 rows (name mirrors id —
// r3 §2 display=slug 同名). 探测模型 / 保存前验证 omitted: the replica has
// no probe/validate endpoint (observed r3 §2, unwired); compat omitted:
// absent from the ticket/map word lists, the server default
// {supportsDeveloperRole:false} stands. Live submit =
// mutations.createProvider (POST /api/teams/:id/providers); fixture follows
// the accept-dialog 律 (#148: close on submit). State resets on the
// open→false edge, not on submit: live mode only closes on success, so a
// failed POST (e.g. providerId 409) keeps the user's input.
// #193: the #175 scroll pin (body scrolls, submit outside) folded into
// DialogShell — the submit rides the `footer` slot, fields ride .dlg-body.

import type { ProviderApi } from '@pacman/shared';
import { useEffect, useState } from 'react';
import { DialogShell } from '../detail/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import { CheckWhite, PlusSmall } from '../icons/index.js';

/** API 协议段（r3 §2 实测文案与顺序；wire 值 = providerApiSchema）。 */
const API_OPTIONS: readonly { value: ProviderApi; label: string }[] = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
];

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
}

export function CreateProviderDialog({
  open,
  onClose,
  pending,
  onCreate,
}: CreateProviderDialogProps) {
  const { t } = useI18n();
  const [providerId, setProviderId] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [api, setApi] = useState<ProviderApi>('openai-completions');
  const [apiKey, setApiKey] = useState('');
  const [authHeader, setAuthHeader] = useState(true);
  const [modelIds, setModelIds] = useState<string[]>([]);

  const ready = providerId.trim() !== '' && label.trim() !== '' && baseUrl.trim() !== '';

  // open→false 边重置：live 失败（不关窗）输入保全；任何关闭路径后重开皆干净。
  useEffect(() => {
    if (open) return;
    setProviderId('');
    setLabel('');
    setBaseUrl('');
    setApi('openai-completions');
    setApiKey('');
    setAuthHeader(true);
    setModelIds([]);
  }, [open]);

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
        <div className="dlg-provider-foot">
          <button
            type="button"
            className="dlg-provider-create"
            disabled={!ready || pending === true}
            onClick={submit}
          >
            {t('添加模型服务')}
          </button>
        </div>
      }
    >
      <div className="dlg-provider">
        <label className="dlg-field-label" htmlFor="dlg-provider-id">
          {t('服务商 ID')}
        </label>
        <input
          id="dlg-provider-id"
          className="dlg-provider-input"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          placeholder={t('例如 my-relay')}
        />
        <label className="dlg-field-label" htmlFor="dlg-provider-label">
          {t('名称')}
        </label>
        <input
          id="dlg-provider-label"
          className="dlg-provider-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <label className="dlg-field-label" htmlFor="dlg-provider-baseurl">
          Base URL
        </label>
        <input
          id="dlg-provider-baseurl"
          className="dlg-provider-input"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://api.example.com/v1"
        />
        <div className="dlg-field-label">{t('API 协议')}</div>
        <div className="dlg-provider-seg" role="tablist" aria-label={t('API 协议')}>
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
        <label className="dlg-field-label" htmlFor="dlg-provider-apikey">
          {t('API 密钥')}
        </label>
        <input
          id="dlg-provider-apikey"
          className="dlg-provider-input"
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
        <div className="dlg-provider-note">{t('密钥将加密存储，保存后无法再次查看。')}</div>
        <div className="dlg-field-label">{t('模型（可选）')}</div>
        {modelIds.map((id, i) => (
          <input
            key={i}
            className="dlg-provider-input"
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
    </DialogShell>
  );
}
