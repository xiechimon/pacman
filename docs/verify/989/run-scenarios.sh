#!/usr/bin/env bash
# Reproduce every ui-registry-gate.mjs verdict path (#989) and capture the
# transcripts archived next to this script. Same method as the #851 runner:
# a detached scratch worktree at the mechanism commit, mutated per scenario
# and restored between scenarios; the lane worktree is only used for the
# clean-tree PASS (01) and the refresh determinism check (13, the only
# scenario that needs network + node_modules).
#
# Usage (from the lane worktree root, committed clean at <mechanism-sha>):
#   bash docs/verify/989/run-scenarios.sh <mechanism-sha>
#
# The scratch worktree is removed at the end (git worktree remove --force).

set -u
SHA="${1:?usage: run-scenarios.sh <mechanism-sha>}"
REPO="$(git rev-parse --show-toplevel)"
SCRATCH="/tmp/registry-gate-989-scenarios"
OUT="$REPO/docs/verify/989"
BASE_MAIN="$(git -C "$REPO" rev-parse origin/main)"

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

# lstep <command...>: same, but in the lane worktree.
lstep() {
  echo "\$ $*" >>"$CUR"
  (cd "$REPO" && eval "$@") >>"$CUR" 2>&1
  echo "exit=$?" >>"$CUR"
  echo >>"$CUR"
}

restore() { git -C "$SCRATCH" restore "$@"; }

# --- 01 clean tree passes -----------------------------------------------------
begin 01-clean-pass.txt "clean tree at the mechanism commit passes all three UI gates"
echo "\$ node scripts/ui-registry-gate.mjs   # (run in the lane worktree, clean at $SHA)" >>"$CUR"
(cd "$REPO" && node scripts/ui-registry-gate.mjs) >>"$CUR" 2>&1
echo "exit=$?" >>"$CUR"
echo >>"$CUR"
echo "\$ node scripts/ui-drift-gate.mjs" >>"$CUR"
(cd "$REPO" && node scripts/ui-drift-gate.mjs) >>"$CUR" 2>&1
echo "exit=$?" >>"$CUR"
echo >>"$CUR"
echo "\$ node scripts/ui-debt-gate.mjs" >>"$CUR"
(cd "$REPO" && node scripts/ui-debt-gate.mjs) >>"$CUR" 2>&1
echo "exit=$?" >>"$CUR"

# --- 02 S1: unregistered file (the ticket's red demo) --------------------------
begin 02-s1-unregistered-file.txt "S1 — a hand-written file appearing in components/ui goes red with a readable reason"
step "printf 'export function HandRolled() {\n  return <button type=\"button\">demo</button>;\n}\n' > apps/web/src/components/ui/hand-rolled-demo.tsx"
step "node scripts/ui-registry-gate.mjs"
step "rm apps/web/src/components/ui/hand-rolled-demo.tsx"

# --- 03 S3: registered file edited without re-freeze ---------------------------
begin 03-s3-content-edit.txt "S3 — editing a registered file without re-freezing the ledger in the same PR goes red"
step "echo 'export const CardDemo = Card;' >> apps/web/src/components/ui/card.tsx"
step "node scripts/ui-registry-gate.mjs"
restore apps/web/src/components/ui/card.tsx

# --- 04 S4: re-freeze cannot legalize a drifted pristine file -------------------
begin 04-s4-pristine-drift-refrozen.txt "S4 — editing a pristine file AND re-freezing still goes red: the ledger no longer equals the pinned snapshot"
step "echo 'export const CardDemo = Card;' >> apps/web/src/components/ui/card.tsx"
step "node scripts/ui-registry-gate.mjs --write"
step "node scripts/ui-registry-gate.mjs"
restore apps/web/src/components/ui/card.tsx scripts/ui-registry.json

# --- 05 S5: pristine -> deviated downgrade vs base ------------------------------
begin 05-s5-downgrade.txt "S5 — re-registering a pristine file as deviated goes red against the base manifest (the ratchet only moves up while map #980 runs)"
step "node -e 'const f=\"scripts/ui-registry.json\";const m=JSON.parse(require(\"fs\").readFileSync(f,\"utf8\"));m.files[\"card.tsx\"].status=\"deviated\";m.files[\"card.tsx\"].reason=\"scenario demo downgrade\";require(\"fs\").writeFileSync(f,JSON.stringify(m,null,2)+\"\\n\")'"
step "node scripts/ui-registry-gate.mjs --base $SHA"
restore scripts/ui-registry.json

