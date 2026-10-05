#!/usr/bin/env bash
# PROTOTYPE screenshot sweep (#909): all variant × face × mode combos.
set -euo pipefail
PLW=/Users/xmon/.herdr/worktrees/pacman/ui-909-visual-direction/apps/web/node_modules/.bin/playwright
OUT=/tmp/t0909
mkdir -p "$OUT"

# wait for dev server
for _ in $(seq 1 40); do
  if curl -s --noproxy '*' -o /dev/null http://localhost:5199/; then break; fi
  sleep 0.5
done
curl -s --noproxy '*' -o /dev/null http://localhost:5199/ || { echo "dev server not up"; exit 1; }

for v in a b c; do
  for f in board detail overlay search resources; do
    "$PLW" screenshot --viewport-size=1440,900 --wait-for-timeout=2200 \
      "http://localhost:5199/?variant=${v}&face=${f}&mode=dark" "$OUT/${v}-${f}-dark.png" >/dev/null 2>&1
    echo "shot ${v}-${f}-dark"
  done
done
for v in a b c; do
  for f in board detail resources; do
    "$PLW" screenshot --viewport-size=1440,900 --wait-for-timeout=2200 \
      "http://localhost:5199/?variant=${v}&face=${f}&mode=light" "$OUT/${v}-${f}-light.png" >/dev/null 2>&1
    echo "shot ${v}-${f}-light"
  done
done
ls -la "$OUT" | tail -5
echo DONE
