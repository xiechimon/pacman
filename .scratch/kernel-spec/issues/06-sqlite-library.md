Type: research
Status: resolved

# SQLite library for a single process


## Question

Which SQLite driver and query layer should the Pacman kernel use in a single-process TypeScript app?

Constraints already locked: one SQLite file in the user data directory; process-local; no replica; no Postgres; TypeScript full stack; one Node or Bun process (process runtime itself is [Kernel process stack](07-process-stack.md)).

Compare, with current docs:

- Drivers: `bun:sqlite`, `better-sqlite3`, `node:sqlite`, `@libsql/client` (local file).
- Query: raw SQL, Drizzle, Kysely.
- Migrations story for a single local file.
- Fit with Node 22+ and with Bun, because the process runtime is not decided yet.

Recommend one driver + one query style that does not force Bun or Node by itself, or state the coupling honestly.

Write findings on branch `research/sqlite-library` and leave a path pointer under this ticket.

## Findings
`.scratch/kernel-spec/research/sqlite-library.md` on branch `research/sqlite-library`

## Answer

Cited comparison is `.scratch/kernel-spec/research/sqlite-library.md` on `research/sqlite-library` (`6142b0c`).

- Driver: `better-sqlite3`. Query: Drizzle (`drizzle-orm/better-sqlite3`).
- Migrations: `drizzle-kit generate` SQL, applied at process start (`migrate()` / `__drizzle_migrations`).
- Node-first (`engines.node >= 22`, native addon). Does not force Bun.
- If [Kernel process stack](07-process-stack.md) later picks Bun: keep `sqlite-core` schema and SQL folder; swap constructor to `drizzle-orm/bun-sqlite` + `bun:sqlite`.
- Rejected for kernel now: `bun:sqlite` (Bun-only), `node:sqlite` (experimental/RC on Node 22/24), `@libsql/client` (async, replica/remote product).
