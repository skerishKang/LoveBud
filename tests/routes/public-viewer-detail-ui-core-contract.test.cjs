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
  const viewerDetailUiIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-ui.js');
  const channelLinkIndex = indexOfScript(scripts, 'js/viewer/public-viewer-detail-channel-link.js');

  assert.notEqual(detailTreeMetaIndex, -1, 'viewer tree meta helper is loaded');
  assert.notEqual(detailBuildersIndex, -1, 'viewer detail builders helper is loaded');
  assert.notEqual(viewerDetailUiIndex, -1, 'viewer detail UI adapter is loaded');
  assert.notEqual(channelLinkIndex, -1, 'viewer channel link helper is loaded');
  assert.equal(scripts.some(function(s) { return s.includes('js/editor/editor-detail-ui.js'); }), false, 'editor detail UI core is no longer loaded');
  assert.ok(detailTreeMetaIndex < viewerDetailUiIndex, 'tree meta helper loads before viewer detail UI adapter');
  assert.ok(detailBuildersIndex < viewerDetailUiIndex, 'detail builders helper loads before viewer detail UI adapter');
  assert.ok(viewerDetailUiIndex < channelLinkIndex, 'channel link helper loads after viewer detail adapter');
});

test('public canvas init uses the viewer detail UI adapter factory', () => {
  const source = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(source.includes('typeof window.createPublicViewerDetailUI === \'function\''), 'public canvas init waits for the viewer detail adapter');
  assert.ok(source.includes('window.createPublicViewerDetailUI(detailUIOptions)'), 'public canvas init creates detail UI through the viewer adapter with delegated options');
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
  assert.ok(source.includes("var detailUI = {};"), 'viewer detail adapter creates its own detail UI object');
  assert.equal(source.includes('window.createEditorDetailUI(deps)'), false, 'viewer detail adapter no longer constructs through editor detail factory');
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

  assert.ok(
    source.includes("document.getElementById('detailContent')"),
    'empty-state boundary keeps detailContent lookup'
  );

  assert.ok(
    source.includes("document.getElementById('detailEmptyState')"),
    'empty-state boundary keeps detailEmptyState lookup'
  );

  assert.ok(
    source.includes("document.getElementById('detailViewMode')"),
    'empty-state boundary keeps detailViewMode lookup'
  );

  assert.equal(
    source.includes("document.getElementById('detailPanelFooter')"),
    false,
    'public viewer detail adapter should not reference detailPanelFooter'
  );
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
  assert.ok(boundarySource.includes('resolveMemoryThumbnail(data)'), 'image boundary uses resolver with data');
  assert.ok(boundarySource.includes('imgEl.src ='), 'image boundary sets image src');
  assert.ok(boundarySource.includes('imgEl.alt = isEmptyState ?'), 'image boundary handles empty state alt');
  assert.ok(boundarySource.includes('safeAlt'), 'image boundary uses safeDisplayTitle guard for alt text');
  assert.ok(source.includes('function safeDisplayTitle(title)'), 'viewer detail adapter exposes safeDisplayTitle helper');
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

test('public viewer detail UI adapter renders tree meta after heading boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createPublicViewerTreeMetaBoundary(deps)'), 'viewer adapter exposes tree meta boundary factory');
  assert.ok(source.includes('window.createEditorDetailTreeMetaBoundary'), 'viewer adapter uses the viewer-provided tree meta boundary');
  assert.ok(source.includes('detailTreeMetaMount'), 'tree meta boundary targets detailTreeMetaMount');
  assert.ok(source.includes('boundary.buildTreeMetaRenderModel'), 'tree meta boundary builds the render model');
  assert.ok(source.includes('boundary.renderTreeMetaBoundary'), 'tree meta boundary renders the model');
  assert.ok(source.includes('createPublicViewerTreeMetaBoundary: createPublicViewerTreeMetaBoundary'), 'viewer adapter publishes tree meta boundary factory');

  const panelStart = source.indexOf('detailUI.updateDetailPanel = function');
  const panelEnd = source.indexOf('};', panelStart);
  const panelSource = source.slice(panelStart, panelEnd);

  const headingIndex = panelSource.indexOf('updateDetailHeading();');
  const treeMetaIndex = panelSource.indexOf('updateTreeMeta(data);');
  const badgeIndex = panelSource.indexOf('updateCurrentMomentBadge(data);');

  assert.notEqual(headingIndex, -1, 'heading update is present');
  assert.ok(headingIndex < treeMetaIndex, 'tree meta runs after heading update');
  assert.ok(treeMetaIndex < badgeIndex, 'tree meta runs before badge post-processing');
});

