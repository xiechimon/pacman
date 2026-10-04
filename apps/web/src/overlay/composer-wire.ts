// Composer wire core (issue #625): the input-logic layer shared by the two
// composer faces — the detail conversation composer (detail/composer.tsx) and
// the chief drawer composer (chief/chief-drawer.tsx). Before this module each
// face carried its own copy of the draft/send/mention/attachment wiring, so
// every capability opening (steer, then attachments, then mentions on the
// chief face) had to be written twice and any missed copy drifted the two
// faces apart.
//
// Scope = the four wire pieces and nothing else:
//   1. draft state — controlled (parent holds state + setter, so attachment
//      tokens can be injected), static (parent supplies a read-only display
//      value, the chief fixture face), or uncontrolled (internal state);
//   2. send — trimmed text, the promise contract from #75/#631/#635:
//      an async onSend clears the draft only on success and keeps it on a
//      rejection (409 steer gate, server error — the failure toast belongs to
//      the surface that owns the mutation), a sync onSend keeps the original
//      clear-right-away semantics;
//   3. mention insertion — the MentionPicker popover path and the inline
//      @-query listbox path route through one insertTokens so the spacing
//      and caret-offset rules live in a single place (#311);
//   4. attachment file-pick + clipboard-paste wire — the hidden file input
//      ref, the attaching flag and the re-pick value reset (#310), plus the
//      paste capture (#729): files from the clipboard go through the same
//      delegate, tokens land line-atomic at the captured caret (file-picker
//      path stays tail-append). #757 adds the in-flight pending list (one
//      placeholder card per uploading file). Grant + upload stay with the
//      calling surface (onAttachment delegate returns the tokens it
//      uploaded).
//
// Inline `@` completion (#728) follows the Claude Code canon (#727 §1):
// the trigger/filter/keyboard machinery lives in overlay/completion.ts as a
// reusable primitive (#731 `/` completion consumes the same parts); this
// hook owns only the React wiring — token-range state with a ref mirror,
// re-evaluation on text AND selection-only caret moves, the outside
// pointer-down dismiss, the IME composition guard, and the Enter law:
// highlighted row = insert without sending (the r9 §5 conflict fix), no
// highlight / list closed = send as before (composer-wire-reject.spec pins
// that half by construction).
//
// Deliberately NOT here: the skins. Both faces keep their own DOM nodes,
// geometry, class names and extra buttons (detail: toolbar / AI review /
// stop; chief: send bar, hero examples). The hook returns state and
// callbacks only and renders no JSX — Multica's useChatController is the
// precedent (chat-page and chat-window share the conversation logic while
// each keeps its own shell).

import { type SkillSuggestion, suggestSkill } from '@pacman/shared';
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  KeyboardEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createPastedNameCounter,
  filesFromClipboardData,
  insertAttachmentTokens,
  type PastedNameCounter,
  type PendingAttachment,
  preparePastedFiles,
} from './attachment-paste.js';
import {
  type CompletionRange,
  completionKeyIntent,
  detectCompletionToken,
  fuzzyFilter,
  MENTION_COMPLETION_SPEC,
} from './completion.js';
import type { MentionGroups } from './mention-picker.js';
import {
  type FileMentionEntry,
  type InlineCompletionRow,
  insertFileText,
  insertMentionText,
  type MentionToken,
} from './mention-token.js';
import { applyOrderedListEnter } from './ordered-list.js';
import { usePendingAttachments } from './pending-attachments.js';
import {
  type BuiltinSlashName,
  buildSlashSections,
  insertSlashText,
  isMessageStart,
  resolveSlashAccept,
  SLASH_COMPLETION_SPEC,
  type SlashRow,
  type SlashSection,
} from './slash-commands.js';

export interface ComposerWireOptions {
  /** Live editable face: enables the inline @-query detection on change.
   *  Static capture faces leave it off so typing rules never fire there. */
  editable?: boolean;
  /** Draft value from the parent. With onDraftChange = controlled mode
   *  (detail live face); without = static mode (read-only display value,
   *  chief fixture face). Omit both for uncontrolled internal state. */
  draft?: string;
  onDraftChange?: (next: string) => void;
  /** Send delegate. Returning a promise opts into the async contract:
   *  success clears the draft, rejection keeps it (#75 reject chain,
   *  #631/#635 chief send). void = clear right after the call. */
  onSend?: (text: string) => void | Promise<void>;
  /** Attachment delegate (#310, contract widened in #729): the surface
   *  owns grant + upload and returns the tokens of the files that made it
   *  (per-file failures toast on the surface). The hook injects the tokens
   *  into the draft — tail for the file picker, captured caret for a
   *  clipboard paste — so the line-atomic discipline lives in one place. */
  onAttachment?: (files: File[]) => string[] | Promise<string[]>;
  /** Entity groups feeding both mention paths (#311). Absent = the inline
   *  listbox never opens and the picker shows zero counts. */
  mentionGroups?: MentionGroups;
  /** File candidates for the inline `@` list (#760). Absent/empty = the
   *  agents-only listbox of #728, byte-identical. Supplied only where a
   *  project context exists (detail composer); the chief drawer and the
   *  new-task dialog stay agents-only. */
  mentionFiles?: FileMentionEntry[];
  /** Slash-command face (#731). Absent = the `/` detector never runs
   *  (chief face keeps its current behavior). `reviewAvailable` /
   *  `stopAvailable` must mirror the toolbar buttons' own display
   *  conditions so the menu never lists a dead row. */
  slash?: {
    reviewAvailable: boolean;
    stopAvailable: boolean;
    onReview?: () => void;
    onStop?: () => void;
  };
}

