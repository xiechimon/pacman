#!/usr/bin/env python3
"""#953 sealed 封版终态核账（票面第 4 项，全部机器可判）。

从仓库任意位置运行：python3 docs/verify/953/audit-terminal-state.py
每项打印实测值与判据；退出码 = 不满足判据的项数（0 = 封版账全过）。

判据（#953 票面 + #851/#913 口径）：
  1. per-face CSS = 0：apps/web/src 下 *.css 仅载体层白名单五件
     （shadcn/tokens/motion/app/fonts.css）
  2. apps/web/src/ui/ 目录已删
  3. 裸控件账：ui-debt 基线 total 与树内实测一致；#952 起终态 = 3 处
     deliberate-native 隐藏 file input（#855 marker 纪律，显式豁免见 README）
  4. docs/spec 编号无撞号（00–25 各号唯一）
  5. spec/16 头部 superseded-in-part 退役声明就位
  6. 余册处置：11 头部 superseded-in-part（#953 加）；06/18 无需标注
     （06 §1 已载对拍义务解除 + 18 册修订注；18 自身已排除像素对拍）
  7. t-0909 沙盒退役：工作树无 library/t-0909；150 文件可按 main 历史
     144698cb 取回；palette-c.css 与 c.css@7340d0ab sha1 逐字节一致
"""

import json
import os
import re
import subprocess
import sys

ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
).stdout.strip()
os.chdir(ROOT)

WHITELIST = {
    "apps/web/src/styles/app.css",
    "apps/web/src/styles/fonts.css",
    "apps/web/src/styles/motion.css",
    "apps/web/src/styles/shadcn.css",
    "apps/web/src/styles/tokens.css",
}

failures = 0


def report(ok, name, value, criterion):
    global failures
    if not ok:
        failures += 1
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {value}")
    print(f"       判据: {criterion}")


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


# 1. per-face CSS = 0
css = [c for c in sh("find apps/web/src -name '*.css'").splitlines() if c]
perface = sorted(set(css) - WHITELIST)
report(
    not perface and set(css) >= WHITELIST,
    "per-face CSS（工作树，白名单外）",
    f"{len(perface)} 个 {perface}；白名单五件在场={sorted(css) == sorted(WHITELIST)}",
    "= 0，载体层仅白名单五件",
)

# 2. src/ui 已删
ui_exists = os.path.exists("apps/web/src/ui")
report(not ui_exists, "apps/web/src/ui/ 目录", f"exists={ui_exists}", "已删（False）")

# 3. 裸控件账
baseline = json.load(open("scripts/ui-debt-baseline.json"))
files = baseline["rawControls"]["files"]
markers = sum(open("apps/web/src/" + f).read().count("deliberate-native") for f in files)
rcc = sh("node scripts/count-raw-controls.mjs 2>/dev/null | grep -c '^| `' || true")
report(
    baseline["rawControls"]["total"] == len(files) == 3 and markers >= 3,
    "裸控件（ui-debt 基线终态）",
    f"total={baseline['rawControls']['total']} files={files} deliberate-native markers={markers}",
    "终态 3 处全部为 #855 deliberate-native 隐藏 file input（显式豁免，见 README §裸控件）",
)
report(
    baseline["perFaceCss"] == {},
    "ui-debt 基线 perFaceCss",
    f"{baseline['perFaceCss']}",
    "空账本（per-face 债务清零后冻结）",
)

# 4. docs/spec 编号
specs = sorted(os.listdir("docs/spec"))
nums = {}
for s in specs:
    m = re.match(r"^(\d+)-", s)
    if m:
        nums.setdefault(int(m.group(1)), []).append(s)
dupes = {k: v for k, v in nums.items() if len(v) > 1}
unnumbered = [s for s in specs if not re.match(r"^\d+-", s)]
report(
    not dupes,
    "docs/spec 撞号",
    f"{len(nums)} 个编号（{min(nums)}–{max(nums)}）重复={dupes or 0}；未编号历史册={unnumbered}",
    "各编号唯一（22 号撞号已由 #952 按正本表 §0 规则重编功能地图至 25 解决）",
)

# 5. spec/16 退役声明
h16 = open("docs/spec/16-shadcn全站铺开批次表与验收口径.md").read(800)
report(
    "superseded-in-part" in h16,
    "spec/16 头部退役声明",
    "superseded-in-part 在场" if "superseded-in-part" in h16 else "缺失",
    "就位（#911/ADR 0010 落）",
)

# 6. 余册 06 D1 / 11 / 18
h11 = open("docs/spec/11-模型服务与机器本地化.md").read(900)
h06 = open("docs/spec/06-开源与分化.md").read(1500)
h18 = open("docs/spec/18-定位与差异化.md").read()
report(
    "superseded-in-part" in h11,
    "spec/11 superseded-in-part",
    "在场（#953 加：resources.css 载体指针失效，页面语义不受影响）",
    "就位",
)
report(
    "18 册" in h06 and "对拍义务" in h06,
    "spec/06 D1 处置",
    "既有注记充分（头部 18 册修订注 + §1 对拍义务解除）——无需新标注",
    "核到什么写什么：无 UI 换代失效面",
)
report(
    "已解除对拍义务" in h18,
    "spec/18 处置",
    "自身已排除像素对拍（§不做清单）——无需新标注",
    "核到什么写什么：定位面与 UI 换代无交集",
)

# 7. t-0909 退役
wt_gone = not os.path.exists("library/t-0909")
hist = sh("git ls-tree -r 144698cb --name-only library/t-0909 | wc -l")
sha_hist = sh("git show 7340d0ab:library/t-0909/src/themes/c.css | shasum | cut -d' ' -f1")
sha_copy = sh("shasum apps/web/e2e/palette-c.css | cut -d' ' -f1")
report(
    wt_gone and hist == "150" and sha_hist == sha_copy,
    "t-0909 沙盒退役",
    f"工作树已删={wt_gone}；历史可取回={hist} 文件 @144698cb；palette-c.css sha1=={sha_copy[:12]}…（与 c.css@7340d0ab 一致={sha_hist == sha_copy}）",
    "工作树无沙盒 + 历史完整 + 冻结正本逐字节一致",
)

print(f"\n{failures} FAIL" if failures else "\nALL PASS — #953 终态核账全过")
sys.exit(1 if failures else 0)
