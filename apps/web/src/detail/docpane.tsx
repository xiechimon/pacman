// Doc pane (issue #56, extended in #57 for the 变更 surface, in #67 for
// the 方案▾ type dropdown and in #75 for the r8 plan-version surfaces):
// plan mode keeps the 方案▾ / vN▾ header over the plan markdown (or the
// centered 暂无方案 placeholder in planning, r7 16). Changes mode
// (review/done/failed) renders the diff header 变更▾ v1▾ · N 个文件改动
// +N with the 全部展开/全部收起 toggle (r7 §3.6), one file row per changed
// file (chevron + name + 👁 + right-aligned +N), the unified-diff hunks
// when expanded (r7 27b) and the centered 暂无可显示的变更 placeholder
// when there is nothing to show (r7 38). #75 adds the version dropdown
// under the version chip (r8 63/70: version rows + 与其他版本对比… +
// 回到与 base 对比), the compare submenu (r8 64: 上一版本 alone) and the
// plan-version diff surface (r8 65–72: range chip `v1 → v2`, `+A −B`
// stats, del/add/marker rows). #225 wires the expanded file block's
// 显示完整文件 button: changes mode swaps the hunks for the conv-branch
// full text inline (live = GET /api/builds/{id}/changes/file, #224;
// fixture = DiffFile.fullContent), the button flipping to 显示差异 as the
// way back. #244 (#238 裁决 A) wires the same button on the plan-diff
// face: plan-version full text lives in the plans table (already loaded
// by the plans read face), not on the conv branch — it lands in the same
// DiffFile.fullContent slot in both fixture and live mode, no fetch.
// #366: the pane moved into the detail route's 488px right column and its
// 方案▾/变更▾ select became the pane-view picker (doc surface + the three
// static sections, overlays/plan-dropdown). The head now always renders —
// it carries that picker, so the empty surfaces keep their way out — and
// the changes/diff file stack scrolls in .doc-files under the pinned head.

import type { DiffFileContent } from '@pacman/shared';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useBuildChangeFile } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { relativeTime } from '../board/rel-time.js';
import { Button } from '../components/ui/button.js';
import type {
  ChangesContent,
  DiffFile,
  DocBlock,
  PaneView,
  PlanDiffContent,
  PlanVersion,
} from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileTab,
  FileText,
  Restore,
  UnfoldVertical,
} from '../icons/index.js';
import { type DocTypeLabel, PaneTypeSelect } from '../overlays/plan-dropdown.js';
import { Segments } from './segments.js';

interface DocPaneProps {
  /** plan: 方案 header + markdown; changes: diff surface (review/done/
   *  failed); diff: plan-version unified diff (r8 65–72). */
  mode: 'plan' | 'changes' | 'diff';
  doc: DocBlock[] | undefined;
  changes: ChangesContent | undefined;
  /** Fixture instant the relative version ages are measured against. */
  now: number;
  /** Scenario-frozen initial open state of the 方案▾ dropdown (#67). */
  planDropdownOpen?: boolean;
  /** #366: the type select is the right-pane view picker — picking a
   *  section row swaps the pane away from this doc surface. */
  onPaneView: (view: PaneView) => void;
  /** Build payload present → the dropdown lists the three section rows. */
  hasSections?: boolean;
  /** Version dropdown rows, newest first (r8 63/70). */
  planVersions?: PlanVersion[];
  /** Open menu on the version chip / range chip (r8 63/64). */
  versionMenu?: 'versions' | 'compare';
  onVersionMenu?: (menu: 'versions' | 'compare' | undefined) => void;
  /** 上一版本 picked in the compare submenu (r8 64 → 71). */
  onCompare?: () => void;
  /** 回到与 base 对比 picked (r8 70): drops the diff surface. */
  onBase?: () => void;
  /** Plan-version diff content (mode 'diff'). */
  planDiff?: PlanDiffContent;
  onToggleExpand?: () => void;
  /** #225: changes 面「显示完整文件」的 build 柄（live = buildId，fixture =
   *  null）；plan-diff 面不经此柄（#244：全文走 DiffFile.fullContent 槽，
   *  DiffFileBlock 收 null）。 */
  buildId?: string | null;
  /** #476（#473 决策候选 A）：plan 空态的任务元信息块（TaskMetaBlock）——
   *  给了就顶替居中「暂无方案」占位；只在 plan 面 doc==null 分支消费，
   *  不与文档面并存。fixture 面缺省（无数据源），占位字节不变。 */
  emptyMeta?: ReactNode;
}

