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
      <div className="doc-file-row">
        {expanded ? (
          <ChevronDown width={10} height={10} />
        ) : (
          <ChevronRight width={10} height={10} />
        )}
        <FileText width={14} height={14} />
        {file.path}
        <span className="doc-file-eye">
          <Eye width={14} height={14} />
        </span>
        <span className="doc-file-add">
          +{file.added}
          {file.removed != null && file.removed > 0 && (
            <span className="doc-file-del"> −{file.removed}</span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="diff-body">
          {full.kind === 'hidden' &&
            file.hunks.map((hunk) => (
              <div key={hunk.header} className="diff-hunk">
                <div className="diff-hunk-head">{hunk.header}</div>
                {hunk.lines.map((line, i) => (
                  // fixture order is stable; lines carry no ids
                  <div key={i} className={`diff-line diff-line--${line.kind}`}>
                    <span className="diff-no diff-no--old">{line.oldNo ?? ''}</span>
                    <span className="diff-no diff-no--new">{line.newNo ?? ''}</span>
                    <span className="diff-mark">
                      {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ''}
                    </span>
                    <span className="diff-text">{line.text}</span>
                  </div>
                ))}
              </div>
            ))}
          {full.kind === 'text' && (
            <div className="diff-full">
              {full.content
                .replace(/\n$/, '')
                .split('\n')
                .map((text, i) => (
                  // file order is stable; lines carry no ids
                  <div key={i} className="diff-line diff-line--context">
                    <span className="diff-no diff-no--old" />
                    <span className="diff-no diff-no--new">{i + 1}</span>
                    <span className="diff-mark" />
                    <span className="diff-text">{text}</span>
                  </div>
                ))}
            </div>
          )}
          {(full.kind === 'loading' || full.kind === 'error' || full.kind === 'binary') && (
            <div className="diff-full diff-full--state">
              {full.kind === 'loading'
                ? t('加载中…')
                : full.kind === 'error'
                  ? t('文件加载失败')
                  : t('二进制文件暂不支持预览')}
            </div>
          )}
          {/* XMON-24：切 shadcn ghost——漆底/几何全在 .diff-expand per-face；
              utilities 清底座圆角（老面漆底直角）、justify、右内边距
              （per-face 只钉左 13，px-0 后左值仍 per-face 赢）、字重、
              active 位移与 svg 16px 强制（属性 12px）。 */}
          <Button
            variant="ghost"
            className="diff-expand rounded-none justify-start px-0 font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
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
  // XMON-24：菜单行切 shadcn ghost——几何/皮肤全在 .version-menu-row
  // per-face（space-between 压 justify、bg transparent 灭 hover 底）；
  // utilities 只清字重、active 位移与 svg 16px 强制（Restore 属性 13px）。
  // svg 子句与底座字符串逐字节同形（单引号）——twMerge 按字面识别冲突组，
  // 引号风格不同会双写 size-4/size-auto 赌 CSS 顺序。
  const rowClass =
    "version-menu-row font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";
  if (menu === 'compare') {
    return (
      <div className="version-menu version-menu--sub">
        <Button variant="ghost" className={rowClass} onClick={onCompare}>
          {t('上一版本')}
        </Button>
      </div>
    );
  }
  return (
    <div className="version-menu">
      {versions.map((row, i) => (
        <Button
          variant="ghost"
          key={row.v}
          className={`${rowClass}${i === 0 ? ' version-menu-row--current' : ''}`}
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
        {diffOpen && diffFrom != null && <span className="version-menu-label">{diffFrom}</span>}
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
    <span className="doc-range-wrap">
      {/* XMON-24：两 chip 钮切 shadcn ghost——range chip 皮肤全在
          .doc-range-chip per-face（漆底灭 hover）；select 面与
          overlays/plan-dropdown 同 class 同 neutralizer 串（逐字节一致，
          防两消费面漂移）。svg 免底座 16px 强制（属性 12px）。 */}
      {range != null ? (
        <Button
          variant="ghost"
          className="doc-range-chip font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={toggle}
        >
          {range.from} → {range.to}
          <ChevronDown width={12} height={12} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="doc-pane-select h-auto rounded-none justify-start gap-0 font-normal active:not-aria-[haspopup]:translate-y-0 hover:bg-transparent [&_svg:not([class*='size-'])]:size-auto"
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
      <section className="doc-pane">
        {/* #366: the pane head always renders — it carries the view picker,
            so the empty surfaces keep their way out; the version chip /
            stat / toggle only make sense over data. */}
        <header className="doc-pane-head">
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
              <span className="doc-changes-stat">
                {t('· {n} 个文件改动', { n: fileCount })}{' '}
                <span className="doc-changes-add">+{added}</span>
                {removed > 0 && <span className="doc-changes-del"> −{removed}</span>}
              </span>
              {/* XMON-24：切 shadcn ghost——皮肤全在 .doc-expand-all
                  per-face（无高度声明，h-auto 还原裸钮内容高）。 */}
              <Button
                variant="ghost"
                className="doc-expand-all h-auto rounded-none font-normal hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
                onClick={onToggleExpand}
              >
                {expanded ? t('全部收起') : t('全部展开')}
              </Button>
            </>
          )}
        </header>
        {hasData ? (
          <div className="doc-files">
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
          <div className="doc-empty doc-empty--full">{t('暂无可显示的变更')}</div>
        )}
      </section>
    );
  }

  return (
    <section className="doc-pane">
      <header className="doc-pane-head">
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
      <div className="doc-pane-body">
        {doc == null
          ? // #476：live 空态由任务元信息块承接（顶对齐、随 doc-pane-body
            // 既有滚动）；fixture 面 emptyMeta 缺省 → 居中占位原样。
            (emptyMeta ?? <div className="doc-empty">{t('暂无方案')}</div>)
          : doc.map((block, i) => (
              <p
                // fixture order is stable; blocks carry no ids
                key={i}
                className={`doc-block doc-block--${block.kind}`}
              >
                {block.kind === 'bullet' ? '• ' : ''}
                <Segments segments={block.segments} codeClassName="doc-code" />
              </p>
            ))}
      </div>
    </section>
  );
}
