const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const POLICY_DOC = path.join(ROOT, 'docs/security/FRONTEND_RENDERING_DOM_XSS_GUARDRAILS.md');

const HIGH_RISK_FRONTEND_FILES = [
  'js/editor/editor-detail-ui.js',
  'js/editor/editor-canvas-node.js',
  'js/viewer/public-tree-viewer.js',
  'js/viewer/tree-viewer.js',
  'js/editor/editor-memory-form-preview.js'
];

const USER_CONTROLLED_FIELD_PATTERN = /\b(?:tree|treeData|currentTree|memory|memories|node|item|record|payload|draft|formData|tag|tags|title|memo|note|quote|diary|thumbnail|sourceUrl|url|label|emotionTags)\b/;
const HTML_SINK_PATTERN = /\.(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(/;
const SAFE_BOUNDARY_PATTERN = /\b(?:escapeHtml|sanitize|safeHtml|textContent|createTextNode|setAttribute|safeUrl|sanitizeUrl|normalizeUrl|resolveMemoryThumbnail|resolveTreeTitleText|formatI18nText)\b/;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function getStatementWindow(content, index) {
  const before = content.lastIndexOf('\n', index - 1);
  const after = content.indexOf('\n', index);
  const start = Math.max(0, before === -1 ? 0 : before + 1);
  const end = after === -1 ? content.length : after;
  return content.slice(start, end);
}

function findUnsafeHtmlSinkWindows(content) {
  const matches = [];
  const sinkRegex = new RegExp(HTML_SINK_PATTERN.source, 'g');
  let match;

  while ((match = sinkRegex.exec(content)) !== null) {
    const windowText = getStatementWindow(content, match.index);
    const isDynamicHtml = windowText.includes('${') || windowText.includes(' + ') || windowText.includes('+=');
    const mentionsUserField = USER_CONTROLLED_FIELD_PATTERN.test(windowText);
    const hasSafeBoundary = SAFE_BOUNDARY_PATTERN.test(windowText);

    if (isDynamicHtml && mentionsUserField && !hasSafeBoundary) {
      matches.push({
        line: getLineNumber(content, match.index),
        snippet: windowText.trim()
      });
    }
  }

  return matches;
}

test('frontend DOM XSS rendering policy document exists', () => {
  assert.ok(fs.existsSync(POLICY_DOC), 'frontend rendering DOM XSS guardrails policy should exist');

  const content = fs.readFileSync(POLICY_DOC, 'utf8');
  assert.match(content, /User-controlled fields/, 'policy should define user-controlled fields');
  assert.match(content, /textContent/, 'policy should prefer textContent for text rendering');
  assert.match(content, /innerHTML/, 'policy should document innerHTML boundaries');
  assert.match(content, /escapeHtml/, 'policy should require explicit escaping for unavoidable HTML');
});

test('representative high-risk frontend render files exist', () => {
  HIGH_RISK_FRONTEND_FILES.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${relativePath} should exist`);
  });
});

test('high-risk frontend files do not directly interpolate obvious user-controlled fields into HTML sinks', () => {
  const violations = [];

  HIGH_RISK_FRONTEND_FILES.forEach((relativePath) => {
    const content = read(relativePath);
    const fileViolations = findUnsafeHtmlSinkWindows(content);
    fileViolations.forEach((violation) => {
      violations.push(`${relativePath}:${violation.line} ${violation.snippet}`);
    });
  });

  assert.deepEqual(
    violations,
    [],
    `User-controlled fields must use textContent, DOM node creation, URL validation, or explicit escaping before HTML sinks:\n${violations.join('\n')}`
  );
});

test('Editor detail render path keeps obvious user text on textContent or escaped boundaries', () => {
  const content = read('js/editor/editor-detail-ui.js');

  assert.match(content, /headerEl\.textContent\s*=/, 'detail header should be assigned through textContent');
  assert.match(content, /dateEl\.textContent\s*=/, 'detail date text should be assigned through textContent');
  assert.match(content, /textEl\.textContent\s*=/, 'save status text should be assigned through textContent');
  assert.match(content, /escapeHtml/, 'editor detail UI should keep an explicit escaped HTML boundary available');
});

test('Public viewer render path keeps escaped HTML boundary visible when HTML templates are used', () => {
  const content = read('js/viewer/public-tree-viewer.js');

  if (HTML_SINK_PATTERN.test(content)) {
    assert.match(content, /escapeHtml|textContent|createElement|setAttribute/, 'public viewer HTML sinks should keep visible safe-rendering boundaries');
  }
});
