'use strict';

/**
 * DOM HTML sink scanner and semantic classifier (#4533).
 *
 * Shared by the two DOM XSS contract tests:
 *   - tests/contracts/dom-xss-renderer-guardrail-contract.test.cjs  (Layer 1: per-file counts)
 *   - tests/contracts/frontend-dom-xss-guardrails.test.cjs          (Layer 2: sink semantics)
 *
 * Pure source read: no network, database, provider, DOM, browser, or runtime
 * execution of the scanned code. No new parser dependency — extraction is a
 * bounded, string/template-aware, AST-free scanner.
 *
 * Classification vocabulary (per sink):
 *   CLEAR_CONTAINER             right-hand side is an empty string literal
 *   STATIC_TRUSTED_TEMPLATE     no user-controlled value reaches the sink
 *   EXPLICIT_ESCAPED_DYNAMIC    every user value passes escapeHtml/textContent/etc.
 *   SANITIZED_URL_DYNAMIC       every user value passes sanitizeUrl/safeUrl/normalizeUrl
 *   APPROVED_RENDERER_BOUNDARY  delegated to a helper whose chain reaches an escaping boundary
 *   REVIEW_NEEDED               user-controlled value with no provable safe boundary
 *
 * Surface vocabulary (per sink file):
 *   ACTIVE_PRODUCT     loaded by a reachable Product page
 *   DORMANT_UNLINKED   loaded only by an unreachable page, or by no page at all
 *   MOCK_PROTOTYPE     prototype/PoC/mock runtime that is not an active Product surface
 *
 * Refs #4533 #4390
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const SINK_REGEX = /(\.innerHTML\s*=|\.insertAdjacentHTML\s*\(|\.outerHTML\s*=)/g;

const SINK_TYPES = Object.freeze(['.innerHTML =', '.insertAdjacentHTML(', '.outerHTML =']);

// Fresh regex each call — sink discovery must be byte-identical to the Layer-1
// count guard regex so both layers always agree on what a sink is.
function sinkPattern() {
  return /(\.innerHTML\s*=|\.insertAdjacentHTML\s*\(|\.outerHTML\s*=)/g;
}

const CLASSIFICATION_VOCABULARY = Object.freeze([
  'CLEAR_CONTAINER',
  'STATIC_TRUSTED_TEMPLATE',
  'EXPLICIT_ESCAPED_DYNAMIC',
  'SANITIZED_URL_DYNAMIC',
  'APPROVED_RENDERER_BOUNDARY',
  'REVIEW_NEEDED',
]);

const SURFACE_VOCABULARY = Object.freeze(['ACTIVE_PRODUCT', 'DORMANT_UNLINKED', 'MOCK_PROTOTYPE']);

// #4533 / policy user-controlled vocabulary (docs/security/FRONTEND_RENDERING_DOM_XSS_GUARDRAILS.md).
const USER_VOCAB = /\b(?:tree|treeData|currentTree|memory|memories|node|item|record|payload|draft|formData|tag|tags|title|memo|note|quote|diary|thumbnail|sourceUrl|url|label|emotionTags)\b/;

// Explicit safe boundaries (canonical helpers in js/utils/security.js plus DOM text sinks).
const SAFE_BOUNDARY = /\b(?:escapeHtml|sanitize|safeHtml|textContent|createTextNode|setAttribute|safeUrl|sanitizeUrl|normalizeUrl|resolveMemoryThumbnail|resolveTreeTitleText|formatI18nText)\b/;
const URL_BOUNDARY = /\b(?:sanitizeUrl|safeUrl|normalizeUrl)\b/;

// Application-text producers (i18n/number formatting) — never user payload.
const APP_TEXT_CALLS = /\b(?:tText|t|getSearchCopy|formatDate|formatNumber|formatI18nText)\s*\(/;

const CALLEE_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
  'String', 'Number', 'Array', 'Object', 'Math', 'JSON', 'encodeURIComponent',
  'isNaN', 'parseInt', 'parseFloat', 'Boolean', 'Promise', 'Date', 'RegExp',
  'Error', 'require', 'console',
]);

const MAX_STATEMENT_BYTES = 8000;

// ─── file enumeration ────────────────────────────────────────────────────────

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function relPath(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, '/');
}

function listJsFiles() {
  return walk(path.join(ROOT, 'js'), '.js').map(relPath).sort();
}

function listHtmlFiles() {
  return [...walk(path.join(ROOT, 'pages'), '.html'), path.join(ROOT, 'index.html')]
    .filter((f) => fs.existsSync(f))
    .map(relPath)
    .sort();
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// ─── bounded, template/string-aware statement extraction ─────────────────────
//
// Walks forward from the sink while tracking string, template-literal, `${}`
// interpolation, comment and bracket state, and stops at the terminating `;`
// of the top-level statement. Multiline template sinks are therefore analysed
// as one statement instead of one line.

function extractStatement(content, start) {
  const modes = ['code']; // 'code' | 'sq' | 'dq' | 'tmpl'
  const templateMarks = [];
  let braces = 0;
  let parens = 0;
  let brackets = 0;
  let i = start;
  const limit = Math.min(content.length, start + MAX_STATEMENT_BYTES);
  let end = -1;

  while (i < limit) {
    const top = modes[modes.length - 1];
    const c = content[i];
    const n = content[i + 1];

    if (top === 'sq' || top === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((top === 'sq' && c === "'") || (top === 'dq' && c === '"')) modes.pop();
      i += 1; continue;
    }
    if (top === 'tmpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { modes.pop(); i += 1; continue; }
      if (c === '$' && n === '{') { templateMarks.push(braces); modes.push('code'); braces += 1; i += 2; continue; }
      i += 1; continue;
    }
    // code
    if (c === "'") { modes.push('sq'); i += 1; continue; }
    if (c === '"') { modes.push('dq'); i += 1; continue; }
    if (c === '`') { modes.push('tmpl'); i += 1; continue; }
    if (c === '/' && n === '/') { while (i < limit && content[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') { const e = content.indexOf('*/', i + 2); i = e === -1 ? limit : e + 2; continue; }
    if (c === '{') { braces += 1; i += 1; continue; }
    if (c === '}') {
      if (braces > 0) {
        braces -= 1;
        if (templateMarks.length && braces === templateMarks[templateMarks.length - 1]) {
          templateMarks.pop();
          modes.pop(); // back into the enclosing template literal
          i += 1; continue;
        }
      }
      i += 1; continue;
    }
    if (c === '(') { parens += 1; i += 1; continue; }
    if (c === ')') { if (parens > 0) parens -= 1; i += 1; continue; }
    if (c === '[') { brackets += 1; i += 1; continue; }
    if (c === ']') { if (brackets > 0) brackets -= 1; i += 1; continue; }
    if (c === ';' && modes.length === 1 && braces === 0 && parens === 0 && brackets === 0) { end = i + 1; break; }
    i += 1;
  }
  if (end === -1) end = i;
  return content.slice(start, end);
}