test('public viewer detail UI adapter renders channel link via viewer namespace', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function updatePublicViewerDetailChannelLink(data)'), 'viewer adapter exposes channel link updater');
  assert.ok(source.includes('window.LoveBudPublicViewerDetailChannelLink'), 'viewer adapter reads channel link helper namespace');
  assert.ok(source.includes('helper.renderDetailChannelLink(data)'), 'viewer adapter delegates channel link rendering to helper');
  assert.ok(source.includes('updatePublicViewerDetailChannelLink(data);'), 'viewer adapter runs channel link update in detail panel flow');
  assert.ok(source.includes('updatePublicViewerDetailChannelLink: updatePublicViewerDetailChannelLink'), 'viewer adapter publishes channel link updater');

  const panelStart = source.indexOf('detailUI.updateDetailPanel = function');
  const panelEnd = source.indexOf('};', panelStart);
  const panelSource = source.slice(panelStart, panelEnd);

  const titleIndex = panelSource.indexOf('updateCurrentMomentTitle(data);');
  const channelLinkIndex = panelSource.indexOf('updatePublicViewerDetailChannelLink(data);');
  const hintIndex = panelSource.indexOf('updatePublicViewerCurrentMomentHint();');

  assert.ok(titleIndex < channelLinkIndex, 'channel link runs after title update');
  assert.ok(channelLinkIndex < hintIndex, 'channel link runs before hint update');
});

test('public viewer detail UI adapter does not bind removed selected action buttons', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.equal(
    source.includes('function createPublicViewerSelectedMomentActionsBoundary(deps)'),
    false,
    'viewer detail adapter should not expose selected action button boundary'
  );
  assert.equal(
    source.includes("document.getElementById('viewMomentDetailBtn')"),
    false,
    'viewer detail adapter should not target viewMomentDetailBtn'
  );
  assert.equal(
    source.includes("document.getElementById('continueFromMomentBtn')"),
    false,
    'viewer detail adapter should not target continueFromMomentBtn'
  );
  assert.equal(
    source.includes('installSelectedMomentActions'),
    false,
    'viewer detail adapter should not install selected action button handlers'
  );
  assert.equal(
    source.includes('openCurrentMomentDetail();'),
    false,
    'viewer detail adapter should not call openCurrentMomentDetail from a removed button handler'
  );
  assert.equal(
    source.includes('createPublicViewerSelectedMomentActionsBoundary: createPublicViewerSelectedMomentActionsBoundary'),
    false,
    'viewer detail adapter namespace should not publish removed selected action boundary'
  );
  assert.equal(
    source.includes("document.getElementById('addMemoryBtn')"),
    false,
    'viewer detail adapter must not reference addMemoryBtn'
  );
  assert.equal(
    source.includes("document.getElementById('canvasEmptyStartBtn')"),
    false,
    'viewer detail adapter must not reference canvasEmptyStartBtn'
  );
});

test('public viewer detail UI adapter does not bind removed memory action mounts', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.equal(
    source.includes('function createPublicViewerMemoryActionsBoundary(deps)'),
    false,
    'viewer detail adapter should not expose memory actions boundary'
  );
  assert.equal(
    source.includes("document.querySelector('.memory-actions')"),
    false,
    'viewer detail adapter should not target .memory-actions'
  );
  assert.equal(
    source.includes('var updateMemoryActions = createPublicViewerMemoryActionsBoundary(deps)'),
    false,
    'viewer detail adapter should not create memory action updater'
  );
  assert.equal(
    source.includes('updateMemoryActions(data);'),
    false,
    'viewer detail adapter should not run memory action updater'
  );
  assert.equal(
    source.includes('createPublicViewerMemoryActionsBoundary: createPublicViewerMemoryActionsBoundary'),
    false,
    'viewer detail adapter namespace should not publish removed memory actions boundary'
  );

  const panelStart = source.indexOf('detailUI.updateDetailPanel = function');
  const panelEnd = source.indexOf('};', panelStart);
  const panelSource = source.slice(panelStart, panelEnd);

  const reactionsIndex = panelSource.indexOf('updateReadOnlyReactionSummary(data);');

  assert.notEqual(reactionsIndex, -1, 'read-only reactions update remains present');
});

