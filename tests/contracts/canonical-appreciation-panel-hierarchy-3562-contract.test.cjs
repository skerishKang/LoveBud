/**
 * Contract: LoveBud #3562 — separate tree-scope from selected-moment detail panels.
 *
 * Hierarchy:
 *   Left: tree-scope (#detailTreeMetaSection / #detailTreeMetaMount)
 *   Center: visualization (unchanged)
 *   Right: selected-moment only (#detailViewMode without tree meta)
 *
 * Preserves #3563 single presentation builder boundary.
 *
 * EXECUTED_FAKE + SOURCE_STATIC hybrid.
 *
 * Closes #3562
 * Refs #3563 — CLOSED / completed; do not reopen.
 * Keep #3425 OPEN. Keep #1882 OPEN.
 * #3075 is CLOSED / completed. Do not reopen.
 * #3188 is CLOSED / completed. Do not reopen.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SHARED = 'js/shared/canonical-appreciation-detail-presentation.js';
const OWNER_SIDEBAR = 'js/editor/templates/editor-sidebar-template.js';
const PUBLIC_SIDEBAR = 'js/viewer/templates/public-viewer-sidebar-template.js';
const OWNER_MOMENT = 'js/editor/templates/editor-detail-view-mode-template.js';
const PUBLIC_MOMENT = 'js/viewer/public-viewer-detail-view-mode-template.js';

function loadShared() {
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read(SHARED), ctx);
  return ctx.window.LoveBudCanonicalAppreciationDetailPresentation;
}

test('#3562 shared builder exposes tree-scope shell separate from selected-moment shell', () => {
  const api = loadShared();
  assert.equal(typeof api.buildTreeScopeShellHtml, 'function');
  assert.equal(typeof api.buildDetailViewModeHtml, 'function');

  const tree = api.buildTreeScopeShellHtml({ authority: 'public-safe' });
  const moment = api.buildDetailViewModeHtml({ authority: 'public-safe' });
  const ownerMoment = api.buildDetailViewModeHtml({ authority: 'owner' });

  assert.match(tree, /id="detailTreeMetaSection"/);
  assert.match(tree, /id="detailTreeMetaMount"/);
  assert.match(tree, /data-appreciation-region="tree-scope"/);
  assert.match(tree, /data-canonical-section="tree-scope"/);

  assert.match(moment, /id="detailViewMode"/);
  assert.match(moment, /data-appreciation-region="selected-moment"/);
  assert.doesNotMatch(moment, /id="detailTreeMetaMount"/);
  assert.doesNotMatch(moment, /id="detailTreeMetaSection"/);
  assert.doesNotMatch(moment, /data-canonical-section="tree-meta"/);

  assert.doesNotMatch(ownerMoment, /id="detailTreeMetaMount"/);
  assert.match(ownerMoment, /id="editMemoryBtn"/);
  assert.doesNotMatch(moment, /id="editMemoryBtn"/);
});

test('#3562 EXECUTED: owner and public selected-moment sections match', () => {
  const api = loadShared();
  const owner = Array.from(api.listCanonicalSections(api.buildDetailViewModeHtml({ authority: 'owner' }))).map(String);
  const pub = Array.from(api.listCanonicalSections(api.buildDetailViewModeHtml({ authority: 'public-safe' }))).map(String);
  assert.equal(owner.join('|'), pub.join('|'));
  assert.equal(owner.join('|'), 'selected-moment|moment-info|moment-social');
});

test('#3562 left sidebars host exactly one tree-scope mount id', () => {
  const ownerSidebar = read(OWNER_SIDEBAR);
  const publicSidebar = read(PUBLIC_SIDEBAR);

  for (const [label, src] of [
    ['owner', ownerSidebar],
    ['public', publicSidebar]
  ]) {
    const sectionCount = (src.match(/id="detailTreeMetaSection"/g) || []).length;
    const mountCount = (src.match(/id="detailTreeMetaMount"/g) || []).length;
    assert.equal(sectionCount, 1, label + ' sidebar must declare one detailTreeMetaSection');
    assert.equal(mountCount, 1, label + ' sidebar must declare one detailTreeMetaMount');
    assert.match(src, /data-appreciation-region="tree-scope"/);
    assert.match(src, /data-appreciation-layout="tree-scope-rail"/);
    // Selected-moment nodes must not live in the left rail.
    assert.doesNotMatch(src, /id="detailCurrentMomentTitle"/);
    assert.doesNotMatch(src, /id="detailMemo"/);
    assert.doesNotMatch(src, /id="momentReactionsCard"/);
  }
});

test('#3562 thin moment wrappers do not embed tree-scope markup', () => {
  const owner = read(OWNER_MOMENT);
  const pub = read(PUBLIC_MOMENT);
  assert.doesNotMatch(owner, /id="detailTreeMetaMount"/);
  assert.doesNotMatch(pub, /id="detailTreeMetaMount"/);
  assert.match(owner, /LoveBudCanonicalAppreciationDetailPresentation/);
  assert.match(pub, /LoveBudCanonicalAppreciationDetailPresentation/);
});

test('#3562 controllers still resolve tree meta by stable left-rail id', () => {
  const editorUi = read('js/editor/editor-detail-ui.js');
  const publicUi = read('js/viewer/public-viewer-detail-ui.js');
  assert.match(editorUi, /getElementById\(['"]detailTreeMetaMount['"]\)/);
  assert.match(publicUi, /getElementById\(['"]detailTreeMetaMount['"]\)/);
  // Right-rail reset must not clear left-rail tree-scope (regression of moment selection wiping tree social).
  assert.match(editorUi, /Tree-scope mount lives in the left rail/);
  assert.doesNotMatch(
    editorUi,
    /const treeMetaMount = document\.getElementById\('detailTreeMetaMount'\);\s*if \(treeMetaMount\) treeMetaMount\.innerHTML = '';/
  );
});

test('#3562 right-rail heading is selected-moment scope', () => {
  const editorUi = read('js/editor/editor-detail-ui.js');
  const publicUi = read('js/viewer/public-viewer-detail-ui.js');
  assert.match(editorUi, /선택한 순간/);
  assert.match(publicUi, /선택한 순간/);
});

test('#3562 public tree-meta uniqueness helpers still use single mount boundary', () => {
  const treeMeta = read('js/viewer/public-viewer-detail-tree-meta.js');
  assert.match(treeMeta, /function renderTreeMetaBoundary|const renderTreeMetaBoundary/);
  assert.match(treeMeta, /treeCommentsControlEl/);
  assert.match(treeMeta, /shareButtonEl/);
  // Whole-tree comments panel is attached under tree meta block, not moment card.
  assert.match(treeMeta, /treeCommentsPanelEl/);
  assert.match(treeMeta, /actionsRow\.appendChild\(shareButtonEl\)|if \(shareButtonEl\) actionsRow\.appendChild/);
});

test('#3562 responsive CSS keeps public tree-scope rail available', () => {
  const css = read('css/editor/editor-sidebar.css');
  assert.match(css, /data-appreciation-layout="tree-scope-rail"/);
  // Must not hard-hide tree-scope public rail at tablet.
  assert.match(css, /public-viewer-sidebar\[data-appreciation-layout="tree-scope-rail"\]/);
  assert.match(css, /display:\s*flex\s*!important/);
});

test('#3562 does not reopen closed social issues or implement #3563 twice', () => {
  const self = fs.readFileSync(
    path.join(ROOT, 'tests/contracts/canonical-appreciation-panel-hierarchy-3562-contract.test.cjs'),
    'utf8'
  );
  const header = self.slice(0, 900);
  assert.match(header, /#3075 is CLOSED \/ completed/);
  assert.match(header, /#3188 is CLOSED \/ completed/);
  assert.match(header, /Keep #3425 OPEN/);
  assert.match(header, /Keep #1882 OPEN/);
  assert.equal(header.includes('Keep #' + '3075 OPEN'), false);
  assert.equal(header.includes('Keep #' + '3188 OPEN'), false);
});

test('#3561 geometry guard remains intact', () => {
  const css = read('css/editor/editor-memory-node.css');
  assert.doesNotMatch(
    css,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i
  );
  assert.match(css, /min-width:\s*108px/);
});

test('#3563 My Trees two-action model remains (no third public-view action)', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('myTreesHubOpenBtn'));
  assert.ok(html.includes('myTreesHubEditBtn'));
  assert.ok(html.includes('myTreesHubShareBtn'));
  assert.ok(!html.includes('공개 화면 보기'));
  assert.ok(!html.includes('myTreesHubPublicViewBtn'));
});
