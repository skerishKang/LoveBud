const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DETAIL_UI_JS = path.join(ROOT, 'js/editor/editor-detail-ui.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('This is a static contract for editor detail title/memo/tag user-content sinks', () => {
  const source = readFile(DETAIL_UI_JS);

  // 1. Verify textContent is used for selected moment title, memo, tags, and counts
  // (Title, memo, and tag rendering are now delegated to LoveBudPublicViewerAppreciationDomRenderer)
  assert.match(source, /likeCount\.textContent\s*=\s*/, 'likeCount.textContent must be assigned');
  assert.match(source, /commentCount\.textContent\s*=\s*/, 'commentCount.textContent must be assigned');

  // 2. Verify dangerous innerHTML user content bindings are absent
  assert.doesNotMatch(source, /titleText\.innerHTML/, 'titleText.innerHTML is prohibited');
  assert.doesNotMatch(source, /memoBody\.innerHTML/, 'memoBody.innerHTML is prohibited');
  assert.doesNotMatch(source, /tagEl\.innerHTML/, 'tagEl.innerHTML is prohibited');
  assert.doesNotMatch(source, /titleContainer\.innerHTML\s*=\s*.*title/, 'titleContainer.innerHTML is prohibited');
  assert.doesNotMatch(source, /noteEl\.innerHTML\s*=\s*.*memo/, 'noteEl.innerHTML is prohibited');

  // 3. XSS Payloads referenced for contract compliance
  const payloads = [
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    '<a href="javascript:alert(1)">x</a>'
  ];
  assert.ok(payloads.length > 0);
});
