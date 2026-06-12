// Browse Final Social Sort Labels Implementation — contract test
// Locks the UI changes for Unit D: browse sort label activation
// Refs #2436, #2433, #1661

const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const searchUiJs = path.join(__dirname, '..', '..', 'js', 'search', 'search-ui.js');
const visitorViewerPanelsJs = path.join(__dirname, '..', '..', 'js', 'visitor-viewer', 'visitor-viewer-panels.js');
const i18nSearchJs = path.join(__dirname, '..', '..', 'js', 'i18n', 'i18n-search.js');
const decisionDoc = path.join(__dirname, '..', '..', 'docs', 'product', 'lovebud-browse-final-social-sort-labels-decision.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// ── Sort button existence ──────────────────────────────────────────────

test('search-ui.js has sort button for latest', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="latest"/);
});

test('search-ui.js has sort button for views (조회순)', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="views"/);
  assert.match(content, /조회순/);
});

test('search-ui.js has sort button for likes (좋아요순)', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="likes"/);
  assert.match(content, /좋아요순/);
});

test('search-ui.js does NOT have visible popular button (많은 순간순)', () => {
  const content = readFile(searchUiJs);
  // The popular button in ensureBrowseControls must be removed
  // The string 'data-browse-sort="popular"' must not exist as a visible button
  assert.doesNotMatch(content, /data-browse-sort="popular"/);
});

// ── Sort values map to internal sort values ────────────────────────────

test('search-ui.js 최신순 maps to latest', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="latest".*최신순|최신순.*data-browse-sort="latest"/);
});

test('search-ui.js 조회순 maps to views', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="views".*조회순|조회순.*data-browse-sort="views"/);
});

test('search-ui.js 좋아요순 maps to likes', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /data-browse-sort="likes".*좋아요순|좋아요순.*data-browse-sort="likes"/);
});

// ── SORT_COPY includes views and likes ─────────────────────────────────

test('search-ui.js SORT_COPY includes views heading', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /views:\s*\{/);
  assert.match(content, /resultsViewsHeading/);
});

test('search-ui.js SORT_COPY includes likes heading', () => {
  const content = readFile(searchUiJs);
  assert.match(content, /likes:\s*\{/);
  assert.match(content, /resultsLikesHeading/);
});

test('search-ui.js SORT_COPY no longer has popular heading', () => {
  const content = readFile(searchUiJs);
  assert.doesNotMatch(content, /popular:\s*\{/);
  assert.doesNotMatch(content, /resultsPopularHeading/);
});

// ── i18n keys exist ────────────────────────────────────────────────────

test('i18n-search.js has resultsViewsHeading', () => {
  const content = readFile(i18nSearchJs);
  assert.match(content, /resultsViewsHeading/);
  assert.match(content, /많이 본 러브트리/);
  assert.match(content, /Most Viewed LoveTrees/);
});

test('i18n-search.js has resultsLikesHeading', () => {
  const content = readFile(i18nSearchJs);
  assert.match(content, /resultsLikesHeading/);
  assert.match(content, /많이 좋아한 러브트리/);
  assert.match(content, /Most Liked LoveTrees/);
});

test('i18n-search.js keeps existing resultsPopularHeading (backward compat)', () => {
  const content = readFile(i18nSearchJs);
  assert.match(content, /resultsPopularHeading/);
});

// ── visitor-viewer-panels.js is NOT affected (tree-comments sort is separate) ──

test('visitor-viewer-panels.js 인기순/최신순 are tree-comments sort, not Browse sort', () => {
  const content = readFile(visitorViewerPanelsJs);
  // The tree-comments panel has its own sort controls — these are comment
  // sorting (인기순/최신순), not Browse tree sorting. They must remain unchanged.
  assert.match(content, /인기순/);
  assert.match(content, /최신순/);
  // These must NOT have data-browse-sort attributes (they are not Browse sort)
  assert.doesNotMatch(content, /data-browse-sort/);
});

// ── Non-goals (must NOT be changed) ────────────────────────────────────

test('search-ui.js does NOT add viewCount or likeCount to payload', () => {
  const content = readFile(searchUiJs);
  // The UI just sends sort values; it must not add new payload fields
  assert.doesNotMatch(content, /viewCount/);
  assert.doesNotMatch(content, /likeCount/);
});

test('search-ui.js does NOT add card count badges', () => {
  const content = readFile(searchUiJs);
  // No viewCount or likeCount badge rendering
  assert.doesNotMatch(content, /조회수.*뱃지|조회수.*badge|views.*badge/i);
});

test('search-ui.js still sends sort value through state.currentSort', () => {
  const content = readFile(searchUiJs);
  // The sort value flows via state.currentSort which is passed to API
  assert.match(content, /state\.currentSort/);
  // The click handler sets currentSort from data attribute
  assert.match(content, /button\.dataset\.browseSort/);
});

test('sort flow: search-index.js passes state.currentSort as sort param to API', () => {
  const filePath = path.join(__dirname, '..', '..', 'js', 'search', 'search-index.js');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /sort:\s*state\.currentSort/);
});