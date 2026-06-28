const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Detail View Mode template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-detail-view-mode-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="detailViewMode"'), 'must include detail view mode root id');
    assert.ok(helperCode.includes('id="detailTreeMetaMount"'), 'must include detail tree meta mount id');
    assert.ok(helperCode.includes('class="editor-tree-meta-section"'), 'must include editor-tree-meta-section class (tree context card)');
    // Tree meta section should be OUTSIDE detailViewMode (persistent tree context)
    const treeMetaIndex = helperCode.indexOf('class="editor-tree-meta-section"');
    const viewModeIndex = helperCode.indexOf('id="detailViewMode"');
    assert.ok(treeMetaIndex !== -1 && viewModeIndex !== -1, 'both tree meta section and detailViewMode must exist');
    assert.ok(treeMetaIndex < viewModeIndex, 'tree meta section must appear before detailViewMode in template (persistent tree context)');

    assert.ok(helperCode.includes('id="detailCurrentMomentBadge"'), 'must include badge id');
    assert.ok(helperCode.includes('id="editMemoryBtn"'), 'must include edit btn id');
    assert.ok(helperCode.includes('id="detailCurrentMomentTitle"'), 'must include title id');
    assert.ok(helperCode.includes('id="detailCurrentMomentHint"'), 'must include hint id');
    assert.ok(helperCode.includes('id="detailImg"'), 'must include image id');
    assert.ok(helperCode.includes('id="viewMomentDetailBtn"'), 'must include view btn id');
    assert.ok(helperCode.includes('id="continueFromMomentBtn"'), 'must include continue btn id');
    assert.ok(helperCode.includes('id="detailTags"'), 'must include tags id');
    assert.ok(helperCode.includes('id="detailMemo"'), 'must include memo id');
    assert.ok(helperCode.includes('id="saveStatusIndicator"'), 'must include save status indicator id');
    assert.ok(helperCode.includes('id="saveStatusText"'), 'must include save status text id');
    assert.ok(helperCode.includes('id="lastSavedTime"'), 'must include last saved time id');

    assert.ok(helperCode.includes('class="editor-hidden-initial"'), 'must include editor-hidden-initial class');
    assert.match(helperCode, /id="detailViewMode"[^>]*style="display:\s*none;"/, 'detail view mode root must be initially hidden');
    assert.ok(helperCode.includes('class="editor-current-moment-card"'), 'must include editor-current-moment-card class');
    assert.ok(helperCode.includes('class="editor-moment-actions-card"'), 'must include editor-moment-actions-card class');
    assert.ok(helperCode.includes('class="editor-moment-info-card"'), 'must include editor-moment-info-card class');
    assert.ok(helperCode.includes('class="editor-save-status-card"'), 'must include editor-save-status-card class');

    assert.ok(helperCode.includes('editorDetailViewModeTemplateMount'), 'must find mount element');
});

test('editor.html uses template mount and removes raw detail view mode markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the shell mount anchor (inner mounts are inside the shell helper)
    // assert.ok(html.includes('id="editorDetailViewModeTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like detailCurrentMomentTitle in the raw HTML anymore
    assert.ok(!html.includes('id="detailCurrentMomentTitle"'), 'raw HTML should not contain detail current moment title');
    assert.ok(!html.includes('id="saveStatusIndicator"'), 'raw HTML should not contain save status indicator');
    assert.ok(!html.includes('id="detailViewMode"'), 'raw HTML should not contain detail view mode wrapper directly');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const topbarHelperIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const emptyGuideHelperIndex = html.indexOf('js/editor/templates/editor-empty-guide-template.js');
    const floatingToolbarHelperIndex = html.indexOf('js/editor/templates/editor-floating-toolbar-template.js');
    const detailEmptyStateHelperIndex = html.indexOf('js/editor/templates/editor-detail-empty-state-template.js');
    const detailViewModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-view-mode-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(detailEmptyStateHelperIndex, -1, 'editor.html must still load the detail empty state helper script');
    assert.notEqual(detailViewModeHelperIndex, -1, 'editor.html must load the new detail view mode helper script');

    assert.ok(detailViewModeHelperIndex < domSelectorsIndex, 'detail view mode helper must load before dom selectors');
    assert.ok(detailViewModeHelperIndex < editorJsIndex, 'detail view mode helper must load before js/editor.js');
    assert.ok(detailEmptyStateHelperIndex < detailViewModeHelperIndex, 'detail empty state helper usually loads before detail view mode helper for consistency');
});
