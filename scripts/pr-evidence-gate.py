#!/usr/bin/env python3
"""PR evidence gate (#750): image links in the PR body must be embedded and reachable.

Two checks, either failing turns the job red:

1. Embedded: every `raw.githubusercontent.com` link pointing at an image
   (`png|gif|jpe?g|webp`) must use the inline-image form `![label](url)`.
   A plain `[label](url)` renders as a link, and a bare URL with no markdown
   around it renders as an autolink or as plain text -- either way the image
   never appears, so the evidence is invisible.
2. Reachable: every such link must answer HTTP 200 (catches bad SHAs).

Scope note: only `raw.githubusercontent.com` image links are checked.
Links on other hosts (attachments, user-images, ...) are ignored by design,
as are links to non-image evidence files (`.json`, `.md`, `.txt`): those
cannot be embedded as images, so they are read as references, not evidence.
See Merge Danger in the PR body.

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

# Rule shared with the coordinator's reference implementation,
# `scratch/pr-evidence-check.py` (outside this repo): same link pattern,
# same curl probe, same verdicts. Change one, change the other.
MD_LINK = re.compile(r'(?P<bang>!?)\[(?P<label>[^\]]*)\]\((?P<url>[^)\s]+)\)')
IMG_URL = re.compile(r'https://raw\.githubusercontent\.com/[^\s)\]>]+\.(?:png|gif|jpe?g|webp)')


def http_code(url):
    r = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '25', url],
        capture_output=True, text=True)
    return r.stdout.strip()


def find_links(body):
    """Every raw image URL in the body, tagged with its rendering form.

    A URL is embedded only as the target of `![label](url)`. As the target
    of `[label](url)` it renders as a link, and standing on its own it
    renders as an autolink or as text; none of those show the image.
    """
    targets = {}
    for m in MD_LINK.finditer(body):
        start, end = m.span('url')
        targets[(start, end)] = m

    def markdown_target(start, end):
        for (s, e), m in targets.items():
            if s <= start and end <= e:
                return m
        return None

    links = []
    seen = set()
    for m in IMG_URL.finditer(body):
        md = markdown_target(m.start(), m.end())
        if md is None:
            links.append({'form': 'bare', 'embedded': False, 'label': None,
                          'url': m.group(0),
                          'line': body.count('\n', 0, m.start()) + 1})
            continue
        span = md.span('url')
        if span in seen:
            continue
        seen.add(span)
        links.append({'form': 'image' if md.group('bang') == '!' else 'link',
                      'embedded': md.group('bang') == '!',
                      'label': md.group('label'),
                      'url': body[span[0]:span[1]],
                      'line': body.count('\n', 0, md.start()) + 1})
    return links


def describe(link):
    if link['form'] == 'bare':
        return f"{link['url']} (bare URL, line {link['line']})"
    return f"[{link['label']}]({link['url']})"


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding='utf-8') as f:
            body = f.read()
    else:
        body = os.environ.get('PR_BODY', '')
    if body is None:
        body = ''

    links = find_links(body)

    print(f"pr-evidence: scanned {len(links)} image link(s)")
    failures = []

    for link in links:
        if not link['embedded']:
            failures.append(link)
            print(f"FAIL not-embedded: {describe(link)}")

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        codes = list(ex.map(lambda link: (link, http_code(link['url'])), links))
    for link, code in codes:
        if code != '200':
            failures.append(link)
            print(f"FAIL unreachable (HTTP {code}): {describe(link)}")

    if failures:
        print(f"pr-evidence: RED ({len(failures)} problem(s))")
        return 1
    print("pr-evidence: GREEN")
    return 0


if __name__ == '__main__':
    sys.exit(main())