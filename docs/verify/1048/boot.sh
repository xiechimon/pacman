#!/usr/bin/env bash
# #1048 evidence stack booter. Starts the real apps/server the way a systemd
# deployment does: the token comes from an EnvironmentFile-style env file
# sourced into the process environment (systemd EnvironmentFile= injects the
# same KEY=VALUE lines; the server reads process.env once at boot).
#
# Usage: bash boot.sh token|notoken
#   token   -> sources /tmp/t0250/token.env (creates it with a throwaway
#              random value when missing); gate expected (401 without auth)
#   notoken -> PACMAN_TOKEN unset; auth off expected (200, no gate)
#
# Writes: /tmp/t0250/port-<mode>, /tmp/t0250/server-<mode>.{pid,log}
set -euo pipefail
WT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUN=/tmp/t0250
MODE="${1:-token}"
mkdir -p "$RUN/home-$MODE"
if [ "$MODE" = "token" ] && [ ! -f "$RUN/token.env" ]; then
  echo "PACMAN_TOKEN=demo-$(openssl rand -hex 8)" > "$RUN/token.env"
fi
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
echo "$PORT" > "$RUN/port-$MODE"
cd "$WT/apps/server"
if [ "$MODE" = "token" ]; then
  set -a; source "$RUN/token.env"; set +a
  EXPECT=401
else
  unset PACMAN_TOKEN || true
  EXPECT=200
fi
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  PORT="$PORT" HOST=127.0.0.1 LOG_LEVEL=warn \
  PACMAN_HOME="$RUN/home-$MODE" PACMAN_WEB_DIR="$WT/apps/web/dist" \
  pnpm exec tsx src/index.ts > "$RUN/server-$MODE.log" 2>&1 &
echo $! > "$RUN/server-$MODE.pid"
code=000
for _ in $(seq 1 120); do
  code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/teams" || true)
  [ "$code" = "$EXPECT" ] && break
  sleep 0.5
done
echo "mode=$MODE port=$PORT code=$code expect=$EXPECT pid=$(cat "$RUN/server-$MODE.pid")"
[ "$code" = "$EXPECT" ]