test('public viewer detail UI adapter owns visible detail heading boundary', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes('function createPublicViewerDetailHeadingBoundary(deps)'), 'viewer adapter exposes detail heading boundary factory');
  assert.ok(source.includes("detailPanel.querySelector('h3')"), 'heading boundary uses detailPanel h3 querySelector');
  assert.ok(source.includes("document.querySelector('#detailPanel h3')"), 'heading boundary has fallback selector');
  assert.ok(source.includes('editor_current_hub_heading'), 'heading boundary references editor_current_hub_heading i18n key');
  assert.ok(source.includes("'현재 순간 허브'"), 'heading boundary has explicit fallback text');
  assert.ok(source.includes('headerEl.textContent'), 'heading boundary uses textContent to set heading');
  assert.ok(source.includes('createPublicViewerDetailHeadingBoundary: createPublicViewerDetailHeadingBoundary'), 'viewer adapter publishes heading boundary on namespace');
  assert.ok(source.includes('var updateDetailHeading = createPublicViewerDetailHeadingBoundary(deps)'), 'viewer adapter creates heading updater');
  assert.ok(source.includes('updateDetailHeading();'), 'viewer adapter runs heading update in detail panel flow');

  const panelStart = source.indexOf('detailUI.updateDetailPanel = function');
  const panelEnd = source.indexOf('};', panelStart);
  const panelSource = source.slice(panelStart, panelEnd);

  assert.equal(panelSource.indexOf('delegatedUpdateDetailPanel(data);'), -1, 'no delegated detail render call remains in panel flow');
  const headingIndex = panelSource.indexOf('updateDetailHeading();');
  const treeMetaIndex = panelSource.indexOf('updateTreeMeta(data);');

  assert.notEqual(headingIndex, -1, 'heading update is present in panel flow');
  assert.ok(headingIndex < treeMetaIndex, 'heading update runs before tree meta post-processing');
});

test('public viewer detail UI adapter owns detail panel render flow', () => {
  const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

  assert.ok(source.includes("var detailUI = {};"), 'viewer adapter creates its own detail UI shell');
  assert.equal(source.includes('var delegatedUpdateDetailPanel'), false, 'viewer adapter no longer captures delegated detail panel renderer');
  assert.equal(source.includes('delegatedUpdateDetailPanel(data);'), false, 'viewer adapter no longer delegates detail panel rendering');
  assert.ok(source.includes('delegatesToEditorDetailUI: false'), 'viewer adapter marks editor detail delegation as removed');
  assert.ok(source.includes('var updateTreeMeta = createPublicViewerTreeMetaBoundary(deps)'), 'viewer adapter creates tree meta updater');
  assert.ok(source.includes('var updateCurrentMomentBadge = createPublicViewerCurrentMomentBadgeBoundary(deps)'), 'viewer adapter creates the badge updater');
  assert.ok(source.includes('var updateCurrentMomentImage = createPublicViewerCurrentMomentImageBoundary(deps)'), 'viewer adapter creates the image updater');
  assert.ok(source.includes('var updateReadOnlyReactionSummary = createPublicViewerReadOnlyReactionSummaryBoundary(deps)'), 'viewer adapter creates the read-only reaction updater');
  assert.ok(source.includes('var updateDetailHeading = createPublicViewerDetailHeadingBoundary(deps)'), 'viewer adapter creates heading updater');
  assert.ok(source.includes('detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data)'), 'viewer adapter owns the updateDetailPanel function');
  assert.ok(source.includes('updateDetailHeading();'), 'viewer flow starts with heading update');
  assert.ok(source.includes('updateTreeMeta(data);'), 'viewer flow applies tree meta post-processing');
  assert.ok(source.includes('updateCurrentMomentBadge(data);'), 'viewer flow applies badge post-processing');
  assert.ok(source.includes('updatePublicViewerCurrentMomentHint();'), 'viewer flow applies hint post-processing');
  assert.ok(source.includes('updateCurrentMomentImage(data);'), 'viewer flow applies image post-processing');
  assert.ok(source.includes('updateReadOnlyReactionSummary(data);'), 'viewer flow applies read-only reactions');
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
