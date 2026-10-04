// In-flight attachment bookkeeping (#757). One hook instance per composer
// face (detail wire, new-task dialog); the strip component only reads the
// list. track() mints an entry per file BEFORE the grant fires so the
// placeholder paints in the same tick as the paste — the empty window the
// ticket closes. untrack() drops exactly the uids of the run that settled,
// so overlapping uploads never clear each other, and revokes their blob
// URLs (an unrevoked object URL pins the file bytes for the page's life).
// Unmount revokes whatever is left (a send racing an unmount).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingAttachment } from './attachment-paste.js';

export interface PendingTracker {
  pending: PendingAttachment[];
  track: (files: File[]) => string[];
  untrack: (uids: string[]) => void;
}

export function usePendingAttachments(): PendingTracker {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const seqRef = useRef(0);
  // Synchronous mirror for the unmount revoke: state may lag the last
  // track/untrack inside the same commit.
  const liveRef = useRef<PendingAttachment[]>([]);
  liveRef.current = pending;

  const track = useCallback((files: File[]): string[] => {
    const entries: PendingAttachment[] = files.map((file) => {
      seqRef.current += 1;
      return {
        uid: `pending-${seqRef.current}`,
        name: file.name,
        mime: file.type,
        url: file.type.toLowerCase().startsWith('image/') ? URL.createObjectURL(file) : null,
      };
    });
    setPending((current) => [...current, ...entries]);
    return entries.map((entry) => entry.uid);
  }, []);

  const untrack = useCallback((uids: string[]): void => {
    if (uids.length === 0) return;
    const gone = new Set(uids);
    setPending((current) => {
      for (const entry of current) {
        if (gone.has(entry.uid) && entry.url !== null) URL.revokeObjectURL(entry.url);
      }
      return current.filter((entry) => !gone.has(entry.uid));
    });
  }, []);

  useEffect(
    () => () => {
      for (const entry of liveRef.current) {
        if (entry.url !== null) URL.revokeObjectURL(entry.url);
      }
    },
    [],
  );

  return { pending, track, untrack };
}
