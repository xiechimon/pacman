// MCP 服务器 route (issue #69, r7 09): one card row per server — 20px
// orange plug tile, name + type label on the title line, endpoint url
// below, relative creation label + overflow dots at the right edge.
import { useSearchParams } from 'react-router';
import { useMcpServers } from '../api/hooks.js';
import { mapMcpServers } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { EllipsisVertical, Network } from '../icons/index.js';
import { EmptyState, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const MCP_HREF = '/app/resources/mcp-servers';

export function McpServersPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：GET mcp-servers（r3 §5.1 record 面）。
  const { live, teamId } = useLiveData();
  const mcpQ = useMcpServers(teamId, live);
  const servers = live
    ? mapMcpServers(mcpQ.data ?? [], Date.now())
    : (fixture.resources?.mcpServers ?? []);

  return (
    <ResourceShell
      title="MCP 服务器"
      href={MCP_HREF}
      backHref="/app"
      selected={MCP_HREF}
      fixture={fixture}
    >
      {servers.length === 0 ? (
        <EmptyState
          Icon={Network}
          title="尚无 MCP 服务器。"
          description="MCP 服务器为 Agent 提供额外工具，例如工单系统、浏览器、内部 API。授权在每个 Agent 的页面上单独进行。"
          actionLabel="添加 MCP 服务器"
        />
      ) : (
        servers.map((server) => (
          <div className="res-card res-rowcard res-rowcard--mcp" key={server.name}>
            <Tile Icon={Network} size="sm" tone="orange" />
            <span className="res-row-text">
              <span className="res-row-line">
                <span className="res-row-title">{server.name}</span>
                <span className="res-row-kind">{t(server.kind)}</span>
              </span>
              <span className="res-row-desc">{server.url}</span>
            </span>
            <span className="res-row-ago">{t(server.ago)}</span>
            <span className="res-row-more">
              <EllipsisVertical width={16} height={16} />
            </span>
          </div>
        ))
      )}
    </ResourceShell>
  );
}
