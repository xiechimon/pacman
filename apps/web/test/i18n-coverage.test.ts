// en-coverage gate (issue #74 acceptance: 语言切换全已建屏生效). Walks the
// app source with the TypeScript scanner and enforces the zh-as-key contract:
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
//
// TS 7 note: the native compiler no longer ships the old JS parser API
// (`ts.createSourceFile`); `typescript/unstable/ast` exposes the scanner,
// so this gate walks tokens with a small state machine — brace depth tracks
// template substitutions (`${` … `}` rescans as template), and JSX text is
// entered via `scanJsxToken` after an opening tag. Verified token-for-token
// equivalent to the TS 5 AST walk on this tree (literals / quasis / JSX
// text inventories identical).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CHIEF_REBIND_CONFIRM_COPY, NOTIFICATION_BANNER_COPY } from '@pacman/shared';
import { createScanner, LanguageVariant, SyntaxKind } from 'typescript/unstable/ast';
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

/** Dict keys assembled at module scope (exact-value fixture chrome; the
 *  #114 banner copy keys live in the shared NOTIFICATION_BANNER_COPY canon
 *  — packages/shared, outside the src/ scan tree — and reach t() through
 *  the constant, never as literals). */
const COMPUTED_KEYS = new Set<string>([
  PROBE_TOOL_CALL_LABEL,
  NOTIFICATION_BANNER_COPY.title,
  NOTIFICATION_BANNER_COPY.body,
  NOTIFICATION_BANNER_COPY.action,
  // #182: chief 换绑二次确认 copy 同为 shared canon（<agent> 占位由显示层
  // 替换），经 t() 消费、不作字面量出现。
  CHIEF_REBIND_CONFIRM_COPY,
]);

/** Data layer: capture-verbatim user/agent content, never translated.
 *  `api` = M5 live 数据层（wire→display mappers）——产出的是与 fixtures 同族
 *  的记录内容串（zh-CN 权威 canon，01 §4.1/S6：workspace zh 权威 + en 兜底
 *  在组件 t() 位兑现），mapper 为纯数据变换、无 i18n 上下文。 */
const EXCLUDED_DIRS = ['fixtures', 'api'];
const EXCLUDED_FILES = ['i18n/en.ts'];

/** Tokens after which `<` continues an expression (comparison, generic
 *  argument list) instead of opening JSX. */
