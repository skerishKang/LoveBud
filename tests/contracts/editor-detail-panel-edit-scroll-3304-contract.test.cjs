'use strict';

/*
 * Issue #3304 — Desktop detail panel must contain a long edit form.
 *
 * Confirmed production finding (desktop, 1080p):
 *   - The 3-column shell (left rail / center canvas / right detail panel) is fine.
 *   - The "순간 수정" button is in the right place.
 *   - The real defect: when the edit form is long, content below the fold
 *     (cancel / save, delete, "기존 순간 연결하기") escapes the right panel
 *     and is clipped by the Editor shell's overflow:hidden boundary.
 *
 * Root cause (CSS sizing / flex / min-height / overflow):
 *   - .detail-panel is a flex column but lacks min-height: 0.
 *   - .detail-content (flex: 1; overflow-y: auto) also lacks min-height: 0.
 *   In a flex column, a child's default min-height is auto (= its content
 *   size), so a tall edit form forces .detail-content to grow to content
 *   height instead of shrinking within the shell. Without min-height: 0 the
 *   panel cannot bound the content and it overflows the shell boundary.
 *
 * This contract pins the desktop bounded-scroll invariant at the
 * selector/property level. It MUST fail on current origin/main (baseline)
 * and pass after the CSS-only fix is applied.
 *
 * Allowed fix scope: CSS only. No DOM / template / JS changes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const LAYOUT_CSS = path.join(ROOT, 'css/editor/editor-layout.css');
const PANEL_CSS = path.join(ROOT, 'css/editor/editor-detail-panel.css');
const EDIT_MODE_TEMPLATE = path.join(ROOT, 'js/editor/templates/editor-detail-edit-mode-template.js');
const PANEL_TEMPLATE = path.join(ROOT, 'js/editor/templates/editor-detail-panel-shell-template.js');
const VIEW_MODE_TEMPLATE = path.join(ROOT, 'js/shared/canonical-appreciation-detail-presentation.js');
const HTML = path.join(ROOT, 'pages/editor.html');

const layoutCss = fs.readFileSync(LAYOUT_CSS, 'utf8');
const panelCss = fs.readFileSync(PANEL_CSS, 'utf8');
const editModeTemplate = fs.readFileSync(EDIT_MODE_TEMPLATE, 'utf8');
const panelTemplate = fs.readFileSync(PANEL_TEMPLATE, 'utf8');
const viewModeTemplate = fs.readFileSync(VIEW_MODE_TEMPLATE, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');

// ---------------------------------------------------------------------------
// A. Desktop editor shell keeps a bounded height with hidden overflow.
// ---------------------------------------------------------------------------
test('A. desktop editor shell is bounded by 100dvh-header height with hidden overflow', () => {
  const rule = (layoutCss.match(/\.editor-layout\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(rule.length > 0, '.editor-layout rule must exist');
  assert.match(rule, /height:\s*calc\(100dvh\s*-\s*var\(--header-height\)\)/,
    'editor-layout must be height: calc(100dvh - var(--header-height))');
  assert.match(rule, /overflow:\s*hidden/,
    'editor-layout must clip overflow (overflow: hidden)');
});

// ---------------------------------------------------------------------------
// B. Desktop right detail panel can shrink inside the shell height.
// ---------------------------------------------------------------------------
test('B. desktop right detail panel is a shrinkable bounded flex column inside the shell', () => {
  const rule = (panelCss.match(/\.detail-panel\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(rule.length > 0, '.detail-panel rule must exist');
  assert.match(rule, /display:\s*flex/, '.detail-panel must be display: flex');
  assert.match(rule, /flex-direction:\s*column/, '.detail-panel must be a column flex');
  // Without min-height:0 the panel cannot shrink below its content height.
  assert.match(rule, /min-height:\s*0/,
    '.detail-panel must set min-height: 0 so it can shrink inside the shell');
});

// ---------------------------------------------------------------------------
// C. detail-content is a flex child with min-height:0 and a vertical scroll boundary.
// ---------------------------------------------------------------------------
test('C. detail-content has min-height:0 and a vertical scroll boundary', () => {
  const rule = (panelCss.match(/\.detail-content\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(rule.length > 0, '.detail-content rule must exist');
  assert.match(rule, /flex:\s*1/, '.detail-content must be flex: 1 to fill the panel');
  assert.match(rule, /overflow-y:\s*auto/,
    '.detail-content must own the vertical scroll (overflow-y: auto)');
  // This is the precise missing bound: a flex child defaults to min-height:auto,
  // which prevents it from shrinking below content height.
  assert.match(rule, /min-height:\s*0/,
    '.detail-content must set min-height: 0 so a long edit form scrolls inside it');
});

// ---------------------------------------------------------------------------
// D. Long edit content cannot push the panel past the shell boundary
//    (selector/property level proof of the bounded structure).
// ---------------------------------------------------------------------------
test('D. long edit content is contained by detail-content, not the panel itself', () => {
  // The panel must NOT be the scroll container — it must not grow with content.
  const panelRule = (panelCss.match(/\.detail-panel\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.doesNotMatch(panelRule, /overflow-y:\s*auto/,
    '.detail-panel must NOT be the vertical scroll container (content must scroll inside .detail-content)');

  // The scroll boundary lives on .detail-content, and it may shrink.
  const contentRule = (panelCss.match(/\.detail-content\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.match(contentRule, /overflow-y:\s*auto/);
  assert.match(contentRule, /min-height:\s*0/);

  // Both panel (B) and content (C) agree on the bounded-scroll contract.
  assert.match(panelRule, /min-height:\s*0/);
});

// ---------------------------------------------------------------------------
// E. save-status card stays a sibling outside detail-content and does not
//    push edit controls out via shrink/overflow.
// ---------------------------------------------------------------------------
test('E. save-status card is a sibling of detail-content, not nested inside it', () => {
  // In the shell template, .editor-save-status-card is a direct child of
  // .detail-panel, appearing AFTER .detail-content (sibling, not descendant).
  const panelOpen = panelTemplate.indexOf('id="detailContent"');
  const saveCard = panelTemplate.indexOf('editor-save-status-card');
  assert.notEqual(panelOpen, -1, 'detail-content mount must exist in shell template');
  assert.notEqual(saveCard, -1, 'save-status card must exist in shell template');
  assert.ok(saveCard > panelOpen,
    'save-status card must appear after detail-content (sibling outside detail-content)');

  // The save-status card must not be a flex:1 / auto-scroll region.
  const sectionCards = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-detail-content/section-cards.css'), 'utf8'
  );
  const saveRule = (sectionCards.match(/\.editor-save-status-card\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(saveRule.length > 0, '.editor-save-status-card rule must exist');
  assert.doesNotMatch(saveRule, /flex:\s*1/,
    '.editor-save-status-card must not act as a flex:1 region that competes with detail-content');
});

// ---------------------------------------------------------------------------
// F. max-width: 1024px responsive rules are preserved (must not change).
// ---------------------------------------------------------------------------
test('F. tablet/mobile responsive rules remain intact (<=1024px untouched)', () => {
  const tablet = fs.readFileSync(path.join(ROOT, 'css/editor/editor-responsive/tablet.css'), 'utf8');
  const mobile = fs.readFileSync(path.join(ROOT, 'css/editor/editor-responsive/mobile.css'), 'utf8');

  // tablet.css keeps the 1024px column-stack + fixed panel behavior.
  assert.match(tablet, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(tablet, /\.detail-panel\s*\{[^}]*position:\s*fixed/,
    'tablet .detail-panel must remain position: fixed (drawer behavior unchanged)');

  // mobile.css keeps its detail-panel / detail-content overrides.
  assert.match(mobile, /@media\s*\(max-width:\s*768px\)/);
  assert.match(mobile, /\.detail-panel\s*\{[^}]*width:\s*100%/);

  // The desktop-only min-height:0 fix must NOT leak into the <=1024px rules.
  assert.doesNotMatch(tablet, /\.detail-panel\s*\{[^}]*min-height:\s*0/,
    'desktop min-height:0 fix must not alter the tablet drawer rule');
});

// ---------------------------------------------------------------------------
// G. editor detail panel shell template + edit form mount structure unchanged.
// ---------------------------------------------------------------------------
test('G. detail panel shell template and edit form mount structure unchanged', () => {
  // Shell template structure must be exactly the existing mount anchors.
  assert.ok(panelTemplate.includes('id="detailContent"'), 'shell template must keep detail-content mount');
  assert.ok(panelTemplate.includes('id="editorDetailEditModeTemplateMount"'),
    'shell template must keep edit mode mount anchor');
  assert.ok(panelTemplate.includes('editorDetailPanelShellTemplateMount'),
    'shell template must keep its own mount anchor');

  // Edit mode template must keep the four production-confirmed controls.
  assert.ok(editModeTemplate.includes('id="cancelEditBtn"'), 'cancelEditBtn must be present');
  assert.ok(editModeTemplate.includes('id="saveEditBtn"'), 'saveEditBtn must be present');
  assert.ok(editModeTemplate.includes('id="deleteMemoryBtn"'), 'deleteMemoryBtn must be present');
  // connectExistingCtaBtn lives in the edit mode template
  assert.ok(editModeTemplate.includes('id="connectExistingCtaBtn"'), 'connectExistingCtaBtn must be present');
});

// ---------------------------------------------------------------------------
// H. Production-confirmed target control IDs / text hooks are retained.
// ---------------------------------------------------------------------------
test('H. production-confirmed target controls retained (cancel/save/delete/connect)', () => {
  assert.ok(editModeTemplate.includes('cancelEditBtn'), 'cancelEditBtn id retained');
  assert.ok(editModeTemplate.includes('saveEditBtn'), 'saveEditBtn id retained');
  assert.ok(editModeTemplate.includes('deleteMemoryBtn'), 'deleteMemoryBtn id retained');
  assert.ok(editModeTemplate.includes('connectExistingCtaBtn'), 'connectExistingCtaBtn id retained');
  assert.ok(editModeTemplate.includes('기존 순간 연결하기'), 'connect CTA text hook retained');
});

// ---------------------------------------------------------------------------
// Sanity guard: editor.html still loads the shell template helper before runtime.
// ---------------------------------------------------------------------------
test('I. editor.html loads the detail panel shell template helper', () => {
  assert.ok(html.includes('editor-detail-panel-shell-template.js'),
    'editor.html must load the shell template helper');
});
