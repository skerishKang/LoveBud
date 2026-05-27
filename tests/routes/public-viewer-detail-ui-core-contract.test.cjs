const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getViewHtml() {
  return fs.readFileSync('pages/view.html', 'utf8');
}

function getScriptSrcs() {
  const html = getViewHtml();
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => String(match[1] || '').split('?')[0]);
}

function indexOfScript(scripts, needle) {
  return scripts.findIndex((src) => src.includes(needle));
}

test('public viewer loads detail UI through the viewer adapter layer', () => {
  const scripts = getScriptSrcs();
  const detailTreeMetaIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-tree-meta.js');
  const detailBuildersIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-builders.js');
  const editorDetailUiIndex = indexOfScript(scripts, 'js/editor/editor-detail-ui.js');
  const viewerDetailUiIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-ui.js');
  const channelLinkIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-channel-link.js');

  assert.notEqual(detailTreeMetaIndex, -1, 'viewer tree meta helper is loaded');
  assert.notEqual(detailBuildersIndex, -1, 'viewer detail builders helper is loaded');
  assert.notEqual(editorDetailUiIndex, -1, 'editor detail UI core is still loaded for now');
  assert.notEqual(viewerDetailUiIndex, -1, 'viewer detail UI adapter is loaded');
  assert.notEqual(channelLinkIndex, -1, 'viewer channel link helper is loaded');
  assert.ok(detailTreeMetaIndex < editorDetailUiIndex, 'tree meta helper loads before detail UI core');
  assert.ok(detailBuildersIndex < editorDetailUiIndex, 'detail builders helper loads before detail UI core');
  assert.ok(editorDetailUiIndex < viewerDetailUiIndex, 'viewer detail UI adapter loads after detail UI core');
  assert.ok(viewerDetailUiIndex < channelLinkIndex, 'channel link helper loads after viewer detail adapter');
});

test('public canvas init uses the viewer detail UI adapter factory', () => {
  const source = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(source.includes('typeof window.createPublicViewerDetailUI === \'function\''), 'public canvas init waits for the viewer detail adapter');
  assert.ok(source.includes('window.createPublicViewerDetailUI({'), 'public canvas init creates detail UI through the viewer adapter');
  assert.equal(
    source.includes('typeof window.createEditorDetailUIBuilders === \'function\''),
    false,
    'public canvas init does not wait on a builder helper it does not call directly'
  );
  assert.equal(source.includes('window.createEditorDetailUI({'), false, 'public canvas init does not call the editor detail factory directly');
  assert.equal(source.includes('window.createEditorDetailTreeMetaBoundary({'), false, 'public canvas init does not create an unused tree meta boundary');
});

test('public viewer detail UI adapter owns focus selected button updates', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createPublicViewerDetailUI(deps)'), 'viewer detail adapter exposes createPublicViewerDetailUI');
  assert.ok(source.includes('window.createEditorDetailUI(deps)'), 'viewer detail adapter delegates to current detail UI core');
  assert.ok(source.includes('function createPublicViewerUpdateFocusSelectedBtn(deps)'), 'viewer detail adapter exposes focus updater factory');
  assert.ok(source.includes('detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps)'), 'viewer detail adapter assigns focus updater');
  assert.ok(source.includes('document.getElementById(\'focusSelectedBtn\')'), 'viewer focus updater targets focusSelectedBtn');
  assert.ok(source.includes('btn.classList.toggle(\'is-disabled\', !hasSelection)'), 'viewer focus updater preserves disabled class behavior');
  assert.ok(source.includes('window.createPublicViewerDetailUI = createPublicViewerDetailUI'), 'viewer detail adapter publishes the public factory');
  assert.ok(source.includes('LoveBudPublicViewerDetailUI'), 'viewer detail adapter exposes an inspectable namespace');
});

test('public viewer detail UI adapter owns sidebar status as noop', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function updatePublicViewerSidebarStatus() {}'), 'viewer adapter exposes a sidebar status noop');
  assert.ok(source.includes('detailUI.updateSidebarStatus = updatePublicViewerSidebarStatus'), 'viewer adapter assigns sidebar status noop');
  assert.ok(source.includes('updatePublicViewerSidebarStatus: updatePublicViewerSidebarStatus'), 'viewer adapter publishes sidebar status noop for inspection');
});

