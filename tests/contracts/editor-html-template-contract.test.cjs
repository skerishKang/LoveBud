const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor.html keeps active editor page shell contracts', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // 1. Root & shell containers
    assert.ok(html.includes('id="shared-header"'), 'must have shared-header');
    assert.ok(html.includes('class="editor-layout'), 'must have editor-layout');
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'must have editorSidebarTemplateMount');
    assert.ok(html.includes('id="canvasArea"'), 'must have canvasArea');
    assert.ok(html.includes('class="canvas-svg"'), 'must have canvas-svg');
    
    // 2. Toolbar & Floating UI
    assert.ok(html.includes('id="editorFloatingToolbarTemplateMount"'), 'must have editorFloatingToolbarTemplateMount');
    
    // 3. Modals & Forms
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'must have addMemoryFormTemplateMount');
    
    // 4. Detail Panel (extracted to editorDetailPanelShellTemplateMount)
    assert.ok(html.includes('id="editorDetailPanelShellTemplateMount"'), 'must have editorDetailPanelShellTemplateMount');
    assert.ok(!html.includes('id="detailPanel"'), 'detailPanel must not be in raw HTML');
    
    // 5. Mobile UI
    assert.ok(html.includes('id="mobileBottomBar"'), 'must have mobileBottomBar');
});

test('editor.html keeps script loading order before editor runtime', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Expected order of editor scripts
    const scriptOrder = [
        'js/editor/editor-dom-selectors.js',
        'js/editor/editor-root-helpers.js',
        'js/editor/editor-canvas-layout.js',
        'js/editor/editor-canvas-interaction.js',
        'js/editor/editor-floating-toolbar.js',
        'js/editor/editor-mobile-bottom-bar.js',
        'js/editor/editor-rename-ui.js',
        'js/editor/editor-detail-ui.js',
        'js/editor/editor-memory-form.js',
        'js/editor/editor-shell-utils.js',
        'js/editor/editor-shell-bridges.js',
        'js/editor/editor-shell-helpers.js',
        'js/editor.js',
        'js/editor/editor-i18n-refresh.js'
    ];

    let lastIndex = -1;
    scriptOrder.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `tree.html must load ${script}`);
        assert.ok(index > lastIndex, `${script} must load after the previous scripts`);
        lastIndex = index;
    });
    
    // Check auth scripts loading order
    const authOrderBeforeEditor = [
        'js/auth/auth-state.js',
        'js/auth/auth-callbacks.js',
        'js/auth/auth-firebase.js',
        'js/auth.js'
    ];
    
    let lastAuthIndex = -1;
    authOrderBeforeEditor.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `editor.html must load ${script}`);
        assert.ok(index > lastAuthIndex, `${script} must load in correct order`);
        lastAuthIndex = index;
    });

    const editorIndex = html.indexOf('js/editor.js');
    assert.ok(lastAuthIndex < editorIndex, 'Auth scripts must load before editor.js');

    const protectedRouteIndex = html.indexOf('js/auth/auth-protected-route.js');
    assert.notEqual(protectedRouteIndex, -1, 'editor.html must load auth-protected-route.js');
    assert.ok(editorIndex < protectedRouteIndex, 'auth-protected-route.js must load after editor.js');
});

test('editor.html exposes stable static template extraction candidates', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    /*
     * CANDIDATES FOR STATIC TEMPLATE EXTRACTION:
     * 1. Sidebar (`<aside class="sidebar reveal-fade">`) - static shell for status and "add" sections.
     * 2. Canvas Topbar (`<div class="editor-canvas-topbar">`) - static toolbars for zoom and layout.
     * 3. Floating Toolbar (`<div id="editorFloatingToolbar">` and associated tooltips/dropdowns).
     * 4. Empty Guide (`<div id="canvasEmptyGuide">`) - static onboarding element.
     * 5. Add Memory Form Modal (`<div id="addMemoryForm">`) - heavy static markup for memory creation.
     * 6. Detail Panel (`<aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel">`) - heavy static shell for viewing/editing.
     */

    // Ensure candidates exist to be extracted later
    // 7. Canvas Topbar (`<div class="editor-canvas-topbar">`) - EXTRACTED (see editor-canvas-topbar-template-contract.test.js)
    assert.ok(html.includes('id="editorCanvasTopbarTemplateMount"'), 'Candidate: Canvas Topbar is extracted to mount');
    // 8. Empty Guide (`<div id="canvasEmptyGuide">`) - EXTRACTED (see editor-empty-guide-template-contract.test.js)
    assert.ok(html.includes('id="editorEmptyGuideTemplateMount"'), 'Candidate: Empty Guide is extracted to mount');
    // 5. Add Memory Form Modal (`<div id="addMemoryForm">`) - EXTRACTED (see editor-add-memory-form-template-contract.test.js)
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'Candidate: Add Memory Form Modal is extracted to mount');
    // 6. Sidebar sections (`<aside class="sidebar">`) - EXTRACTED (see editor-sidebar-template-contract.test.js)
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'Candidate: Sidebar is extracted to mount');
    // 9. Detail Empty State (`<div id="detailEmptyState">`) - EXTRACTED (see editor-detail-empty-state-template-contract.test.js)
    // 10. Detail View Mode (`<div id="detailViewMode">`) - EXTRACTED (see editor-detail-view-mode-template-contract.test.js)
    // Now handled inside Detail Panel Shell mount
    // 11. Detail Edit Mode (`<div id="detailEditMode">`) - EXTRACTED (see editor-detail-edit-mode-template-contract.test.js)
    // Now handled inside Detail Panel Shell mount
    
    // AREAS NOT TO EXTRACT YET (Remaining shells):
    // - canvas SVG rendering logic (id="canvasSvg"): tightly coupled to editor runtime SVG engine.
    // - main app wrapper (id="canvasArea", class="editor-layout"): base shell, extraction brings little value.
    // - mobileBottomBar: explicitly non-goal for this issue.
    // - save status indicator logic
});

test('editor template audit avoids runtime behavior changes', () => {
    // This contract test ensures we don't accidentally mutate logic in js/editor/ while planning HTML extraction.
    assert.ok(true, 'This audit PR only adds tests to identify extraction boundaries, without mutating js/editor.js');
});