// ─── expression extraction ───────────────────────────────────────────────────

function extractExpressions(stmt) {
  const exprs = [];
  for (let i = 0; i < stmt.length; i++) {
    if (stmt[i] === '$' && stmt[i + 1] === '{') {
      let j = i + 2;
      let depth = 1;
      let quote = null;
      let inTemplate = 0;
      while (j < stmt.length && depth > 0) {
        const c = stmt[j];
        if (quote) { if (c === '\\') { j += 2; continue; } if (c === quote) quote = null; j += 1; continue; }
        if (c === "'" || c === '"') { quote = c; j += 1; continue; }
        if (c === '`') { inTemplate ^= 1; j += 1; continue; }
        if (!inTemplate) { if (c === '{') depth += 1; else if (c === '}') { depth -= 1; if (depth === 0) break; } }
        j += 1;
      }
      exprs.push(stmt.slice(i + 2, j));
      i = j;
    }
  }
  if (exprs.length === 0 && /\s\+\s/.test(stmt)) {
    const eq = stmt.search(/(\.innerHTML\s*=|\.outerHTML\s*=)/);
    const rhs = eq >= 0 ? stmt.slice(stmt.indexOf('=', eq) + 1) : stmt;
    for (const part of rhs.split(/\s\+\s/)) exprs.push(part);
  }
  return exprs;
}

