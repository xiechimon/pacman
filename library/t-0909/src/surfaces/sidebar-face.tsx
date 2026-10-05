// PROTOTYPE surface (#909): 侧栏 — 240px docked rail, 36px row pitch,
// hover/active alpha ladder tokens, group labels riding the variant's
// label typography tokens.

import { cn } from 'cn';
import { Button } from '../components/ui/button.js';
import { Kbd } from '../components/ui/kbd.js';
import {
  ChevronRight,
  Clock,
  EllipsisVertical,
  Kanban,
  KeyThin,
  Layers,
  Monitor,
  Network,
  Plus,
  Puzzle,
  Search,
  SquarePen,
  Users,
} from '../icons/index.js';
import { SIDEBAR_PROJECTS, USER } from '../mock.js';

function GroupLabel({ children }: { children: string }) {
  return (
    <div
      className="mt-3 mb-1 flex h-6 items-center gap-1 px-2 text-content-dim"
      style={{
        fontFamily: 'var(--font-label)',
        fontSize: 'var(--label-size)',
        letterSpacing: 'var(--label-spacing)',
        textTransform: 'var(--label-transform)' as never,
      }}
    >
      <ChevronRight className="size-3" />
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  active,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-(--radius-md) px-2 text-left text-[13px] transition-colors duration-(--dur-fast)',
        active
          ? 'bg-sidebar-active font-medium text-foreground'
          : 'text-content-secondary hover:bg-sidebar-hover hover:text-foreground',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-foreground' : 'text-content-tertiary')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function SidebarFace() {
  return (
    <aside className="z-(--z-docked) flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface px-2 py-2">
      <Row icon={<Search className="size-4" />} label="搜索" trailing={<Kbd className="ml-auto text-[10px]">⌘K</Kbd>} />
      <Row icon={<SquarePen className="size-4" />} label="新任务" />
      <Row icon={<Kanban className="size-4" />} label="看板" active />
      <Row icon={<Clock className="size-4" />} label="定时" />
      <Row icon={<Users className="size-4" />} label="团队" />

      <GroupLabel>资源</GroupLabel>
      <Row icon={<Puzzle className="size-4" />} label="skills" />
      <Row icon={<Network className="size-4" />} label="mcp-servers" />
      <Row icon={<KeyThin className="size-4" />} label="secrets" />
      <Row icon={<Monitor className="size-4" />} label="machines" />
      <Row icon={<Layers className="size-4" />} label="providers" />

      <GroupLabel>项目</GroupLabel>
      {SIDEBAR_PROJECTS.map((p) => (
        <Row
          key={p.id}
          active={p.active}
          icon={
            <span className="grid size-4 place-items-center rounded-full bg-(--project-avatar-bg) text-[9px] font-semibold text-(--project-avatar-fg)">
              {p.initial}
            </span>
          }
          label={p.name}
          trailing={
            p.active ? (
              <span className="rounded-4xl bg-(--badge-attention) px-1.5 font-mono text-[10px] font-semibold text-(--badge-attention-fg)">
                2
              </span>
            ) : undefined
          }
        />
      ))}

      <div className="mt-auto border-t border-line pt-2">
        <div className="flex h-9 items-center gap-2 rounded-(--radius-md) px-2 hover:bg-sidebar-hover">
          <span className="grid size-5 place-items-center rounded-full bg-(--agent-avatar-bg) font-mono text-[9px] text-content-secondary">
            XM
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-content-secondary">{USER.name}</span>
          <Button variant="ghost" size="icon-xs" aria-label="账户菜单">
            <EllipsisVertical />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 px-2 pb-1 text-[10px] text-content-dim">
          <Plus className="size-2.5" />
          <span className="truncate font-mono">{USER.machine}</span>
        </div>
      </div>
    </aside>
  );
}
