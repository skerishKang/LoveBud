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
// 7. No @keyframes in any file
// ---------------------------------------------------------------------------
test('no @keyframes in any split file', () => {
  assert.doesNotMatch(sectionCards, /@keyframes/);
  assert.doesNotMatch(momentCard, /@keyframes/);
  assert.doesNotMatch(detailInfo, /@keyframes/);
  assert.doesNotMatch(responsive, /@keyframes/);
});
