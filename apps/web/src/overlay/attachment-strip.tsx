// Composer attachment strip (issue #757): the visible face for both ends of
// the paste→upload→token window. While a grant/upload is in flight the draft
// holds no token yet — the strip renders one placeholder card per pending
// file (image bytes via blob URL at chip size, so landing the token never
// moves layout). Once tokens land, the same strip renders the settled chips
// parsed whole-line off the draft (parseAttachmentTokens — the renderer never
// chip-ifies an inline token, and neither does this). The draft text itself
// is never touched for placeholders (ATTACHMENT_LINE anchoring would break).
//
// Clicking an image card — in-flight or settled — opens the preview lightbox
// (AttachmentPreview, DialogShell at the default --z-dialog tier, above the
// new-task low-tier panel and the docked chief drawer). Non-image chips keep
// their transcript link shape: there is no viewer for them.
//
// Reuse audit (ticket asks to reuse before building new):
//   - settled chip = AttachmentChip (detail/chat-markdown.tsx:179) with its
//     #757 onPreview branch — same geometry the transcript renders;
//   - the project-page file tab is a file-name list with row select, not an
//     image viewer — verified, no reusable preview there; transcript/docpane
//     and dir-browser have no image viewer either. The lightbox below is new.
// Placement: the strip itself is in-flow static; each face positions it —
// detail composer floats it below its fixed 76px box (the above-box slot is
// the #812 mention strip's), chief and new-task take it in flow. All rules
// live in ./attachment-strip.css, imported here so they load on every face
// (detail.css never reaches the board page, overlay.css never reaches the
// detail page — a per-face stylesheet cannot cover this component).

import { useMemo, useState } from 'react';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { AttachmentChip } from '../detail/chat-markdown.js';
import { useI18n } from '../i18n/provider.js';
import { type PendingAttachment, parseAttachmentTokens } from './attachment-paste.js';
import './attachment-strip.css';

interface PreviewTarget {
  name: string;
  src: string;
}

/** Image preview lightbox (#757 B). DialogShell owns Esc / outside-press /
//  focus-return; the src snapshot is taken at open time so a token landing
//  (or failing) underneath never yanks the open picture. A dead src (deleted
//  attachment) falls back to the file name instead of a blank panel. */
export function AttachmentPreview({
  name,
  src,
  onClose,
}: {
  name: string;
  src: string;
  onClose: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <DialogShell
      title={name}
      onClose={onClose}
      onBackdropClick={onClose}
      width={640}
      className="attachment-preview"
    >
      <div className="attachment-preview-body">
        {broken ? (
          <div className="attachment-preview-broken">{name}</div>
        ) : (
          <img
            src={src}
            alt={name}
            className="attachment-preview-img"
            onError={() => setBroken(true)}
          />
        )}
      </div>
    </DialogShell>
  );
}

export function AttachmentStrip({
  draft,
  pending,
}: {
  /** Live draft text — settled chips parse off this, read-only. */
  draft: string;
  /** Uploads in flight (usePendingAttachments) — placeholder cards. */
  pending: PendingAttachment[];
}) {
  const { t } = useI18n();
  const settled = useMemo(() => parseAttachmentTokens(draft), [draft]);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  if (pending.length === 0 && settled.length === 0) return null;
  return (
    <div className="attachment-strip" role="status" aria-label={t('附件')}>
      {pending.map((entry) =>
        entry.url !== null ? (
          <button
            key={entry.uid}
            type="button"
            className="spec-chip spec-chip--image spec-chip--preview attachment-pending"
            title={entry.name}
            onClick={() => {
              if (entry.url !== null) setPreview({ name: entry.name, src: entry.url });
            }}
          >
            <img src={entry.url} alt={entry.name} className="spec-chip-img" />
            <span className="attachment-pending-badge">{t('上传中')}</span>
          </button>
        ) : (
          <span key={entry.uid} className="spec-chip attachment-pending" title={entry.name}>
            <span className="composer-chip-label">{entry.name}</span>
            <span className="attachment-pending-badge">{t('上传中')}</span>
          </span>
        ),
      )}
      {settled.map((token, index) => (
        <AttachmentChip
          key={`${token.key}#${index}`}
          name={token.name}
          attachmentKey={token.key}
          onPreview={(name, src) => setPreview({ name, src })}
        />
      ))}
      {preview !== null && (
        <AttachmentPreview name={preview.name} src={preview.src} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
