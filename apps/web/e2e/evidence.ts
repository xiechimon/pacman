import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Opt-in evidence capture for fixture-face specs (#659).
 *
 * Regression runs (CI, any lane's full-suite run) must never write into
 * tracked paths. Three specs used to regenerate their ticket's committed
 * docs/verify PNGs on every run: the rendered UI drifts after the ticket
 * lands, so each full e2e rewrote tracked bytes and dirtied the working
 * tree for every other lane.
 *
 * Evidence generation is now explicit — a task that needs fresh screenshots
 * for its PR runs:
 *
 *   PACMAN_E2E_EVIDENCE=docs/verify/<ticket> npx playwright test <spec>
 *
 * The value resolves from the repo root (a subdir like <ticket>/after is
 * fine), the directory is created on demand, and the task branch commits the
 * regenerated PNGs. Unset = no-op: the committed history stays byte-frozen
 * and the SHA-pinned raw links in merged PR bodies keep matching main.
 */
const EVIDENCE_ROOT = process.env.PACMAN_E2E_EVIDENCE
  ? resolve(import.meta.dirname, '../../..', process.env.PACMAN_E2E_EVIDENCE)
  : null;

/** Capture `name` under PACMAN_E2E_EVIDENCE; silently skipped when unset. */
export async function evidenceShot(page: Page, name: string): Promise<void> {
  if (EVIDENCE_ROOT === null) return;
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, name) });
}
