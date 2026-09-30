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
 *   APPROVED_RENDERER_BOUNDARY  delegated to an explicitly declared renderer contract whose
 *                               returned user-bearing fragments are proven escaped from source
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

// ─── approved renderer contracts ─────────────────────────────────────────────
//
// #4533 correction. An approval is never granted by a helper name, by an escape
// token that merely appears somewhere in a helper body or in its callee chain,
// or by a same-name helper in another file. A renderer boundary exists only
// where it is declared here: exact owning source + exact call sites allowed to
// rely on it + a bounded producer list whose *returned* fragments are
// mechanically re-proven from that exact source on every run.
//
// The proof re-reads the declared producer definitions from their own files and
// requires every returned fragment to be a literal, an application-text call, a
// numeric/boolean coercion, a whole call to another declared producer, or a
// value that sits inside an escaping boundary call. Removing the escaping from a
// producer return — or adding a raw user-bearing value to it — fails the guard
// even when the helper still contains some other escape call.

const MAX_PROOF_DEPTH = 4;

const ESCAPE_CALL_NAMES = new Set([
  'escapeHtml', 'sanitizeUrl', 'safeUrl', 'normalizeUrl', 'encodeURIComponent', 'encodeURI',
]);
const NUMERIC_CALL_NAMES = new Set(['Number', 'parseInt', 'parseFloat', 'Boolean']);
const APP_TEXT_CALL_NAMES = new Set(['tText', 't', 'getSearchCopy', 'formatDate', 'formatNumber', 'formatI18nText']);