export interface ComposerWire {
  /** The value to bind on the textarea. */
  draft: string;
  /** Draft setter honoring the active mode (controlled / static / internal). */
  setDraft: Dispatch<SetStateAction<string>>;
  /** Send the trimmed draft; empty text is a no-op on editable faces. */
  send: () => void;
  /** Textarea onChange: stores the value and re-judges the inline @ token. */
  handleChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Textarea onKeyDown: completion keys first (↑↓ / Tab / Enter=insert /
   *  Esc while the listbox is open), then ordered-list continuation
   *  (#814: plain Enter on a `1. ` line wins over send), then the
   *  composer's own Enter-to-send. IME composition never triggers any
   *  layer (#728 failure mode 8). */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Re-judge the token after caret-only moves (keyup / click / select):
   *  the listbox must close when the caret leaves the token and may reopen
   *  when it comes back (#728 failure mode 3 — change events alone leave
   *  the popup stale). */
  handleCaretMoved: () => void;
  /** Re-judge after the IME commits its composition. */
  handleCompositionEnd: () => void;
  /** Textarea onBlur: the listbox only lives while the composer has focus
   *  (row clicks never blur it — their mousedown is prevented; the toolbar
   *  path dismisses on pointerdown before focus travels). Covers Tab-away
   *  on an empty result list, where no key intent dismisses. */
  handleBlur: () => void;
  /** Bind on the textarea element — the caret anchor for mention insertion. */
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  /** Bind on the hidden file input; open it via openFilePicker. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  openFilePicker: () => void;
  /** True while an onAttachment delegate is in flight. */
  attaching: boolean;
  /** Files with an upload in flight (#757 in-transit placeholders — the
   *  strip paints one card per entry; entries drop as their run settles). */
  pendingAttachments: PendingAttachment[];
  onPickFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Textarea onPaste (#729): clipboard files go through onAttachment and
   *  land line-atomic at the caret; a text-only paste is never touched. */
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** MentionPicker popover open state (toolbar path). */
  pickerOpen: boolean;
  togglePicker: () => void;
  closePicker: () => void;
  /** Inline @-query listbox state (typing path). */
  inlineOpen: boolean;
  /** Start offset of the detected `@` token (listbox data-caret anchor). */
  inlineCaret: number | null;
  /** The query text after `@` — drives filtering and the empty-state copy. */
  inlineQuery: string;
  /** Unified inline `@` rows (#760: agents + files, one fuzzy pass over the
   *  concatenated roster — ties keep roster order so agents stay first;
   *  capped at 15, CC rules 14-18 + COMPLETION_CAP). */
  inlineRows: InlineCompletionRow[];
  /** Highlighted row index; null = nothing highlighted, so Enter keeps its
   *  send semantics (CC rule 56 isomorph — the top row is NOT preselected). */
  inlineHighlight: number | null;
  /** Mouse hover moves the highlight (CC rule 24). */
  setInlineHighlight: (index: number | null) => void;
  /** Element id for the listbox; rows are `${inlineListboxId}-opt-${index}`
   *  so the textarea can point aria-activedescendant at the active row
   *  (combobox pattern — the textarea keeps focus the whole time). */
  inlineListboxId: string;
  /** Bind on the listbox container: the outside pointer-down dismiss needs
   *  the containment check to let row clicks through. */
  inlineListboxRef: RefObject<HTMLDivElement | null>;
  closeInline: () => void;
  /** Insert one mention token at the caret (or over the detected `@query`). */
  insertToken: (token: MentionToken) => void;
  /** Slash-command menu state (#731, detail face only). Sections carry the
   *  partition (builtins first, then skills); `slashRows` is the same rows
   *  flattened for highlight indexing. A zero total means the empty state. */
  slashOpen: boolean;
  slashQuery: string;
  /** Start offset of the detected `/` token (listbox data-caret anchor). */
  slashCaret: number | null;
  slashSections: SlashSection[];
  slashRows: SlashRow[];
  slashHighlight: number | null;
  setSlashHighlight: (index: number | null) => void;
  slashListboxId: string;
  slashListboxRef: RefObject<HTMLDivElement | null>;
  closeSlash: () => void;
  /** Accept a slash row the way Enter/Tab-with-highlight would (`via`
   *  selects run-vs-insert per the approved semantics). */
  acceptSlashRow: (row: SlashRow, via: 'enter' | 'tab') => void;
  /** `/help` panel open state (an execute builtin like the rest). */
  helpOpen: boolean;
  closeHelp: () => void;
  /** Rows for the help panel: the currently available builtins. */
  helpRows: SlashRow[];
  /** Team-skill count for the help panel footer line. */
  helpSkillCount: number;
  /** Batched insert for the popover multi-select: every token composes in
   *  ONE draft update at the evolving caret. The old per-token loop read
   *  the same stale draft closure per call, so only the last token of a
   *  multi-select survived (#728 failure mode 11 coverage). */
  insertTokens: (tokens: MentionToken[]) => void;
  /** Insert a file path at the caret (#760: bare path text + trailing space,
   *  same STORED-range consumption as the token path). */
  insertFile: (path: string) => void;
  /** mentionGroups with the empty-groups fallback applied (the picker opens
   *  on empty groups so the user still sees the zero counts, r9 §2.2). */
  groups: MentionGroups;
  /** Natural-language skill suggestion (#823): the matched team skill for
   *  the current draft, or null. Live only while both completion popups are
   *  closed (the `/` and `@` faces own their keys — this face never steals
   *  Tab/Enter/Esc from them) and never on static faces. */
  suggestion: SkillSuggestion | null;
  /** Accept the suggestion the way Tab-with-hint would: inserts the skill
   *  token at the caret without consuming any typed text. */
  acceptSuggestion: () => void;
  /** Dismiss this suggestion instance (single-ignore: Esc or the strip's
   *  close button; the ignore lasts until the draft is sent). */
  dismissSuggestion: () => void;
}

const EMPTY_GROUPS: MentionGroups = {
  todo: [],
  skill: [],
  agent: [],
  project: [],
  machine: [],
};

function sameRange(a: CompletionRange, b: CompletionRange): boolean {
  return a.start === b.start && a.end === b.end && a.query === b.query;
}

export function useComposerWire(options: ComposerWireOptions): ComposerWire {
  const {
    editable = false,
    draft: draftProp,
    onDraftChange,
    onSend,
    onAttachment,
    mentionGroups,
    mentionFiles,
    slash: slashOptions,
  } = options;

  const [internalDraft, setInternalDraft] = useState('');
  const controlled = draftProp !== undefined && onDraftChange !== undefined;
  const staticFace = draftProp !== undefined && onDraftChange === undefined;
  const draft = controlled || staticFace ? (draftProp as string) : internalDraft;
  const setDraft: Dispatch<SetStateAction<string>> = controlled
    ? (next) =>
        (onDraftChange as (value: string) => void)(typeof next === 'function' ? next(draft) : next)
    : staticFace
      ? () => {}
      : setInternalDraft;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineListboxRef = useRef<HTMLDivElement | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // #757 in-transit placeholders: one card per file with an upload in
  // flight (detail + chief faces render pendingAttachments in the strip).
  const {
    pending: pendingAttachments,
    track: trackPending,
    untrack: untrackPending,
  } = usePendingAttachments();

  // Inline @ completion state (#728). The ref mirror is the synchronous
  // source of truth for event handlers (React state lags inside the same
  // event); applyRange dedupes through it so a keyup re-evaluation after a
  // consumed arrow key cannot reset the highlight it just moved.
  const [inlineRange, setInlineRange] = useState<CompletionRange | null>(null);
  const inlineRangeRef = useRef<CompletionRange | null>(null);
  // The range dismissed by an explicit Esc: the dismissing key's own keyup
  // re-evaluation re-detects the exact same range (the caret never moved),
  // which without this marker would instantly reopen the listbox the user
  // just closed. Any DIFFERENT detection (typing, caret move) clears the
  // marker — Esc dismisses this token instance, it does not disable the
  // trigger.
  const dismissedRangeRef = useRef<CompletionRange | null>(null);
  const [inlineHighlight, setInlineHighlight] = useState<number | null>(null);
  const inlineListboxId = useId();
  const agentCount = mentionGroups?.agent.length ?? 0;
  const fileCount = mentionFiles?.length ?? 0;
  const inlineOpen = inlineRange !== null && agentCount + fileCount > 0;

  // Slash-command completion state (#731). Mirrors the inline `@` shape:
  // a ref mirror for synchronous event reads, an Esc-dismissed marker so
  // the dismissing key's own keyup cannot reopen, and a null highlight
  // (the top row is NOT preselected — Enter without highlight sends).
  // The two detectors are mutually exclusive by construction (S3); the
  // apply functions additionally cross-clear so a stale sibling can never
  // leave two popups open at once (failure mode 4).
  const [slashRange, setSlashRange] = useState<CompletionRange | null>(null);
  const slashRangeRef = useRef<CompletionRange | null>(null);
  const dismissedSlashRef = useRef<CompletionRange | null>(null);
  const [slashHighlight, setSlashHighlight] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const slashListboxId = useId();
  const slashListboxRef = useRef<HTMLDivElement | null>(null);
  const slashEnabled = editable && slashOptions !== undefined;

  // Natural-language skill suggestion (#823): the skill dismissed by an
  // explicit Esc / close-button stays dismissed until the draft is sent —
  // typing more text never resurrects the same nudge, a different matched
  // skill still shows.
  const [dismissedSkillId, setDismissedSkillId] = useState<string | null>(null);

  // Mirror of the freshest committed draft (#729): an upload resolving
  // seconds after the paste must insert into the text as it stands now —
  // the render-scoped `draft` closure would be stale and eat everything
  // typed during the upload.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // Paste numbering per draft (CC [Image #N] spirit) + in-flight count
  // driving the send gate below.
  const pastedNameCounterRef = useRef<PastedNameCounter | null>(null);
  if (pastedNameCounterRef.current === null)
    pastedNameCounterRef.current = createPastedNameCounter();
  const attachInFlightRef = useRef(0);
  // The value+caret produced by the in-flight attachment insert, consumed
  // by the attach layout effect in the very commit that lands the draft.
  const pendingAttachRef = useRef<{ value: string; caret: number } | null>(null);

  const applyRange = useCallback((next: CompletionRange | null) => {
    const prev = inlineRangeRef.current;
    if (prev === next) return;
    if (prev !== null && next !== null && sameRange(prev, next)) return;
    if (next !== null) {
      const dismissed = dismissedRangeRef.current;
      if (dismissed !== null) {
        if (sameRange(dismissed, next)) return;
        dismissedRangeRef.current = null;
      }
      // Opening the `@` menu retires a stale slash token (mirror of the
      // slash face's cross-clear above).
      slashRangeRef.current = null;
      setSlashRange(null);
      setSlashHighlight(null);
    }
    inlineRangeRef.current = next;
    setInlineRange(next);
    // A fresh token/query re-sorts the candidates (CC rule 12/15) — never
    // carry a highlight across into the new list.
    setInlineHighlight(null);
  }, []);

  const closeInline = useCallback(() => {
    applyRange(null);
  }, [applyRange]);

  const applySlashRange = useCallback((next: CompletionRange | null) => {
    const prev = slashRangeRef.current;
    if (prev === next) return;
    if (prev !== null && next !== null && sameRange(prev, next)) return;
    if (next !== null) {
      const dismissed = dismissedSlashRef.current;
      if (dismissed !== null) {
        if (sameRange(dismissed, next)) return;
        dismissedSlashRef.current = null;
      }
      // Opening the slash menu retires a stale `@` token (and Esc on the
      // `@` face retires a stale slash token via applyRange's mirror).
      inlineRangeRef.current = null;
      setInlineRange(null);
      setInlineHighlight(null);
    }
    slashRangeRef.current = next;
    setSlashRange(next);
    setSlashHighlight(null);
  }, []);

  const closeSlash = useCallback(() => {
    applySlashRange(null);
  }, [applySlashRange]);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  /** Re-judge the token from the live DOM value + caret. Runs on change,
   *  on caret-only moves (keyup / click / select) and after IME commit.
   *  Slash is judged first; a live slash token suppresses the `@` face. */
  const reevaluate = useCallback(() => {
    if (!editable) return;
    const ta = textareaRef.current;
    if (ta == null) return;
    const caret = ta.selectionStart ?? ta.value.length;
    if (slashEnabled) {
      const slash = detectCompletionToken(ta.value, caret, SLASH_COMPLETION_SPEC);
      if (slash !== null) {
        applySlashRange(slash);
        return;
      }
      applySlashRange(null);
    }
    applyRange(detectCompletionToken(ta.value, caret, MENTION_COMPLETION_SPEC));
  }, [editable, slashEnabled, applySlashRange, applyRange]);

  /** Change-driven re-judge. A value change is always a fresh user edit, so
   *  it retires the Esc-dismissed markers first: re-typing the identical
   *  token after Esc must reopen (the markers exist only to swallow the
   *  dismissing key's own caret-only re-evaluation, which arrives via
   *  handleCaretMoved below with the markers intact). Both faces share
   *  this law — the `@` face had the same latent stickiness. */
  const reevaluateFromChange = useCallback(() => {
    dismissedRangeRef.current = null;
    dismissedSlashRef.current = null;
    reevaluate();
  }, [reevaluate]);

  // Unified `@` roster (#760: agents + files, ONE fuzzy pass — CC rules
  // 14-18: subsequence + smart case + boundary bonus, capped at 15).
  // Concatenation order is the tie-break (stable sort): agents keep roster
  // priority, files (enumeration order = git order) follow. An empty query
  // lists the concatenated roster in order. mentionFiles absent/empty = the
  // #728 agents-only list, unchanged.
  const inlineRows = useMemo(() => {
    if (inlineRange === null || mentionGroups == null) return [];
    const rows: InlineCompletionRow[] = [
      ...mentionGroups.agent.map(
        (a): InlineCompletionRow => ({
          kind: 'agent',
          id: a.id,
          label: a.label,
          ...(a.subtitle !== undefined ? { subtitle: a.subtitle } : {}),
        }),
      ),
      ...(mentionFiles ?? []).map(
        (f): InlineCompletionRow => ({
          kind: 'file',
          id: f.path,
          label: f.type === 'tree' ? `${f.path}/` : f.path,
          fileType: f.type,
        }),
      ),
    ];
    return fuzzyFilter(inlineRange.query, rows, (r) => r.label);
  }, [inlineRange, mentionGroups, mentionFiles]);

  // Slash menu rows (#731): builtins gated by availability, then skills in
  // roster order. Flat rows drive the single highlight index across both
  // sections. The menu stays open on a zero total to show the empty state.
  const slashSections: SlashSection[] = useMemo(() => {
    if (slashRange === null || !slashEnabled) return [];
    return buildSlashSections({
      query: slashRange.query,
      available: {
        review: slashOptions?.reviewAvailable === true,
        stop: slashOptions?.stopAvailable === true,
      },
      skills: (mentionGroups?.skill ?? []).map((s) => ({
        id: s.id,
        name: s.label,
        ...(s.subtitle != null ? { description: s.subtitle } : {}),
      })),
    });
  }, [slashRange, slashEnabled, slashOptions, mentionGroups]);
  const slashRows = useMemo(() => slashSections.flatMap((s) => s.rows), [slashSections]);
  const slashOpen = slashRange !== null && slashEnabled;
  const slashQuery = slashRange?.query ?? '';

  // Skill suggestion (#823): draft-derived, over the same skill vocab that
  // feeds the mention picker and the `/` menu (mentionGroups.skill — the
  // useSkills projection, never a side table). Suppressed while either
  // completion popup is open so Tab/Enter/Esc keep their menu meaning, and
  // off entirely on static faces. A dismissed skill is excluded from the
  // retry so a multi-intent draft falls through to the next live nudge
  // instead of going quiet entirely.
  const suggestion = useMemo<SkillSuggestion | null>(() => {
    if (!editable) return null;
    if (slashOpen || inlineOpen) return null;
    const skills = (mentionGroups?.skill ?? []).map((s) => ({
      id: s.id,
      name: s.label,
      ...(s.subtitle !== undefined ? { description: s.subtitle } : {}),
    }));
    const hit = suggestSkill(draft, skills);
    if (hit === null) return null;
    if (hit.skillId !== dismissedSkillId) return hit;
    return suggestSkill(
      draft,
      skills.filter((s) => s.id !== dismissedSkillId),
    );
  }, [draft, mentionGroups, editable, slashOpen, inlineOpen, dismissedSkillId]);
  // Synchronous mirror for event handlers (same React-state-lag rationale
  // as the inline range ref above).
  const suggestionRef = useRef<SkillSuggestion | null>(null);
  suggestionRef.current = suggestion;
  const helpSkillCount = mentionGroups?.skill.length ?? 0;
  const helpRows = useMemo(
    () =>
      buildSlashSections({
        query: '',
        available: {
          review: slashOptions?.reviewAvailable === true,
          stop: slashOptions?.stopAvailable === true,
        },
        skills: [],
      }).flatMap((s) => s.rows),
    [slashOptions],
  );

  const send = () => {
    // Attachment upload in flight: the send is blocked so a message can
    // never leave without the tokens still being uploaded (#729 failure
    // mode 3). The draft survives untouched; Enter sends once landed.
    if (attachInFlightRef.current > 0) return;
    // A sent draft retires the single-ignore (#823): the next draft judges
    // its suggestion fresh.
    setDismissedSkillId(null);
    const text = draft.trim();
    if (text === '' && !editable) {
      // Static capture face: the fixture send stays callable with the empty
      // text (fixture callers wire a scripted chain reaction and ignore the
      // argument); live faces have no onSend delegate at all when static.
      onSend?.(text);
      return;
    }
    if (text === '') return;
    const result = onSend?.(text);
    if (result instanceof Promise) {
      // Async face (steer / chief send): success clears the draft; a
      // rejection (409 gate, server error) keeps it — no lost words. The
      // failure toast belongs to the mutation-owning surface (#635).
      void result.then(() => setDraft('')).catch(() => {});
    } else {
      setDraft('');
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  /** Upload delegate runner shared by the file-picker and paste paths
   *  (#729): tracks the attaching flag (a count, so overlapping uploads
   *  keep the send gate closed until the last one lands), injects the
   *  returned tokens line-atomic at `caret` (null = tail-append, the
   *  pre-#729 clip shape), then restores the caret IN the commit that
   *  lands the draft (the attach layout effect below) — only when the
   *  textarea still owns focus, so a file-picker round trip never steals
   *  it back. #757: each run also tracks its files as pending entries (one
   *  placeholder card per file, painted the same tick as the paste) and
   *  untracks exactly those uids when it settles — success, empty, or
   *  delegate-level rejection — so overlapping runs never clear each other
   *  and a failed file's card leaves with its toast. */
  const runAttachment = (files: File[], caret: number | null, also?: () => void) => {
    if (!onAttachment) {
      also?.();
      return;
    }
    attachInFlightRef.current += 1;
    setAttaching(true);
    const pendingUids = trackPending(files);
    void Promise.resolve(onAttachment(files))
      .then((tokens) => {
        if (tokens.length === 0) return;
        const inserted = insertAttachmentTokens(draftRef.current, tokens, caret);
        // The restore rides the attach layout effect below, in the same
        // commit that lands the new draft. A requestAnimationFrame restore
        // is a race against the React commit: when the frame callback runs
        // first, the setSelectionRange clamps against the OLD value and the
        // committed value then drops the caret at the end (the mid-line
        // paste spec failing 57 vs 63 under CI timing). The mention path
        // moved off the same race for the same reason (#728).
        pendingAttachRef.current = inserted;
        setDraft(inserted.value);
      })
      .catch((err) => {
        // Per-file failures already toasted on the surface; a delegate-level
        // rejection is a bug — surface it, never swallow silently (#729
        // failure mode 4).
        console.error('attachment delegate failed', err);
      })
      .finally(() => {
        untrackPending(pendingUids);
        attachInFlightRef.current = Math.max(0, attachInFlightRef.current - 1);
        if (attachInFlightRef.current === 0) setAttaching(false);
        also?.();
      });
  };

  const onPickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset the value so picking the same file again re-fires change.
    event.target.value = '';
    if (files.length === 0) return;
    runAttachment(files, null);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAttachment) return;
    const files = filesFromClipboardData(event.clipboardData);
    // Text-only paste (or mixed clipboard read as text): the event is never
    // touched, so plain text behavior stays byte-identical (#729 failure
    // mode 7). A mixed file+text clipboard extracts the files and drops the
    // text — files win per the issue ruling.
    if (files.length === 0) return;
    event.preventDefault();
    // The inline @ listbox would dangle on a query the paste just replaced.
    closeInline();
    const counter = pastedNameCounterRef.current as PastedNameCounter;
    // Per-draft numbering: a blank draft with nothing in flight restarts at
    // 1; the in-flight guard keeps rapid double pastes from colliding.
    counter.begin(draftRef.current.trim() === '');
    const caret = event.currentTarget.selectionStart ?? draftRef.current.length;
    runAttachment(preparePastedFiles(files, counter), caret, () => counter.end());
  };

  // The caret restore for the pending insert, applied by the layout effect
  // below IN the commit that lands the new draft. A requestAnimationFrame
  // restore is a race: fast typing (key repeat — or a test harness typing
  // several chars inside one frame) lands keystrokes before the frame
  // callback, and the late setSelectionRange then yanks the caret back
  // mid-typing and scrambles the text (`@re` came out as `re@`). The
  // layout effect runs after the DOM mutation and before any subsequent
  // input event, so the restore can never interleave with typing.
  const pendingInsertRef = useRef<{ value: string; caret: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingInsertRef.current;
    if (pending == null) return;
    pendingInsertRef.current = null;
    // The parent did not adopt the insert (rejected/transformed the draft)
    // — do not fight its value.
    if (pending.value !== draft) return;
    const ta = textareaRef.current;
    if (ta == null) return;
    // focus() is a no-op while the combobox pattern keeps the textarea
    // focused; it matters for the popover path, where the toolbar button
    // held focus.
    ta.focus();
    ta.setSelectionRange(pending.caret, pending.caret);
  }, [draft]);

  // The attachment-path caret restore (#729), in the commit that lands the
  // inserted tokens: layout effects run after the DOM mutation and before
  // any subsequent input event, so the restore can never lose the race
  // against the commit or interleave with typing. Unlike the mention path
  // it never calls focus() — a file-picker round trip must not steal focus
  // back, so the restore only applies while the textarea already owns it.
  useLayoutEffect(() => {
    const pending = pendingAttachRef.current;
    if (pending == null) return;
    pendingAttachRef.current = null;
    // The parent did not adopt the insert (rejected/transformed the draft)
    // — do not fight its value.
    if (pending.value !== draft) return;
    const ta = textareaRef.current;
    if (ta == null || document.activeElement !== ta) return;
    ta.setSelectionRange(pending.caret, pending.caret);
  }, [draft]);

  /** Text insertion over a STORED detection range `[start, end)` so the
   *  `@query` (or `/query`) is consumed instead of left behind as residue.
   *  The stored range is the contract (#728 failure mode 5): recomputing
   *  from a caret that drifted after detection would eat neighbouring text.
   *  All pieces compose in ONE draft update at the evolving caret
   *  (multi-select popover path — the old per-token loop read the same stale
   *  draft closure per call, so only the last token of a multi-select
   *  survived, #728 failure mode 11). */
  const applyTextInsert = (
    produce: (
      current: string,
      at: number,
      end: number | undefined,
    ) => { value: string; caret: number },
    range: CompletionRange | null,
  ) => {
    const ta = textareaRef.current;
    if (ta == null) {
      setDraft((current) => produce(current, current.length, undefined).value);
      return;
    }
    const start = range !== null ? range.start : (ta.selectionStart ?? ta.value.length);
    const replaceEnd = range !== null ? range.end : undefined;
    closeInline();
    closeSlash();
    pendingInsertRef.current = null;
    setDraft((current) => {
      const result = produce(current, start, replaceEnd);
      pendingInsertRef.current = { value: result.value, caret: result.caret };
      return result.value;
    });
  };

  const insertTokensAt = (tokens: MentionToken[], range: CompletionRange | null) => {
    if (tokens.length === 0) return;
    applyTextInsert((current, at, end) => {
      let value = current;
      let caret = at;
      let rest = end;
      for (const token of tokens) {
        // Later tokens land after the previous insertion, never re-replacing.
        const result = insertMentionText(value, token, caret, rest);
        value = result.value;
        caret = result.caret;
        rest = undefined;
      }
      return { value, caret };
    }, range);
  };

  const insertTokens = (tokens: MentionToken[]) => {
    insertTokensAt(tokens, inlineOpen ? inlineRangeRef.current : null);
  };

  /** Accept the live suggestion: the skill token lands at the caret, the
   *  typed prose stays untouched (range null = pure caret insert, nothing
   *  consumed). The new draft references the skill, so the matcher goes
   *  quiet on its own — no extra state to clear. Plain function (not
   *  useCallback): it must close over the current render's insertTokensAt,
   *  whose controlled-mode setDraft carries the fresh draft — a frozen
   *  first-render closure would insert into the empty initial draft. */
  const acceptSuggestion = () => {
    const hit = suggestionRef.current;
    if (hit === null) return;
    insertTokensAt([{ kind: 'skill', id: hit.skillId, label: hit.skillName }], null);
  };

  const dismissSuggestion = () => {
    const hit = suggestionRef.current;
    if (hit === null) return;
    setDismissedSkillId(hit.skillId);
  };

  const insertToken = (token: MentionToken) => insertTokens([token]);

  /** File path insert (#760): bare path text + trailing space (CC rule 26),
   *  same STORED-range consumption as the token path. */
  const insertFileAt = (path: string, range: CompletionRange | null) => {
    applyTextInsert((current, at, end) => insertFileText(current, path, at, end), range);
  };

  const insertFile = (path: string) => {
    insertFileAt(path, inlineOpen ? inlineRangeRef.current : null);
  };
  /** Run a builtin execute command (#731). Every entry maps to a live
   *  composer action — there are no placeholder rows (D1). */
  const runBuiltin = (name: BuiltinSlashName) => {
    closeSlash();
    switch (name) {
      case 'clear':
        setDraft('');
        break;
      case 'attach':
        openFilePicker();
        break;
      case 'mention':
        setPickerOpen(true);
        break;
      case 'review':
        slashOptions?.onReview?.();
        break;
      case 'stop':
        slashOptions?.onStop?.();
        break;
      case 'help':
        setHelpOpen(true);
        break;
    }
  };

  /** Replace the `/query` span with literal `/name ` text (rule 60) —
   *  the mid-prompt and Tab shape that never runs anything. Caret restore
   *  rides pendingInsertRef like the mention path. */
  const insertSlashLiteral = (name: string) => {
    const range = slashRangeRef.current;
    if (range === null) return;
    closeSlash();
    pendingInsertRef.current = null;
    setDraft((current) => {
      // The range was detected against an older value; clamp it the way the
      // mention path does instead of recomputing (failure mode 5 family).
      const start = Math.max(0, Math.min(range.start, current.length));
      const end = Math.max(start, Math.min(range.end, current.length));
      const inserted = insertSlashText(current, { start, end, query: range.query }, name);
      pendingInsertRef.current = { value: inserted.value, caret: inserted.caret };
      return inserted.value;
    });
  };

  /** Accept one slash row per the approved semantics: message-start Enter
   *  on an execute row runs it; skill rows insert their token; everything
   *  else lands literal `/name ` text. */
  const acceptSlashRow = (row: SlashRow, via: 'enter' | 'tab') => {
    const range = slashRangeRef.current;
    if (range === null) return;
    const ta = textareaRef.current;
    const value = ta?.value ?? '';
    const action = resolveSlashAccept({
      name: row.name,
      kind: row.kind,
      atStart: isMessageStart(value, range.start),
      via,
    });
    if (action === 'run' && row.builtin !== undefined) {
      runBuiltin(row.builtin);
      return;
    }
    if (action === 'insert-token' && row.skillId !== undefined) {
      const skill = mentionGroups?.skill.find((s) => s.id === row.skillId);
      insertTokensAt([{ kind: 'skill', id: row.skillId, label: skill?.label ?? row.name }], range);
      return;
    }
    insertSlashLiteral(row.name);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (!editable) return;
    reevaluateFromChange();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = event.nativeEvent.isComposing;
    // Slash face first (#731): while its menu is open the completion keys
    // belong to it; the `@` face only runs when slash is closed (the two
    // detectors never co-open, failure mode 4).
    if (slashOpen) {
      const slashIntent = completionKeyIntent(
        { key: event.key, shiftKey: event.shiftKey, isComposing },
        { open: true, highlight: slashHighlight, matchCount: slashRows.length },
      );
      if (slashIntent.kind !== 'ignore') event.preventDefault();
      if (slashIntent.kind === 'dismiss') {
        dismissedSlashRef.current = slashRangeRef.current;
        closeSlash();
        return;
      }
      if (slashIntent.kind === 'navigate') {
        setSlashHighlight(slashIntent.index);
        return;
      }
      if (slashIntent.kind === 'accept') {
        const picked = slashRows[slashIntent.index];
        if (picked != null) {
          acceptSlashRow(picked, event.key === 'Tab' ? 'tab' : 'enter');
        }
        return;
      }
    }
    const intent = completionKeyIntent(
      { key: event.key, shiftKey: event.shiftKey, isComposing },
      { open: inlineOpen, highlight: inlineHighlight, matchCount: inlineRows.length },
    );
    if (intent.kind !== 'ignore') event.preventDefault();
    if (intent.kind === 'dismiss') {
      // preventDefault is load-bearing for the #634 Esc ladder: the detail
      // page's window handler bails on event.defaultPrevented, so closing
      // the listbox consumes the key instead of leaving the page.
      // The marker keeps this same key's keyup re-evaluation from
      // instantly reopening the dismissed range.
      dismissedRangeRef.current = inlineRangeRef.current;
      closeInline();
      return;
    }
    if (intent.kind === 'navigate') {
      setInlineHighlight(intent.index);
      return;
    }
    if (intent.kind === 'accept') {
      const picked = inlineRows[intent.index];
      if (picked?.kind === 'agent') {
        insertTokens([{ kind: 'agent', id: picked.id, label: picked.label }]);
      } else if (picked?.kind === 'file') {
        insertFile(picked.label);
      }
      return;
    }
    // intent === 'ignore': the skill-suggestion face (#823) runs here —
    // reachable only with both completion popups closed (their open-state
    // branches above all return first), so Tab/Esc can never steal a menu
    // key. IME composition never triggers either layer (#728 failure
    // mode 8 carries over).
    if (!slashOpen && !inlineOpen && suggestionRef.current !== null && !isComposing) {
      if (event.key === 'Tab') {
        event.preventDefault();
        acceptSuggestion();
        return;
      }
      if (event.key === 'Escape') {
        // preventDefault is load-bearing for the #634 Esc ladder (see the
        // inline dismiss above): closing the hint consumes the key.
        event.preventDefault();
        dismissSuggestion();
        return;
      }
    }
    // intent === 'ignore': the composer's own keys. Enter sends — but never
    // mid-IME-composition (the composing Enter belongs to the candidate
    // window; #728 failure mode 8) and never with shift (newline). A plain
    // Enter on an ordered-list line (#814) continues the list instead of
    // sending: the caret restore rides pendingInsertRef like the mention
    // path (commit-atomic, no rAF race). Modified Enter (shift/meta/ctrl/
    // alt) never takes the list branch — those keep their ambient meaning.
    // Priority order for Enter is therefore: completion-accept (above) >
    // ordered-list continuation > send.
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      if (event.metaKey !== true && event.ctrlKey !== true && event.altKey !== true) {
        const ta = textareaRef.current;
        if (ta != null) {
          const continued = applyOrderedListEnter(ta.value, ta.selectionStart ?? ta.value.length);
          if (continued !== null) {
            event.preventDefault();
            pendingInsertRef.current = { value: continued.value, caret: continued.caret };
            setDraft(continued.value);
            return;
          }
        }
      }
      event.preventDefault();
      send();
    }
  };

  // Outside pointer-down dismiss (web adaptation, #727 @7): clicks anywhere
  // except the textarea (caret re-evaluation handles those) and the listbox
  // itself (row clicks handle those) close the popup. Capture phase so an
  // inner stopPropagation cannot swallow the dismiss. Covers both the `@`
  // and the `/` faces (#731).
  useEffect(() => {
    if (!inlineOpen && !slashOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target == null) return;
      const ta = textareaRef.current;
      if (ta?.contains(target)) return;
      const box = inlineListboxRef.current;
      if (box?.contains(target)) return;
      const slashBox = slashListboxRef.current;
      if (slashBox?.contains(target)) return;
      closeInline();
      closeSlash();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [inlineOpen, slashOpen, closeInline, closeSlash]);

  const groups = mentionGroups ?? EMPTY_GROUPS;

  return {
    draft,
    setDraft,
    send,
    handleChange,
    handleKeyDown,
    handleCaretMoved: reevaluate,
    handleCompositionEnd: reevaluate,
    handleBlur: () => {
      closeInline();
      closeSlash();
    },
    textareaRef,
    fileInputRef,
    openFilePicker,
    attaching,
    pendingAttachments,
    onPickFiles,
    handlePaste,
    pickerOpen,
    togglePicker: () => setPickerOpen((value) => !value),
    closePicker: () => setPickerOpen(false),
    inlineOpen,
    inlineCaret: inlineRange?.start ?? null,
    inlineQuery: inlineRange?.query ?? '',
    inlineRows,
    inlineHighlight,
    setInlineHighlight,
    inlineListboxId,
    inlineListboxRef,
    closeInline,
    insertToken,
    insertTokens,
    insertFile,
    groups,
    suggestion,
    acceptSuggestion,
    dismissSuggestion,
    slashOpen,
    slashQuery,
    slashCaret: slashRange?.start ?? null,
    slashSections,
    slashRows,
    slashHighlight,
    setSlashHighlight,
    slashListboxId,
    slashListboxRef,
    closeSlash,
    acceptSlashRow,
    helpOpen,
    closeHelp,
    helpRows,
    helpSkillCount,
  };
}
