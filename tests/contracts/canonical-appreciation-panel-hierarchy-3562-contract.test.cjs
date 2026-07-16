/**
 * Contract: LoveBud #3562 — tree-scope vs selected-moment hierarchy (runtime-proven).
 *
 * Keep #3425 OPEN. Keep #1882 OPEN.
 * #3075 is CLOSED / completed. Do not reopen.
 * #3188 is CLOSED / completed. Do not reopen.
 * Refs #3563 — CLOSED / completed; do not reopen.
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
const EDITOR_DETAIL_UI = 'js/editor/editor-detail-ui.js';
const SIDEBAR_CSS = 'css/editor/editor-sidebar.css';
const TABLET_CSS = 'css/editor/editor-responsive/tablet.css';

function loadShared() {
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read(SHARED), ctx);
  return ctx.window.LoveBudCanonicalAppreciationDetailPresentation;
}

function runSidebarBuilder(relPath, exportName) {
  const api = loadShared();
  let src = read(relPath);
  src = src.replace(/export\s+function/, 'function');
  // Drop auto-mount side effect
  src = src.replace(/\nconst mount = document[\s\S]*$/, '\n');
  const sandbox = {
    window: {
      LoveBudCanonicalAppreciationDetailPresentation: api
    },
    document: {
      getElementById: function () {
        return null;
      }
    },
    console
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '; this.__html = ' + exportName + '();', sandbox);
  return {
    html: String(sandbox.__html || ''),
    builderShell: api.buildTreeScopeShellHtml({
      authority: exportName.indexOf('Public') >= 0 ? 'public-safe' : 'owner'
    })
  };
}

test('#3562 route sidebars call shared tree-scope builder (no hard-coded section markup)', () => {
  const ownerSrc = read(OWNER_SIDEBAR);
  const publicSrc = read(PUBLIC_SIDEBAR);
  for (const [label, src] of [
    ['owner', ownerSrc],
    ['public', publicSrc]
  ]) {
    assert.match(src, /buildTreeScopeShellHtml/, label + ' must call shared buildTreeScopeShellHtml');
    assert.match(src, /LoveBudCanonicalAppreciationDetailPresentation/, label + ' must reference shared builder');
    // Must not hard-code the tree-scope section shell in the route template.
    assert.doesNotMatch(
      src,
      /id="detailTreeMetaSection"/,
      label + ' must not hard-code detailTreeMetaSection markup'
    );
    assert.doesNotMatch(
      src,
      /id="detailTreeMetaMount"/,
      label + ' must not hard-code detailTreeMetaMount markup'
    );
    assert.doesNotMatch(
      src,
      /data-canonical-section="tree-scope"/,
      label + ' must not hard-code tree-scope attributes'
    );
  }
});

test('#3562 EXECUTED: owner and public sidebar HTML contain shared builder tree-scope output', () => {
  const owner = runSidebarBuilder(OWNER_SIDEBAR, 'buildSidebarTemplate');
  const pub = runSidebarBuilder(PUBLIC_SIDEBAR, 'buildPublicSidebarTemplate');

  assert.ok(owner.html.length > 100, 'owner sidebar must produce HTML');
  assert.ok(pub.html.length > 100, 'public sidebar must produce HTML');

  // Shared builder marker proves runtime source, not a copied string in the route file.
  assert.match(owner.html, /data-tree-scope-source="LoveBudCanonicalAppreciationDetailPresentation"/);
  assert.match(pub.html, /data-tree-scope-source="LoveBudCanonicalAppreciationDetailPresentation"/);
  assert.match(owner.html, /data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation"/);
  assert.match(pub.html, /data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation"/);

  // Exact shared shell content is embedded (not a route-owned alternate).
  assert.ok(
    owner.html.includes(owner.builderShell),
    'owner sidebar must embed exact shared tree-scope shell HTML'
  );
  assert.ok(
    pub.html.includes(pub.builderShell),
    'public sidebar must embed exact shared tree-scope shell HTML'
  );

  // Unique IDs once per sidebar output
  assert.equal((owner.html.match(/id="detailTreeMetaSection"/g) || []).length, 1);
  assert.equal((owner.html.match(/id="detailTreeMetaMount"/g) || []).length, 1);
  assert.equal((pub.html.match(/id="detailTreeMetaSection"/g) || []).length, 1);
  assert.equal((pub.html.match(/id="detailTreeMetaMount"/g) || []).length, 1);

  // Authority projection on shell
  assert.match(owner.html, /data-route-authority="owner"/);
  assert.match(pub.html, /data-route-authority="public-safe"/);

  // Selected-moment content not in left rail
  assert.doesNotMatch(owner.html, /id="detailCurrentMomentTitle"/);
  assert.doesNotMatch(pub.html, /id="momentReactionsCard"/);
  assert.doesNotMatch(pub.html, /id="editMemoryBtn"/);
});

test('#3562 EXECUTED: selected-moment shell has no tree-level nodes', () => {
  const api = loadShared();
  const moment = api.buildDetailViewModeHtml({ authority: 'public-safe' });
  const ownerMoment = api.buildDetailViewModeHtml({ authority: 'owner' });
  for (const html of [moment, ownerMoment]) {
    assert.doesNotMatch(html, /id="detailTreeMetaMount"/);
    assert.doesNotMatch(html, /id="detailTreeMetaSection"/);
    assert.doesNotMatch(html, /data-canonical-section="tree-meta"/);
    assert.match(html, /data-appreciation-region="selected-moment"/);
  }
  assert.match(ownerMoment, /id="editMemoryBtn"/);
  assert.doesNotMatch(moment, /id="editMemoryBtn"/);
});

test('#3562 pages load shared builder before sidebar modules', () => {
  const editorHtml = read('pages/editor.html');
  const viewHtml = read('pages/view.html');
  const eShared = editorHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const eSide = editorHtml.indexOf('editor-sidebar-template.js');
  const vShared = viewHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const vSide = viewHtml.indexOf('public-viewer-sidebar-template.js');
  assert.ok(eShared >= 0 && eSide > eShared, 'editor: shared builder before owner sidebar');
  assert.ok(vShared >= 0 && vSide > vShared, 'view: shared builder before public sidebar');
});

test('#3562 empty/no-selection owner path renders tree scope before empty return', () => {
  const src = read(EDITOR_DETAIL_UI);
  // Tree meta model/render must appear before isEmptyState early-return body effects.
  const modelIdx = src.indexOf('buildTreeMetaRenderModel');
  const renderIdx = src.indexOf('renderTreeMetaBoundary(treeMetaMount');
  const emptyReturnBlock = src.indexOf('if (isEmptyState)');
  // First model+render for updateDetailPanel must precede the empty-state return.
  // Find the updateDetailPanel function body region.
  const updateIdx = src.indexOf('const updateDetailPanel = (data)');
  assert.ok(updateIdx >= 0, 'updateDetailPanel must exist');
  const body = src.slice(updateIdx, updateIdx + 3500);
  const bodyModel = body.indexOf('buildTreeMetaRenderModel');
  const bodyRender = body.indexOf('renderTreeMetaBoundary(treeMetaMount');
  const bodyEmpty = body.indexOf('if (isEmptyState)');
  assert.ok(bodyModel >= 0 && bodyRender >= 0 && bodyEmpty >= 0, 'tree meta + empty branch present in updateDetailPanel');
  assert.ok(bodyModel < bodyEmpty, 'tree meta model must be built before isEmptyState return branch');
  assert.ok(bodyRender < bodyEmpty, 'tree meta must render before isEmptyState return branch');
});

test('#3562 EXECUTED empty-tree tree-meta model retains title/status without moment share', () => {
  // Execute editor tree-meta boundary with fake deps for empty tree.
  const treeMetaSrc = read('js/editor/editor-detail-tree-meta.js');
  const sandbox = {
    window: {},
    document: {
      createElement: function (tag) {
        const el = {
          tagName: String(tag).toUpperCase(),
          style: {},
          dataset: {},
          children: [],
          textContent: '',
          appendChild: function (c) {
            this.children.push(c);
            return c;
          },
          addEventListener: function () {},
          setAttribute: function () {},
          getAttribute: function () {
            return null;
          }
        };
        return el;
      },
      createTextNode: function (t) {
        return { textContent: String(t) };
      }
    },
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(treeMetaSrc, sandbox);
  assert.equal(typeof sandbox.window.createEditorDetailTreeMetaBoundary, 'function');
  const boundary = sandbox.window.createEditorDetailTreeMetaBoundary({
    i18n: function (k) {
      return k;
    },
    formatI18nText: function (_k, fb) {
      return fb;
    },
    resolveTreeTitleText: function (t) {
      return t || '빈 트리';
    },
    createInlineIcon: function () {
      return sandbox.document.createElement('span');
    },
    showToast: function () {},
    openCurrentMomentDetail: function () {},
    canEdit: true,
    openRenameTree: function () {},
    updateTreeVisibility: function () {},
    updateDetailPanel: function () {
      return function () {};
    }
  });
  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 't-empty', title: '빈 트리', visibility: 'private' },
    treeState: { totalMomentCount: 0, hasMoments: false },
    data: { isNewTree: true },
    isEmptyState: true,
    localSaveMode: false
  });
  assert.equal(model.displayTreeTitle, '빈 트리');
  assert.equal(model.isPublic, false);
  assert.ok(model.countLabel, 'empty tree status copy must exist');
  assert.equal(model.shareButtonEl, null, 'empty tree must not expose moment-dependent share');
  assert.equal(model.openDetailButtonEl, null, 'empty tree must not expose open-detail action');

  // Render into mount and ensure content exists
  const mount = { innerHTML: '', children: [], appendChild: function (c) { this.children.push(c); this.innerHTML = 'filled'; } };
  boundary.renderTreeMetaBoundary(mount, model, 't-empty', { isNewTree: true });
  assert.equal(mount.innerHTML, 'filled');
  assert.ok(mount.children.length >= 1, 'tree meta block must be appended for empty tree');
});

test('#3562 Option A responsive CSS resets public detail off-canvas at tablet', () => {
  const css = read(SIDEBAR_CSS);
  const tablet = read(TABLET_CSS);
  // Confirm conflict source still exists (tablet off-canvas) so our reset is meaningful.
  assert.match(tablet, /transform:\s*translateX\(100%\)/);
  assert.match(tablet, /\.detail-panel\s*\{[\s\S]*?position:\s*fixed/);

  // Public tree-scope layout explicitly resets off-canvas properties.
  assert.match(css, /public-viewer-sidebar\[data-appreciation-layout="tree-scope-rail"\]/);
  assert.match(css, /position:\s*relative\s*!important/);
  assert.match(css, /transform:\s*none\s*!important/);
  assert.match(css, /height:\s*auto\s*!important/);
  assert.match(css, /z-index:\s*auto\s*!important/);
  // Semantic order markers
  assert.match(css, /order:\s*-1/);
  assert.match(css, /order:\s*0/);
  assert.match(css, /order:\s*1/);
});

test('#3562 pages do not hard-hide public tree-scope rail', () => {
  const css = read(SIDEBAR_CSS);
  // Legacy hide only applies without tree-scope-rail.
  assert.match(css, /public-viewer-sidebar:not\(\[data-appreciation-layout="tree-scope-rail"\]\)/);
});

test('#3561 geometry guard remains', () => {
  const css = read('css/editor/editor-memory-node.css');
  assert.doesNotMatch(
    css,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i
  );
});

test('#3563 selected-moment sections remain shared across authority', () => {
  const api = loadShared();
  const owner = Array.from(api.listCanonicalSections(api.buildDetailViewModeHtml({ authority: 'owner' }))).map(String);
  const pub = Array.from(api.listCanonicalSections(api.buildDetailViewModeHtml({ authority: 'public-safe' }))).map(String);
  assert.equal(owner.join('|'), pub.join('|'));
  assert.equal(owner.join('|'), 'selected-moment|moment-info|moment-social');
});

test('#3562 closed-issue hygiene header', () => {
  const self = fs.readFileSync(
    path.join(ROOT, 'tests/contracts/canonical-appreciation-panel-hierarchy-3562-contract.test.cjs'),
    'utf8'
  );
  const header = self.slice(0, 700);
  assert.match(header, /#3075 is CLOSED \/ completed/);
  assert.match(header, /#3188 is CLOSED \/ completed/);
  assert.match(header, /Keep #3425 OPEN/);
  assert.match(header, /Keep #1882 OPEN/);
  assert.equal(header.includes('Keep #' + '3075 OPEN'), false);
});