const ESCAPE_CALL = /\b(?:escapeHtml|sanitizeUrl|safeUrl|normalizeUrl|encodeURIComponent|encodeURI)\s*\(/g;
const NUMERIC_CALL = /\b(?:Number|parseInt|parseFloat|Boolean)\s*\(/g;

// A pure member chain (`safeTitle`, `tree.title`, `a?.b`) carries no call of its
// own, so its safety must be proven through the local definitions it resolves to.
const MEMBER_CHAIN = /^[A-Za-z_$][\w$]*(?:\s*[?.]\s*[A-Za-z_$][\w$]*)*$/;

const APPROVED_RENDERER_CONTRACTS = Object.freeze({
  // js/detail/detail-render.js renders the video panel through the detail-video
  // factory; every returned fragment is an escaping template.
  buildVideoMainMarkup: {
    source: 'js/detail/detail-video.js',
    callSites: ['js/detail/detail-render.js'],
    producers: [
      { source: 'js/detail/detail-video.js', name: 'buildVideoMainMarkup' },
      { source: 'js/detail/detail-video.js', name: 'buildIframeEmbedMarkup' },
      { source: 'js/detail/detail-video.js', name: 'buildImageOnlyMomentMarkup' },
      { source: 'js/detail/detail-video.js', name: 'buildVideoUnavailableMarkup' },
    ],
  },
  // Browse hub flow stages: the label is escaped at every return site.
  buildHydratedFlowStages: {
    source: 'js/my-trees/my-trees-preview-state.js',
    callSites: ['js/my-trees/my-trees-preview-state.js'],
    producers: [
      { source: 'js/my-trees/my-trees-preview-state.js', name: 'buildHydratedFlowStages' },
    ],
  },
  // Delegates to the injected share-link helper (window.LoveBudSearchShareLink).
  renderSocialBar: {
    source: 'js/search/search-preview-playable-hub-patch.js',
    callSites: ['js/search/search-preview-playable-hub-patch.js'],
    producers: [
      { source: 'js/search/search-preview-playable-hub-patch.js', name: 'renderSocialBar' },
      { source: 'js/search/search-share-link.js', name: 'renderPreviewSocialShell' },
    ],
  },
  // The renderer wrappers delegate to window.LoveBudSearchPreviewBuilders.
  getPreviewSummaryCopy: {
    source: 'js/search/search-preview-renderer.js',
    callSites: ['js/search/search-preview-renderer.js'],
    producers: [
      { source: 'js/search/search-preview-renderer.js', name: 'getPreviewSummaryCopy' },
      { source: 'js/search/search-preview-renderer-builders.js', name: 'getPreviewSummaryCopy' },
    ],
  },
  renderEmotionTags: {
    source: 'js/search/search-preview-renderer.js',
    callSites: ['js/search/search-preview-renderer.js'],
    producers: [
      { source: 'js/search/search-preview-renderer.js', name: 'renderEmotionTags' },
      { source: 'js/search/search-preview-renderer-builders.js', name: 'renderEmotionTags' },
    ],
  },
  // The three preview action helpers delegate to window.LoveBudSearchPreviewActionHelper.
  renderOpenTreeButton: {
    source: 'js/search/search-preview-renderer.js',
    callSites: ['js/search/search-preview-renderer.js'],
    producers: [
      { source: 'js/search/search-preview-renderer.js', name: 'renderOpenTreeButton' },
      { source: 'js/search/search-preview-action-helper.js', name: 'renderOpenTreeButton' },
    ],
  },
  renderPreviewActionButton: {
    source: 'js/search/search-preview-renderer.js',
    callSites: ['js/search/search-preview-renderer.js'],
    producers: [
      { source: 'js/search/search-preview-renderer.js', name: 'renderPreviewActionButton' },
      { source: 'js/search/search-preview-action-helper.js', name: 'renderPreviewActionButton' },
    ],
  },
  renderShareButton: {
    source: 'js/search/search-preview-renderer.js',
    callSites: ['js/search/search-preview-renderer.js'],
    producers: [
      { source: 'js/search/search-preview-renderer.js', name: 'renderShareButton' },
      { source: 'js/search/search-preview-action-helper.js', name: 'renderShareButton' },
    ],
  },
});

// ─── length-preserving masked source views ───────────────────────────────────
//
// String/template literals, comments and nested function expressions are blanked
// in place (never re-flowed) so every index stays valid against the original
// text. Template `${...}` interpolations keep their code visible and are also
// reported with their offsets.

function maskLiterals(text) {
  const chars = text.split('');
  const interpolations = [];
  const blank = (i) => { if (chars[i] !== '\n' && chars[i] !== undefined) chars[i] = ' '; };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const quote = c;
      blank(i);
      i += 1;
      while (i < text.length) {
        const ch = text[i];
        if (ch === '\\') { blank(i); blank(i + 1); i += 2; continue; }
        if (ch === '\n') break;
        blank(i);
        i += 1;
        if (ch === quote) break;
      }
      continue;
    }
    if (c === '`') {
      blank(i);
      i += 1;
      while (i < text.length) {
        const ch = text[i];
        if (ch === '\\') { blank(i); blank(i + 1); i += 2; continue; }
        if (ch === '`') { blank(i); i += 1; break; }
        if (ch === '$' && text[i + 1] === '{') {
          const close = matchCodeBrace(text, i + 1);
          if (close === -1) { i = text.length; break; }
          const inner = text.slice(i + 2, close);
          const innerMasked = maskLiterals(inner);
          for (let k = 0; k < inner.length; k += 1) chars[i + 2 + k] = innerMasked.masked[k];
          blank(i);
          blank(i + 1);
          blank(close);
          interpolations.push({ text: inner, start: i + 2, end: close });
          i = close + 1;
          continue;
        }
        blank(i);
        i += 1;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') { blank(i); i += 1; } continue; }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let k = i; k < stop; k += 1) blank(k);
      i = stop;
      continue;
    }
    i += 1;
  }
  return { masked: chars.join(''), interpolations };
}

// Quote-aware brace/paren matcher over raw source.
function matchCodeBrace(text, start) {
  let depth = 0;
  let mode = null;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (mode) {
      if (c === '\\') { i += 1; continue; }
      if (c === mode) mode = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function matchParen(maskedText, start) {
  let depth = 0;
  for (let i = start; i < maskedText.length; i += 1) {
    if (maskedText[i] === '(') depth += 1;
    else if (maskedText[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

// Nested function expressions (and their parameter lists) are not part of the
// enclosing fragment; their own returns are proven separately.
function maskFunctionSpans(maskedText) {
  const chars = maskedText.split('');
  const spans = [];
  const blank = (i) => { if (chars[i] !== '\n' && chars[i] !== undefined) chars[i] = ' '; };
  const patterns = [
    /\bfunction\b[\s\S]*?\(/g,
    /\([^()]*\)\s*=>\s*\{/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(maskedText)) !== null) {
      const openParen = maskedText.indexOf('(', m.index);
      if (openParen === -1) continue;
      const closeParen = matchParen(maskedText, openParen);
      if (closeParen === -1) continue;
      const bodyStart = maskedText.indexOf('{', closeParen);
      if (bodyStart === -1) continue;
      const bodyEnd = matchCodeBrace(maskedText, bodyStart);
      if (bodyEnd === -1) continue;
      for (let k = m.index; k <= bodyEnd; k += 1) blank(k);
      spans.push([m.index, bodyEnd + 1]);
      re.lastIndex = bodyEnd + 1;
    }
  }
  return { masked: chars.join(''), spans };
}

// ─── fragment decomposition ──────────────────────────────────────────────────

// Top-level `+`, `||`, `??` and ternary branches. The condition of a ternary is
// control flow, not output, so it is dropped; both branches must prove.
function splitOutputPieces(maskedText, offset) {
  const pieces = [];
  let depth = 0;
  let start = 0;
  const push = (from, to, keep) => {
    if (!keep) return;
    const raw = maskedText.slice(from, to);
    const text = raw.trim();
    if (!text) return;
    const lead = raw.length - raw.replace(/^\s+/, '').length;
    pieces.push({ text, start: offset + from + lead, end: offset + to });
  };
  for (let i = 0; i < maskedText.length; i += 1) {
    const c = maskedText[i];
    if (c === '(' || c === '[' || c === '{') { depth += 1; continue; }
    if (c === ')' || c === ']' || c === '}') { if (depth > 0) depth -= 1; continue; }
    if (depth !== 0) continue;
    let len = 1;
    let keep = true;
    if (c === '+') keep = true;
    else if (c === '|' && maskedText[i + 1] === '|') { len = 2; keep = true; }
    else if (c === '?' && maskedText[i + 1] === '?') { len = 2; keep = true; }
    else if (c === '?' && maskedText[i + 1] !== '.' && maskedText[i + 1] !== '?') { keep = false; }
    else if (c === ':') keep = true;
    else continue;
    push(start, i, keep);
    start = i + len;
    i += len - 1;
  }
  push(start, maskedText.length, true);
  return pieces;
}

// Boundaries that make every value inside their argument list inert for HTML.
function boundaryZones(maskedText) {
  const zones = [];
  for (const re of [ESCAPE_CALL, NUMERIC_CALL]) {
    const pattern = new RegExp(re.source, 'g');
    let m;
    while ((m = pattern.exec(maskedText)) !== null) {
      const open = maskedText.indexOf('(', m.index);
      if (open === -1) continue;
      const close = matchParen(maskedText, open);
      if (close === -1) continue;
      zones.push({ start: open, end: close + 1, name: m[0].replace(/\s*\($/, '').trim() });
    }
  }
  return zones;
}

// Callee name when the whole fragment is one call expression, else null.
function wholeCallCallee(fragmentText) {
  const text = fragmentText.trim();
  if (!text.endsWith(')')) return null;
  let depth = 0;
  let open = -1;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') {
      if (depth === 0 && c === '(') open = i;
      depth += 1;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) {
        if (i !== text.length - 1) return null;
        break;
      }
    }
  }
  if (open === -1) return null;
  let callee = text.slice(0, open).trim();
  if (callee.endsWith('?.')) callee = callee.slice(0, -2).trim();
  const m = /([A-Za-z_$][\w$]*)$/.exec(callee);
  return m ? m[1] : null;
}

// User-vocabulary occurrences that are output values: property names after `.`
// and object-literal keys are not values.
function userValueHits(pieceText) {
  const hits = [];
  const re = new RegExp(USER_VOCAB.source, 'g');
  let m;
  let braceDepth = 0;
  const braceAt = [];
  for (let i = 0; i < pieceText.length; i += 1) {
    const c = pieceText[i];
    braceDepth += (c === '{' ? 1 : 0) - (c === '}' ? 1 : 0);
    braceAt[i] = braceDepth;
  }
  while ((m = re.exec(pieceText)) !== null) {
    const before = pieceText.slice(0, m.index).replace(/\s+$/, '');
    if (before.endsWith('.')) continue;
    const after = pieceText.slice(m.index + m[0].length).replace(/^\s+/, '');
    if (after.startsWith(':') && braceAt[m.index] > 0) continue;
    hits.push({ value: m[0], index: m.index });
  }
  return hits;
}

// ─── exact-source definition and return extraction ───────────────────────────

// The bounded definition region of `name` inside one exact source. Only the
// exact owner file is ever consulted; no cross-file name search exists.
function definitionRegion(source, name) {
  const masked = maskLiterals(source).masked;
  const esc = escapeRegExp(name);
  const fnRe = new RegExp('\\bfunction\\s+' + esc + '\\s*\\(', 'g');
  const fn = fnRe.exec(masked);
  if (fn) {
    const closeParen = matchParen(masked, masked.indexOf('(', fn.index));
    if (closeParen !== -1) {
      const bodyStart = masked.indexOf('{', closeParen);
      if (bodyStart !== -1) {
        const bodyEnd = matchCodeBrace(masked, bodyStart);
        if (bodyEnd !== -1) return source.slice(fn.index, bodyEnd + 1);
      }
    }
  }
  const assignRe = new RegExp('([^\\w$.]|^)\\s*' + esc + '\\s*=', 'g');
  let m;
  const regions = [];
  while ((m = assignRe.exec(masked)) !== null) {
    if (masked.slice(m.index + m[0].length).startsWith('=')) continue; // ==
    const eq = m.index + m[0].length - 1;
    const stmt = extractStatement(source, eq);
    if (stmt) regions.push(normalizeFragment(stmt));
  }
  return regions.length ? regions.join('\n') : null;
}

function normalizeFragment(text) {
  return String(text || '').replace(/^\s*return\b/, '').replace(/^\s*=\s*/, '').trim().replace(/;\s*$/, '').trim();
}

// The statements of a definition: header and outer braces removed so that only
// the definition's own body is scanned for returned fragments.
function definitionBodyView(regionText) {
  const masked = maskLiterals(regionText).masked;
  let body = regionText;
  const fnHeader = /^\s*(?:async\s+)?function\b[\s\S]*?\)\s*\{/.exec(masked);
  const arrow = masked.indexOf('=>');
  if (fnHeader) {
    body = regionText.slice(fnHeader[0].length - 1);
  } else if (arrow !== -1) {
    body = regionText.slice(arrow + 2).trim();
  }
  body = body.trim();
  if (body.startsWith('{') && matchCodeBrace(body, 0) === body.length - 1) body = body.slice(1, -1);
  return body;
}

function collectReturnsEverywhere(text) {
  const masked = maskLiterals(text).masked;
  const out = [];
  const re = /\breturn\b/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const expr = normalizeFragment(extractStatement(text, m.index).replace(/^return\b/, ''));
    if (expr) out.push(expr);
  }
  return out;
}

function returnsOutsideNestedFunctions(bodyText) {
  const fnView = maskFunctionSpans(maskLiterals(bodyText).masked);
  const inFunction = (index) => fnView.spans.some((s) => s[0] <= index && index < s[1]);
  const out = [];
  const re = /\breturn\b/g;
  let m;
  while ((m = re.exec(fnView.masked)) !== null) {
    if (inFunction(m.index)) continue;
    const expr = normalizeFragment(extractStatement(bodyText, m.index).replace(/^return\b/, ''));
    if (expr) out.push(expr);
  }
  return out;
}

// Returned fragments of a definition: its own top-level returns, the returns of
// nested callbacks opened inside those returns (they build the same output
// string), and — when the definition itself is an inline function expression —
// the returns of that function. A callback whose value is only used as data
// (for example a `map` that feeds another map) is not treated as output.
function collectReturnExpressions(regionText) {
  const body = definitionBodyView(regionText);
  const out = [];
  for (const expr of returnsOutsideNestedFunctions(body)) {
    out.push(expr, ...collectReturnsEverywhere(expr));
  }
  if (out.length === 0) out.push(...collectReturnsEverywhere(body));
  // expression-bodied arrow / template-only definition: the body is the fragment
  if (out.length === 0 && /[A-Za-z_$<`]/.test(body)) out.push(body);
  return out;
}

// Full (multiline-safe) assignments of `name` inside a bounded region.
function resolveDefinitionExpressions(source, name) {
  if (!source) return [];
  const masked = maskLiterals(source).masked;
  const re = new RegExp('([^\\w$.]|^)\\s*(?:var|let|const)?\\s*' + escapeRegExp(name) + '\\s*=', 'g');
  const out = [];
  let m;
  while ((m = re.exec(masked)) !== null) {
    const eq = m.index + m[0].length - 1;
    if (masked.slice(eq + 1).startsWith('=')) continue;
    const stmt = extractStatement(source, eq);
    const rhs = stmt.replace(/^\s*=\s*/, '').trim().replace(/;\s*$/, '');
    if (rhs) out.push(rhs);
  }
  return out;
}

// Bound parameter names of a definition (function declaration, method or arrow).
function definitionParams(regionText, name) {
  const masked = maskLiterals(regionText).masked;
  let open = -1;
  const fn = new RegExp('\\bfunction\\s+' + escapeRegExp(name) + '\\s*\\(').exec(masked);
  if (fn) {
    open = masked.indexOf('(', fn.index);
  } else {
    const arrow = masked.indexOf('=>');
    if (arrow === -1) return new Set();
    open = masked.lastIndexOf('(', arrow);
    if (open === -1) {
      const m = /([A-Za-z_$][\w$]*)\s*=>/.exec(masked);
      return new Set(m ? [m[1]] : []);
    }
  }
  const close = matchParen(masked, open);
  if (close === -1) return new Set();
  return new Set(masked.slice(open + 1, close).match(/[A-Za-z_$][\w$]*/g) || []);
}

function isWholeCallTo(pieceText, names) {
  const callee = wholeCallCallee(pieceText);
  return callee !== null && names.has(callee);
}

// ─── returned-fragment proof ─────────────────────────────────────────────────

function proveFragment(expression, ctx, depth) {
  const violations = [];
  if (depth > MAX_PROOF_DEPTH) return { ok: false, violations: [`proof depth exceeded at ${expression.slice(0, 80)}`] };

  const expr = normalizeFragment(expression);
  if (!expr) return { ok: true, violations: [] };

  const literalView = maskLiterals(expr);
  const fnView = maskFunctionSpans(literalView.masked);
  const zones = boundaryZones(fnView.masked);
  const inZone = (index) => zones.some((z) => z.start <= index && index < z.end);
  const inFunction = (index) => fnView.spans.some((s) => s[0] <= index && index < s[1]);

  // Each `${...}` interpolation is its own fragment; interpolations already
  // covered by an enclosing escaping/numeric boundary or belonging to a nested
  // function body are proven there instead.
  const interpChars = fnView.masked.split('');
  for (const interp of literalView.interpolations) {
    for (let k = interp.start; k < interp.end; k += 1) {
      if (interpChars[k] !== '\n') interpChars[k] = ' ';
    }
    if (inZone(interp.start) || inFunction(interp.start)) continue;
    const verdict = proveFragment(interp.text, ctx, depth + 1);
    if (!verdict.ok) violations.push(...verdict.violations);
  }
  const code = interpChars.join('');

  const pieces = splitOutputPieces(code, 0);
  const producerNames = ctx.producerNames || new Set();
  for (const piece of pieces) {
    if (!/[A-Za-z_$]/.test(piece.text)) continue;
    if (isWholeCallTo(piece.text, producerNames)) continue;
    const callee = wholeCallCallee(piece.text);
    if (callee !== null && (ESCAPE_CALL_NAMES.has(callee) || NUMERIC_CALL_NAMES.has(callee))) continue;
    if (APP_TEXT_CALL_NAMES.has(callee)) continue;

    // A pure member chain carries no call of its own: it is proven through the
    // exact local definitions it resolves to. Definition data-flow, not the
    // variable name, decides. Function parameters have no local definition, so
    // they fall through to the vocabulary check below.
    if (MEMBER_CHAIN.test(piece.text)) {
      const root = piece.text.split(/\s*[?.]\s*/)[0].trim();
      const skip = (ctx.params && ctx.params.has(root))
        || CALLEE_KEYWORDS.has(root) || ESCAPE_CALL_NAMES.has(root) || NUMERIC_CALL_NAMES.has(root);
      if (!skip) {
        const defs = resolveDefinitionExpressions(ctx.region, root);
        if (defs.length > 0) {
          // the definition search stays in the same producer region, so a
          // provenance hop can never escape into a narrower scope and lose the
          // escaping that actually guards the value
          for (const def of defs) {
            const verdict = proveFragment(def, ctx, depth + 1);
            if (!verdict.ok) violations.push(`local definition \`${root}\` is not proven safe: ${verdict.violations[0]}`);
          }
          continue;
        }
      }
    }

    for (const hit of userValueHits(piece.text)) {
      if (inZone(piece.start + hit.index)) continue;
      violations.push(`user-controlled \`${hit.value}\` reaches a returned fragment outside an escaping boundary: ${piece.text.slice(0, 90)}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

function proveReturnFragment(returnExpression, sourceText) {
  const expr = normalizeFragment(returnExpression);
  const region = sourceText || '';
  return proveFragment(expr, { region, producerNames: new Set() }, 0);
}

function definesRenderer(source, name) {
  if (!source) return false;
  const masked = maskLiterals(source).masked;
  if (new RegExp('\\bfunction\\s+' + escapeRegExp(name) + '\\s*\\(').test(masked)) return true;
  const assignRe = new RegExp('([^\\w$.]|^)\\s*(?:var|let|const)?\\s*' + escapeRegExp(name) + '\\s*=', 'g');
  let m;
  while ((m = assignRe.exec(masked)) !== null) {
    const eq = m.index + m[0].length - 1;
    if (masked.slice(eq + 1).startsWith('=')) continue;
    const stmt = extractStatement(source, eq);
    const rhs = stmt.replace(/^\s*=\s*/, '').trim().replace(/;\s*$/, '');
    if (/=>|\bfunction\b/.test(rhs) || /^[A-Za-z_$][\w$]*(\s*[?.]\s*[A-Za-z_$][\w$]*)*$/.test(rhs)) return true;
  }
  return false;
}

function contractSourceText(rel, options) {
  const overlay = options && options.sources;
  if (overlay && Object.prototype.hasOwnProperty.call(overlay, rel)) return overlay[rel];
  return read(rel);
}

// Exact-source-bound approval. There is no global same-name lookup: the helper
// is resolved through the declared contract only, and the declared producers are
// re-proven from their own files on every call.
function rendererApproval(name, callerFile, callerSource, options) {
  const contracts = (options && options.contracts) || APPROVED_RENDERER_CONTRACTS;
  const contract = Object.prototype.hasOwnProperty.call(contracts, name) ? contracts[name] : null;
  if (!contract) return { ok: false, why: `${name} is not declared in APPROVED_RENDERER_CONTRACTS` };

  if (definesRenderer(callerSource, name)) {
    if (contract.source !== callerFile) {
      return { ok: false, why: `${name} is defined locally in ${callerFile}; the declared owner is ${contract.source}, and a same-name helper in another file can never approve it` };
    }
  } else if (!contract.callSites.includes(callerFile)) {
    return { ok: false, why: `${callerFile} is not a declared call site for ${name}` };
  }

  // The source under analysis is always the authority for its own file: a local
  // definition can never be replaced by the on-disk text of the same path.
  const sourceFor = (rel) => (rel === callerFile ? callerSource : contractSourceText(rel, options));
  const producerNames = new Set(contract.producers.map((p) => p.name));
  const entryRegion = definitionRegion(sourceFor(contract.source), name) || '';
  const failures = [];

  for (const producer of contract.producers) {
    const source = sourceFor(producer.source);
    const region = definitionRegion(source, producer.name);
    if (!region) {
      failures.push(`${producer.source} does not define ${producer.name}`);
      continue;
    }
    if (producer.name !== name && !new RegExp('\\b' + escapeRegExp(producer.name) + '\\b').test(entryRegion)) {
      failures.push(`${contract.source}#${name} never delegates to declared producer ${producer.name}`);
      continue;
    }
    const returns = collectReturnExpressions(region);
    if (returns.length === 0) {
      failures.push(`${producer.source}#${producer.name} has no returned fragment to prove`);
      continue;
    }
    const params = definitionParams(region, producer.name);
    for (const expr of returns) {
      const verdict = proveFragment(expr, { region, producerNames, params }, 0);
      if (!verdict.ok) {
        failures.push(`${producer.source}#${producer.name} return is not proven: ${verdict.violations[0]}`);
        break;
      }
    }
  }
  return failures.length ? { ok: false, why: failures.join('; ') } : { ok: true, why: `declared contract ${name} (owner ${contract.source}) proven from source` };
}

// An expression may only be accepted as a renderer boundary when every call it
// makes is either inert (escaping/numeric/application text) or a declared,
// exactly-sourced, return-proven renderer.
function fragmentApproved(expr, callerFile, callerSource, options) {
  const names = [...maskLiterals(expr).masked.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  const unique = [...new Set(names)];
  if (unique.length === 0) return { ok: false, why: 'no helper call to approve' };
  for (const name of unique) {
    if (CALLEE_KEYWORDS.has(name)) continue;
    if (ESCAPE_CALL_NAMES.has(name) || NUMERIC_CALL_NAMES.has(name)) continue;
    if (APP_TEXT_CALL_NAMES.has(name)) continue;
    const verdict = rendererApproval(name, callerFile, callerSource, options);
    if (!verdict.ok) return verdict;
  }
  return { ok: true, why: 'every helper call in the expression is an inert boundary or a declared, return-proven renderer' };
}

// ─── expression status ───────────────────────────────────────────────────────

function exprStatus(expr, fileSrc, depth, callerFile, options) {
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
  const approval = fragmentApproved(expr, callerFile, fileSrc, options);
  if (approval.ok) return { kind: 'approved', why: approval.why };
  return { kind: 'unsafe', why: `user vocabulary without a declared, return-proven renderer boundary (${approval.why})` };
}

// ─── sink classification ─────────────────────────────────────────────────────

function splitSink(stmt) {
  const m = /(\.innerHTML\s*=|\.outerHTML\s*=|\.insertAdjacentHTML\s*\()/.exec(stmt);
  if (!m) return null;
  return { type: m[1].trim(), rhs: stmt.slice(m.index + m[0].length) };
}

function classifyStatement(stmt, fileSrc, callerFile, options) {
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
      const approval = fragmentApproved(rhs, callerFile, fileSrc, options);
      if (approval.ok) {
        return { classification: 'APPROVED_RENDERER_BOUNDARY', boundary: 'approved-renderer', unsafe: [] };
      }
      return { classification: 'REVIEW_NEEDED', boundary: 'none', unsafe: [rhs.trim()] };
    }
    return { classification: 'STATIC_TRUSTED_TEMPLATE', boundary: 'static-literal', unsafe: [] };
  }

  const statuses = exprs.map((e) => ({ e, s: exprStatus(e, fileSrc, 0, callerFile, options) }));
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
      const verdict = classifyStatement(stmt, content, rel);
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
  if (verdict.classification === 'APPROVED_RENDERER_BOUNDARY') return `delegated to a declared renderer contract whose returned user-bearing fragments are proven escaped from its exact source (${verdict.boundary})`;
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
  APPROVED_RENDERER_CONTRACTS,
  rendererApproval,
  fragmentApproved,
  proveReturnFragment,
  proveFragment,
  definitionRegion,
  definitionBodyView,
  collectReturnExpressions,
  definitionParams,
  definesRenderer,
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