// #945（detail.css 清零）：右栏文档面皮肤迁 token utilities。族律 = r7
// 27/27b/36 捕获：head 36px 发丝缝、文件行 32px surface-secondary、diff
// mono 11px（hunk 头 22px 行盒 / 行 17px）、gutter 老新双列右对齐
// （old 18px / new 19px，r7 27b x255/x274 实测）。ghost 七通道中和随各钮。
/** pane 头带（36px + 发丝缝，#366）——docpane 与 right-pane 三 section 头
 *  共用单源（#945：老 .doc-pane-head 规则族的两消费面防漂移律不变）。 */
export const PANE_HEAD =
  'doc-pane-head flex h-9 flex-none items-center border-b border-(--border-default) pl-[17px] text-xs leading-4 text-(--text-secondary) [&>svg]:text-(--text-tertiary)';
const PANE_SELECT =
  'ml-0 flex h-auto cursor-pointer items-center justify-start gap-[3px] rounded-none border-none bg-transparent p-0 text-xs leading-4 text-inherit font-normal hover:bg-transparent hover:text-inherit dark:hover:bg-transparent dark:hover:text-inherit active:not-aria-[haspopup]:translate-y-0 [&_svg]:text-(--text-tertiary)';
const DIFF_LINE = 'flex items-center font-mono text-[11px] leading-[17px] text-(--text-secondary)';
// gutter 老/新行号格右对齐；宽度差 1px 是 r7 27b 捕获原值（old 列尾 x255、
// new 列尾 x274）。
const DIFF_NO = 'flex-none pr-[3px] text-right text-(--text-tertiary)';
const DIFF_KIND_SKIN: Record<string, string> = {
  add: 'bg-(--diff-add-bg)',
  del: 'bg-(--diff-del-bg)',
  marker: 'bg-transparent text-(--text-tertiary)',
  context: '',
};

/** 全文视图状态（#225，镜像 #202 deriveFileView 五态）：hidden = hunk 面；
 *  loading/error 仅 fetch 面可达（changes 面 live）；binary = 不可预览态
 *  （live base64 封套 / 槽位缺 fullContent）；text 直渲。 */
type FullFileView =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'binary' }
  | { kind: 'text'; content: string };

/** 结构子集传参，不绑 useQuery 全形（#202 code-review 同律）。
 *  fetchLive = 经 changes/file 端点取全文（changes 面 live）；false =
 *  槽位面（fixture 任意面 / plan-diff 面，#244）。 */
function deriveFullFileView(
  fetchLive: boolean,
  showFull: boolean,
  fixtureContent: string | null,
  file: { isError: boolean; data: DiffFileContent | undefined },
): FullFileView {
  if (!showFull) return { kind: 'hidden' };
  if (!fetchLive) {
    return fixtureContent !== null ? { kind: 'text', content: fixtureContent } : { kind: 'binary' };
  }
  if (file.isError) return { kind: 'error' };
  if (file.data === undefined) return { kind: 'loading' };
  return file.data.encoding === 'base64'
    ? { kind: 'binary' }
    : { kind: 'text', content: file.data.content };
}

