Type: research
Status: open

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
