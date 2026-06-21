const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. My Trees bundle imports mobile controls balance override last', () => {
  const css = read('css/my-trees.css');
  const responsiveIdx = css.indexOf('my-trees-responsive.css');
  const balanceIdx = css.indexOf('my-trees-mobile-controls-balance.css?v=20260622-mytrees-controls-1');
  assert.ok(responsiveIdx > 0, 'responsive import must exist');
  assert.ok(balanceIdx > 0, 'mobile controls balance import must exist');
  assert.ok(responsiveIdx < balanceIdx, 'balance override must load after responsive rules');
});

test('2. Mobile sort control can shrink without colliding with view controls', () => {
  const css = read('css/my-trees/my-trees-mobile-controls-balance.css');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /\.my-trees-results-controls\s+\.sort-control\s*{[^}]*flex:\s*1\s+1\s+auto;[^}]*max-width:\s*none;[^}]*min-width:\s*0;[^}]*}/s);
});

test('3. View mode keeps fixed width while the controls row owns spacing', () => {
  const css = read('css/my-trees/my-trees-mobile-controls-balance.css');
  assert.match(css, /\.my-trees-results-controls\s*{[^}]*gap:\s*8px;[^}]*margin-left:\s*0;[^}]*}/s);
  assert.match(css, /\.my-trees-results-controls\s+\.my-trees-view-mode-mount\s*{[^}]*flex:\s*0\s+0\s+auto;[^}]*margin-left:\s*0;[^}]*}/s);
});

test('4. Recent-sort option text is shortened to a compact 3-character label', () => {
  const html = read('pages/my-trees.html');
  const i18n = read('js/i18n/i18n-my-trees.js');
  const refresh = read('js/my-trees/my-trees-i18n-refresh.js');
  // HTML default and i18n refresh fallback must match the compact label
  assert.match(html, /<option id="sortRecentOption"[^>]*>최신순<\/option>/, 'pages/my-trees.html sortRecentOption default must be "최신순"');
  assert.match(refresh, /setText\('sortRecentOption',\s*'myTrees\.sort_recent',\s*'최신순'\)/, 'my-trees-i18n-refresh.js fallback for sort_recent must be "최신순"');
  // i18n data must use the compact ko label and a 1-word en label
  assert.match(i18n, /'myTrees\.sort_recent':\s*\{\s*ko:\s*'최신순',\s*en:\s*'Latest'\s*\}/, 'i18n sort_recent must use compact ko "최신순" and en "Latest"');
});
