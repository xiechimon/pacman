// API-keys route (issue #70): the empty state per r2 19 (icon tile +
// canon copy + 新建密钥 / 查看文档), and with a created key in the
// fixture the r3 §6 display rules — list row masked `pacman_afe07565…`
// (r3 样例原形前缀 tds_ 随品牌槽切换，#109)
// plus the one-time plaintext block carrying the 02 §8 canon
// 「请立即复制密钥，它仅显示一次。」. Row and one-time block shapes are
// [推断] (no capture: r2 §9-12, r3 §6 图失); mask and copy are observed.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiKeys, useApiMutations, useTodos } from '../api/hooks.js';
import { mapApiKeys, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, ExternalLink, Key } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';
import { ApiKeyCreateDialog } from './api-key-create-dialog.js';

export function ApiKeysPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：列表 = GET api-keys（只读掩码，02 §8）；新建 = POST 直发默认
  // 权限位（已建屏无 r3 §6 表单弹窗面——名称/白名单归后票 [设计]），一次性
  // 明文块 = 创建响应 plaintext（仅显示一次 canon）。
  const { live, teamId } = useLiveData();
  const keysQ = useApiKeys(teamId, live);
  const todosQ = useTodos(teamId, live);
  const mutations = useApiMutations(teamId);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  // W4 #287：新建走权限位表单弹窗（不再默认直发）；fixture 面按钮保持无操作。
  const [createOpen, setCreateOpen] = useState(false);
  const keys = live
    ? [
        ...mapApiKeys(keysQ.data ?? []),
        ...(plaintext !== null
          ? [{ id: 'once', name: null, masked: '', gitAccess: false, mcpAccess: false, plaintext }]
          : []),
      ]
    : (fixture.apiKeys?.keys ?? []);
  return (
    <SecondaryShell
      route="api-keys"
      fixture={live ? { ...fixture, todos: (todosQ.data ?? []).map(toDisplayTodo) } : fixture}
      title={t('API 密钥')}
    >
      {keys.length === 0 ? (
        <div className="keys-empty">
          <div className="keys-empty-tile">
            <Key />
          </div>
          <h2 className="keys-empty-title">{t('尚无 API 密钥。')}</h2>
          <p className="keys-empty-desc">
            {t('API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的看板。')}
          </p>
          <div className="keys-empty-actions">
            <button
              type="button"
              className="keys-create"
              onClick={live ? () => setCreateOpen(true) : undefined}
            >
              {t('新建密钥')}
            </button>
            <button type="button" className="keys-docs">
              {t('查看文档')}
              <ExternalLink />
            </button>
          </div>
        </div>
      ) : (
        <>
          {keys
            .filter((key) => key.plaintext != null)
            .map((key) => (
              <div key={`once-${key.id}`} className="keys-once">
                <code className="keys-once-value">{key.plaintext}</code>
                <button
                  type="button"
                  className="keys-once-copy"
                  onClick={
                    live
                      ? () => void navigator.clipboard?.writeText(key.plaintext ?? '')
                      : undefined
                  }
                >
                  {t('复制')}
                </button>
                <p className="keys-once-note">{t('请立即复制密钥，它仅显示一次。')}</p>
              </div>
            ))}
          <div className="keys-list">
            {keys.map((key) => (
              <div key={key.id} className="keys-row">
                <span className="keys-row-icon">
                  <Key width={16} height={16} />
                </span>
                <span className="keys-row-text">
                  <span className="keys-row-name">{key.name ?? key.masked}</span>
                  {key.name != null && <span className="keys-row-mask">{key.masked}</span>}
                </span>
                <span className="keys-row-chevron">
                  <ChevronRight width={16} height={16} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <ApiKeyCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(body) =>
          mutations.createApiKey.mutate(body, {
            onSuccess: (res) => {
              if (typeof res.plaintext === 'string') setPlaintext(res.plaintext);
            },
          })
        }
      />
    </SecondaryShell>
  );
}
