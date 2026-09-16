# SQLite library for a single Pacman process

Question: which SQLite driver and query layer should the Pacman kernel use?

Locked already: one SQLite file in the user data directory; process-local; no replica; no Postgres; TypeScript; one Node or Bun process (runtime still open on [Kernel process stack](../issues/07-process-stack.md)).

Sources are first-party docs and first-party source, retrieved 2026-09-17.

## Recommendation

**Driver: `better-sqlite3`. Query: Drizzle (`drizzle-orm/better-sqlite3`) with generated SQL migrations applied at process start.**

This does **not** force Bun. It **does favor Node**: `better-sqlite3` is a Node native addon (`engines.node: ">=22"` in WiseLibs 13.0.3). Bun’s own init rules say use `bun:sqlite` and do not use `better-sqlite3`. If ticket 07 later picks Bun, keep the Drizzle `sqlite-core` schema and the generated SQL folder; change only the constructor import to `drizzle-orm/bun-sqlite` and `bun:sqlite`’s `Database`.

Do not pick `bun:sqlite` now — that forces Bun. Do not pick `node:sqlite` as the kernel store while Node 22+ is still a candidate: on Node 22 it is Stability 1.1 (active development); on Node 24 it is Stability 1.2 (release candidate), which Node still classifies as experimental. Do not pick `@libsql/client` for this file: Turso now aims that package at remote libSQL / ORM, local `file:` is a side path, the API is async, and the replica/sync surface is locked out of Pacman.

## Drivers

### `better-sqlite3`

WiseLibs documents it as “the fastest and simplest library for SQLite in Node.js”: synchronous `Database` / `Statement`, file created on `new Database(path)`, WAL via `db.pragma('journal_mode = WAL')`. Queries start immediately; no connection pool. Native addon with prebuilt binaries; install docs require a currently supported Node and native build tools if a prebuild is missing.

Fit: one writer process, one file, sync transactions around Issue/Run/Event writes. Matches SQLite’s serialized writer better than an async wrapper.

Coupling: Node-first. Bun implements a `better-sqlite3`-inspired API as `bun:sqlite` and tells Bun apps not to take the npm addon.

### `bun:sqlite`

Bun built-in. `import { Database } from "bun:sqlite"`. Sync, prepared statements, transactions, WAL pragma. API is explicitly inspired by `better-sqlite3`. File path or `:memory:`.

Coupling: **Bun only.** Not importable on Node.

### `node:sqlite`

`import { DatabaseSync } from "node:sqlite"` (the `node:` scheme only). Sync file or `:memory:` connection. Added in Node 22.5.0. Node 22.13.0 / 23.4.0 dropped the `--experimental-sqlite` flag but kept experimental status.

Stability (Node’s own index):

| Line | Status |
| --- | --- |
| Node 22 (docs `latest-v22.x`, source `doc/api/sqlite.md` at v22.23.2) | Stability **1.1 — Active development** |
| Node 24.15.0 changelog | “SQLite is now a release candidate” |
| Node 24 (v24.21.0) | Stability **1.2 — Release candidate** |

Node defines all of Stability 1 as experimental: not under semver, “use of the feature is not recommended in production environments.” 1.2 means they hope it is ready to become stable; breaking changes are still allowed.

Bun’s Node-compat page marks `node:sqlite` fully implemented, with differences (sync `backup()`, macOS system `libsqlite3.dylib`, extension/session APIs needing a full SQLite build).

Coupling: Node-shaped API that Bun also implements. Neutral on Bun-vs-Node **if** Pacman accepts experimental/RC persistence. Not acceptable while Node 22 remains a legal process runtime.

### `@libsql/client` (local `file:`)

`createClient({ url: "file:local.db" })` then `await client.execute` / `batch`. Official local example is a Node script against a file. The TypeScript SDK reference still documents this under “Local Development.”

Turso’s current TypeScript quickstart splits the world:

- New **local / embedded**: `@tursodatabase/database` (Turso engine rewrite, MVCC, async).
- Remote Turso Cloud: `@tursodatabase/serverless`.
- Remote **libSQL** or **ORM** (Drizzle, Prisma): `@libsql/client`.

`@libsql/client` also owns embedded replicas (`syncUrl`). Pacman locked no replica. The client is Promise-based (`Promise<ResultSet>`), unlike the three sync drivers above.

`@tursodatabase/database` is out of scope for this ticket, and it is not stock SQLite (encrypted files “cannot be read as standard SQLite databases”).

Coupling: npm package, not a runtime builtin. Extra engine/product surface Pacman does not want.

## Query layer

Kernel tables are still open (Event kinds, Diff storage). The query layer must survive schema change on one local file without a DBA.

### Raw SQL

Every driver already exposes `prepare` / `run` / `all`. Zero extra library. Types and migrations are hand-rolled. Cheap for a frozen three-table schema; expensive once Event/Diff columns move.

### Drizzle

Official SQLite connect docs list native drivers: `libsql`, `node:sqlite`, `better-sqlite3`, plus a dedicated Bun page for `bun:sqlite`. Constructor import is per driver:

- `drizzle-orm/better-sqlite3`
- `drizzle-orm/bun-sqlite`
- `drizzle-orm/node-sqlite`
- `drizzle-orm/libsql`

Schema lives in `drizzle-orm/sqlite-core`. That schema and `drizzle-kit` SQL output are the portable piece; the driver module is the runtime-specific piece.

