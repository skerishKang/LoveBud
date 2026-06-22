const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const myTreesHtmlFile = path.join(ROOT, 'pages/my-trees.html');
const searchUiFile = path.join(ROOT, 'js/search/search-ui.js');

const myTreesHtml = fs.readFileSync(myTreesHtmlFile, 'utf8');
const searchUiSource = fs.readFileSync(searchUiFile, 'utf8');

test('My Trees sort select has aria-label for accessibility parity with Browse', () => {
  // Issue #2710 follow-up. Browse search-ui.js sets aria-label="정렬 기준"
  // (or "Sort order" in en) on the dynamically-created #browseSortSelect.
  // The My Trees sort select is rendered statically in pages/my-trees.html
  // and previously had no aria-label at all — screen readers would just
  // announce the option labels without the control purpose. Restore parity.
  assert.match(
    myTreesHtml,
    /<select\s+id="sortTreesSelect"[^>]*aria-label="정렬 기준"/,
    'My Trees sortTreesSelect must carry aria-label="정렬 기준"'
  );
});

test('Browse sort select still has aria-label="정렬 기준" for parity baseline', () => {
  // Pre-condition: Browse must keep its aria-label so the parity comparison
  // remains meaningful. If Browse is later changed, this test should be
  // updated alongside the My Trees one.
  assert.match(
    searchUiSource,
    /select\.setAttribute\(\s*'aria-label'\s*,\s*isEn\s*\?\s*'Sort order'\s*:\s*'정렬 기준'\s*\)/,
    'Browse #browseSortSelect must still set aria-label="정렬 기준" / "Sort order"'
  );
});