# --- 06 S2: stale entry after file removal ---------------------------------------
begin 06-s2-stale-entry.txt "S2 — deleting a file while its manifest entry stays goes red (the ledger must track the tree)"
step "rm apps/web/src/components/ui/kbd-hint.tsx"
step "node scripts/ui-registry-gate.mjs"
restore apps/web/src/components/ui/kbd-hint.tsx

# --- 07 S6: fail-closed structural validation ------------------------------------
begin 07-s6-corrupt.txt "S6 — corrupt manifest, a deviated entry without reason, and a missing snapshot file all fail closed (exit 2), never silently green"
step "printf 'not json' > scripts/ui-registry.json"
step "node scripts/ui-registry-gate.mjs"
restore scripts/ui-registry.json
step "node -e 'const f=\"scripts/ui-registry.json\";const m=JSON.parse(require(\"fs\").readFileSync(f,\"utf8\"));delete m.files[\"button.tsx\"].reason;require(\"fs\").writeFileSync(f,JSON.stringify(m,null,2)+\"\\n\")'"
step "node scripts/ui-registry-gate.mjs"
restore scripts/ui-registry.json
step "rm scripts/ui-upstream-snapshots.json"
step "node scripts/ui-registry-gate.mjs"
restore scripts/ui-upstream-snapshots.json

# --- 08 base sha not fetched --------------------------------------------------------
begin 08-base-not-fetched.txt "an unavailable base sha exits 2 instead of silently falling back to the branch manifest"
step "node scripts/ui-registry-gate.mjs --base deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

# --- 09 bootstrap: base without the manifest -----------------------------------------
begin 09-bootstrap-pass.txt "a base that predates the manifest (main at $BASE_MAIN) skips the S5 ratchet and passes — the introducing PR is green"
step "node scripts/ui-registry-gate.mjs --base $BASE_MAIN"

# --- 10 --write refuses to invent registrations ---------------------------------------
begin 10-write-refuses-unregistered.txt "--write refuses to freeze an unregistered file (kind/status/reason are semantic) and prints the entry skeleton"
step "printf 'export function HandRolled() {\n  return <button type=\"button\">demo</button>;\n}\n' > apps/web/src/components/ui/hand-rolled-demo.tsx"
step "node scripts/ui-registry-gate.mjs --write"
step "rm apps/web/src/components/ui/hand-rolled-demo.tsx"

# --- 11 --write idempotent --------------------------------------------------------------
begin 11-write-idempotent.txt "re-freezing an unchanged tree reports no change (idempotent)"
step "node scripts/ui-registry-gate.mjs --write"
step "node scripts/ui-registry-gate.mjs --write"
step "git -C $SCRATCH status --porcelain scripts/ui-registry.json"

# --- 12 G5: raw color in components/ui ----------------------------------------------------
begin 12-g5-raw-color.txt "G5 (ui-drift-gate) — a raw palette class or arbitrary color value inside components/ui goes red"
step "printf 'export const Demo = () => <div className=\"bg-red-500 text-[#fff]\" />;\n' >> apps/web/src/components/ui/kbd-hint.tsx"
step "node scripts/ui-drift-gate.mjs"
restore apps/web/src/components/ui/kbd-hint.tsx

# --- 13 refresh determinism (lane worktree; needs network + node_modules) ------------------
begin 13-refresh-deterministic.txt "refresh re-run against the same upstream regenerates identical item hashes — only fetchedAt metadata moves (git diff + restore prove it)"
lstep "node scripts/ui-registry-refresh.mjs"
lstep "git diff --stat scripts/ui-upstream-snapshots.json"
lstep "git diff scripts/ui-upstream-snapshots.json | grep -E '^[+-]' | grep -vE '^[+-]{3}' | head -8"
lstep "git restore scripts/ui-upstream-snapshots.json && git status --porcelain scripts/"

git -C "$REPO" worktree remove --force "$SCRATCH"
echo "scenarios written to $OUT"
