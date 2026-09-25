#!/bin/sh
# cli 包 pack 冒烟（#270）：pack → 仓外临时目录装 tarball → 裸 node 跑
# `--help` / `--version` + manifest/tarball 内容断言。
# 仓外安装 = 规避 npm 沿目录树爬到仓根 pnpm-workspace 解析 `catalog:` 的
# 祖先坑（实测 EUNSUPPORTEDPROTOCOL）；探针一律不碰真实 ~/.pacman。
# 与主包冒烟（#264）同族——CI job 由 #264 落地时一并收编。
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/pacman-cli-smoke.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

echo "== pack @xiechimon/pacman-cli =="
pnpm -C "$ROOT/apps/daemon" pack --pack-destination "$WORK" >/dev/null

TGZ=$(find "$WORK" -maxdepth 1 -name 'xiechimon-pacman-cli-*.tgz' | head -n1)
[ -n "$TGZ" ] || { echo "FAIL: tarball 未产出"; exit 1; }

echo "== tarball manifest 断言 =="
MANIFEST=$(tar -xzf "$TGZ" -O package/package.json)
VERSION=$(printf '%s' "$MANIFEST" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log(p.version)})")
printf '%s' "$MANIFEST" | node -e "
let s='';
process.stdin.on('data',d=>s+=d).on('end',()=>{
  const p=JSON.parse(s);
  const deps=Object.entries(p.dependencies||{});
  const bad=deps.filter(([,v])=>/workspace:|catalog:/.test(v));
  if (bad.length) { console.error('FAIL: dependencies 残留 workspace/catalog: '+JSON.stringify(bad)); process.exit(1); }
  if (!p.bin || !p.bin.pacman) { console.error('FAIL: bin.pacman 缺'); process.exit(1); }
  if (!p.files || !p.files.includes('dist')) { console.error('FAIL: files 缺 dist'); process.exit(1); }
  console.log('ok: deps = ' + (deps.map(([k])=>k).join(', ') || '(none)'));
})"

echo "== tarball 内容断言 =="
LIST=$(tar -tzf "$TGZ")
printf '%s\n' "$LIST" | grep -q '^package/dist/cli.mjs$' || { echo "FAIL: dist/cli.mjs 不在 tarball"; exit 1; }
if printf '%s\n' "$LIST" | grep -q '^package/src/'; then echo "FAIL: src 泄漏进 tarball"; exit 1; fi
printf '%s\n' "$LIST" | grep -q '^package/LICENSE$' || { echo "FAIL: LICENSE 不在 tarball"; exit 1; }
echo "ok: dist/LICENSE 在位、无 src 泄漏（$(printf '%s\n' "$LIST" | wc -l | tr -d ' ') 条目）"

echo "== 仓外安装（$WORK/install） =="
mkdir "$WORK/install"
cd "$WORK/install"
npm init -y >/dev/null 2>&1
npm install "$TGZ" --no-audit --no-fund >/dev/null 2>&1
echo "ok: npm install $(basename "$TGZ")"

echo "== 裸 node 面 =="
# realpath：macOS 的 /tmp → /private/tmp 符号链接会让 argv[1] 与
# import.meta.url 不一致——cli.ts 直跑守卫按 URL 等值判定，路径不实化
# 则 main 不触发（静默空跑）。真实安装路径无此形态，这里对齐真实语义。
PKG="$WORK/install/node_modules/@xiechimon/pacman-cli"
CLI=$(realpath "$PKG/dist/cli.mjs")
node "$CLI" --help >/dev/null && echo "ok: --help exit 0"
OUT=$(node "$CLI" --version)
[ "$OUT" = "$VERSION" ] && echo "ok: --version = $VERSION" || { echo "FAIL: --version = $OUT (expect $VERSION)"; exit 1; }

echo "PASS: cli pack 冒烟全绿"
