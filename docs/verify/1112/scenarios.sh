#!/usr/bin/env bash
set -u
REPO=/tmp/t1112/repo
cd "$REPO" || exit 1
PATH=/tmp/t1112/work:$PATH
export PATH

run() {
  local label="$1"
  set +e
  bash .git/hooks/pre-commit > /tmp/t1112/out.txt 2>&1
  local rc=$?
  set -u
  echo "$label rc=$rc"
  if [ $rc -ne 0 ]; then
    grep -E 'Blocked|banned|unexpected' /tmp/t1112/out.txt | head -2 | sed 's/^/    /'
  fi
  git reset -q -- . >/dev/null 2>&1
  rm -f docs1.drawio.svg docs2.drawio.svg docs3.drawio.svg docs4.drawio.svg src1.ts src2.ts
}

python3 - <<'PYEOF'
import base64, random, string
rng = random.Random(42)
al = string.ascii_letters + string.digits + '+/'
png = b'\x89PNG\r\n\x1a\n' + bytes(rng.randrange(256) for _ in range(400))
b64 = base64.b64encode(png).decode()
off = rng.randrange(0, len(b64) - 8)
b64 = b64[:off] + 'TODO' + b64[off+4:]
b64 += '=' * (-len(b64) % 4)
svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,' + b64 + '"/></svg>'
open('/tmp/t1112/repo/docs1.drawio.svg', 'w').write(svg)
PYEOF
git add docs1.drawio.svg
run "S1-svg-base64-TODO-passes"

printf '// TODO: fix later\nexport const x = 1;\n' > src1.ts
git add src1.ts
run "S2-real-TODO-blocked"

printf '<svg><text>TODO: fix the layout</text></svg>\n' > docs2.drawio.svg
git add docs2.drawio.svg
run "S3-svg-markup-TODO-blocked"

printf '<svg><text>先这样吧</text></svg>\n' > docs3.drawio.svg
git add docs3.drawio.svg
run "S4-svg-markup-CJK-blocked"

printf '// TODO: real one\n' > src2.ts
printf '<svg><text>fine line</text></svg>\n' > docs4.drawio.svg
git add src2.ts docs4.drawio.svg
run "S5-mixed-blocked-real-TODO"

echo "scenarios done"
