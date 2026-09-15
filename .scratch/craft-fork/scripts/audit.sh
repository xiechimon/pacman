#!/usr/bin/env bash
# pacman · 身份与裁剪审计脚本
# 用法：bash .scratch/craft-fork/scripts/audit.sh
# 退出码：0 = a/c 类干净；1 = 有残留
# 说明：B2 票要求 a 类（必删）与 c 类（可选断）零命中；b 类（深换皮）由 B3 处置，本脚本只统计。

set -u

# rg 在 bun 仓里装在 node_modules/.bin，把路径补上
export PATH="$PWD/node_modules/.bin:$PATH"

# 排除：构建产物、依赖、调研草稿、锁文件
EXCLUDE=(
  -g '!node_modules/**'
  -g '!dist/**'
  -g '!out/**'
  -g '!.scratch/craft-fork/research/**'
  -g '!bun.lock'
  -g '!package-lock.json'
)

# a 类：必删（19 条触点汇总为正则或集）
A_PATTERN='@sentry|sentry-electron|Sentry\.(init|captureException|captureMessage|setUser|setTag)|plausible\.io|send_developer_feedback|Send Feedback|submitFeedback|mcp\.craft\.do|Craft MCP Integration'

# c 类：可选断（10 条触点汇总）
C_PATTERN='thecraftagents\.com/(pages|install|auth/callback|docs|s/)'

# b 类：深换皮（B3 范围，仅统计）
B_PATTERN='craftagents://|\.craft-agent|@craft-agent/|craft-agent-v[12]|app\.lukilabs\.craft-agent|com\.lukilabs\.craft-agent'

scan() {
  local name=$1 pattern=$2
  rg --no-heading ${EXCLUDE[@]} -e "$pattern" . | sort -u
}

report() {
  local label=$1 hits=$2 hard=$3
  printf "  %-20s %4d 命中%s\n" "$label" "$hits" "$([ "$hard" = 1 ] && echo " [硬要求]" || echo " [仅统计]")"
}

a_hits=$(scan a "$A_PATTERN" | wc -l | tr -d ' ')
c_hits=$(scan c "$C_PATTERN" | wc -l | tr -d ' ')
b_hits=$(scan b "$B_PATTERN" | wc -l | tr -d ' ')

echo "=== pacman 身份与裁剪审计 ==="
report "a 类（必删）" "$a_hits" 1
report "c 类（可选断）" "$c_hits" 1
report "b 类（深换皮 B3）" "$b_hits" 0
echo

exit_code=0
for entry in "a:$A_PATTERN" "c:$C_PATTERN"; do
  name="${entry%%:*}"
  pattern="${entry#*:}"
  hits=$(scan "$name" "$pattern")
  if [ -n "$hits" ]; then
    echo "--- $name 类命中详情 ---"
    echo "$hits"
    echo
    exit_code=1
  fi
done

if [ "$exit_code" = "0" ]; then
  echo "✓ a/c 类干净（b 类待 B3）"
else
  echo "✗ a/c 类有残留，按 01 票逐条勾销"
fi

exit $exit_code
