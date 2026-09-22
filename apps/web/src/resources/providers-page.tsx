// 模型服务 route (issue #69, r7 07): grouped card with the built-in
// `Todos（内置）` row (indigo sparkle tile, model count, 未启用 pill) above
// custom gateway rows (orange layers tile, orange 自定义 tag, overflow
// dots instead of the pill).
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { EllipsisVertical, Layers, Sparkle } from '../icons/index.js';
import { RowChevron, StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const PROVIDERS_HREF = '/app/resources/providers';

export function ProvidersPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const providers = fixture.resources?.providers ?? [];

  return (
    <ResourceShell
      title="模型服务"
      href={PROVIDERS_HREF}
      backHref="/app"
      selected={PROVIDERS_HREF}
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
    </ResourceShell>
  );
}
