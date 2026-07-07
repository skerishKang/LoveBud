const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Detail View Mode template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-detail-view-mode-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="detailViewMode"'), 'must include detail view mode root id');
    assert.ok(helperCode.includes('id="detailTreeMetaMount"'), 'must include detail tree meta mount id');
    assert.ok(helperCode.includes('id="detailCurrentMomentBadge"'), 'must include badge id');
    assert.ok(helperCode.includes('id="editMemoryBtn"'), 'must include edit btn id');
    assert.ok(helperCode.includes('id="detailCurrentMomentTitle"'), 'must include title id');
    assert.ok(helperCode.includes('id="detailCurrentMomentHint"'), 'must include hint id');
    assert.ok(helperCode.includes('id="detailImg"'), 'must include image id');
    assert.ok(helperCode.includes('id="viewMomentDetailBtn"'), 'must include view btn id');
    assert.ok(helperCode.includes('id="continueFromMomentBtn"'), 'must include continue btn id');
    assert.ok(helperCode.includes('id="detailTags"'), 'must include tags id');
    assert.ok(helperCode.includes('id="detailMemo"'), 'must include memo id');

    assert.ok(helperCode.includes('class="editor-hidden-initial"'), 'must include editor-hidden-initial class');
    assert.match(helperCode, /id="detailViewMode"[^>]*style="display:\s*none;"/, 'detail view mode root must be initially hidden');
    assert.ok(helperCode.includes('class="editor-current-moment-card"'), 'must include editor-current-moment-card class');
    assert.ok(helperCode.includes('class="editor-moment-actions-card"'), 'must include editor-moment-actions-card class');
    assert.ok(helperCode.includes('class="editor-moment-info-card"'), 'must include editor-moment-info-card class');

    assert.ok(helperCode.includes('editorDetailViewModeTemplateMount'), 'must find mount element');
});

test('Detail View Mode template must NOT contain the shared save-status markup', () => {
    const helperCode = fs.readFileSync('js/editor/templates/editor-detail-view-mode-template.js', 'utf8');

    assert.ok(!helperCode.includes('id="saveStatusIndicator"'), 'view-mode template must not contain saveStatusIndicator');
    assert.ok(!helperCode.includes('id="saveStatusText"'), 'view-mode template must not contain saveStatusText');
    assert.ok(!helperCode.includes('id="saveStatusIcon"'), 'view-mode template must not contain saveStatusIcon');
    assert.ok(!helperCode.includes('id="lastSavedTime"'), 'view-mode template must not contain lastSavedTime');
    assert.ok(!helperCode.includes('class="editor-save-status-card"'), 'view-mode template must not contain editor-save-status-card');
});

test('Detail Panel Shell template must contain the shared save-status markup exactly once', () => {
    const helperCode = fs.readFileSync('js/editor/templates/editor-detail-panel-shell-template.js', 'utf8');

    assert.ok(helperCode.includes('id="saveStatusIndicator"'), 'shell template must contain saveStatusIndicator');
    assert.ok(helperCode.includes('id="saveStatusText"'), 'shell template must contain saveStatusText');
    assert.ok(helperCode.includes('id="saveStatusIcon"'), 'shell template must contain saveStatusIcon');
    assert.ok(helperCode.includes('id="lastSavedTime"'), 'shell template must contain lastSavedTime');
    assert.ok(helperCode.includes('aria-live="polite"'), 'shell template must contain the single aria-live region');
    assert.ok(helperCode.includes('class="editor-save-status-card"'), 'shell template must contain editor-save-status-card');

    const indicatorCount = (helperCode.match(/id="saveStatusIndicator"/g) || []).length;
    assert.strictEqual(indicatorCount, 1, 'saveStatusIndicator must appear exactly once in the shell template');

    const ariaLiveCount = (helperCode.match(/aria-live="polite"/g) || []).length;
    assert.strictEqual(ariaLiveCount, 1, 'aria-live polite region must appear exactly once in the shell template');

    const statusCardCount = (helperCode.match(/class="editor-save-status-card"/g) || []).length;
    assert.strictEqual(statusCardCount, 1, 'editor-save-status-card must appear exactly once in the shell template');
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
