#!/bin/sh
# 主包 pack 冒烟（#264）：`pnpm pack`（prepack 自建 bundle + web dist）→ 仓外
# 临时目录装 tarball → 裸 `node` 起 → 断言 `/api/user/me` 200 + `/app` 200 +
# 数据根隔离（临时 PACMAN_HOME）。
# 失败方式枚举 = spec #260 Testing Decisions 固化为断言：
#   1. bundle 缺依赖（external 误伤）→ 裸 node 起不来 → 红
#   2. web dist 未进包 / webDir 解析错 → /app 非 200 → 红
#   3. migration 未进包 → 首启 migrate 崩 → 红
#   4. tarball 含 src/test → 内容清单断言红
# 仓外安装 = 规避 npm 沿目录树爬到仓根解析 `catalog:` 的祖先坑；探针一律
# 不碰真实 ~/.pacman。与 scripts/pack-smoke-cli.sh（#270）同族。
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/pacman-pack-smoke.XXXXXX")
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== pack @xiechimon/pacman（prepack: web build + esbuild bundle + stage-web） =="
pnpm -C "$ROOT/apps/server" pack --pack-destination "$WORK" >/dev/null

TGZ=$(find "$WORK" -maxdepth 1 -name 'xiechimon-pacman-0.1.0.tgz' | head -n1)
[ -n "$TGZ" ] || { echo "FAIL: tarball 未产出"; exit 1; }

echo "== tarball manifest 断言 =="
MANIFEST=$(tar -xzf "$TGZ" -O package/package.json)
printf '%s' "$MANIFEST" | node -e "
let s='';
process.stdin.on('data',d=>s+=d).on('end',()=>{
  const p=JSON.parse(s);
  const deps=Object.entries(p.dependencies||{});
  const bad=deps.filter(([,v])=>/workspace:|catalog:/.test(v));
  if (bad.length) { console.error('FAIL: dependencies 残留 workspace/catalog: '+JSON.stringify(bad)); process.exit(1); }
  if (!p.bin || !p.bin.pacman) { console.error('FAIL: bin.pacman 缺'); process.exit(1); }
  console.log('ok: deps = ' + (deps.map(([k])=>k).join(', ') || '(none)'));
})"

echo "== tarball 内容断言 =="
LIST=$(tar -tzf "$TGZ")
for want in '^package/dist/index.mjs$' '^package/web/index.html$' '^package/drizzle/meta/_journal.json$' '^package/drizzle/0000' '^package/LICENSE$'; do
  if printf '%s\n' "$LIST" | grep -q "$want"; then :; else echo "FAIL: tarball 缺 $want"; exit 1; fi
done
if printf '%s\n' "$LIST" | grep -q '^package/src/'; then echo "FAIL: src 泄漏进 tarball"; exit 1; fi
if printf '%s\n' "$LIST" | grep -q '^package/test/'; then echo "FAIL: test 泄漏进 tarball"; exit 1; fi
echo "ok: bundle/web dist/migrations/LICENSE 在位、无 src/test 泄漏（$(printf '%s\n' "$LIST" | wc -l | tr -d ' ') 条目）"

echo "== 仓外安装（$WORK/install） =="
mkdir "$WORK/install"
cd "$WORK/install"
npm init -y >/dev/null 2>&1
npm install "$TGZ" --no-audit --no-fund >/dev/null 2>&1
echo "ok: npm install $(basename "$TGZ")"

echo "== 裸 node 起（隔离 PACMAN_HOME） =="
PKG="$WORK/install/node_modules/@xiechimon/pacman"
PORT=""
for candidate in 8395 8396 8397 8398; do
  if ! lsof -iTCP:$candidate -sTCP:LISTEN >/dev/null 2>&1; then PORT=$candidate; break; fi
done
[ -n "$PORT" ] || { echo "FAIL: 8395-8398 全被占用"; exit 1; }
echo "using port $PORT"
PORT=$PORT PACMAN_HOME="$WORK/home" node "$PKG/dist/index.mjs" > "$WORK/server.out" 2>&1 &
SERVER_PID=$!

wait_200() {
  i=0
  while [ "$i" -lt 40 ]; do
    code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$1" 2>/dev/null || echo 000)
    if [ "$code" = "200" ]; then return 0; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
    i=$((i + 1))
    sleep 0.5
  done
  return 1
}

if ! wait_200 /api/user/me; then
  echo "FAIL: /api/user/me 未就绪（起不来或超时）——server 输出尾部："
  tail -8 "$WORK/server.out" || true
  exit 1
fi
me_body=$(curl -s --noproxy '*' "http://127.0.0.1:$PORT/api/user/me")
case "$me_body" in *'"displayName":"Owner"'*) echo "ok: /api/user/me 200 + seed 生效";; *) echo "FAIL: me body 异常: $me_body"; exit 1;; esac

if ! wait_200 /app; then
  echo "FAIL: /app 非 200（web dist 未进包或 webDir 解析错）——server 输出尾部："
  tail -8 "$WORK/server.out" || true
  exit 1
fi
echo "ok: /app 200（webDir 包内探测生效）"

kill "$SERVER_PID" 2>/dev/null || true
SERVER_PID=""
echo "PASS: 主包 pack 冒烟全绿"
