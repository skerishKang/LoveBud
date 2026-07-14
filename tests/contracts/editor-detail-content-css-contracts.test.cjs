const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/editor/editor-detail-content.css');
const SECTION_CARDS = path.join(ROOT, 'css/editor/editor-detail-content/section-cards.css');
const MOMENT_CARD = path.join(ROOT, 'css/editor/editor-detail-content/moment-card.css');
const DETAIL_INFO = path.join(ROOT, 'css/editor/editor-detail-content/detail-info.css');
const RESPONSIVE = path.join(ROOT, 'css/editor/editor-detail-content/responsive.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const sectionCards = fs.readFileSync(SECTION_CARDS, 'utf8');
const momentCard = fs.readFileSync(MOMENT_CARD, 'utf8');
const detailInfo = fs.readFileSync(DETAIL_INFO, 'utf8');
const responsive = fs.readFileSync(RESPONSIVE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /editor-detail-content\/section-cards\.css/);
  assert.match(manifest, /editor-detail-content\/moment-card\.css/);
  assert.match(manifest, /editor-detail-content\/detail-info\.css/);
  assert.match(manifest, /editor-detail-content\/responsive\.css/);
});

test('manifest is thin — fewer than 15 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 15, `Manifest should be <15 lines, got ${lineCount}`);
});

// ---------------------------------------------------------------------------
// 2. section-cards.css selectors
// ---------------------------------------------------------------------------
test('section-cards.css — editor-tree-meta-section selector preserved', () => {
  assert.match(sectionCards, /\.editor-tree-meta-section/);
});

test('section-cards.css — editor-current-moment-card selector preserved', () => {
  assert.match(sectionCards, /\.editor-current-moment-card/);
});

test('section-cards.css — editor-moment-info-card selector preserved', () => {
  assert.match(sectionCards, /\.editor-moment-info-card/);
});

test('section-cards.css — editor-save-status-card selector preserved', () => {
  assert.match(sectionCards, /\.editor-save-status-card/);
});

test('section-cards.css — editor-section-eyebrow selector preserved', () => {
  assert.match(sectionCards, /\.editor-section-eyebrow/);
});

