const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Detail Panel Shell template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-detail-panel-shell-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="detailPanel"'), 'must include detail panel root id');
    assert.ok(helperCode.includes('detail-panel'), 'must include detail-panel class');
    assert.ok(helperCode.includes('memory-detail-section'), 'must include memory-detail-section class');
    assert.ok(helperCode.includes('reveal-fade'), 'must include reveal-fade class');

    assert.ok(helperCode.includes('panel-header'), 'must include panel-header class');
    assert.ok(helperCode.includes('headline'), 'must include headline class');
    assert.ok(helperCode.includes('editor-panel-headline'), 'must include editor-panel-headline class');

    assert.ok(helperCode.includes('id="detailContent"'), 'must include detail content id');
    assert.ok(helperCode.includes('detail-content'), 'must include detail-content class');

    assert.ok(helperCode.includes('id="editorDetailEmptyStateTemplateMount"'), 'must include empty state mount');
    assert.ok(helperCode.includes('id="editorDetailViewModeTemplateMount"'), 'must include view mode mount');
    assert.ok(helperCode.includes('id="editorDetailEditModeTemplateMount"'), 'must include edit mode mount');

    assert.ok(helperCode.includes('editorDetailPanelShellTemplateMount'), 'must find mount element');
});

test('editor.html uses template mount and removes raw detail panel shell markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the shell mount anchor
    assert.ok(html.includes('id="editorDetailPanelShellTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents directly in raw HTML anymore
    assert.ok(!html.includes('id="detailPanel"'), 'raw HTML should not contain detail panel directly');
    assert.ok(!html.includes('id="detailContent"'), 'raw HTML should not contain detail content directly');
    
    // The internal mounts should NOT be in the raw HTML either (they are inside the shell template now)
    assert.ok(!html.includes('id="editorDetailEmptyStateTemplateMount"'), 'raw HTML should not contain inner empty state mount directly');
    assert.ok(!html.includes('id="editorDetailViewModeTemplateMount"'), 'raw HTML should not contain inner view mode mount directly');
    assert.ok(!html.includes('id="editorDetailEditModeTemplateMount"'), 'raw HTML should not contain inner edit mode mount directly');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const detailPanelShellHelperIndex = html.indexOf('js/editor/templates/editor-detail-panel-shell-template.js');
    const detailEmptyStateHelperIndex = html.indexOf('js/editor/templates/editor-detail-empty-state-template.js');
    const detailViewModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-view-mode-template.js');
    const detailEditModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-edit-mode-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(detailPanelShellHelperIndex, -1, 'editor.html must load the detail panel shell helper script');
    
    // order: shell -> empty -> view -> edit -> dom-selectors
    assert.ok(detailPanelShellHelperIndex < detailEmptyStateHelperIndex, 'detail panel shell must load before empty state');
    assert.ok(detailEmptyStateHelperIndex < detailViewModeHelperIndex, 'empty state must load before view mode');
    assert.ok(detailViewModeHelperIndex < detailEditModeHelperIndex, 'view mode must load before edit mode');
    assert.ok(detailEditModeHelperIndex < domSelectorsIndex, 'edit mode must load before dom selectors');
    assert.ok(detailEditModeHelperIndex < editorJsIndex, 'edit mode must load before js/editor.js');
});
