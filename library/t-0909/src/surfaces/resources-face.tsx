// PROTOTYPE surface (#909): resources — 768px centered column under a
// ResourceShell head (back chevron / centered title / right action), the
// segmented tab strip on seg tokens, and row cards on the hairline recipe.

import { cn } from 'cn';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Switch } from '../components/ui/switch.js';
import {
  ChevronLeft,
  Eye,
  KeyThin,
  Monitor,
  Network,
  Plus,
  Puzzle,
  Sparkle,
} from '../icons/index.js';
import { MACHINES, MCP_SERVERS, PROVIDERS, SECRETS, SKILLS, WORST_PROVIDERS } from '../mock.js';

const ROW =
  'flex-row items-center gap-3 rounded-(--edge-radius) p-3 ring-0 [box-shadow:var(--edge-ring)]';

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-(--radius-popover) bg-(--tile-indigo-bg) text-(--tile-indigo-fg)">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2
      className="mt-2 mb-1 text-content-tertiary"
      style={{
        fontFamily: 'var(--font-label)',
        fontSize: 'var(--label-size)',
        letterSpacing: 'var(--label-spacing)',
        textTransform: 'var(--label-transform)' as never,
      }}
    >
      {children}
    </h2>
  );
}

const TABS = ['providers', 'machines', 'mcp', 'skills', 'secrets'] as const;

export function ResourcesFace({ worst = false }: { worst?: boolean }) {
  const providers = worst ? WORST_PROVIDERS : PROVIDERS;
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="relative flex h-11 shrink-0 items-center border-b border-line px-3">
        <Button variant="ghost" size="icon-sm" aria-label="返回">
          <ChevronLeft />
        </Button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold tracking-[-0.015em]">
          资源
        </h1>
        <Button variant="outline" size="sm" className="ml-auto">
          <Plus data-icon="inline-start" />
          新建
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[768px] px-4 py-5">
          {/* segmented tabs on seg tokens */}
          <div
            className="mb-5 flex w-fit gap-0.5 rounded-4xl bg-surface-secondary p-0.5"
            role="tablist"
            aria-label="资源分区"
          >
            {TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={i === 0}
                className={cn(
                  'rounded-4xl px-3 py-1 font-mono text-xs transition-colors',
                  i === 0
                    ? 'bg-(--seg-active) text-foreground'
                    : 'text-content-tertiary hover:bg-sidebar-hover',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <SectionLabel>模型提供方</SectionLabel>
          <div className="flex flex-col gap-2">
            {providers.map((p) => (
              <Card key={p.name} size="sm" className={ROW}>
                <Tile>
                  <Sparkle className="size-4" />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-card-foreground">{p.name}</span>
                  <span className="block font-mono text-[10px] text-content-dim">{p.kind}</span>
                </span>
                {p.pill &&
                  (p.ok ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {p.pill}
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 border-0 bg-(--chip-failed-bg) text-[10px] text-(--chip-failed-fg)">
                      {p.pill}
                    </Badge>
                  ))}
                <span className="w-16 shrink-0 text-right font-mono text-[10px] text-content-dim">
                  {p.ago}
                </span>
              </Card>
            ))}
          </div>

          <SectionLabel>机器</SectionLabel>
          <div className="flex flex-col gap-2">
            {MACHINES.map((m) => (
              <Card key={m.name} size="sm" className={ROW}>
                <Tile>
                  <Monitor className="size-4" />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-card-foreground">{m.name}</span>
                  <span className="block font-mono text-[10px] text-content-dim">
                    {m.kind === 'local' ? '本机' : '远端'} · {m.runtimes.join(' / ')}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[10px]',
                    m.online ? 'text-(--chip-done-fg)' : 'text-content-dim',
                  )}
                >
                  {m.online ? '在线' : '离线'}
                </span>
                <Switch defaultChecked={m.shellEnabled} aria-label={`shell ${m.name}`} />
              </Card>
            ))}
          </div>

          <SectionLabel>MCP servers</SectionLabel>
          <div className="flex flex-col gap-2">
            {MCP_SERVERS.map((s) => (
              <Card key={s.name} size="sm" className={ROW}>
                <Tile>
                  <Network className="size-4" />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-card-foreground">
                    {s.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-content-dim">
                    {s.kind} · {s.url}
                  </span>
                </span>
              </Card>
            ))}
          </div>

          <SectionLabel>skills</SectionLabel>
          <div className="flex flex-col gap-2">
            {SKILLS.map((s) => (
              <Card key={s.name} size="sm" className={ROW}>
                <Tile>
                  <Puzzle className="size-4" />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-card-foreground">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-content-tertiary">
                    {s.description}
                  </span>
                </span>
              </Card>
            ))}
          </div>

          <SectionLabel>secrets</SectionLabel>
          <div className="mb-16 flex flex-col gap-2">
            {SECRETS.map((s) => (
              <Card key={s.name} size="sm" className={ROW}>
                <Tile>
                  <KeyThin className="size-4" />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-card-foreground">
                    {s.name}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-content-dim">{s.ago}</span>
                <Button variant="ghost" size="icon-xs" aria-label="查看">
                  <Eye />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
