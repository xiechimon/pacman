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
//      @-query listbox path route through one insertToken so the spacing and
//      caret-offset rules live in a single place (#311);
//   4. attachment file-pick wire — the hidden file input ref, the attaching
//      flag and the re-pick value reset (#310). Grant + upload + token
//      injection stay with the calling surface (onAttachment delegate).
//
// Deliberately NOT here: the skins. Both faces keep their own DOM nodes,
// geometry, class names and extra buttons (detail: toolbar / AI review /
// stop; chief: send bar, hero examples). The hook returns state and
// callbacks only and renders no JSX — Multica's useChatController is the
// precedent (chat-page and chat-window share the conversation logic while
// each keeps its own shell).

import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import { useMemo, useRef, useState } from 'react';
import type { MentionGroups } from './mention-picker.js';
import { detectInlineAgentQuery, insertMentionText, type MentionToken } from './mention-token.js';

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
  /** Attachment delegate (#310): the surface owns grant + upload and
   *  injects the returned tokens into the draft via setDraft. */
  onAttachment?: (files: File[]) => void | Promise<void>;
  /** Entity groups feeding both mention paths (#311). Absent = the inline
   *  listbox never opens and the picker shows zero counts. */
  mentionGroups?: MentionGroups;
}

export interface ComposerWire {
  /** The value to bind on the textarea. */
  draft: string;
  /** Draft setter honoring the active mode (controlled / static / internal). */
  setDraft: Dispatch<SetStateAction<string>>;
  /** Send the trimmed draft; empty text is a no-op on editable faces. */
  send: () => void;
  /** Textarea onChange: stores the value and drives the inline @ detection. */
  handleChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Textarea onKeyDown: Escape closes the inline listbox, Enter (no shift)
   *  sends. */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Bind on the textarea element — the caret anchor for mention insertion. */
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  /** Bind on the hidden file input; open it via openFilePicker. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  openFilePicker: () => void;
  /** True while an onAttachment delegate is in flight. */
  attaching: boolean;
  onPickFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  /** MentionPicker popover open state (toolbar path). */
  pickerOpen: boolean;
  togglePicker: () => void;
  closePicker: () => void;
  /** Inline @-query listbox state (typing path). */
  inlineOpen: boolean;
  inlineCaret: number | null;
  /** Agent entries filtered by the partial query after the @. */
  inlineAgents: MentionGroups['agent'];
  closeInline: () => void;
  /** Insert a mention token at the caret; shared by both mention paths. */
  insertToken: (token: MentionToken) => void;
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

export function useComposerWire(options: ComposerWireOptions): ComposerWire {
  const {
    editable = false,
    draft: draftProp,
    onDraftChange,
    onSend,
    onAttachment,
    mentionGroups,
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
  const [attaching, setAttaching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineCaret, setInlineCaret] = useState<number | null>(null);

  const send = () => {
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

  const onPickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset the value so picking the same file again re-fires change.
    event.target.value = '';
    if (files.length === 0 || !onAttachment) return;
    setAttaching(true);
    const result = onAttachment(files);
    void Promise.resolve(result).finally(() => setAttaching(false));
  };

  /** Insert a mention token at the current caret position. Used by both the
   *  MentionPicker (toolbar click) and the @ inline listbox — same code path
   *  so the spacing + caret offset rules live in one place (#311). */
  const insertToken = (token: MentionToken) => {
    const ta = textareaRef.current;
    if (ta == null) {
      setDraft((current) => insertMentionText(current, token, null).value);
      return;
    }
    // For the @ inline path, replace from the @-prefix start to the caret so
    // the resulting text carries just the spaced mention and the original
    // @partial query is dropped.
    const caret = ta.selectionStart ?? draft.length;
    let at = caret;
    if (inlineOpen) {
      const query = detectInlineAgentQuery(draft, caret);
      if (query !== null) {
        at = caret - query.length - 1; // -1 for the leading @
      }
    }
    const { value, caret: nextCaret } = insertMentionText(draft, token, at);
    setDraft(value);
    // Re-focus the textarea + restore the caret after React commits the new
    // value. requestAnimationFrame avoids a frame where the DOM still holds
    // the stale draft.
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
    });
    setInlineOpen(false);
    setInlineCaret(null);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (!editable) return;
    const caret = event.target.selectionStart ?? next.length;
    const query = detectInlineAgentQuery(next, caret);
    if (query !== null && mentionGroups && mentionGroups.agent.length > 0) {
      setInlineOpen(true);
      setInlineCaret(caret);
    } else {
      setInlineOpen(false);
      setInlineCaret(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && inlineOpen) {
      event.preventDefault();
      setInlineOpen(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  // Filter the agents listbox by the partial query after the @ so typing a
  // prefix narrows the list; an empty query shows every agent.
  const inlineAgents = useMemo(() => {
    if (!mentionGroups) return [];
    const caret = inlineCaret ?? 0;
    const query = detectInlineAgentQuery(draft, caret) ?? '';
    const q = query.toLowerCase();
    if (q === '') return mentionGroups.agent;
    return mentionGroups.agent.filter((a) => a.label.toLowerCase().includes(q));
  }, [mentionGroups, draft, inlineCaret]);

  const groups = mentionGroups ?? EMPTY_GROUPS;

  return {
    draft,
    setDraft,
    send,
    handleChange,
    handleKeyDown,
    textareaRef,
    fileInputRef,
    openFilePicker,
    attaching,
    onPickFiles,
    pickerOpen,
    togglePicker: () => setPickerOpen((value) => !value),
    closePicker: () => setPickerOpen(false),
    inlineOpen,
    inlineCaret,
    inlineAgents,
    closeInline: () => {
      setInlineOpen(false);
      setInlineCaret(null);
    },
    insertToken,
    groups,
  };
}
