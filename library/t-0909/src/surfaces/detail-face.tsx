// PROTOTYPE surface (#909): 详情页 — 44px head, transcript center column,
// 488px right pane (token / branch / run history), composer at the bottom.
// Phase chips ride the StatusChip badge adapter (no per-face CSS).

import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import {
  Panel,
  PanelHead,
  PanelLabel,
  PanelRow,
  PanelValue,
} from '../components/ui/panel.js';
import { TagChip } from '../components/ui/tag-chip.js';
import {
  ArrowUp,
  Ban,
  ChevronLeft,
  EllipsisVertical,
  FileText,
  Terminal,
} from '../icons/index.js';
import { BRANCH_INFO, DETAIL_TASK, RUN_HISTORY, TOKEN_USAGE, TRANSCRIPT } from '../mock.js';
import { StatusChip } from './status-chip.js';

const RUN_TONE = {
  current: 'building',
  failed: 'failed',
  done: 'done',
} as const;

function AgentDisc({ name }: { name: string }) {
  const initials = name
    .split(/[-\s]/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--agent-avatar-bg) font-mono text-[10px] text-content-secondary">
      {initials}
    </span>
  );
}

export function DetailFace() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <Button variant="ghost" size="icon-sm" aria-label="返回看板">
          <ChevronLeft />
        </Button>
        <span className="font-mono text-[11px] text-content-tertiary">#{DETAIL_TASK.seq}</span>
        <h1
          className="max-w-[40ch] truncate text-sm text-foreground"
          style={{ fontWeight: 'var(--title-weight)' as never, letterSpacing: 'var(--title-tracking)' }}
        >
          {DETAIL_TASK.title}
        </h1>
        <StatusChip phase={DETAIL_TASK.phase} />
        {DETAIL_TASK.tags.map((t) => (
          <TagChip key={t.id} tag={t} />
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="text-(--stop)">
            <Ban data-icon="inline-start" />
            停止
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="更多">
            <EllipsisVertical />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* transcript center column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-5">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {TRANSCRIPT.map((m, i) => {
                if (m.kind === 'user')
                  return (
                    <div
                      key={i}
                      className="max-w-[85%] self-end rounded-(--edge-radius) bg-card p-3 [box-shadow:var(--edge-ring)]"
                    >
                      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-content-dim">
                        {m.author} · {m.ago}
                      </div>
                      <p className="text-sm leading-relaxed text-card-foreground">{m.text}</p>
                    </div>
                  );
                if (m.kind === 'agent')
                  return (
                    <div key={i} className="flex gap-2.5">
                      <AgentDisc name={m.author ?? ''} />
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-content-dim">
                          {m.author} · {m.ago}
                        </div>
                        <p className="text-sm leading-relaxed text-content-secondary">{m.text}</p>
                      </div>
                    </div>
                  );
                if (m.kind === 'activity')
                  return (
                    <div key={i} className="ml-[17px] flex flex-col gap-1 border-l border-line pl-4">
                      {m.activity?.map((a, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-content-tertiary">
                          <Terminal className="size-3 shrink-0 text-content-dim" />
                          <span className="rounded-(--radius-sm) bg-surface-secondary px-1 font-mono text-[10px]">
                            {a.tool}
                          </span>
                          <span className="truncate font-mono text-[11px]">{a.summary}</span>
                        </div>
                      ))}
                    </div>
                  );
                return (
                  <Card
                    key={i}
                    size="sm"
                    className="ml-[17px] max-w-md flex-row items-center gap-2 rounded-(--edge-radius) ring-0 [box-shadow:var(--edge-ring)]"
                  >
                    <FileText className="size-4 shrink-0 text-content-tertiary" />
                    <span className="truncate font-mono text-xs text-content-secondary">
                      {m.diff?.file}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px]">
                      <span className="rounded-(--radius-sm) bg-(--diff-add-bg) px-1 text-(--diff-add-fg)">
                        +{m.diff?.add}
                      </span>{' '}
                      <span className="rounded-(--radius-sm) bg-(--diff-del-bg) px-1 text-destructive">
                        −{m.diff?.del}
                      </span>
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
          {/* composer */}
          <div className="shrink-0 border-t border-line p-3">
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
              <Input className="h-9 flex-1 rounded-(--radius-md)" placeholder={`回复 ${DETAIL_TASK.agentName}…`} />
              <Button variant="brand" size="icon" aria-label="发送">
                <ArrowUp />
              </Button>
            </div>
          </div>
        </div>

        {/* right pane */}
        <aside className="flex w-[488px] shrink-0 flex-col gap-3 overflow-auto border-l border-line bg-surface p-4">
          <Panel>
            <PanelHead className="items-start px-3 pt-2.5 pb-1 text-xs font-medium text-content-secondary">Token 用量</PanelHead>
            <PanelRow className="px-3 py-2">
              <PanelLabel>输入</PanelLabel>
              <PanelValue>{TOKEN_USAGE.input}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>输出</PanelLabel>
              <PanelValue>{TOKEN_USAGE.output}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>缓存读取</PanelLabel>
              <PanelValue>{TOKEN_USAGE.cacheRead}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>成本</PanelLabel>
              <PanelValue>{TOKEN_USAGE.cost}</PanelValue>
            </PanelRow>
          </Panel>
          <Panel>
            <PanelHead className="items-start px-3 pt-2.5 pb-1 text-xs font-medium text-content-secondary">分支</PanelHead>
            <PanelRow className="px-3 py-2">
              <PanelLabel>branch</PanelLabel>
              <PanelValue>{BRANCH_INFO.branch}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>commit</PanelLabel>
              <PanelValue>{BRANCH_INFO.commit}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>机器</PanelLabel>
              <PanelValue>{BRANCH_INFO.machine}</PanelValue>
            </PanelRow>
            <PanelRow className="px-3 py-2">
              <PanelLabel>目录</PanelLabel>
              <PanelValue>{BRANCH_INFO.directory}</PanelValue>
            </PanelRow>
          </Panel>
          <Panel>
            <PanelHead className="items-start px-3 pt-2.5 pb-1 text-xs font-medium text-content-secondary">运行历史</PanelHead>
            {RUN_HISTORY.map((r) => (
              <PanelRow key={r.label} className="px-3 py-2">
                <PanelLabel>{r.label}</PanelLabel>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="truncate text-xs text-content-dim">{r.meta}</span>
                  <StatusChip phase={RUN_TONE[r.status]} />
                </span>
              </PanelRow>
            ))}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
