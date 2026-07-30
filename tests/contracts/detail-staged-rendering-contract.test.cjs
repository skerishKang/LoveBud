const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('detail loader renders current memory before tree and connected fetches settle', () => {
  const src = read('js/detail/detail-loader.js');
  const memoryMissingIndex = src.indexOf('if (!memory) {');
  const stagedRenderIndex = src.indexOf('renderMemoryBase(memory);');
  const loadPromisesIndex = src.indexOf('const loadPromises = [];');
  const awaitTreeContextIndex = src.indexOf('await Promise.all(loadPromises)');

  assert.ok(memoryMissingIndex >= 0, 'loader must keep missing memory boundary');
  assert.ok(stagedRenderIndex > memoryMissingIndex, 'current memory should render only after missing memory guard');
  assert.ok(loadPromisesIndex > stagedRenderIndex, 'tree/connected fetch setup should happen after staged current render');
  assert.ok(awaitTreeContextIndex > stagedRenderIndex, 'current memory render must not wait for tree/connected fetches');
});

test('detail page exposes explicit initial media loading state', () => {
  const html = read('pages/detail.html');
  const css = read('css/detail/components.css');

  assert.match(html, /class="detail-media-loading"/);
  assert.match(html, /대표 장면을 준비하고 있어요/);
  assert.match(css, /\.detail-media-loading/);
  assert.doesNotMatch(html, /type="module"/);
});

test('detail connected flow has a separate staged loading state', () => {
  const loader = read('js/detail/detail-loader.js');
  const connected = read('js/detail/detail-connected.js');
  const copy = read('js/detail/detail-copy.js');

  assert.match(loader, /stagedDegradedReason = hasTreeContext \? 'context-loading' : 'missing-tree-id'/);
  assert.match(connected, /degradedReason === 'context-loading'/);
  assert.match(copy, /isContextLoading/);
});

test('browse detail context uses public tree detail read path', () => {
  const loader = read('js/detail/detail-loader.js');
  const client = read('js/postgres-client.js');

  assert.match(client, /getPublicTree:\s*async \(treeId\) => BaseApiFetch\.apiFetch\(`\/trees\/\$\{treeId\}`,\s*\{ publicRead: true \}\)/);
  assert.match(loader, /sourceContext === 'browse' && window\.apiClient\.getPublicTree/);
  assert.match(loader, /window\.apiClient\.getPublicTree\(canonicalTreeId\)/);
  assert.match(loader, /window\.apiClient\.getTree\(canonicalTreeId\)/);
});

test('detail #videoMain is the primary busy region owner with one initial status owner', () => {
  const html = read('pages/detail.html');

  assert.match(html, /<div id="videoMain"[^>]*aria-busy="true"/, '#videoMain must own the initial busy state');
  assert.match(html, /class="detail-media-loading" role="status" aria-live="polite"/, 'loading child must be a polite status owner');
  assert.match(html, /대표 장면을 준비하고 있어요/, 'bounded loading copy must be preserved');

  const statusOwners = html.match(/role="status"/g) || [];
  assert.equal(statusOwners.length, 1, 'detail.html must expose exactly one initial announcement owner');
  const liveOwners = html.match(/aria-live=/g) || [];
  assert.equal(liveOwners.length, 1, 'detail.html must expose exactly one aria-live owner');
});

test('renderMemoryBase clears busy state and replaces initial loading markup', () => {
  const render = read('js/detail/detail-render.js');

  assert.match(render, /videoMain\.innerHTML = buildVideoMainMarkup\(memory\)/, 'ready render must replace the loading markup');
  assert.match(render, /videoMain\.removeAttribute\('aria-busy'\)/, 'renderMemoryBase must clear the busy state');
});

test('terminal missing state clears busy and exposes exactly one accessible owner without retry', () => {
  const boundary = read('js/detail/detail-loading-error-boundary.js');

  assert.match(boundary, /removeAttribute\('aria-busy'\)/, 'terminal state must clear the primary busy state');

  const terminalOwners = boundary.match(/role="status"/g) || [];
  assert.equal(terminalOwners.length, 1, 'terminal state must expose exactly one accessible status owner');

  assert.match(boundary, /memory_not_found_title/, 'terminal heading copy must remain');
  assert.match(boundary, /memory_not_found_desc/, 'terminal explanatory copy must remain');
  assert.match(boundary, /back_to_home/, 'Home navigation must remain');
  assert.match(boundary, /browse_lovetrees/, 'Browse navigation must remain');
  assert.match(boundary, /homeHref/, 'Home href must be preserved');
  assert.match(boundary, /searchHref/, 'Browse href must be preserved');

  assert.doesNotMatch(boundary, /retry/i, 'terminal missing state must not add a transient retry');
});

test('reduced-motion removes loading icon motion without adding a new animation', () => {
  const css = read('css/detail/components.css');

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'reduced-motion block must exist');
  assert.match(css, /\.detail-media-loading \.material-symbols-outlined/, 'reduced-motion must target the loading icon');
  assert.match(css, /animation: none/, 'reduced-motion must disable loading icon animation');
  assert.doesNotMatch(css, /@keyframes/, 'components.css must not introduce a new animation');
});

test('loading semantics stay bounded to the five allowed files', () => {
  const html = read('pages/detail.html');
  const css = read('css/detail/components.css');
  const render = read('js/detail/detail-render.js');
  const boundary = read('js/detail/detail-loading-error-boundary.js');

  assert.match(html, /id="videoMain"/, 'busy owner lives in detail.html');
  assert.match(css, /\.detail-media-loading/, 'loading styles live in components.css');
  assert.match(render, /renderMemoryBase/, 'ready transition lives in detail-render.js');
  assert.match(boundary, /renderMissingMemoryState/, 'terminal state lives in detail-loading-error-boundary.js');

  const loader = read('js/detail/detail-loader.js');
  const connected = read('js/detail/detail-connected.js');
  const copy = read('js/detail/detail-copy.js');
  assert.doesNotMatch(loader, /removeAttribute\('aria-busy'\)/, 'busy clearing must not leak into detail-loader.js');
  assert.doesNotMatch(connected, /detail-missing-state/, 'terminal state must not leak into detail-connected.js');
  assert.doesNotMatch(copy, /detail-missing-state/, 'terminal state must not leak into detail-copy.js');
});
