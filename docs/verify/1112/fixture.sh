#!/usr/bin/env bash
set -u
HOOK="$1"
REPO=/tmp/t1112/repo
WORK=/tmp/t1112/work
mkdir -p "$REPO/.husky" "$REPO/scripts" "$WORK"
printf '%s\n' '临时' '先这样' 'workaround' '以后再改' '时间紧' 'TODO' 'FIXME' 'HACK' > "$REPO/.husky/banned.txt"
printf '%s\n' '// stub: pass-through' > "$REPO/scripts/check-lockfile-commit.mjs"
printf '%s\n' '#!/usr/bin/env bash' 'if [ "$1" = exec ] && [ "$2" = biome ]; then exit 0; fi' 'if [ "$1" = -r ] && [ "$2" = typecheck ]; then exit 0; fi' 'if [ "$1" = spec:parse ]; then exit 0; fi' 'echo "pnpm stub unexpected: $*" >&2' 'exit 99' > "$WORK/pnpm"
chmod +x "$WORK/pnpm"
git -C "$REPO" init -q
git -C "$REPO" config user.email t@t
git -C "$REPO" config user.name t
git -C "$REPO" add .husky/banned.txt scripts/check-lockfile-commit.mjs
git -C "$REPO" commit -qm init
mkdir -p "$REPO/.git/hooks"
cp "$HOOK" "$REPO/.git/hooks/pre-commit"
chmod +x "$REPO/.git/hooks/pre-commit"
echo "fixture ready"