test('public viewer detail UI adapter owns empty state', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createPublicViewerSetDetailEmptyState(deps)'), 'viewer adapter exposes empty state factory');
  assert.ok(source.includes('detailUI.setDetailEmptyState = createPublicViewerSetDetailEmptyState(deps)'), 'viewer adapter overrides setDetailEmptyState');
  assert.ok(source.includes('LoveBudPublicViewerDetailUI'), 'viewer adapter exposes the inspectable namespace');
  assert.ok(source.includes('createPublicViewerSetDetailEmptyState'), 'viewer adapter publishes empty state factory on namespace');
});

test('public viewer detail UI adapter exposes current moment badge boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
  const boundaryStart = source.indexOf('function createPublicViewerCurrentMomentBadgeBoundary(deps)');
  const boundaryEnd = source.indexOf('function updatePublicViewerCurrentMomentHint()');
  const boundarySource = source.slice(boundaryStart, boundaryEnd);

  assert.notEqual(boundaryStart, -1, 'viewer adapter exposes current moment badge boundary factory');
  assert.notEqual(boundaryEnd, -1, 'viewer adapter keeps hint boundary after badge boundary');
  assert.ok(source.includes('createPublicViewerCurrentMomentBadgeBoundary: createPublicViewerCurrentMomentBadgeBoundary'), 'viewer adapter publishes badge boundary on namespace');
  assert.ok(boundarySource.includes('detailCurrentMomentBadge'), 'badge boundary targets the current moment badge mount');
  assert.ok(boundarySource.includes('waiting_first_moment'), 'badge boundary covers waiting first moment state');
  assert.ok(boundarySource.includes('start_moment'), 'badge boundary covers root moment state');
  assert.ok(boundarySource.includes('selected_moment'), 'badge boundary covers selected moment state');
});

test('public viewer detail UI adapter owns current moment hint boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
  const boundaryStart = source.indexOf('function updatePublicViewerCurrentMomentHint()');
  const boundaryEnd = source.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  const boundarySource = source.slice(boundaryStart, boundaryEnd);

  assert.notEqual(boundaryStart, -1, 'viewer adapter exposes current moment hint boundary');
  assert.notEqual(boundaryEnd, -1, 'viewer adapter keeps image boundary after hint boundary');
  assert.ok(source.includes('updatePublicViewerCurrentMomentHint: updatePublicViewerCurrentMomentHint'), 'viewer adapter publishes hint boundary on namespace');
  assert.ok(boundarySource.includes('detailCurrentMomentHint'), 'hint boundary targets the current moment hint mount');
  assert.ok(boundarySource.includes("hintEl.textContent = ''"), 'hint boundary clears hint text');
  assert.ok(boundarySource.includes('hintEl.hidden = true'), 'hint boundary hides the hint mount');
});

test('public viewer detail UI adapter owns current moment image boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
  const boundaryStart = source.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  const boundaryEnd = source.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundarySource = source.slice(boundaryStart, boundaryEnd);

  assert.notEqual(boundaryStart, -1, 'viewer adapter exposes current moment image boundary factory');
  assert.notEqual(boundaryEnd, -1, 'viewer adapter keeps image boundary before reactions boundary');
  assert.ok(source.includes('createPublicViewerCurrentMomentImageBoundary: createPublicViewerCurrentMomentImageBoundary'), 'viewer adapter publishes image boundary on namespace');
  assert.ok(boundarySource.includes('resolveMemoryThumbnail'), 'image boundary uses injected thumbnail resolver');
  assert.ok(boundarySource.includes('detailImg'), 'image boundary targets the detail image mount');
  assert.ok(boundarySource.includes('imgEl.src = resolveMemoryThumbnail(data);'), 'image boundary sets image src from resolver');
  assert.ok(boundarySource.includes("imgEl.alt = isEmptyState ? '' : ((data && data.title) || '')"), 'image boundary sets alt text consistently');
});

