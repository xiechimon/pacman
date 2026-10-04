#!/usr/bin/env python3
"""PR evidence gate (#750): image links in the PR body must be embedded and reachable.

Two checks, either failing turns the job red:

1. Embedded: every `raw.githubusercontent.com` link pointing at an image
   (`png|gif|jpe?g|webp`) must use the inline-image form `![label](url)`.
   A plain `[label](url)` renders as a bare link on the PR page, so the
   evidence is invisible.
2. Reachable: every such link must answer HTTP 200 (catches bad SHAs).

Scope note: only `raw.githubusercontent.com` image links are checked.
Links on other hosts (attachments, user-images, ...) are ignored by design;
see Merge Danger in the PR body.

Usage:
  PR_BODY='<pr body>' python3 scripts/pr-evidence-gate.py   # CI entry point
  python3 scripts/pr-evidence-gate.py path/to/body.md        # local testing

Exit 0 when the body passes, 1 otherwise. All findings name the URL.
"""
import os
import re
import subprocess
import sys
import concurrent.futures as cf

# Same pattern as scratch/pr-evidence-check.py (coordinator's reference
# implementation): keep the two in agreement, do not widen the scope here.
IMG = re.compile(r'(?P<bang>!?)\[(?P<label>[^\]]*)\]\((?P<url>https://raw\.githubusercontent\.com/[^)\s]+\.(?:png|gif|jpe?g|webp))\)')


def http_code(url):
    r = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '25', url],
        capture_output=True, text=True)
    return r.stdout.strip()


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding='utf-8') as f:
            body = f.read()
    else:
        body = os.environ.get('PR_BODY', '')
    if body is None:
        body = ''

    links = [{'embedded': m.group('bang') == '!',
              'label': m.group('label'),
              'url': m.group('url')}
             for m in IMG.finditer(body)]

    print(f"pr-evidence: scanned {len(links)} image link(s)")
    failures = []

    for link in links:
        if not link['embedded']:
            failures.append(link)
            print(f"FAIL not-embedded: [{link['label']}]({link['url']})")

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        codes = list(ex.map(lambda link: (link, http_code(link['url'])), links))
    for link, code in codes:
        if code != '200':
            failures.append(link)
            print(f"FAIL unreachable (HTTP {code}): [{link['label']}]({link['url']})")

    if failures:
        print(f"pr-evidence: RED ({len(failures)} problem(s))")
        return 1
    print("pr-evidence: GREEN")
    return 0


if __name__ == '__main__':
    sys.exit(main())
