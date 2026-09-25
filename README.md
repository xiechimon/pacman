# pacman

A self-hosted, open-source **agent workspace**: a task board where you write the tasks and AI agents build them on your own machines.

English | [简体中文](./README.zh.md)

## What

You file a task on a kanban board. An agent picks it up, checks out a worktree and a branch, and streams its work back to the UI as a conversation — plan cards, diffs, tool calls, all in real time. The run pauses at review so a human decides what merges.

- **Tasks & phases** — kanban board with numbered tasks, tags, and schedules that re-run a task on a cycle.
- **Agents** — execution roles configured with a model, responsibilities, skills, MCP servers, secrets, and memory. A per-user "chief" agent dispatches work.
- **Machines** — register any host by running the daemon on it; builds execute there under supervision. Your laptop, your box, your rules.
- **Providers** — model access via API key, OAuth (GitHub Copilot, OpenAI Codex), or a custom endpoint.
- **Repos** — git repositories hosted by the server itself (push/pull with an API key) or connected from GitHub.
- **Live everything** — SSE streams for board and conversation updates, notifications, token-usage accounting per build and model.

## Why

- **Self-hosted.** One data root (`~/.pacman`), SQLite, no external service in the loop. Your code and your model keys stay on your machines.
- **Open source.** Apache-2.0 (see [License](#license)).
- **Honest lineage.** pacman began as a clean-room study of todos.dev's public interface (see [Origins](#origins)) and is now an independent product; its roadmap diverges from real usage, not from anyone else's spec.

## Quickstart

Requirements: Node.js >= 22.19 and pnpm (e.g. via `corepack enable`).

```sh
pnpm install
pnpm start
```

`pnpm start` builds the web UI and starts the server hosting it on the same origin. Open **http://127.0.0.1:8787/app**. The first boot creates the database, runs migrations, and seeds a default team.

Use a different port with `PORT=9000 pnpm start`.

### Optional: register this machine as an executor

The UI is fully usable without a daemon; register a machine when you want agents to actually run builds on it.

```sh
# One-time enrollment: create an API key in the web UI (/app/api-keys, plaintext shown once), then
pnpm dev:daemon start --api-key <pacman_...> --team <teamId>
# Daily use (credentials persisted in ~/.pacman/machine.json):
pnpm dev:daemon start        # also: stop / restart / logs -f / status
```

## Configuration

Server environment variables (all optional):

| Variable | Default | Description |
|---|---|---|
| `PACMAN_TOKEN` | unset | Bearer token guarding `/api/*`. Set to enable authentication — the web UI asks for the token on first visit; unset means auth off (default). The two SSE stream endpoints additionally accept `?token=` (EventSource cannot set headers). Always set this when binding the server to a non-localhost interface. |
| `PORT` | `8787` | HTTP listen port. |
| `PACMAN_HOME` | `~/.pacman` | Data root. Server state lives under `<PACMAN_HOME>/server/` (`server.db`, `secretbox.key`, hosted bare repos); the daemon keeps `machine.json`, `daemon.log`, and `workspaces/` at the root. **Backup = copy the whole directory** — the db alone is useless without the keyfile, since secrets are stored encrypted. |
| `PACMAN_GITHUB_OAUTH_CLIENT_ID`<br>`PACMAN_GITHUB_OAUTH_CLIENT_SECRET` | unset | Credentials of a self-registered GitHub OAuth App, enabling OAuth provider sign-in. Set both or neither — the server refuses to start on a half-configured pair. |
| `PACMAN_WEB_DIR` | `apps/web/dist` if present | Override for the SPA static-hosting root; unset with no build output = API-only mode. |

Daemon environment variables (alternatives to the CLI flags above): `PACMAN_SERVER` (default `http://127.0.0.1:8787`), `PACMAN_API_KEY`, `PACMAN_TEAM`, `PACMAN_WORKSPACES_DIR` (default `<PACMAN_HOME>/workspaces`).

## Development

```sh
pnpm dev:server   # API server with hot reload on http://127.0.0.1:8787 (first boot: db + migrations + seed)
pnpm dev:web      # vite dev server on http://localhost:5173, proxying /api and /git to 8787
```

Quality gates before committing:

```sh
pnpm lint         # biome ci
pnpm typecheck    # tsc across all packages
pnpm test         # vitest
```

### Repository layout

| Path | Contents |
|---|---|
| `CONTEXT.md` | Domain model & glossary — canonical terminology (Chinese interface terms ↔ English ↔ internal names) |
| `apps/web` | Web UI (React + vite) |
| `apps/server` | Server: Hono REST + SSE + SQLite (package `@xiechimon/pacman` — directory name differs from package name) |
| `apps/daemon` | Executor daemon (package `@xiechimon/pacman-cli` — directory name differs from package name) |
| `packages/shared` | Protocol vocabulary, record shapes, brand-slot single source (`@pacman/shared`) |
| `docs/spec/` | Implementation canon, volumes 00–06 (Chinese) |
| `docs/research/` | r1–r8 replication-era site inventories and evidence (historical archive) |
| `parity/` | Pixel-parity harness against `docs/research/assets/` baselines (now a regression tool) |
| `scripts/` | Build-time tools (incl. `generate-icons.mjs`) |

## Third-party credits

- Avatar font [Lorelei](https://www.figma.com/community/file/1198749693280469639) — © Lisa Wischofsky, CC0 1.0
- Fonts Inter / JetBrains Mono — SIL Open Font License 1.1
- Icons [lucide](https://lucide.dev) — ISC License
- Emoji curation data [gitmoji](https://gitmoji.dev) — MIT License
- Execution engine [pi SDK](https://github.com/badlogic/pi-mono) — MIT License

Full obligations table: `docs/spec/素材替换计划.md` §4.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Origins

pacman began as a clean-room study of todos.dev's public interface and protocols — an exploration of agent-workspace design. It is now an independent project with its own roadmap, and uses no code or assets from todos.dev.
