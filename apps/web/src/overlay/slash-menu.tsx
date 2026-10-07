// Slash menu + command help skins (issue #731).
//
// SlashMenu: the `/` listbox. Same combobox contract as MentionInline
// (#728): the textarea keeps focus for the whole open window — rows are
// non-focusable (tabIndex -1 + mousedown preventDefault) and the highlight
// is exposed through aria-activedescendant. Rows render in caller-given
// sections (builtins first, then skills); a zero total renders the empty
// state (rule 51 isomorph).
//
// SlashHelp: the `/help` panel. A read-only FloatingShell listing the
// currently available builtins with their descriptions — the only builtin
// that needs its own surface (proposal §2).
//
// #948 per-face 清零：slash-menu.css 规则 1:1 迁 utility——listbox 与
// `.mention-inline` 同锚同几何（composer 相对卡，bottom calc(100%+6px)、
// max-h 220、局部 z40＝#688 阶梯外，绘制收编于宿主面 stacking context）；
// /help 面板 = 居中 picker 家族形（fixed 228 / 400 宽 / 负 margin 居中，
// transform 留给动画层独占——#448/#656 律）。行钮收编 components/ui Button
// （ghost 档七通道中和，#908 comment-6001887439 裁决 3；行不在 motion.css
// hover 家族名单，hover 底中和为透明、高亮只走 --active 类）。面板投影是
// 无 token 槽的一次性字面量（§3.1(a)），逐值保留。

import { Fragment, type Ref, useEffect } from 'react';
import { Button } from '../components/ui/button.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { useI18n } from '../i18n/provider.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import type { SlashRow } from './slash-commands.js';

export interface SlashMenuSection {
  title: string;
  rows: SlashRow[];
}

export interface SlashMenuProps {
  open: boolean;
  sections: SlashMenuSection[];
  /** Start offset of the detected `/` token (data-caret debug anchor). */
  caret: number | null;
  /** Query text after `/` — only the empty-state copy consumes it. */
  query: string;
  /** Global highlight index across sections; null = none highlighted. */
  highlight: number | null;
  onHover: (index: number) => void;
  onPick: (row: SlashRow) => void;
  listboxRef: Ref<HTMLDivElement>;
  listboxId: string;
}

/** 面板壳（原 .slash-menu）：与 .mention-inline 同锚同皮（r9 §2.2/§3.2）。 */
const MENU_CLS =
  'slash-menu absolute inset-x-0 bottom-[calc(100%+6px)] z-40 max-h-[220px] overflow-auto rounded-(--radius-popover) border border-(--border) bg-(--popover) p-1 shadow-[0_12px_32px_rgb(0_0_0/0.18)]';

/** 行钮基底（原 .slash-menu-row，Button ghost 七通道中和 + h-auto——旧行
 *  高随内容，不吃件 size 档的 32px）。 */
const ROW_CLS =
  'slash-menu-row flex h-auto w-full cursor-pointer items-baseline justify-start gap-2 rounded-[6px] border-0 px-2 py-1.5 text-left text-sm font-normal text-(--foreground) hover:bg-transparent hover:text-(--foreground) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0';

/** 命令行名（mono 13px）与描述（12px tertiary 截断）——menu 行与 /help 行
 *  共用（原 .slash-menu-name / .slash-menu-desc）。 */
const NAME_CLS = 'slash-menu-name flex-none font-mono text-[13px]';
const DESC_CLS = 'slash-menu-desc truncate text-xs text-(--text-tertiary)';

export function SlashMenu({
  open,
  sections,
  caret,
  query,
  highlight,
  onHover,
  onPick,
  listboxRef,
  listboxId,
}: SlashMenuProps) {
  const { t } = useI18n();
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  useEffect(() => {
    if (!open || highlight == null) return;
    document.getElementById(`${listboxId}-opt-${highlight}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, listboxId]);
  if (!open) return null;
  let offset = 0;
  return (
    <div
      ref={listboxRef}
      id={listboxId}
      className={`${MENU_CLS} duration-100 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2`}
      role="listbox"
      aria-label="Commands"
      data-caret={caret ?? ''}
    >
      {total === 0 ? (
        <div className="slash-menu-empty px-2 py-2.5 text-[13px] text-(--text-tertiary)">
          {t('没有匹配"/{query}"的命令', { query })}
        </div>
      ) : (
        sections.map((section) => {
          const base = offset;
          offset += section.rows.length;
          return (
            <Fragment key={section.title}>
              <div
                className="slash-menu-head px-2 pt-1.5 pb-0.5 text-xs text-(--text-tertiary)"
                aria-hidden="true"
              >
                {section.title}
              </div>
              {section.rows.map((row, i) => {
                const index = base + i;
                return (
                  <Button
                    key={`${section.title}-${row.name}`}
                    id={`${listboxId}-opt-${index}`}
                    variant="ghost"
                    tabIndex={-1}
                    role="option"
                    aria-selected={index === highlight}
                    className={`${ROW_CLS}${index === highlight ? ' slash-menu-row--active bg-(--secondary)' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onPick(row)}
                  >
                    <span className={NAME_CLS}>/{row.name}</span>
                    <span className={DESC_CLS}>
                      {row.descKey != null ? t(row.descKey) : (row.description ?? '')}
                    </span>
                  </Button>
                );
              })}
            </Fragment>
          );
        })
      )}
    </div>
  );
}

export interface SlashHelpProps {
  open: boolean;
  onClose: () => void;
  /** Currently available builtins (same rows as the menu). */
  commands: SlashRow[];
  skillCount: number;
}

export function SlashHelp({ open, onClose, commands, skillCount }: SlashHelpProps) {
  const { t } = useI18n();
  return (
    <FloatingShell open={open} onClose={onClose} className="slash-help-shell">
      <ClickCatcher onClose={onClose} />
      <div
        className={`slash-help fixed top-[228px] left-1/2 z-(--z-picker) ml-[-200px] max-h-[70vh] w-[400px] max-w-[calc(100vw-32px)] overflow-auto rounded-[12px] border border-(--border) bg-(--popover) p-3 text-(--foreground) shadow-[0_18px_48px_rgb(0_0_0/0.22)] ${FLOATING_POP_ANIM}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('命令说明')}
      >
        <div className="slash-help-title mb-2 text-sm font-semibold">{t('命令说明')}</div>
        <div className="slash-help-list flex max-h-[320px] flex-col gap-0.5 overflow-auto">
          {commands.map((row) => (
            <div key={row.name} className="slash-help-row flex items-baseline gap-2 px-2 py-1.5">
              <span className={NAME_CLS}>/{row.name}</span>
              <span className={DESC_CLS}>
                {row.descKey != null ? t(row.descKey) : (row.description ?? '')}
              </span>
            </div>
          ))}
        </div>
        <div className="slash-help-foot mt-2 border-t border-(--border) pt-2 text-xs text-(--text-tertiary)">
          {t('团队技能来自技能页面（共 {count} 个）', { count: skillCount })}
        </div>
      </div>
    </FloatingShell>
  );
}