test('public viewer detail UI adapter exposes read-only reaction summary boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
  const boundaryStart = source.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = source.indexOf('function createPublicViewerDetailUI(deps)');
  const boundarySource = source.slice(boundaryStart, boundaryEnd);

  assert.notEqual(boundaryStart, -1, 'viewer adapter exposes read-only reactions boundary factory');
  assert.notEqual(boundaryEnd, -1, 'viewer adapter keeps the public detail factory after the reactions boundary');
  assert.ok(source.includes('createPublicViewerReadOnlyReactionSummaryBoundary: createPublicViewerReadOnlyReactionSummaryBoundary'), 'viewer adapter publishes read-only reactions boundary on namespace');
  assert.ok(boundarySource.includes('fetchReactionSummary'), 'read-only reactions boundary may fetch summary data');
  assert.equal(boundarySource.includes('toggleReaction'), false, 'read-only reactions boundary must not write reaction state');
  assert.equal(boundarySource.includes('from=editor'), false, 'read-only reactions boundary must not navigate through editor detail context');
});

test('public viewer detail UI adapter wraps detail panel updates with viewer-owned post-processing', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('var delegatedUpdateDetailPanel = typeof detailUI.updateDetailPanel === \'function\''), 'viewer adapter captures delegated detail panel update');
  assert.ok(source.includes('var updateCurrentMomentBadge = createPublicViewerCurrentMomentBadgeBoundary(deps)'), 'viewer adapter creates the badge updater');
  assert.ok(source.includes('var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps)'), 'viewer adapter creates the image updater');
  assert.ok(source.includes('var updateReadOnlyReactionSummary = createPublicViewerReadOnlyReactionSummaryBoundary(deps)'), 'viewer adapter creates the read-only reaction updater');
  assert.ok(source.includes('detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data)'), 'viewer adapter wraps updateDetailPanel for public viewer');
  assert.ok(source.includes('delegatedUpdateDetailPanel(data);'), 'viewer wrapper runs delegated detail rendering first');
  assert.ok(source.includes('updateCurrentMomentBadge(data);'), 'viewer wrapper applies badge post-processing after delegated rendering');
  assert.ok(source.includes('updatePublicViewerCurrentMomentHint();'), 'viewer wrapper applies hint post-processing after badge post-processing');
  assert.ok(source.includes('updateCurrentMomentImage(data);'), 'viewer wrapper applies image post-processing after hint post-processing');
  assert.ok(source.includes('updateReadOnlyReactionSummary(data);'), 'viewer wrapper applies read-only reactions after image post-processing');
});

test('public viewer keeps extracted detail helpers on viewer-owned paths', () => {
  const scripts = getScriptSrcs();

  [
    '../js/editor/editor-detail-tree-meta.js',
    '../js/editor/editor-detail-ui-builders.js',
    '../js/editor/editor-detail-inline-edit.js',
    '../js/editor/editor-detail-sidebar-status-boundary.js',
    '../js/editor/editor-detail-channel-link.js'
  ].forEach((src) => {
    assert.equal(scripts.includes(src), false, `unexpected public-view script: ${src}`);
  });
});

test('editor detail UI core contract remains explicit for future viewer renderer replacement', () => {
  const source = fs.readFileSync('js/editor/editor-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createEditorDetailUI(deps)'), 'detail UI core exposes createEditorDetailUI factory');
  assert.ok(source.includes('window.createEditorDetailUI = createEditorDetailUI'), 'detail UI core publishes factory on window');
  assert.ok(source.includes('setDetailEmptyState'), 'detail UI core return contract includes setDetailEmptyState');
  assert.ok(source.includes('updateFocusSelectedBtn'), 'detail UI core return contract includes updateFocusSelectedBtn');
  assert.ok(source.includes('updateSidebarStatus'), 'detail UI core return contract includes updateSidebarStatus');
  assert.ok(source.includes('updateDetailPanel'), 'detail UI core return contract includes updateDetailPanel');
  assert.ok(source.includes('toggleReaction'), 'editor detail core still owns full reaction write behavior');
  assert.ok(source.includes('from=editor'), 'editor detail core still owns editor detail navigation context');
  assert.ok(source.includes('window.createEditorDetailTreeMetaBoundary'), 'detail UI core depends on tree meta boundary');
  assert.ok(source.includes('window.createEditorDetailUIBuilders'), 'detail UI core depends on detail UI builders');
  assert.ok(source.includes('window.createEditorDetailInlineEditBoundary'), 'detail UI core depends on inline edit boundary fallback');
  assert.ok(source.includes('window.createEditorDetailSidebarStatusBoundary'), 'detail UI core depends on sidebar status boundary fallback');
});
