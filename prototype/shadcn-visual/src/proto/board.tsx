// PROTOTYPE (#407): 双版视觉对比 —— 同一组 shadcn 组件 + 同一 mock board 数据，
// 仅 token 层不同。?theme=a = pacman tokens.css 灌 shadcn 变量规约；
// ?theme=b = shadcn 官方默认（neutral, dark）。字体两版同持 Inter，
// 只让 token 层参与裁决。一次性沙盒，不进仓。
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Todo = { id: number; title: string; chip: string; who: string };
type Col = { name: string; dot: string; todos: Todo[] };

const COLS: Col[] = [
  {
    name: "进行中",
    dot: "var(--dot-building)",
    todos: [
      { id: 312, title: "弹层族收口：死钮接线与 local-first 裁决", chip: "plan", who: "XC" },
      { id: 318, title: "看板列虚拟滚动", chip: "plan", who: "PM" },
    ],
  },
  {
    name: "待验收",
    dot: "var(--dot-review)",
    todos: [
      { id: 309, title: "drizzle 迁移序号重编", chip: "confirm", who: "XC" },
      { id: 322, title: "Chief 设置面三件", chip: "confirm", who: "AG" },
      { id: 327, title: "通知横幅铃铛盘", chip: "confirm", who: "XC" },
    ],
  },
  {
    name: "待办",
    dot: "var(--dot-idle)",
    todos: [
      { id: 330, title: "全站切换 shadcn/ui", chip: "idle", who: "PM" },
      { id: 331, title: "token 管道架构裁决", chip: "idle", who: "XC" },
    ],
  },
  {
    name: "完成",
    dot: "var(--dot-done)",
    todos: [
      { id: 297, title: "拖拽卡升层阴影双修主题", chip: "done", who: "AG" },
      { id: 301, title: "dicebear 头像系统", chip: "done", who: "XC" },
    ],
  },
];

const NAV = ["看板", "任务", "资源", "Agent", "机器", "设置"];

function Chip({ kind, label }: { kind: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `var(--chip-${kind}-bg)`, color: `var(--chip-${kind}-fg)` }}
    >
      {label}
    </span>
  );
}

const CHIP_LABEL: Record<string, string> = { plan: "构建", confirm: "待验收", idle: "待办", done: "完成" };

function TaskCard({ t }: { t: Todo }) {
  return (
    <Card className="gap-0 rounded-[var(--radius-card)] border-[var(--card-border)] bg-[var(--card)] py-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-3">
        <div className="text-sm leading-5 font-medium text-[var(--card-foreground)]">{t.title}</div>
        <div className="mt-2 flex items-center justify-between">
          <Chip kind={t.chip} label={CHIP_LABEL[t.chip]} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">#{t.id}</span>
            <Avatar className="size-5">
              <AvatarFallback className="text-[9px]">{t.who}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProtoBoard() {
  const [nav, setNav] = useState("看板");
  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="inline-block size-5 rounded-full bg-[var(--primary)]" />
          <span className="text-sm font-semibold tracking-tight">Pacman</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => (
            <button
              key={n}
              onClick={() => setNav(n)}
              className={`w-full rounded-[var(--radius-md)] px-3 py-1.5 text-left text-sm transition-colors ${
                nav === n
                  ? "bg-[var(--sidebar-active)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--sidebar-hover)]"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">XC</AvatarFallback>
          </Avatar>
          <div className="text-xs">
            <div className="font-medium">xiechimon</div>
            <div className="text-[var(--muted-foreground)]">团队 · pacman</div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3">
          <span className="text-sm text-[var(--muted-foreground)]">pacman</span>
          <span className="text-sm text-[var(--muted-foreground)]">/</span>
          <span className="text-sm font-medium">{nav}</span>
          <div className="ml-auto flex items-center gap-2">
            <Input placeholder="搜索任务…  ⌘K" className="h-8 w-56" />
            <Button size="sm">+ 任务</Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-auto bg-[var(--canvas)] p-4">
          {COLS.map((c) => (
            <section key={c.name} className="flex min-h-0 flex-col gap-2">
              <header className="flex items-center gap-2 px-1">
                <span className="inline-block size-2 rounded-full" style={{ background: c.dot }} />
                <span className="text-xs font-medium text-[var(--col-head-text)]">{c.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{c.todos.length}</span>
              </header>
              {c.todos.map((t) => (
                <TaskCard key={t.id} t={t} />
              ))}
            </section>
          ))}
        </div>

        <footer className="flex items-center gap-2 border-t border-[var(--border)] px-5 py-3">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="secondary">Secondary</Button>
          <Button size="sm" variant="outline">Outline</Button>
          <Button size="sm" variant="ghost">Ghost</Button>
          <Button size="sm" variant="destructive">Destructive</Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Dialog defaultOpen={new URLSearchParams(window.location.search).get("dialog") === "open"}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">打开弹窗</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建任务</DialogTitle>
                <DialogDescription>DialogShell 的 shadcn 对应物：标题 + 描述 + 表单行 + 底栏。</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Input placeholder="任务标题" />
                <Input placeholder="分配给（Agent）" />
              </div>
              <DialogFooter>
                <Button variant="ghost">取消</Button>
                <Button>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </footer>
      </main>
    </div>
  );
}
