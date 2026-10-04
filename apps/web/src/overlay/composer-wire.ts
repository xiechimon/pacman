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
//      path stays tail-append). Grant + upload stay with the calling
//      surface (onAttachment delegate returns the tokens it uploaded).
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
   *  Esc while the listbox is open), then the composer's own Enter-to-send.
   *  IME composition never triggers either layer (#728 failure mode 8). */
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

  /** Re-judge the token from the live DOM value + caret. Runs on change,
   *  on caret-only moves (keyup / click / select) and after IME commit. */
  const reevaluate = useCallback(() => {
    if (!editable) return;
    const ta = textareaRef.current;
    if (ta == null) return;
    const caret = ta.selectionStart ?? ta.value.length;
    applyRange(detectCompletionToken(ta.value, caret, MENTION_COMPLETION_SPEC));
  }, [editable, applyRange]);

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

  const send = () => {
    // Attachment upload in flight: the send is blocked so a message can
    // never leave without the tokens still being uploaded (#729 failure
    // mode 3). The draft survives untouched; Enter sends once landed.
    if (attachInFlightRef.current > 0) return;
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
   *  it back. */
  const runAttachment = (files: File[], caret: number | null, also?: () => void) => {
    if (!onAttachment) {
      also?.();
      return;
    }
    attachInFlightRef.current += 1;
    setAttaching(true);
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

  /** Text insertion over the STORED detection range `[start, end)` so the
   *  `@query` is consumed instead of left behind as residue. The stored range
   *  is the contract (#728 failure mode 5): recomputing from a caret that
   *  drifted after detection would eat neighbouring text. All pieces compose
   *  in ONE draft update at the evolving caret (multi-select popover path —
   *  the old per-token loop read the same stale draft closure per call, so
   *  only the last token of a multi-select survived, #728 failure mode 11). */
  const applyTextInsert = (
    produce: (
      current: string,
      at: number,
      end: number | undefined,
    ) => { value: string; caret: number },
  ) => {
    const ta = textareaRef.current;
    if (ta == null) {
      setDraft((current) => produce(current, current.length, undefined).value);
      return;
    }
    const range = inlineOpen ? inlineRangeRef.current : null;
    const start = range !== null ? range.start : (ta.selectionStart ?? ta.value.length);
    const replaceEnd = range !== null ? range.end : undefined;
    closeInline();
    pendingInsertRef.current = null;
    setDraft((current) => {
      const result = produce(current, start, replaceEnd);
      pendingInsertRef.current = { value: result.value, caret: result.caret };
      return result.value;
    });
  };

  const insertTokens = (tokens: MentionToken[]) => {
    if (tokens.length === 0) return;
    applyTextInsert((value, at, end) => {
      let current = value;
      let caret = at;
      let rest = end;
      for (const token of tokens) {
        // Later tokens land after the previous insertion, never re-replacing.
        const result = insertMentionText(current, token, caret, rest);
        current = result.value;
        caret = result.caret;
        rest = undefined;
      }
      return { value: current, caret };
    });
  };

  const insertToken = (token: MentionToken) => insertTokens([token]);

  /** File path insert (#760): bare path text + trailing space (CC rule 26),
   *  same STORED-range consumption as the token path. */
  const insertFile = (path: string) => {
    applyTextInsert((value, at, end) => insertFileText(value, path, at, end));
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (!editable) return;
    const caret = event.target.selectionStart ?? next.length;
    applyRange(detectCompletionToken(next, caret, MENTION_COMPLETION_SPEC));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = event.nativeEvent.isComposing;
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
    // intent === 'ignore': the composer's own keys. Enter sends — but never
    // mid-IME-composition (the composing Enter belongs to the candidate
    // window; #728 failure mode 8) and never with shift (newline).
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      send();
    }
  };

  // Outside pointer-down dismiss (web adaptation, #727 @7): clicks anywhere
  // except the textarea (caret re-evaluation handles those) and the listbox
  // itself (row clicks handle those) close the popup. Capture phase so an
  // inner stopPropagation cannot swallow the dismiss.
  useEffect(() => {
    if (!inlineOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target == null) return;
      const ta = textareaRef.current;
      if (ta != null && ta.contains(target)) return;
      const box = inlineListboxRef.current;
      if (box != null && box.contains(target)) return;
      closeInline();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [inlineOpen, closeInline]);

  const groups = mentionGroups ?? EMPTY_GROUPS;

  return {
    draft,
    setDraft,
    send,
    handleChange,
    handleKeyDown,
    handleCaretMoved: reevaluate,
    handleCompositionEnd: reevaluate,
    handleBlur: closeInline,
    textareaRef,
    fileInputRef,
    openFilePicker,
    attaching,
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
  };
}
