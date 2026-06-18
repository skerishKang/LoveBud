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
  const balanceIdx = css.indexOf('my-trees-mobile-controls-balance.css?v=20260618-2682-1');
  assert.ok(responsiveIdx > 0, 'responsive import must exist');
  assert.ok(balanceIdx > 0, 'mobile controls balance import must exist');
  assert.ok(responsiveIdx < balanceIdx, 'balance override must load after responsive rules');
});

test('2. Mobile sort control uses a visibly shorter partial width', () => {
  const css = read('css/my-trees/my-trees-mobile-controls-balance.css');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /\.my-trees-results-controls\s+\.sort-control\s*{[^}]*flex:\s*0\s+1\s+56%;[^}]*max-width:\s*220px;[^}]*}/s);
});

test('3. View mode keeps trailing separation from the shorter sort control', () => {
  const css = read('css/my-trees/my-trees-mobile-controls-balance.css');
  assert.match(css, /\.my-trees-results-controls\s*{[^}]*gap:\s*16px;[^}]*}/s);
  assert.match(css, /\.my-trees-results-controls\s+\.my-trees-view-mode-mount\s*{[^}]*margin-left:\s*auto;[^}]*}/s);
});

test('4. My Trees page fetches a fresh CSS bundle for the tightened controls', () => {
  const html = read('pages/my-trees.html');
  assert.match(html, /my-trees\.css\?v=20260618-2676-1-2682-1/);
});
