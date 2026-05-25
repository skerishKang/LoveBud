const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PATCH_JS = path.join(ROOT, 'js/search/search-preview-hub-dom-patch.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('static contract: search-preview-hub-dom-patch.js defines and uses escapeHtml on summaryText before innerHTML assignment', () => {
  const source = readFile(PATCH_JS);

  // Assert that escapeHtml function is defined
  assert.match(source, /function\s+escapeHtml\s*\(/, 'escapeHtml function must be defined');

  // Assert that escapeHtml uses window.LoveBudSecurity.escapeHtml if available
  assert.match(source, /window\.LoveBudSecurity/, 'escapeHtml must check window.LoveBudSecurity');

  // Assert that innerHTML reinsertion calls escapeHtml(summaryText)
  assert.match(source, /copy\.innerHTML\s*=\s*['"]<p class="preview-summary-line">['"]\s*\+\s*escapeHtml\s*\(\s*summaryText\s*\)\s*\+\s*['"]<\/p>['"]/, 'summaryText must be escaped before setting innerHTML');
});

test('behavior: escapeHtml escapes dangerous characters correctly', () => {
  const source = readFile(PATCH_JS);

  const start = source.indexOf('function escapeHtml');
  const end = source.indexOf('function hide');
  assert.ok(start !== -1, 'start of escapeHtml must be found');
  assert.ok(end !== -1, 'start of hide must be found');

  const escapeHtmlFnText = source.slice(start, end);
  const testContext = { window: {} };
  vm.runInNewContext(`${escapeHtmlFnText}; globalThis.escapeHtml = escapeHtml;`, testContext);
  const escapeHtml = testContext.escapeHtml;

  // Test fallback escape behavior (when window.LoveBudSecurity is absent)
  assert.equal(escapeHtml('foo & bar <baz> "qux" \'test\''), 'foo &amp; bar &lt;baz&gt; &quot;qux&quot; &#39;test&#39;');

  // Test delegation behavior (when window.LoveBudSecurity is present)
  testContext.window.LoveBudSecurity = {
    escapeHtml(val) {
      return `security-escaped: ${val}`;
    }
  };
  assert.equal(escapeHtml('test'), 'security-escaped: test');
});

test('behavior: escaped HTML payloads do not contain raw markup brackets', () => {
  const source = readFile(PATCH_JS);

  const start = source.indexOf('function escapeHtml');
  const end = source.indexOf('function hide');
  assert.ok(start !== -1, 'start of escapeHtml must be found');
  assert.ok(end !== -1, 'start of hide must be found');

  const escapeHtmlFnText = source.slice(start, end);
  const testContext = { window: {} };
  vm.runInNewContext(`${escapeHtmlFnText}; globalThis.escapeHtml = escapeHtml;`, testContext);
  const escapeHtml = testContext.escapeHtml;

  const payloads = [
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    '&lt;img src=x onerror=alert(1)&gt;'
  ];

  for (const payload of payloads) {
    const escaped = escapeHtml(payload);
    // Escaped string should not contain unescaped '<' or '>'
    assert.ok(!escaped.includes('<'), `Escaped payload should not contain raw '<': ${escaped}`);
    assert.ok(!escaped.includes('>'), `Escaped payload should not contain raw '>': ${escaped}`);
  }
});
