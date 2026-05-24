const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/editor/editor-status-settings.css');
const SECTION_COMMON = path.join(ROOT, 'css/editor/editor-status-settings/section-common.css');
const STATUS_CARD = path.join(ROOT, 'css/editor/editor-status-settings/status-card.css');
const SETTINGS_PANEL = path.join(ROOT, 'css/editor/editor-status-settings/settings-panel.css');
const SIDEBAR_ACTIONS = path.join(ROOT, 'css/editor/editor-status-settings/sidebar-actions.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const sectionCommon = fs.readFileSync(SECTION_COMMON, 'utf8');
const statusCard = fs.readFileSync(STATUS_CARD, 'utf8');
const settingsPanel = fs.readFileSync(SETTINGS_PANEL, 'utf8');
const sidebarActions = fs.readFileSync(SIDEBAR_ACTIONS, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /editor-status-settings\/section-common\.css/);
  assert.match(manifest, /editor-status-settings\/status-card\.css/);
  assert.match(manifest, /editor-status-settings\/settings-panel\.css/);
  assert.match(manifest, /editor-status-settings\/sidebar-actions\.css/);
});

test('manifest is thin — fewer than 10 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 10, `Manifest should be <10 lines, got ${lineCount}`);
});

// ---------------------------------------------------------------------------
// 2. section-common.css selectors
// ---------------------------------------------------------------------------
test('section-common.css — .editor-status-section selector preserved', () => {
  assert.match(sectionCommon, /\.editor-status-section/);
});

test('section-common.css — .editor-add-section selector preserved', () => {
  assert.match(sectionCommon, /\.editor-add-section/);
});

// ---------------------------------------------------------------------------
// 3. status-card.css selectors
// ---------------------------------------------------------------------------
test('status-card.css — .editor-status-card selector preserved', () => {
  assert.match(statusCard, /\.editor-status-card\s*\{/);
});

test('status-card.css — .editor-space-between-row selector preserved', () => {
  assert.match(statusCard, /\.editor-space-between-row\s*\{/);
});

test('status-card.css — .editor-rename-btn selector preserved', () => {
  assert.match(statusCard, /\.editor-rename-btn\s*\{/);
});

test('status-card.css — .editor-tree-visibility-pill selector preserved', () => {
  assert.match(statusCard, /\.editor-tree-visibility-pill\s*\{/);
});

test('status-card.css — .editor-tree-visibility-pill.is-public preserved', () => {
  assert.match(statusCard, /\.editor-tree-visibility-pill\.is-public/);
});

test('status-card.css — .editor-tree-visibility-pill.is-private preserved', () => {
  assert.match(statusCard, /\.editor-tree-visibility-pill\.is-private/);
});

test('status-card.css — .editor-flow-summary selector preserved', () => {
  assert.match(statusCard, /\.editor-flow-summary\s*\{/);
});

// ---------------------------------------------------------------------------
// 4. settings-panel.css selectors
// ---------------------------------------------------------------------------
test('settings-panel.css — .editor-title-settings-panel selector preserved', () => {
  assert.match(settingsPanel, /\.editor-title-settings-panel\s*\{/);
});

test('settings-panel.css — .editor-mini-setting-btn selector preserved', () => {
  assert.match(settingsPanel, /\.editor-mini-setting-btn\s*\{/);
});

test('settings-panel.css — .editor-mini-setting-btn:hover preserved', () => {
  assert.match(settingsPanel, /\.editor-mini-setting-btn:hover/);
});

// ---------------------------------------------------------------------------
// 5. sidebar-actions.css selectors
// ---------------------------------------------------------------------------
test('sidebar-actions.css — .editor-sidebar-actions selector preserved', () => {
  assert.match(sidebarActions, /\.editor-sidebar-actions\s*\{/);
});

test('sidebar-actions.css — .secondary-btn selector preserved', () => {
  assert.match(sidebarActions, /\.secondary-btn/);
});

test('sidebar-actions.css — .secondary-btn:hover preserved', () => {
  assert.match(sidebarActions, /\.secondary-btn:hover/);
});

test('sidebar-actions.css — .secondary-btn::before preserved', () => {
  assert.match(sidebarActions, /\.secondary-btn::before/);
});

test('sidebar-actions.css — .editor-sidebar-meta selector preserved', () => {
  assert.match(sidebarActions, /\.editor-sidebar-meta\s*\{/);
});

// ---------------------------------------------------------------------------
// 6. Property values preserved
// ---------------------------------------------------------------------------
test('status-card.css — border-radius 18px preserved', () => {
  assert.match(statusCard, /border-radius:\s*18px/);
});

test('settings-panel.css — grid-template-columns preserved', () => {
  assert.match(settingsPanel, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('sidebar-actions.css — content "+" preserved', () => {
  assert.match(sidebarActions, /content:\s*'\+'/);
});

test('sidebar-actions.css — content "⌂" preserved', () => {
  assert.match(sidebarActions, /content:\s*'⌂'/);
});

// ---------------------------------------------------------------------------
// 7. No forbidden content
// ---------------------------------------------------------------------------
test('no !important in any split file', () => {
  assert.doesNotMatch(sectionCommon, /!important/);
  assert.doesNotMatch(statusCard, /!important/);
  assert.doesNotMatch(settingsPanel, /!important/);
  assert.doesNotMatch(sidebarActions, /!important/);
});

test('no @keyframes in any split file', () => {
  assert.doesNotMatch(sectionCommon, /@keyframes/);
  assert.doesNotMatch(statusCard, /@keyframes/);
  assert.doesNotMatch(settingsPanel, /@keyframes/);
  assert.doesNotMatch(sidebarActions, /@keyframes/);
});

test('no @media in any split file', () => {
  assert.doesNotMatch(sectionCommon, /@media/);
  assert.doesNotMatch(statusCard, /@media/);
  assert.doesNotMatch(settingsPanel, /@media/);
  assert.doesNotMatch(sidebarActions, /@media/);
});
