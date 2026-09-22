// API-keys route (issue #70): the empty state per r2 19 (icon tile +
// canon copy + 新建密钥 / 查看文档), and with a created key in the
// fixture the r3 §6 display rules — list row masked `tds_afe07565…`
// plus the one-time plaintext block carrying the 02 §8 canon
// 「请立即复制密钥，它仅显示一次。」. Row and one-time block shapes are
// [推断] (no capture: r2 §9-12, r3 §6 图失); mask and copy are observed.
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChevronRight, ExternalLink, Key } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

export function ApiKeysPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const keys = fixture.apiKeys?.keys ?? [];
  return (
    <SecondaryShell route="api-keys" fixture={fixture} title="API 密钥">
      {keys.length === 0 ? (
        <div className="keys-empty">
          <div className="keys-empty-tile">
            <Key />
          </div>
          <h2 className="keys-empty-title">尚无 API 密钥。</h2>
          <p className="keys-empty-desc">
            API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的看板。
          </p>
          <div className="keys-empty-actions">
            <button type="button" className="keys-create">
              新建密钥
            </button>
            <button type="button" className="keys-docs">
              查看文档
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
                <button type="button" className="keys-once-copy">
                  复制
                </button>
                <p className="keys-once-note">请立即复制密钥，它仅显示一次。</p>
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
    </SecondaryShell>
  );
}
