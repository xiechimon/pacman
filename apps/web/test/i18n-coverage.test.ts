// en-coverage gate (issue #74 acceptance: 语言切换全已建屏生效). Walks the
// app source with the TypeScript AST and enforces the zh-as-key contract:
//
//   1. every CJK string literal under src/ (fixtures/ excluded — that is
//      user/agent data, which never translates) is either an EN dict key
//      or on the documented allowlist;
//   2. no CJK survives in JSX text nodes or template-literal quasis —
//      both mean an unwrapped render site (JSX text must go through
//      {t('…')}, interpolation through dict templates with {vars});
//   3. every EN key is live — it appears as a literal somewhere in src/,
//      so the dict cannot rot with dead entries.
//
// A miss in (1) means the en screen would show a zh string; the identity
// fallback keeps it readable but the acceptance line demands the switch
// works on every built surface.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { PROBE_TOOL_CALL_LABEL } from '../src/fixtures/fixtures.js';
import { EN } from '../src/i18n/en.js';

const SRC = resolve(import.meta.dirname, '../src');
const CJK = /[一-鿿]/;

/** CJK literals that deliberately stay out of the dict, keyed `rel::text`. */
const ALLOWLIST: Record<string, string> = {
  // endonym shown in the language dropdown under both locales ([设计])
  'i18n/locale.ts::简体中文': 'language endonym — identical in every locale by design',
};

/** Dict keys assembled at module scope (exact-value fixture chrome). */
const COMPUTED_KEYS = new Set<string>([PROBE_TOOL_CALL_LABEL]);

/** Data layer: capture-verbatim user/agent content, never translated.
 *  `api` = M5 live 数据层（wire→display mappers）——产出的是与 fixtures 同族
 *  的记录内容串（zh-CN 权威 canon，01 §4.1/S6：workspace zh 权威 + en 兜底
 *  在组件 t() 位兑现），mapper 为纯数据变换、无 i18n 上下文。 */
const EXCLUDED_DIRS = ['fixtures', 'api'];
const EXCLUDED_FILES = ['i18n/en.ts'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry)) out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

interface Found {
  rel: string;
  text: string;
  kind: 'literal' | 'template' | 'jsx-text';
}

function scan(file: string): Found[] {
  const rel = relative(SRC, file).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Found[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (CJK.test(node.text)) found.push({ rel, text: node.text, kind: 'literal' });
    } else if (ts.isTemplateExpression(node)) {
      const quasis = [node.head, ...node.templateSpans.map((s) => s.literal)];
      if (quasis.some((q) => CJK.test(q.text))) {
        found.push({ rel, text: node.getText(), kind: 'template' });
      }
    } else if (ts.isJsxText(node)) {
      if (CJK.test(node.text)) found.push({ rel, text: node.text.trim(), kind: 'jsx-text' });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}

const files = sourceFiles(SRC).filter(
  (f) => !EXCLUDED_FILES.includes(relative(SRC, f).replaceAll('\\', '/')),
);
const all = files.flatMap(scan);

describe('CJK coverage against the en dict', () => {
  it('no CJK survives in JSX text (unwrapped render sites)', () => {
    const jsx = all.filter((f) => f.kind === 'jsx-text');
    expect(jsx.map((f) => `${f.rel}: ${f.text}`)).toEqual([]);
  });

  it('no CJK survives in template-literal quasis (use dict {vars} templates)', () => {
    const templates = all.filter((f) => f.kind === 'template');
    expect(templates.map((f) => `${f.rel}: ${f.text}`)).toEqual([]);
  });

  it('every CJK literal is an EN dict key or allowlisted', () => {
    const missing = all
      .filter((f) => f.kind === 'literal')
      .filter((f) => !(f.text in EN) && !(`${f.rel}::${f.text}` in ALLOWLIST))
      .map((f) => `${f.rel}: ${JSON.stringify(f.text)}`);
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('EN dict liveness', () => {
  it('every key appears as a literal somewhere in src/ (no dead entries)', () => {
    // corpus 含 api/ 数据层（M5）：规则 1–2 豁免该目录（记录内容串与
    // fixtures 同族），但其经 translate() 纯函数位消费的 dict 键（桌面通知
    // 标题，api/sse.ts）是活键——liveness 面计入。
    const corpus = files
      .map((f) => readFileSync(f, 'utf8'))
      .concat(readFileSync(join(SRC, 'fixtures/fixtures.ts'), 'utf8'))
      .concat(sourceFiles(join(SRC, 'api')).map((f) => readFileSync(f, 'utf8')))
      .join('\n');
    const dead = Object.keys(EN).filter(
      (key) => !COMPUTED_KEYS.has(key) && !corpus.includes(key),
    );
    expect(dead).toEqual([]);
  });
});