Kit: `dialect: "sqlite"`, `drizzle-kit generate` writes SQL + snapshots, `drizzle-kit migrate` or runtime `migrate()` applies them. Runtime migrator for `better-sqlite3` (and `bun-sqlite`) reads `migrationsFolder` / `meta/_journal.json` and applies pending SQL. Migrations fundamentals Option 4 is exactly “generate SQL, apply during process startup” — the shape of a single Operator machine opening one file.

Current get-started pages install `drizzle-orm@rc` / `drizzle-kit@rc`. Spec can pin a later non-RC; the driver split is what matters.

### Kysely

TypeScript query builder. Built-in `SqliteDialect` is documented as using **better-sqlite3**. `SqliteDialectConfig.database` is typed as a subset (`close`, `prepare` → `all` / `run` / `iterate`), so a Bun or `node:sqlite` object might duck-type, but first-party docs and examples instantiate `better-sqlite3`. Community dialects exist for Node’s native SQLite and for libSQL; they are not core.

Types are a handwritten (or codegen’d) `Database` interface, separate from runtime schema. Migrations are `up` / `down` TS modules + `Migrator` + `FileMigrationProvider`, tracked in `kysely_migration` / `kysely_migration_lock`. That is a solid single-file story, but swapping Bun vs Node is less first-party than Drizzle’s per-driver packages.

## Migrations on one local file

Recommended loop:

1. Schema in TypeScript (`sqlite-core`).
2. `drizzle-kit generate` commits SQL under the repo (e.g. `drizzle/`).
3. On kernel boot, open the user-data-dir file, `PRAGMA journal_mode = WAL`, then `migrate(db, { migrationsFolder })`.
4. Journal table defaults to `__drizzle_migrations` (overridable in kit config).

Do not use `drizzle-kit push` as the production path for Operator data; it is the prototyping path. Generate + apply is the versioned path.

WAL: both WiseLibs and Bun recommend it for a local writer. WiseLibs notes checkpoint starvation only if multiple processes/threads hold readers forever — Pacman is one process. Bun notes macOS system SQLite may leave `-wal`/`-shm` after close; checkpoint-before-close is a later packaging detail, not a library pick.

SQLite itself remains one writer. Pacman already locked global concurrency to one Run.

## Runtime matrix

| Driver | Node 22+ | Bun | Forces a runtime? |
| --- | --- | --- | --- |
| `better-sqlite3` | Yes, native addon, `engines.node >= 22` | Bun says don’t; use `bun:sqlite` | Favors Node; schema/SQL can move |
| `bun:sqlite` | No | Builtin | Forces Bun |
| `node:sqlite` | Yes, experimental 1.1 on 22, RC 1.2 on 24 | Implemented, with listed diffs | Neutral API, unstable on Node 22 |
| `@libsql/client` | Yes (docs: Node 12+) | npm | Neutral runtime, wrong product |

Query-layer portability if 07 picks Bun later:

- Drizzle: change `drizzle()` import + `Database` construction; keep schema and SQL migrations.
- Kysely: keep builder code; replace `SqliteDialect({ database: new Database(...) })` with a Bun-compatible `SqliteDatabase`; not documented first-party.
- Raw SQL: change only the driver wrapper.

## What this does not decide

- Bun vs Node (ticket 07). This pick is Node-first and reversible at the Drizzle driver import.
- Exact npm versions of `drizzle-orm` / `drizzle-kit` (docs currently show `@rc`).
- User-data-dir path and filename (candidate on ticket 07).
- Table schema (hangs on Event catalog and Diff).

## Sources

- Bun SQLite: https://bun.sh/docs/runtime/sqlite
- Bun Node compat (`node:sqlite` row): https://bun.sh/docs/runtime/nodejs-compat
- Bun init rule (`bun:sqlite`, not `better-sqlite3`): https://github.com/oven-sh/bun/blob/main/src/runtime/cli/init/rule.md
- Node SQLite HTML: https://nodejs.org/docs/latest-v22.x/api/sqlite.html and https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- Node SQLite source banners (Stability 1.1 / 1.2): `doc/api/sqlite.md` at tags v22.23.2 and v24.21.0
- Node stability index: `doc/api/documentation.md` at v24.21.0
- better-sqlite3 README + API + performance: https://github.com/WiseLibs/better-sqlite3
- better-sqlite3 `package.json` `engines.node`: `>=22` (13.0.3)
- Turso TS quickstart + reference: https://docs.turso.tech/sdk/ts/quickstart , https://docs.turso.tech/sdk/ts/reference
- Turso local development: https://docs.turso.tech/local-development
- `@libsql/client` local example: https://github.com/tursodatabase/libsql-client-ts/blob/main/examples/local/index.mjs
- Drizzle SQLite get-started: https://orm.drizzle.team/docs/get-started-sqlite
- Drizzle Bun SQLite: https://orm.drizzle.team/docs/connect-bun-sqlite
- Drizzle migrations fundamentals + kit: https://orm.drizzle.team/docs/migrations , https://orm.drizzle.team/docs/kit-overview , https://orm.drizzle.team/docs/sqlite/drizzle-kit-migrate
- Drizzle `better-sqlite3` / `bun-sqlite` runtime `migrate()`: `drizzle-orm/src/better-sqlite3/migrator.ts`, `drizzle-orm/src/bun-sqlite/migrator.ts`
- Kysely getting started, dialects, migrations: https://kysely.dev/docs/getting-started , https://kysely.dev/docs/dialects , https://kysely.dev/docs/migrations
- Kysely `SqliteDialect` / `SqliteDialectConfig`: https://github.com/kysely-org/kysely/blob/master/src/dialect/sqlite/sqlite-dialect.ts