// ---------------------------------------------------------------------------
// 3. moment-card.css selectors
// ---------------------------------------------------------------------------
test('moment-card.css — editor-current-moment-head selector preserved', () => {
  assert.match(momentCard, /\.editor-current-moment-head\s*\{/);
});

test('moment-card.css — editor-current-moment-badge selector preserved', () => {
  assert.match(momentCard, /\.editor-current-moment-badge/);
});

test('moment-card.css — editor-current-moment-title selector preserved', () => {
  assert.match(momentCard, /\.editor-current-moment-title\s*\{/);
});

test('moment-card.css — editor-current-moment-hint selector preserved', () => {
  assert.match(momentCard, /\.editor-current-moment-hint/);
});

test('moment-card.css — editor-current-moment-actions selector preserved', () => {
  assert.match(momentCard, /\.editor-current-moment-actions\s*\{/);
});

test('moment-card.css — editor-moment-edit-chip selector preserved', () => {
  assert.match(momentCard, /\.editor-moment-edit-chip/);
});

test('moment-card.css — editor-moment-edit-chip::before preserved', () => {
  assert.match(momentCard, /\.editor-moment-edit-chip::before/);
});

test('moment-card.css — memory-edit-button !important preserved', () => {
  assert.match(momentCard, /\.memory-edit-button[\s\S]*?!important/);
});

// ---------------------------------------------------------------------------
// 4. detail-info.css selectors
// ---------------------------------------------------------------------------
test('detail-info.css — detail-video selector preserved', () => {
  assert.match(detailInfo, /\.detail-video\s*\{/);
});

test('detail-info.css — detail-info-group label preserved', () => {
  assert.match(detailInfo, /\.detail-info-group label/);
});

test('detail-info.css — editor-memo-heading-row selector preserved', () => {
  assert.match(detailInfo, /\.editor-memo-heading-row\s*\{/);
});

test('detail-info.css — editor-memo-heading-edit-button selector preserved', () => {
  assert.match(detailInfo, /\.editor-memo-heading-edit-button\s*\{/);
});

test('detail-info.css — detailMemoLabel ID selector preserved', () => {
  assert.match(detailInfo, /#detailMemoLabel/);
});

test('detail-info.css — detail-info-group.is-compact preserved', () => {
  assert.match(detailInfo, /\.detail-info-group\.is-compact/);
});

test('detail-info.css — tags-container selector preserved', () => {
  assert.match(detailInfo, /\.tags-container\s*\{/);
});

test('detail-info.css — .tag selector preserved', () => {
  assert.match(detailInfo, /\.tag\s*\{/);
});

test('detail-info.css — .tag-primary selector preserved', () => {
  assert.match(detailInfo, /\.tag-primary/);
});

test('detail-info.css — .tag-secondary selector preserved', () => {
  assert.match(detailInfo, /\.tag-secondary/);
});

test('detail-info.css — .diary-note selector preserved', () => {
  assert.match(detailInfo, /\.diary-note\s*\{/);
});

test('detail-info.css — .editor-empty-state-cta selector preserved', () => {
  assert.match(detailInfo, /\.editor-empty-state-cta/);
});

// ---------------------------------------------------------------------------
// 5. responsive.css selectors
// ---------------------------------------------------------------------------
test('responsive.css — @media 375px preserved', () => {
  assert.match(responsive, /@media\s*\(max-width:\s*375px\)/);
});

test('responsive.css — editor-current-moment-head responsive preserved', () => {
  assert.match(responsive, /\.editor-current-moment-head\s*\{/);
});

test('responsive.css — editor-moment-edit-chip responsive preserved', () => {
  assert.match(responsive, /\.editor-moment-edit-chip/);
});

test('responsive.css — editor-memo-heading-edit-button responsive preserved', () => {
  assert.match(responsive, /\.editor-memo-heading-edit-button/);
});

// ---------------------------------------------------------------------------
// 6. Property values preserved
// ---------------------------------------------------------------------------
test('section-cards.css — border-radius 22px preserved', () => {
  assert.match(sectionCards, /border-radius:\s*22px/);
});

test('moment-card.css — memory-edit-button content edit preserved', () => {
  assert.match(momentCard, /content:\s*'edit'/);
});

test('detail-info.css — detail-video aspect-ratio 16/9 preserved', () => {
  assert.match(detailInfo, /aspect-ratio:\s*16\/9/);
});

test('detail-info.css — diary-note border-left preserved', () => {
  assert.match(detailInfo, /border-left:\s*4px solid var\(--primary-container\)/);
});

// ---------------------------------------------------------------------------
// 8. Hidden detail group contract (issue #3509)
// ---------------------------------------------------------------------------
test('detail-info.css — .detail-info-group[hidden] selector exists', () => {
  assert.match(detailInfo, /\.detail-info-group\[hidden\]\s*\{/);
});

test('detail-info.css — hidden rule display must be none', () => {
  const hiddenBlock = detailInfo.match(/\.detail-info-group\[hidden\]\s*\{([^}]*)\}/);
  assert.ok(hiddenBlock, 'hidden rule block must be extractable');
  assert.match(hiddenBlock[1], /display:\s*none/);
});

test('detail-info.css — hidden rule must be after base display:grid', () => {
  const gridIdx = detailInfo.indexOf('.detail-info-group {\n    display: grid');
  const hiddenIdx = detailInfo.indexOf('.detail-info-group[hidden]');
  assert.ok(gridIdx >= 0, 'base display:grid must exist');
  assert.ok(hiddenIdx >= 0, 'hidden rule must exist');
  assert.ok(hiddenIdx > gridIdx, 'hidden rule must be after base grid rule');
});

test('detail-info.css — hidden rule must be after .is-compact display:flex', () => {
  const flexIdx = detailInfo.indexOf('.detail-info-group.is-compact {\n    display: flex');
  const hiddenIdx = detailInfo.indexOf('.detail-info-group[hidden]');
  assert.ok(flexIdx >= 0, 'base display:flex must exist');
  assert.ok(hiddenIdx >= 0, 'hidden rule must exist');
  assert.ok(hiddenIdx > flexIdx, 'hidden rule must be after compact flex rule');
});

test('detail-info.css — no standalone global [hidden] override created', () => {
  // Only .detail-info-group[hidden] is permitted, not bare [hidden] as a standalone rule
  const bareHiddenMatches = detailInfo.match(/^\s*\[hidden\]\s*\{/gm);
  assert.equal(bareHiddenMatches, null, 'bare standalone [hidden] rule must not exist; .memory-preview-overlay[hidden] is exempt');
});

test('detail-info.css — detail-info.css import token matches leaf SHA-256 first 12', () => {
  const crypto = require('node:crypto');
  const leafContent = fs.readFileSync(DETAIL_INFO, 'utf8');
  const leafHash = crypto.createHash('sha256').update(leafContent).digest('hex').slice(0, 24);
  const importLine = manifest.match(/@import url\('editor-detail-content\/detail-info\.css\?v=([^']+)'\)/);
  assert.ok(importLine, 'import token must be present');
  assert.equal(importLine[1], '20260715-3509-' + leafHash, 'import token must match leaf hash');
});

test('detail-info.css — leaf import token contains 3509', () => {
  const importLine = manifest.match(/@import url\('editor-detail-content\/detail-info\.css\?v=([^']+)'\)/);
  assert.ok(importLine, 'import token must be present');
  assert.ok(importLine[1].includes('3509'), 'import token must contain 3509');
});

// editor.css must also be checked for the manifest import token
test('detail-info.css — editor.css manifest import token matches manifest SHA-256 first 12', () => {
  const crypto = require('node:crypto');
  const editorCss = fs.readFileSync(path.join(ROOT, 'css/editor.css'), 'utf8');
  const manifestContent = fs.readFileSync(MANIFEST, 'utf8');
  const manifestHash = crypto.createHash('sha256').update(manifestContent).digest('hex').slice(0, 24);
  const importLine = editorCss.match(/@import url\("\.\/editor\/editor-detail-content\.css\?v=([^"]+)"\)/);
  assert.ok(importLine, 'editor.css manifest import token must be present');
  assert.equal(importLine[1], '20260715-3509-' + manifestHash, 'editor.css import token must match manifest hash');
});

test('detail-info.css — manifest import token contains 3509', () => {
  const editorCss = fs.readFileSync(path.join(ROOT, 'css/editor.css'), 'utf8');
  const importLine = editorCss.match(/@import url\("\.\/editor\/editor-detail-content\.css\?v=([^"]+)"\)/);
  assert.ok(importLine, 'manifest import token must be present');
  assert.ok(importLine[1].includes('3509'), 'manifest import token must contain 3509');
});

// ---------------------------------------------------------------------------
// 7. No @keyframes in any file
// ---------------------------------------------------------------------------
test('no @keyframes in any split file', () => {
  assert.doesNotMatch(sectionCards, /@keyframes/);
  assert.doesNotMatch(momentCard, /@keyframes/);
  assert.doesNotMatch(detailInfo, /@keyframes/);
  assert.doesNotMatch(responsive, /@keyframes/);
});
