// 机器 route (issue #69, r7 06): one grouped card — the `Todos 托管机器`
// row (indigo server tile, description line, 未启用 pill) above a divider
// and one row per claimed machine (orange monitor tile, online dot,
// id-tail subline) — then the dashed full-width 添加机器 button.
import { useSearchParams } from 'react-router';
import { resolveScenario } from '../fixtures/scenario.js';
import { Monitor, Server, ServerThin } from '../icons/index.js';
import { RowChevron, StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const MACHINES_HREF = '/app/resources/machines';

export function MachinesPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const machines = fixture.resources?.machines ?? [];

  return (
    // r7 06: the machines topbar carries no `+ 新建` — the dashed 添加机器
    // button is the page's only add action
    <ResourceShell title="机器" href={MACHINES_HREF} backHref="/app" hideNew fixture={fixture}>
      <div className="res-card res-group">
        {machines.map((machine, i) => (
          <div className={`res-grow${i > 0 ? ' res-grow--divided' : ''}`} key={machine.name}>
            <Tile
              Icon={machine.hosted === true ? Server : Monitor}
              size="lg"
              tone={machine.hosted === true ? 'indigo' : 'orange'}
            />
            <span className="res-row-text">
              <span className="res-row-line">
                <span className="res-row-title">{machine.name}</span>
                {machine.online === true && <span className="res-dot" />}
              </span>
              {machine.description != null ? (
                <span className="res-row-desc">{machine.description}</span>
              ) : null}
              {machine.sub != null && <span className="res-row-desc">{machine.sub}</span>}
            </span>
            {machine.pill != null && <StatusPill label={machine.pill} />}
            <RowChevron />
          </div>
        ))}
      </div>
      <button type="button" className="res-add">
        <ServerThin width={14} height={14} />
        添加机器
      </button>
    </ResourceShell>
  );
}
