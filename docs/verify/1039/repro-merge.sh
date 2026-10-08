#!/bin/sh
# #1039 acceptance repro: two lanes record a verify-pacman changelog entry
# concurrently, then a real `git merge` between their branches.
#
#   old : both lanes prepend to the "Last updated:" single-line chain
#         (pre-#1039 shape)             -> expected: CONFLICT on that line
#   new : both lanes add their own file under changelog/ (post-#1039 shape)
#                                     -> expected: clean merge
#
# Usage: sh docs/verify/1039/repro-merge.sh <base-sha> old|new
# Prints the merge transcript and a RESULT line; exits 0 when the observed
# outcome matches the mode's expectation, 1 otherwise.
#
# Notes: each lane gets a real detached worktree (temp dir), a real commit
# through the repo's pre-commit hooks (hence the pnpm install), and the merge
# is a real 3-way merge of two diverged commits. Worktrees are removed on
# exit; the throwaway commits stay unreachable and age out via gc.

set -u

BASE=${1:?usage: repro-merge.sh <base-sha> old|new}
MODE=${2:?usage: repro-merge.sh <base-sha> old|new}
REPO=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/repro-1039.XXXXXX")
trap 'git -C "$REPO" worktree remove --force "$TMP/alpha" >/dev/null 2>&1; \
      git -C "$REPO" worktree remove --force "$TMP/beta" >/dev/null 2>&1; \
      git -C "$REPO" worktree prune >/dev/null 2>&1' EXIT INT TERM

git -C "$REPO" worktree add --detach "$TMP/alpha" "$BASE" >/dev/null 2>&1
git -C "$REPO" worktree add --detach "$TMP/beta" "$BASE" >/dev/null 2>&1
echo "base: $BASE  mode: $MODE"

# hooks run on commit and need node_modules; the store is hot so this is ~4s
for lane in alpha beta; do
  (cd "$TMP/$lane" && corepack pnpm install --prefer-offline >/dev/null 2>&1) || {
    echo "FATAL: pnpm install failed in $lane worktree"; exit 1; }
done

prepend_old() { # $1=worktree $2=entry
  node -e '
    const fs = require("fs");
    const [file, entry] = process.argv.slice(1);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    const i = lines.findIndex((l) => l.startsWith("Last updated: "));
    if (i < 0) throw new Error("chain line not found in " + file);
    lines[i] = "Last updated: " + entry + " 前序:" + lines[i].slice("Last updated: ".length);
    fs.writeFileSync(file, lines.join("\n"));
  ' "$1/.claude/skills/verify-pacman/SKILL.md" "$2"
}

add_new() { # $1=worktree $2=ticket
  cat > "$1/.claude/skills/verify-pacman/changelog/2026-10-09-$2.md" <<EOF
# 2026-10-09 · #$2

repro entry for lane $2 (#1039 acceptance): one file, no shared line.
EOF
}

for_lane() { # $1=worktree $2=ticket $3=lane-name
  if [ "$MODE" = old ]; then
    prepend_old "$1" "2026-10-09(#$2 $3 lane record: repro entry)"
    git -C "$1" add .claude/skills/verify-pacman/SKILL.md
  else
    add_new "$1" "$2"
    git -C "$1" add ".claude/skills/verify-pacman/changelog/2026-10-09-$2.md"
  fi
  git -C "$1" commit -q -m "$3 lane records its changelog entry (repro #$2)" || {
    echo "FATAL: commit failed in $3"; exit 1; }
}

for_lane "$TMP/alpha" 1101 alpha
for_lane "$TMP/beta" 1102 beta
ALPHA_SHA=$(git -C "$TMP/alpha" rev-parse HEAD)

echo "--- merge beta <- alpha (real 3-way merge of two diverged commits) ---"
MERGE_OUT=$(git -C "$TMP/beta" merge "$ALPHA_SHA" 2>&1); MERGE_RC=$?
printf '%s\n' "$MERGE_OUT"
echo "merge exit code: $MERGE_RC"

if [ "$MODE" = old ]; then
  if [ "$MERGE_RC" -ne 0 ] && printf '%s' "$MERGE_OUT" | grep -q "CONFLICT (content): Merge conflict in .claude/skills/verify-pacman/SKILL.md"; then
    echo "RESULT: old form CONFLICTS on the shared line (as observed in the wild)"
    git -C "$TMP/beta" merge --abort >/dev/null 2>&1 || true
    exit 0
  fi
  echo "RESULT: UNEXPECTED — old form did not conflict as expected"; exit 1
fi

# new form: merge must be clean, both entry files present, zero conflict markers
if [ "$MERGE_RC" -ne 0 ]; then echo "RESULT: UNEXPECTED — new form conflicged"; exit 1; fi
MARKERS=$(git -C "$TMP/beta" grep -l '^<<<<<<<' HEAD -- ':(glob)**/*.md' 2>/dev/null || true)
if [ -n "$MARKERS" ]; then echo "RESULT: UNEXPECTED — conflict markers in merged tree: $MARKERS"; exit 1; fi
for t in 1101 1102; do
  git -C "$TMP/beta" cat-file -e "HEAD:.claude/skills/verify-pacman/changelog/2026-10-09-$t.md" || {
    echo "RESULT: UNEXPECTED — merged tree missing lane $t entry"; exit 1; }
done
echo "merged tree carries both entries:"
git -C "$TMP/beta" ls-tree --name-only HEAD .claude/skills/verify-pacman/changelog/ | grep 2026-10-09
echo "RESULT: new form merges clean — two lanes, two files, zero hand resolution"
