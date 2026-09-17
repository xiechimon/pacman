Type: grilling
Status: resolved
Assignee: xiechimon

# Kernel process stack


## Question

What does the single process run, and how does the Operator start it?

Locked already: one process; localhost web + API + SQLite + spawn Claude Code; bind `127.0.0.1`; no login; TypeScript.

Still open:

- Bun vs Node 22+.
- HTTP library and how the UI is served (Vite + React SPA, Hono + React, Next.js). Next.js is what Multica uses; copying it is not a reason.
- Live updates: WebSocket, SSE, or request on focus. Kernel board must show a running Run without a refresh.
- Start command the Operator types (`pacman`, `bun run pacman`, `pnpm dev`).
- Where the SQLite file lives on macOS (candidate: `~/Library/Application Support/pacman/pacman.sqlite`).
- Default port.
- How the spawned Run inherits environment: GUI/launchd PATH lacks `~/.local/bin` / Homebrew, and the Agent binary decision ([How Operator defines an Agent](04-agent-record.md)) relies on login-shell resolution (`$SHELL -ilc`) as fallback.

Depends on [SQLite library for a single process](06-sqlite-library.md) so the driver does not contradict Bun vs Node.

## Answer

**Runtime**: Node 22+. [SQLite library for a single process](06-sqlite-library.md) is Node-first (`better-sqlite3` native addon); the kernel has no use for Bun's performance story. Bun support stays out of the kernel; the swap path (keep `sqlite-core` schema + SQL, change the Drizzle constructor) is recorded on ticket 06.

**HTTP + UI**: Hono on `@hono/node-server`. UI is a Vite-built React SPA; its static bundle is served by the same Hono process. No SSR — a local single-Operator board does not need it. Next.js rejected: its server model fights "one process owns everything", and Multica using it is not a reason.

**MCP server form** (settles the [Kernel Event catalog](03-event-catalog.md) fog): official TypeScript MCP SDK, Streamable HTTP transport, mounted as a route (`/mcp`) on the same kernel HTTP server — same process, same port, `127.0.0.1` only, no per-Run child process. Per-Run token: generated at Run start, written into that Run's temp `--mcp-config` (URL `http://127.0.0.1:<port>/mcp` + token header); invalidated when the Run ends. The kernel validates token → resolves the Run → allows writes only to that Run's Issue timeline.

**Live updates**: SSE. Server→client push only (all writes go through ordinary API calls); no upgrade handshake; Hono-native; browsers auto-reconnect. Every Event row insert is broadcast; the Event id doubles as `Last-Event-ID` so a reconnecting client resumes without gaps.

**Port + start**: default port `4747`, env `PACMAN_PORT` overrides. Port busy → exit with an error telling the Operator to change it; no silent drift (drift would break per-Run MCP URLs and bookmarks). The port bind is also the single-instance guard. Start: `npm run pacman` inside the repo; `package.json` `bin` entry `pacman` so a global link gives the bare command.

**SQLite file**: `~/Library/Application Support/pacman/pacman.sqlite` (macOS convention; single machine locked). Env `PACMAN_DATA_DIR` overrides the directory. First start creates the directory and runs migrations.

**Run env inheritance** (carried over from [How Operator defines an Agent](04-agent-record.md)): the kernel process's own env is irrelevant; only Run spawn matters. Binary resolution per ticket 04 (PATH → login-shell `$SHELL -ilc` → refuse the Run) yields an absolute path; spawn uses that absolute path, and `cmd.env` inherits the kernel env with `PATH` replaced by the login-shell PATH captured during resolution (cached). Terminal-launched Operators already have that PATH; nothing changes for them.