function DiffFileBlock({
  file,
  expanded,
  buildId,
}: {
  file: DiffFile;
  expanded: boolean;
  /** #225/#244 全文读面柄：changes 面 live = buildId（经 changes/file 端点取）；
   *  null = fullContent 槽（fixture 任意面 / plan-diff 面，机制见文件头）。 */
  buildId: string | null;
}) {
  const { t } = useI18n();
  const { live } = useLiveData();
  const [showFull, setShowFull] = useState(false);
  // fetch 面仅 changes 面 live 成立（buildId 非空）；buildId=null 时
  // （fixture 任意面 / plan-diff 面 live）走 fullContent 槽，不起请求。
  const fetchLive = live && buildId != null;
  const fullQ = useBuildChangeFile(buildId, showFull ? file.path : null, fetchLive);
  const full = deriveFullFileView(fetchLive, showFull, file.fullContent ?? null, fullQ);
  return (
    <div className="diff-file">
      {/* 文件行骑 surface-secondary（r7 27 双模）：chevron + 路径 + 👁 +
          右对齐 +N（mono，−N 走 danger 墨）。 */}
      <div className="doc-file-row flex h-8 flex-none items-center gap-1.5 bg-(--surface-secondary) pl-[13px] text-[13px] leading-4 text-(--text-secondary) [&_svg]:text-(--text-tertiary)">
        {expanded ? (
          <ChevronDown width={10} height={10} />
        ) : (
          <ChevronRight width={10} height={10} />
        )}
        <FileText width={14} height={14} />
        {file.path}
        <span className="doc-file-eye flex text-(--text-tertiary)">
          <Eye width={14} height={14} />
        </span>
        <span className="doc-file-add ml-auto pr-[17px] font-mono text-xs leading-4 text-(--diff-add-fg)">
          +{file.added}
          {file.removed != null && file.removed > 0 && (
            <span className="doc-file-del text-(--danger)"> −{file.removed}</span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="diff-body">
          {full.kind === 'hidden' &&
            file.hunks.map((hunk) => (
              <div key={hunk.header} className="diff-hunk">
                <div className="diff-hunk-head border-y border-(--border-default) bg-(--surface-secondary) pl-[53px] font-mono text-[11px] leading-[22px] text-(--text-tertiary)">
                  {hunk.header}
                </div>
                {hunk.lines.map((line, i) => (
                  // fixture order is stable; lines carry no ids
                  <div
                    key={i}
                    className={`diff-line diff-line--${line.kind} ${DIFF_LINE} ${
                      DIFF_KIND_SKIN[line.kind] ?? ''
                    }`}
                    data-kind={line.kind}
                  >
                    <span data-no="old" className={`diff-no diff-no--old ${DIFF_NO} w-[18px]`}>
                      {line.oldNo ?? ''}
                    </span>
                    <span data-no="new" className={`diff-no diff-no--new ${DIFF_NO} w-[19px]`}>
                      {line.newNo ?? ''}
                    </span>
                    <span className="diff-mark w-[11px] flex-none text-center text-(--diff-add-fg)">
                      {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ''}
                    </span>
                    <span className="diff-text pl-1.5 whitespace-pre">{line.text}</span>
                  </div>
                ))}
              </div>
            ))}
          {full.kind === 'text' && (
            <div className="diff-full" data-testid="diff-full">
              {full.content
                .replace(/\n$/, '')
                .split('\n')
                .map((text, i) => (
                  // file order is stable; lines carry no ids
                  <div
                    key={i}
                    className={`diff-line diff-line--context ${DIFF_LINE}`}
                    data-kind="context"
                  >
                    <span data-no="old" className={`diff-no diff-no--old ${DIFF_NO} w-[18px]`} />
                    <span data-no="new" className={`diff-no diff-no--new ${DIFF_NO} w-[19px]`}>
                      {i + 1}
                    </span>
                    <span className="diff-mark w-[11px] flex-none text-center text-(--diff-add-fg)" />
                    <span className="diff-text pl-1.5 whitespace-pre">{text}</span>
                  </div>
                ))}
            </div>
          )}
          {(full.kind === 'loading' || full.kind === 'error' || full.kind === 'binary') && (
            // #225 全文态占位：loading/error/binary 在 hunk 区同槽，左对齐
            // hunk 头文本位（53px），tertiary mono 同 hunk 头族。
            <div className="diff-full diff-full--state py-2 pr-[13px] pl-[53px] font-mono text-[11px] leading-[17px] text-(--text-tertiary)">
              {full.kind === 'loading'
                ? t('加载中…')
                : full.kind === 'error'
                  ? t('文件加载失败')
                  : t('二进制文件暂不支持预览')}
            </div>
          )}
          {/* XMON-24 shadcn ghost 底座不变；#945 漆底/几何迁 utilities——
              27px 满宽条、surface-secondary 漆面（hover 双档钉回漆面，
              灭 ghost 的 muted）、左 13 内衬（pr-0 老面只钉左值）、方角、
              svg 免底座 16px 强制（属性 12px）。 */}
          <Button
            variant="ghost"
            className="diff-expand flex h-[27px] w-full cursor-pointer items-center justify-start gap-1.5 rounded-none border-none bg-(--surface-secondary) pr-0 pl-[13px] text-xs leading-4 font-normal text-(--text-primary) hover:bg-(--surface-secondary) hover:text-(--text-primary) dark:hover:bg-(--surface-secondary) dark:hover:text-(--text-primary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
            onClick={() => setShowFull((v) => !v)}
          >
            <UnfoldVertical width={12} height={12} />
            {showFull ? t('显示差异') : t('显示完整文件')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The floating menu under the version chip / range chip: the version
 *  list (current row bold, restore glyph right, ages computed from the
 *  fixture instant), then 与其他版本对比… (right label = the open diff's
 *  `from`, r8 70) and — only while a diff is open — 回到与 base 对比. */
function VersionMenu({
  versions,
  menu,
  now,
  diffOpen,
  diffFrom,
  onMenu,
  onCompare,
  onBase,
}: {
  versions: PlanVersion[];
  menu: 'versions' | 'compare';
  now: number;
  diffOpen: boolean;
  diffFrom?: string;
  onMenu: (menu: 'versions' | 'compare' | undefined) => void;
  onCompare: () => void;
  onBase: () => void;
}) {
  const { t } = useI18n();
  // XMON-24 菜单行 shadcn ghost 底座不变；#945 几何/皮肤迁 utilities——
  // 37px 行距 + 行间发丝缝（末行免缝，老 :last-child 律走 last: 变体）+
  // space-between 压底座 justify、透明底灭 hover（七通道中和）、svg 免
  // 16px 强制（Restore 属性 13px）。svg 子句与底座字符串逐字节同形
  // （单引号）——twMerge 按字面识别冲突组。菜单盘：212 宽右对齐 chip
  // （r8 §2.7），--radius-popover + edge 投影（0 8 24 @14%）。
  const ROW_BASE =
    "version-menu-row flex h-[37px] w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-(--border-default) bg-transparent text-left text-xs leading-4 font-normal last:border-b-0 hover:bg-transparent dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto [&_svg]:text-(--text-tertiary)";
  const rowClass = `${ROW_BASE} px-[7px] text-(--text-primary) hover:text-(--text-primary) dark:hover:text-(--text-primary)`;
  // 子菜单行（与其他版本对比 ▸ 上一版本）：8px 侧衬 + secondary 墨。
  const subRowClass = `${ROW_BASE} px-2 text-(--text-secondary) hover:text-(--text-secondary) dark:hover:text-(--text-secondary)`;
  const MENU_PANEL =
    'version-menu absolute top-[30px] -right-0.5 z-(--z-popover) w-53 rounded-(--radius-popover) bg-(--popover-bg) py-1 shadow-[0_8px_24px_rgb(0_0_0/0.14)]';
  if (menu === 'compare') {
    return (
      <div className={`${MENU_PANEL} version-menu--sub w-auto min-w-[69px]`}>
        <Button variant="ghost" className={subRowClass} onClick={onCompare}>
          {t('上一版本')}
        </Button>
      </div>
    );
  }
  return (
    <div className={MENU_PANEL}>
      {versions.map((row, i) => (
        <Button
          variant="ghost"
          key={row.v}
          className={`${rowClass}${i === 0 ? ' version-menu-row--current font-semibold' : ''}`}
          onClick={() => onMenu(undefined)}
        >
          <span>
            {row.v} · {relativeTime(row.at, now, t)}
          </span>
          <Restore width={13} height={13} />
        </Button>
      ))}
      <Button variant="ghost" className={rowClass} onClick={() => onMenu('compare')}>
        <span>{t('与其他版本对比…')}</span>
        {diffOpen && diffFrom != null && (
          <span className="version-menu-label text-(--text-tertiary)">{diffFrom}</span>
        )}
      </Button>
      {diffOpen && (
        <Button variant="ghost" className={rowClass} onClick={onBase}>
          <span>{t('回到与 base 对比')}</span>
        </Button>
      )}
    </div>
  );
}

/** Version chip + its menu anchor, shared by the plan-mode select and
 *  the diff-mode range chip (r8 63/70 anchor the panel to the chip's
 *  right edge). */
function VersionControl({
  range,
  label,
  planVersions,
  versionMenu,
  now,
  onVersionMenu,
  onCompare,
  onBase,
}: {
  /** Range chip (`v1 → v2`) when a diff is open; plain select otherwise. */
  range?: { from: string; to: string };
  label?: string;
  planVersions?: PlanVersion[];
  versionMenu?: 'versions' | 'compare';
  now: number;
  onVersionMenu?: (menu: 'versions' | 'compare' | undefined) => void;
  onCompare?: () => void;
  onBase?: () => void;
}) {
  const toggle = () => onVersionMenu?.(versionMenu === 'versions' ? undefined : 'versions');
  return (
    <span className="doc-range-wrap relative ml-[18px] inline-flex">
      {/* XMON-24 两 chip 钮 shadcn ghost 底座不变；#945 皮肤迁 utilities
          ——range chip = 24h 描边 pill `v1 → v2 ⌄`（r8 65，A3 圆角归一
          8px），漆底灭 hover（七通道中和）；select 面与 overlays/
          plan-dropdown 同 class 同配方（ml-0：wrap 内贴左，老嵌套覆写
          规则的消费端等价形）。svg 免底座 16px 强制（属性 12px）。 */}
      {range != null ? (
        <Button
          variant="ghost"
          className="doc-range-chip flex h-6 cursor-pointer items-center gap-1 rounded-[8px] border border-(--range-chip-border) bg-(--range-chip-bg) px-2 text-xs leading-4 font-normal text-(--text-secondary) hover:bg-(--range-chip-bg) hover:text-(--text-secondary) dark:hover:bg-(--range-chip-bg) dark:hover:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={toggle}
        >
          {range.from} → {range.to}
          <ChevronDown width={12} height={12} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          className={`doc-pane-select ${PANE_SELECT} [&_svg:not([class*='size-'])]:size-auto`}
          onClick={toggle}
        >
          {label}
          <ChevronDown width={12} height={12} />
        </Button>
      )}
      {versionMenu != null && onVersionMenu != null && planVersions != null && (
        <VersionMenu
          versions={planVersions}
          menu={versionMenu}
          now={now}
          diffOpen={range != null}
          diffFrom={range?.from}
          onMenu={onVersionMenu}
          onCompare={() => onCompare?.()}
          onBase={() => onBase?.()}
        />
      )}
    </span>
  );
}

/** plan-doc 块皮肤（r8 56 / XMON-55 P2）：正文 15px/24；段间距 8px（首块
 *  归零）；bullet 悬挂 17/−12；节标签 = 12px/500 tertiary 上 22px 下 6px
 *  （是 label 不是 title——它引导的散文是 15px，节边界由更宽的上带标出）。 */
function docBlockClass(kind: string, first: boolean): string {
  const base = 'text-[15px] leading-6 break-words text-(--text-primary)';
  if (kind === 'para') return `${base}${first ? '' : ' mt-2'}`;
  if (kind === 'bullet') return `${base} pl-[17px] [text-indent:-12px]`;
  return `${base} ${first ? 'mt-0' : 'mt-[22px]'} mb-1.5 text-xs leading-4 font-medium tracking-[0.02em] text-(--text-tertiary)`;
}

export function DocPane({
  mode,
  doc,
  changes,
  now,
  planDropdownOpen,
  onPaneView,
  hasSections,
  planVersions,
  versionMenu,
  onVersionMenu,
  onCompare,
  onBase,
  planDiff,
  onToggleExpand,
  buildId,
  emptyMeta,
}: DocPaneProps) {
  const { t } = useI18n();
  // 方案▾/变更▾ 型选钮（#149 接线，#366 升级为右 pane 视图选择器）：
  // 首行 = 相位派生的文档型（✓，重选即留档面），其后三行 = 静止 section。
  const typeSelect = (docLabel: DocTypeLabel) => (
    <PaneTypeSelect
      view="doc"
      docLabel={docLabel}
      sections={hasSections}
      onView={onPaneView}
      initiallyOpen={planDropdownOpen}
    />
  );
  if (mode === 'changes' || mode === 'diff') {
    const hasData = mode === 'diff' ? planDiff != null : changes != null;
    const files = mode === 'diff' ? (planDiff?.files ?? []) : (changes?.files ?? []);
    const expanded = mode === 'diff' ? (planDiff?.expanded ?? false) : (changes?.expanded ?? false);
    const fileCount = files.length;
    const added = files.reduce((sum, f) => sum + f.added, 0);
    const removed = files.reduce((sum, f) => sum + (f.removed ?? 0), 0);
    return (
      <section className="doc-pane flex min-h-0 flex-1 flex-col" data-testid="doc-pane">
        {/* #366: the pane head always renders — it carries the view picker,
            so the empty surfaces keep their way out; the version chip /
            stat / toggle only make sense over data. */}
        <header className={PANE_HEAD}>
          <FileTab width={14} height={14} />
          {typeSelect(mode === 'diff' ? '方案' : '变更')}
          {hasData &&
            (mode === 'diff' && planDiff != null ? (
              <VersionControl
                range={{ from: planDiff.from, to: planDiff.to }}
                planVersions={planVersions}
                versionMenu={versionMenu}
                now={now}
                onVersionMenu={onVersionMenu}
                onCompare={onCompare}
                onBase={onBase}
              />
            ) : (
              <VersionControl
                label={planVersions?.[0]?.v ?? 'v1'}
                planVersions={planVersions}
                versionMenu={versionMenu}
                now={now}
                onVersionMenu={onVersionMenu}
                onCompare={onCompare}
                onBase={onBase}
              />
            ))}
          {hasData && (
            <>
              {/* changes mode（r7 27/36）：stat 簇 + 右对齐展开切换。 */}
              <span className="doc-changes-stat ml-[18px] text-(--text-tertiary)">
                {t('· {n} 个文件改动', { n: fileCount })}{' '}
                <span className="doc-changes-add text-(--diff-add-fg)">+{added}</span>
                {removed > 0 && (
                  <span className="doc-changes-del text-(--danger)"> −{removed}</span>
                )}
              </span>
              {/* XMON-24 shadcn ghost 底座不变；#945 皮肤迁 utilities
                  （无高度声明——h-auto 还原裸钮内容高；透明底 + tertiary
                  墨 + 七通道中和；ml-auto 右对齐 + 17px 右衬）。 */}
              <Button
                variant="ghost"
                className="doc-expand-all ml-auto mr-[17px] h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs leading-4 font-normal text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0"
                onClick={onToggleExpand}
              >
                {expanded ? t('全部收起') : t('全部展开')}
              </Button>
            </>
          )}
        </header>
        {hasData ? (
          <div className="doc-files min-h-0 flex-1 overflow-y-auto">
            {files.map((file) => (
              <DiffFileBlock
                key={file.path}
                file={file}
                expanded={expanded}
                buildId={mode === 'changes' ? (buildId ?? null) : null}
              />
            ))}
          </div>
        ) : (
          // changes-empty 占位（r7 38）：整 pane 居中、头上无 band——
          // --full 变体把 .doc-empty 的绝对居中改回 static flex 项。
          <div className="doc-empty doc-empty--full static flex flex-1 items-center justify-center text-xs leading-4 text-(--text-tertiary)">
            {t('暂无可显示的变更')}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="doc-pane flex min-h-0 flex-1 flex-col" data-testid="doc-pane">
      <header className={PANE_HEAD}>
        <FileTab width={14} height={14} />
        {typeSelect('方案')}
        {doc != null && (
          <VersionControl
            label={planVersions?.[0]?.v ?? 'v1'}
            planVersions={planVersions}
            versionMenu={versionMenu}
            now={now}
            onVersionMenu={onVersionMenu}
            onCompare={onCompare}
            onBase={onBase}
          />
        )}
      </header>
      <div
        className="doc-pane-body relative min-h-0 flex-1 overflow-y-auto pt-4 pr-[18px] pb-6 pl-[17px]"
        data-testid="doc-body"
      >
        {doc == null
          ? // #476：live 空态由任务元信息块承接（顶对齐、随 doc-pane-body
            // 既有滚动）；fixture 面 emptyMeta 缺省 → 居中占位原样。
            (emptyMeta ?? (
              <div className="doc-empty absolute inset-0 flex items-center justify-center text-xs leading-4 text-(--text-tertiary)">
                {t('暂无方案')}
              </div>
            ))
          : doc.map((block, i) => (
              <p
                // fixture order is stable; blocks carry no ids
                key={i}
                className={cn(
                  `doc-block doc-block--${block.kind}`,
                  docBlockClass(block.kind, i === 0),
                )}
              >
                {block.kind === 'bullet' ? '• ' : ''}
                <Segments segments={block.segments} codeClassName="doc-code" />
              </p>
            ))}
      </div>
    </section>
  );
}
