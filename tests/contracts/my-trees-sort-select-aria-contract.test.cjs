const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve('/root/LoveBud');
const myTreesHtmlFile = path.join(ROOT, 'pages/my-trees.html');
const searchUiFile = path.join(ROOT, 'js/search/search-ui.js');

const myTreesHtml = fs.readFileSync(myTreesHtmlFile, 'utf8');
const searchUiSource = fs.readFileSync(searchUiFile, 'utf8');

test('My Trees sort select has aria-label for accessibility parity with Browse', () => {
  assert.match(
    myTreesHtml,
    /<select\s+id="sortTreesSelect"[^>]*aria-label="정렬 기준"/,
    'My Trees sortTreesSelect must carry aria-label="정렬 기준"'
  );
});

test('Browse sort select still has aria-label="정렬 기준" for parity baseline', () => {
  assert.match(
    searchUiSource,
    /select\.setAttribute\(\s*'aria-label'\s*,\s*isEn\s*\?\s*'Sort order'\s*:\s*'정렬 기준'\s*\)/,
    'Browse #browseSortSelect must still set aria-label="정렬 기준" / "Sort order"'
  );
});
