// 看板仓库筛选（#445）：顶栏左侧 chip 组——「全部」复位态 + 项目 chip。
// 设计裁决（#445 轴 1）：
//   - 筛选态进 URL ?projects=（沿 ?tags= 既有先例：replace 写回不刷历史、
//     刷新/分享不丢、无项目数据源的 fixture 场景不渲染）；清空即回全量；
//   - 多选 = OR 并集；与类型轴不同，**没有**「无标签恒可见」豁免——每张
//     卡必属一个项目，仓库收窄的语义就是「只看我的这几个仓库」，命中 =
//     projectId 精确集成员；
//   - 规范序 = 字典序（项目无固定词表，字节序即规范序——同选集恒同 URL，
//     与点击序/书写序无关）；未知 id（已删项目/脏 URL）解析不丢弃——命中
//     判定天然不命中也不误配，收窄见底走板级空态 + 清除钮，不出空白看板。
// 视觉语言 = 退役的 #403 类型 chip 组同形（20px pill、未选 = 中性描边、
// 选中/复位 = 反白实底）；项目不带色彩位——反白而非词表实底是刻意区分
// （词表配色专属 TagChip）。
// per-face 类名（board-repo-filter / repo-filter-chip / repo-filter-all）
// = e2e 定位别名（README 规则 2）。

import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';

/** URL 参 → 选中项目 id 集。去重 + 字典序规范序（同选集恒同 URL，与书写
 *  序无关）；空段丢弃。未知 id 不在解析层丢——项目无静态词表，解析保持
 *  纯函数不依赖异步数据面（直达 URL 在项目列表加载完成前即可正确收窄：
 *  projectId 在卡上，命中判定零异步依赖）。 */
export function parseProjectsParam(raw: string | null): string[] {
  if (raw == null || raw === '') return [];
  return [...new Set(raw.split(','))].filter((id) => id !== '').sort();
}

/** 命中判定：空选中集 = 全量；否则 projectId 精确集成员（多选 = OR 并集，
 *  无恒可见豁免——见模块头注）。 */
export function matchesProjectFilter(todo: TodoRecord, selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  return selected.has(todo.projectId);
}

/** 仓库筛选面的项目行（live = ProjectRecord 投影；fixture = projectNames）。 */
export interface RepoOption {
  id: string;
  name: string;
}

interface RepoFilterBarProps {
  options: RepoOption[];
  /** 选中项目 id（字典序规范序）；空 = 全部态。 */
  selected: string[];
  onToggle: (id: string) => void;
  /** 「全部」复位 = 只清仓库轴（类型轴的清除走各自入口/板级空态钮）。 */
  onClear: () => void;
}

/** 顶栏左侧 chip 组。pill 几何沿 #403 类型 chip 组（h-5/11px/px-2）；
 *  focus 环与 shadcn Button 同 idiom（button.tsx 的 --card-button 实线）。 */
export function RepoFilterBar({ options, selected, onToggle, onClear }: RepoFilterBarProps) {
  const { t } = useI18n();
  const selectedSet = new Set(selected);
  const allActive = selected.length === 0;
  const focus =
    'focus-visible:[outline:2px_solid_var(--card-button)] focus-visible:outline-offset-2';
  const pill =
    'flex h-5 flex-none items-center rounded-full border px-2 text-[11px] leading-none font-medium transition-colors';
  const on = 'border-transparent bg-foreground text-background';
  const off = 'border-border text-muted-foreground hover:bg-accent hover:text-foreground';
  return (
    <div className="board-repo-filter flex min-w-0 items-center gap-1.5 overflow-x-auto pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        className={`repo-filter-all ${pill} ${focus} ${allActive ? on : off}`}
        aria-pressed={allActive}
        onClick={onClear}
      >
        {t('全部')}
      </button>
      {options.map((project) => {
        const active = selectedSet.has(project.id);
        return (
          <button
            key={project.id}
            type="button"
            data-project={project.id}
            className={`repo-filter-chip ${pill} ${focus} ${active ? on : off}`}
            aria-pressed={active}
            onClick={() => onToggle(project.id)}
          >
            {project.name}
          </button>
        );
      })}
    </div>
  );
}
