# #760 evidence — composer `@` file/dir candidates

## What was proven

- Server round-trip (wire-level proof that an inserted path is agent-readable):
  `GET /api/projects/:id/files?ref=main` enumerates `apps/web/src/button.tsx`,
  and `GET /api/projects/:id/file?path=apps/web/src/button.tsx&ref=main`
  returns its exact bytes. Covered by
  `apps/server/test/git-hosting.test.ts` → "GET /api/projects/{id}/files … (#760)".
- Bounds: `limit=2` → 2 rows + `truncated: true`; `limit=abc` → default, no 400;
  bad ref / non-hosted / unknown project → 404 (web degrades to agents-only).
- Submodule gitlinks (`160000 commit` rows) are filtered; parent dirs stay.
- UI: unified agents+files list, one fuzzy pass, bare-path insert + trailing
  space, dir rows trailing slash. Covered by
  `apps/web/e2e/composer-inline-mention.spec.ts` → four `files:` tests.

## Screenshots (this dir, taken from the passing e2e run)

- `files-unified-list.png` — bare `@`: agents roster first, files after.
- `files-insert-path.png` — `@butt` + Enter: `apps/web/src/ui/button.tsx ` in
  the composer, list closed, nothing sent.
- Remaining shots are the pre-existing `#728` pins re-captured on this branch
  (no behavior change on the agents-only path).