const NO_JSX_AFTER = new Set<SyntaxKind>([
  SyntaxKind.Identifier,
  SyntaxKind.PrivateIdentifier,
  SyntaxKind.NumericLiteral,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateTail,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.CloseParenToken,
  SyntaxKind.CloseBracketToken,
  SyntaxKind.ThisKeyword,
  SyntaxKind.SuperKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
  SyntaxKind.NullKeyword,
]);

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
  const isTsx = rel.endsWith('.tsx');
  const scanner = createScanner(
    /* skipTrivia */ true,
    isTsx ? LanguageVariant.JSX : LanguageVariant.Standard,
    text,
  );
  const found: Found[] = [];
  let braceDepth = 0;
  /** braceDepth at which `}` closes the innermost template substitution. */
  const templateStack: number[] = [];
  /** per-template aggregation so one finding carries the whole raw template. */
  const openTemplates: { start: number; cjk: boolean }[] = [];
  let rescanTemplate = false;
  let lastTok = SyntaxKind.Unknown;
  let prevTok = SyntaxKind.Unknown;

  /** Next token in code context; records string/template findings. */
  const advance = (): SyntaxKind => {
    const tok = rescanTemplate ? scanner.reScanTemplateToken(false) : scanner.scan();
    rescanTemplate = false;
    prevTok = lastTok;
    lastTok = tok;
    if (tok === SyntaxKind.OpenBraceToken) {
      braceDepth++;
    } else if (tok === SyntaxKind.CloseBraceToken) {
      const top = templateStack[templateStack.length - 1];
      if (top !== undefined && braceDepth === top) {
        rescanTemplate = true; // `}` closed a template substitution
      } else {
        braceDepth--;
      }
    }
    if (tok === SyntaxKind.StringLiteral || tok === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const v = scanner.getTokenValue();
      if (CJK.test(v)) found.push({ rel, text: v, kind: 'literal' });
    } else if (tok === SyntaxKind.TemplateHead) {
      templateStack.push(braceDepth);
      openTemplates.push({ start: scanner.getTokenStart(), cjk: CJK.test(scanner.getTokenValue()) });
    } else if (tok === SyntaxKind.TemplateMiddle) {
      const t = openTemplates[openTemplates.length - 1];
      if (t) t.cjk ||= CJK.test(scanner.getTokenValue());
    } else if (tok === SyntaxKind.TemplateTail) {
      templateStack.pop();
      const t = openTemplates.pop();
      if (t && (t.cjk || CJK.test(scanner.getTokenValue()))) {
        found.push({ rel, text: text.slice(t.start, scanner.getTokenEnd()), kind: 'template' });
      }
    }
    return tok;
  };

  /** Consume tokens until the `}` matching the `{` the caller just ate. */
  const scanCodeUntilClose = (): void => {
    const stop = braceDepth - 1;
    for (;;) {
      const tok = advance();
      if (tok === SyntaxKind.EndOfFile || braceDepth <= stop) return;
      if (isTsx && tok === SyntaxKind.LessThanToken && !NO_JSX_AFTER.has(prevTok)) {
        scanJsxElement();
      }
    }
  };

  /** LessThanToken just consumed in JSX position: eat tag + children. */
  const scanJsxElement = (): void => {
    let tok = advance();
    if (tok === SyntaxKind.EndOfFile) return;
    if (tok === SyntaxKind.GreaterThanToken) {
      scanJsxChildren(); // <> fragment
      return;
    }
    for (;;) {
      if (tok === SyntaxKind.EndOfFile) return;
      if (tok === SyntaxKind.GreaterThanToken) {
        scanJsxChildren();
        return;
      }
      if (tok === SyntaxKind.SlashToken) {
        advance(); // self-closing: consume `>`
        return;
      }
      if (tok === SyntaxKind.OpenBraceToken) {
        scanCodeUntilClose(); // spread attribute
        tok = advance();
        continue;
      }
      if (tok === SyntaxKind.EqualsToken) {
        const v = advance();
        if (v === SyntaxKind.OpenBraceToken) scanCodeUntilClose();
        // else attribute string literal — already recorded by advance()
        tok = advance();
        continue;
      }
      tok = advance(); // tag-name part or attribute name
    }
  };

  const scanJsxChildren = (): void => {
    for (;;) {
      const tok = scanner.scanJsxToken();
      prevTok = lastTok;
      lastTok = tok;
      if (tok === SyntaxKind.EndOfFile) return;
      if (tok === SyntaxKind.JsxText || tok === SyntaxKind.JsxTextAllWhiteSpaces) {
        const v = scanner.getTokenText();
        if (CJK.test(v)) found.push({ rel, text: v.trim(), kind: 'jsx-text' });
        continue;
      }
      if (tok === SyntaxKind.OpenBraceToken) {
        braceDepth++;
        scanCodeUntilClose(); // { expression } container
        continue;
      }
      if (tok === SyntaxKind.LessThanToken) {
        scanJsxElement(); // nested element
        continue;
      }
      if (tok === SyntaxKind.LessThanSlashToken) {
        let t = advance(); // closing tag: consume through `>`
        while (t !== SyntaxKind.GreaterThanToken && t !== SyntaxKind.EndOfFile) t = advance();
        return;
      }
      return; // unexpected token — bail rather than spin
    }
  };

  for (;;) {
    const tok = advance();
    if (tok === SyntaxKind.EndOfFile) break;
    if (isTsx && tok === SyntaxKind.LessThanToken && !NO_JSX_AFTER.has(prevTok)) {
      scanJsxElement();
    }
  }
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
