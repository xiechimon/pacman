#!/usr/bin/env bash
# Reproduce every ui-debt-gate.mjs verdict path (#851) and capture the
# transcripts archived next to this script.
#
# Method: a detached scratch worktree at the mechanism commit, mutated per
# scenario and restored between scenarios; the lane worktree itself is only
# used for the clean-tree PASS. Gate output is captured verbatim.
#
# Usage (from the lane worktree root):
#   bash docs/verify/851/run-scenarios.sh <mechanism-sha>
#
# The scratch worktree is removed at the end (git worktree remove --force).

set -u
SHA="${1:?usage: run-scenarios.sh <mechanism-sha>}"
REPO="$(git rev-parse --show-toplevel)"
SCRATCH="/tmp/debt-gate-851-scenarios"
OUT="$REPO/docs/verify/851"

git -C "$REPO" worktree remove --force "$SCRATCH" 2>/dev/null
git -C "$REPO" worktree add --detach "$SCRATCH" "$SHA" >/dev/null 2>&1

CUR=""
begin() {
  CUR="$OUT/$1"
  {
    echo "scenario: $2"
    echo "scratch worktree: $SCRATCH @ $SHA"
    echo
  } >"$CUR"
}

# step <command...>: echo the command, run it in the scratch worktree,
# append output and exit code verbatim.
step() {
  echo "\$ $*" >>"$CUR"
  (cd "$SCRATCH" && eval "$@") >>"$CUR" 2>&1
  echo "exit=$?" >>"$CUR"
  echo >>"$CUR"
}

restore() { git -C "$SCRATCH" restore "$@"; }

# --- 01 clean tree passes ----------------------------------------------------
begin 01-clean-pass.txt "clean tree at the mechanism commit passes (in-tree baseline)"
echo "\$ node scripts/ui-debt-gate.mjs   # (run in the lane worktree, clean at $SHA)" >>"$CUR"
(cd "$REPO" && node scripts/ui-debt-gate.mjs) >>"$CUR" 2>&1
echo "exit=$?" >>"$CUR"

# --- 02 D1: one added per-face CSS line --------------------------------------
begin 02-d1-css-plus-one.txt "D1 — adding one line to a per-face CSS file goes red"
step "echo '.debt-demo { color: red; }' >> apps/web/src/chief/chief.css"
step "node scripts/ui-debt-gate.mjs"
restore apps/web/src/chief/chief.css

# --- 03 D2: one added bare control --------------------------------------------
begin 03-d2-control-plus-one.txt "D2 — adding one bare control goes red (total 77 > baseline 76)"
step "printf 'export function DebtDemo() {\n  return <button type=\"button\">demo</button>;\n}\n' > apps/web/src/board/debt-demo.tsx"
step "node scripts/ui-debt-gate.mjs"
step "rm apps/web/src/board/debt-demo.tsx"

# --- 04 D1: a brand-new per-face CSS file -------------------------------------
begin 04-d1-new-css-file.txt "D1 — a brand-new per-face CSS file goes red (new faces have a baseline of 0)"
step "printf '.debt-demo {\n  color: red;\n}\n' > apps/web/src/board/debt-demo.css"
step "node scripts/ui-debt-gate.mjs"
step "rm apps/web/src/board/debt-demo.css"

# --- 05 D3: re-freezing the baseline cannot legalize new debt ------------------
begin 05-d3-baseline-raise.txt "D3 — raising the in-tree baseline above the base sha's baseline goes red even when tree == baseline"
step "echo '.debt-demo { color: red; }' >> apps/web/src/chief/chief.css"
step "node scripts/ui-debt-gate.mjs --write"
step "node scripts/ui-debt-gate.mjs --base $SHA"
restore apps/web/src/chief/chief.css scripts/ui-debt-baseline.json

# --- 06 D4: malformed baseline fails closed ------------------------------------
begin 06-d4-corrupt-baseline.txt "D4 — a corrupt or internally inconsistent baseline fails closed (exit 2), never silently green"
step "printf 'not json' > scripts/ui-debt-baseline.json"
step "node scripts/ui-debt-gate.mjs"
restore scripts/ui-debt-baseline.json
step "node -e 'const f=\"scripts/ui-debt-baseline.json\";const b=require(\"./\"+f);b.rawControls.total+=1;require(\"fs\").writeFileSync(f,JSON.stringify(b,null,2)+\"\\n\")'"
step "node scripts/ui-debt-gate.mjs"
restore scripts/ui-debt-baseline.json

# --- 07 debt below baseline passes with a ratchet-down note ---------------------
begin 07-ratchet-down-note.txt "removing debt passes and asks for a --write re-freeze (baseline follows the tree down)"
step "node -e 'const f=\"apps/web/src/chief/chief.css\";const s=require(\"fs\").readFileSync(f,\"utf8\").split(\"\\n\");s.splice(s.length-2,1);require(\"fs\").writeFileSync(f,s.join(\"\\n\"))'"
step "node scripts/ui-debt-gate.mjs"
step "node scripts/ui-debt-gate.mjs --write"
restore apps/web/src/chief/chief.css scripts/ui-debt-baseline.json

# --- 08 unfetched base sha refuses to fall back ----------------------------------
begin 08-base-not-fetched.txt "an unavailable base sha exits 2 instead of quietly gating against the branch-supplied baseline"
step "node scripts/ui-debt-gate.mjs --base 0000000000000000000000000000000000000000"

# --- 09 freeze is idempotent -------------------------------------------------------
begin 09-freeze-idempotent.txt "re-freezing an unchanged tree reports no numeric change"
step "node scripts/ui-debt-gate.mjs --write"

git -C "$REPO" worktree remove --force "$SCRATCH"
echo "scenarios written to $OUT"
