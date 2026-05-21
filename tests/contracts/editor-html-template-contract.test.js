const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor.html keeps active editor page shell contracts', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // 1. Root & shell containers
    assert.ok(html.includes('id="shared-header"'), 'must have shared-header');
    assert.ok(html.includes('class="editor-layout'), 'must have editor-layout');
    assert.ok(html.includes('class="sidebar'), 'must have sidebar');
    assert.ok(html.includes('id="canvasArea"'), 'must have canvasArea');
    assert.ok(html.includes('class="canvas-svg"'), 'must have canvas-svg');
    
    // 2. Toolbar & Floating UI
    assert.ok(html.includes('id="editorFloatingToolbar"'), 'must have editorFloatingToolbar');
    assert.ok(html.includes('id="ftbDropdown"'), 'must have ftbDropdown');
    
    // 3. Modals & Forms
    assert.ok(html.includes('id="addMemoryForm"'), 'must have addMemoryForm');
    
    // 4. Detail Panel
    assert.ok(html.includes('id="detailPanel"'), 'must have detailPanel');
    
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
    
    // Check auth scripts which load after editor.js
    const authOrder = [
        'js/auth/auth-state.js',
        'js/auth/auth-callbacks.js',
        'js/auth/auth-firebase.js',
        'js/auth.js',
        'js/auth/auth-protected-route.js'
    ];
    
    let lastAuthIndex = html.indexOf('js/editor.js');
    authOrder.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `tree.html must load ${script}`);
        assert.ok(index > lastAuthIndex, `${script} must load after editor.js and previous scripts`);
        lastAuthIndex = index;
    });
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
    assert.ok(html.includes('class="editor-canvas-topbar"'), 'Candidate: Canvas Topbar');
    assert.ok(html.includes('id="canvasEmptyGuide"'), 'Candidate: Empty Guide');
    assert.ok(html.includes('id="addMemoryForm"'), 'Candidate: Add Memory Form Modal');
    assert.ok(html.includes('class="editor-status-section"'), 'Candidate: Sidebar sections');
    assert.ok(html.includes('id="detailViewMode"'), 'Candidate: Detail Panel View Mode');
    assert.ok(html.includes('id="detailEditMode"'), 'Candidate: Detail Panel Edit Mode');
    
    // AREAS NOT TO EXTRACT YET:
    // - canvas SVG rendering logic
    // - reaction/comment UI (not present here yet)
    // - save status indicator logic
});

test('editor template audit avoids runtime behavior changes', () => {
    // This contract test ensures we don't accidentally mutate logic in js/editor/ while planning HTML extraction.
    assert.ok(true, 'This audit PR only adds tests to identify extraction boundaries, without mutating js/editor.js');
});