function stripLiterals(expr) {
  return expr
    .replace(/'(?:[^'\\]|\\.)*'/g, "'S'")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"S"');
}

function literalOnly(expr) {
  const stripped = stripLiterals(expr).replace(/;\s*$/, '');
  return !/[A-Za-z_$]/.test(stripped.replace(/['"]/g, ''));
}

function memberPath(expr) {
  const t = expr.trim().replace(/;\s*$/, '');
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(t) ? t : null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── bounded local provenance ────────────────────────────────────────────────
//
// Provenance is only ever used to PROVE a value is safe (escaped or application
// text). It is never used on its own to declare a sink unsafe.

function resolveLocalDefinition(fileSrc, name) {
  if (!fileSrc) return null;
  const re = new RegExp('(?:var|let|const)?\\s*' + escapeRegExp(name.split('.').pop()) + '\\s*=\\s*([^;\\n]+);', 'g');
  let m;
  let found = null;
  while ((m = re.exec(fileSrc)) !== null) found = m[2];
  return found;
}

function resolveAllDefinitions(fileSrc, name) {
  if (!fileSrc) return [];
  const lastSeg = escapeRegExp(name.split('.').pop());
  const out = [];
  const assign = new RegExp('(?:var|let|const)?\\s*' + lastSeg + '\\s*=\\s*([^;\\n]+);', 'g');
  let m;
  while ((m = assign.exec(fileSrc)) !== null) out.push(m[1]);
  const prop = new RegExp('\\b' + lastSeg + '\\s*:\\s*([^,\\n}]+)', 'g');
  while ((m = prop.exec(fileSrc)) !== null) out.push(m[1]);
  return out;
}

let SOURCES_CACHE = null;
function allSources() {
  if (!SOURCES_CACHE) {
    SOURCES_CACHE = listJsFiles().map((rel) => [rel, read(rel)]);
  }
  return SOURCES_CACHE;
}

function resolveCalleeRegion(name, fileSrc) {
  const esc = escapeRegExp(name);
  const patterns = [
    new RegExp('function\\s+' + esc + '\\s*\\('),
    new RegExp('\\b' + esc + '\\s*=\\s*(?:async\\s*)?(?:function\\s*\\(|\\([^)]*\\)\\s*=>|[A-Za-z_$][\\w$]*\\s*=>)'),
  ];
  for (const src of [fileSrc, ...allSources().map(([, s]) => s)]) {
    if (!src) continue;
    for (const re of patterns) {
      const m = re.exec(src);
      if (m) return src.slice(m.index, m.index + 6000);
    }
  }
  return null;
}

// Does this helper's own body, or a bounded chain of helpers it calls, reach an
// explicit escaping boundary? Depth-limited and cycle-guarded.
function calleeChainEscapes(name, fileSrc, depth, seen) {
  if (depth > 3 || seen.has(name) || CALLEE_KEYWORDS.has(name)) return false;
  seen.add(name);
  const local = resolveLocalDefinition(fileSrc, name);
  if (local && SAFE_BOUNDARY.test(local)) return true;
  const region = resolveCalleeRegion(name, fileSrc);
  if (!region) return false;
  if (SAFE_BOUNDARY.test(region)) return true;
  const callees = [...region.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]);
  return callees.some((n) => calleeChainEscapes(n, fileSrc, depth + 1, seen));
}

function calleeEscapesSomewhere(fileSrc, expr) {
  const names = [...expr.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]);
  const seen = new Set();
  return names.some((n) => calleeChainEscapes(n, fileSrc, 0, seen));
}

// ─── expression status ───────────────────────────────────────────────────────

function exprStatus(expr, fileSrc, depth) {
  if (SAFE_BOUNDARY.test(expr)) {
    const kind = URL_BOUNDARY.test(expr) && !/\bescapeHtml\b/.test(expr) ? 'url' : 'escaped';
    return { kind, why: 'explicit escaping/URL boundary' };
  }
  const stripped = stripLiterals(expr);
  if (!USER_VOCAB.test(stripped)) return { kind: 'app-text', why: 'no user vocabulary in expression' };

  // User vocabulary is present. Provenance may only prove safety.
  const p = memberPath(expr);
  if (p && depth < 3 && fileSrc) {
    const defs = resolveAllDefinitions(fileSrc, p);
    if (defs.length > 0) {
      if (defs.some((d) => SAFE_BOUNDARY.test(d))) return { kind: 'escaped', why: 'escaped at definition' };
      if (defs.every((d) => !USER_VOCAB.test(stripLiterals(d)))) {
        return { kind: 'app-text', why: 'definitions are application text' };
      }
      if (defs.every((d) => APP_TEXT_CALLS.test(d) || literalOnly(d))) {
        return { kind: 'app-text', why: 'i18n/application text definitions' };
      }
    }
  }
  if (calleeEscapesSomewhere(fileSrc, expr)) return { kind: 'approved', why: 'renderer chain reaches an escaping boundary' };
  return { kind: 'unsafe', why: 'user vocabulary without an explicit safe boundary' };
}

// ─── sink classification ─────────────────────────────────────────────────────

function splitSink(stmt) {
  const m = /(\.innerHTML\s*=|\.outerHTML\s*=|\.insertAdjacentHTML\s*\()/.exec(stmt);
  if (!m) return null;
  return { type: m[1].trim(), rhs: stmt.slice(m.index + m[0].length) };
}

function classifyStatement(stmt, fileSrc) {
  const sink = splitSink(stmt);
  if (!sink) return { classification: 'REVIEW_NEEDED', boundary: 'none', unsafe: [] };
  const rhs = sink.rhs;
  const trimmedRhs = rhs.replace(/^\s+/, '').replace(/;\s*$/, '').trim();

  if (/^''$|^""$/.test(trimmedRhs)) {
    return { classification: 'CLEAR_CONTAINER', boundary: 'clear-container', unsafe: [] };
  }

  let exprs = extractExpressions(stmt).filter((e) => !literalOnly(e));
  if (exprs.length === 0) {
    const p = memberPath(trimmedRhs);
    if (p) {
      const def = resolveLocalDefinition(fileSrc, p);
      if (def) {
        exprs = extractExpressions(def).filter((e) => !literalOnly(e));
        if (exprs.length === 0) exprs = [def];
      }
    }
  }

  if (exprs.length === 0) {
    if (SAFE_BOUNDARY.test(rhs)) {
      const cls = URL_BOUNDARY.test(rhs) && !/\bescapeHtml\b/.test(rhs) ? 'SANITIZED_URL_DYNAMIC' : 'EXPLICIT_ESCAPED_DYNAMIC';
      return { classification: cls, boundary: 'escape', unsafe: [] };
    }
    if (USER_VOCAB.test(stripLiterals(rhs))) {
      if (calleeEscapesSomewhere(fileSrc, rhs)) {
        return { classification: 'APPROVED_RENDERER_BOUNDARY', boundary: 'approved-renderer', unsafe: [] };
      }
      return { classification: 'REVIEW_NEEDED', boundary: 'none', unsafe: [rhs.trim()] };
    }
    return { classification: 'STATIC_TRUSTED_TEMPLATE', boundary: 'static-literal', unsafe: [] };
  }

  const statuses = exprs.map((e) => ({ e, s: exprStatus(e, fileSrc, 0) }));
  const unsafe = statuses.filter((x) => x.s.kind === 'unsafe');
  if (unsafe.length > 0) {
    return { classification: 'REVIEW_NEEDED', boundary: 'none', unsafe: unsafe.map((x) => x.e.trim()) };
  }
  const anyUrl = statuses.some((x) => x.s.kind === 'url');
  const anyEscaped = statuses.some((x) => x.s.kind === 'escaped');
  const anyApproved = statuses.some((x) => x.s.kind === 'approved');
  if (anyUrl && !anyEscaped) return { classification: 'SANITIZED_URL_DYNAMIC', boundary: 'sanitizeUrl', unsafe: [] };
  if (anyEscaped) return { classification: 'EXPLICIT_ESCAPED_DYNAMIC', boundary: 'escape', unsafe: [] };
  if (anyApproved) return { classification: 'APPROVED_RENDERER_BOUNDARY', boundary: 'approved-renderer', unsafe: [] };
  return { classification: 'STATIC_TRUSTED_TEMPLATE', boundary: 'static-literal', unsafe: [] };
}

// ─── surface (active vs dormant vs mock) reachability ────────────────────────

function scriptSources(htmlText) {
  return [...htmlText.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
}

function pageFromScriptSrc(src) {
  const idx = src.lastIndexOf('js/');
  if (idx < 0) return null;
  const want = src.slice(idx).replace(/\\/g, '/');
  return want; // repository-relative script path
}

function buildSurfaceMap() {
  const htmlFiles = listHtmlFiles();
  const jsFiles = listJsFiles();
  const jsToPages = new Map();
  const pageScripts = new Map();

  // static <script src> loaders
  for (const page of htmlFiles) {
    const text = read(page);
    const scripts = scriptSources(text);
    pageScripts.set(page, scripts);
    for (const src of scripts) {
      const want = pageFromScriptSrc(src);
      if (!want || !jsFiles.includes(want)) continue;
      if (!jsToPages.has(want)) jsToPages.set(want, new Set());
      jsToPages.get(want).add(page);
    }
  }

  // dynamic `script.src = '...js/...'` loaders inside js sources
  for (const js of jsFiles) {
    const text = read(js);
    for (const m of text.matchAll(/script\.src\s*=\s*['"]([^'"]+)['"]/g)) {
      const want = pageFromScriptSrc(m[1].split('?')[0]);
      if (!want || !jsFiles.includes(want)) continue;
      // the injecting script runs on the pages that load it
      for (const page of (jsToPages.get(js) || [])) {
        if (!jsToPages.has(want)) jsToPages.set(want, new Set());
        jsToPages.get(want).add(page);
      }
      if (!jsToPages.has(want)) jsToPages.set(want, new Set());
    }
  }

  // reachable pages: redirect targets, cross-page hrefs, js-side references
  const redirects = read('_redirects');
  const reachable = new Set(['index.html']);
  for (const m of redirects.matchAll(/^\/\S+\s+(\S+)\s+\d+$/gm)) {
    const target = m[1].replace(/\.html$/, '').replace(/\/$/, '');
    for (const page of htmlFiles) {
      const name = page.replace(/^pages\//, '').replace(/\.html$/, '');
      if (target === `/pages/${name}` || target === `/${name}`) reachable.add(page);
    }
  }
  for (const page of htmlFiles) {
    const text = read(page);
    for (const m of text.matchAll(/href="([^"#?]+)"/g)) {
      const href = m[1];
      for (const other of htmlFiles) {
        if (other === page) continue;
        const base = other.split('/').pop();
        if (href.endsWith(base) || href.endsWith(base.replace(/\.html$/, ''))) reachable.add(other);
      }
    }
  }
  // js-side page references, excluding the page that itself loads the referencing script
  for (const js of jsFiles) {
    const text = read(js);
    const loaders = jsToPages.get(js) || new Set();
    for (const m of text.matchAll(/pages\/([a-z0-9-]+)(?:\.html)?/gi)) {
      const target = `pages/${m[1]}.html`;
      if (!htmlFiles.includes(target)) continue;
      if ([...loaders].every((p) => p === target)) continue; // self-referential only
      reachable.add(target);
    }
  }

  const mockMarker = /\bprototype\b|\bPoc\b|\bPoC\b|mock data only|isolated ux prototype/i;

  const map = new Map();
  for (const js of jsFiles) {
    const pages = [...(jsToPages.get(js) || [])].sort();
    const header = read(js).split('\n').slice(0, 24).join('\n');
    if (pages.length > 0 && pages.some((p) => reachable.has(p))) {
      map.set(js, 'ACTIVE_PRODUCT');
    } else if (mockMarker.test(header)) {
      map.set(js, 'MOCK_PROTOTYPE');
    } else {
      map.set(js, 'DORMANT_UNLINKED');
    }
  }
  return { map, jsToPages, reachable, htmlFiles, jsFiles };
}

// ─── full sink inventory ─────────────────────────────────────────────────────

function statementDigest(stmt) {
  // stable across whitespace reformatting, sensitive to any real edit
  const normalized = stmt.replace(/\s+/g, ' ').trim().replace(/;$/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function buildSinkInventory() {
  const { map: surfaceMap } = buildSurfaceMap();
  const sinks = [];
  for (const rel of listJsFiles()) {
    const content = read(rel);
    const surface = surfaceMap.get(rel) || 'DORMANT_UNLINKED';
    const perFile = new Map();
    const pattern = sinkPattern();
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const stmt = extractStatement(content, m.index);
      const line = content.slice(0, m.index).split('\n').length;
      const seq = (perFile.get(m[1].trim()) || 0) + 1;
      perFile.set(m[1].trim(), seq);
      const verdict = classifyStatement(stmt, content);
      sinks.push({
        path: rel,
        sinkType: m[1].trim(),
        occurrence: seq,
        identity: `${rel}::${m[1].trim()}::#${seq}::${statementDigest(stmt)}`,
        statementDigest: statementDigest(stmt),
        statementPreview: stmt.replace(/\s+/g, ' ').trim().slice(0, 160),
        line,
        classification: surface === 'ACTIVE_PRODUCT' ? verdict.classification : 'DORMANT_OR_MOCK',
        semanticClassification: verdict.classification,
        dynamic: /\$\{|\s\+\s/.test(stmt),
        safeBoundary: verdict.boundary,
        surface,
        active: surface === 'ACTIVE_PRODUCT',
        reason: reasonFor(verdict, surface),
      });
    }
  }
  sinks.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
  return { sinks, surfaceMap };
}

function reasonFor(verdict, surface) {
  if (verdict.classification === 'REVIEW_NEEDED') {
    return `user-controlled value reaches the sink with no provable safe boundary (${verdict.unsafe.join(' | ').slice(0, 160)})`;
  }
  if (verdict.classification === 'CLEAR_CONTAINER') return 'clear-container: empty string literal';
  if (verdict.classification === 'APPROVED_RENDERER_BOUNDARY') return `delegated to a helper whose chain reaches an escaping boundary (${verdict.boundary})`;
  if (verdict.classification === 'EXPLICIT_ESCAPED_DYNAMIC') return 'every interpolated user value passes an explicit escaping/DOM-text boundary';
  if (verdict.classification === 'SANITIZED_URL_DYNAMIC') return 'URL value passes sanitizeUrl/safeUrl/normalizeUrl';
  if (surface !== 'ACTIVE_PRODUCT') return 'static application markup on a non-active surface';
  return 'static application markup or non-user dynamic content only';
}

function summarise(sinks) {
  const byClassification = {};
  const bySurface = {};
  for (const cls of CLASSIFICATION_VOCABULARY) byClassification[cls] = 0;
  byClassification.DORMANT_OR_MOCK = 0;
  for (const s of SURFACE_VOCABULARY) bySurface[s] = 0;
  let activeReviewNeeded = 0;
  let semanticReviewNeeded = 0;
  for (const s of sinks) {
    byClassification[s.classification] = (byClassification[s.classification] || 0) + 1;
    bySurface[s.surface] = (bySurface[s.surface] || 0) + 1;
    if (s.semanticClassification === 'REVIEW_NEEDED') semanticReviewNeeded += 1;
    if (s.active && s.classification === 'REVIEW_NEEDED') activeReviewNeeded += 1;
  }
  return { total: sinks.length, byClassification, bySurface, activeReviewNeeded, semanticReviewNeeded };
}

module.exports = {
  ROOT,
  SINK_TYPES,
  sinkPattern,
  CLASSIFICATION_VOCABULARY,
  SURFACE_VOCABULARY,
  USER_VOCAB,
  SAFE_BOUNDARY,
  listJsFiles,
  listHtmlFiles,
  read,
  relPath,
  extractStatement,
  extractExpressions,
  classifyStatement,
  buildSinkInventory,
  buildSurfaceMap,
  summarise,
  statementDigest,
};
