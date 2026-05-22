const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor.html loads js/editor.js as the final entrypoint after runtime modules', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const rootHelpersIndex = html.indexOf('js/editor/editor-root-helpers.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(domSelectorsIndex, -1, 'dom-selectors must exist');
    assert.notEqual(rootHelpersIndex, -1, 'root-helpers must exist');
    assert.notEqual(editorJsIndex, -1, 'editor.js must exist');

    assert.ok(domSelectorsIndex < editorJsIndex, 'dom-selectors must load before editor.js');
    assert.ok(rootHelpersIndex < editorJsIndex, 'root-helpers must load before editor.js');
});

test('js/editor.js retains its legacy entrypoint markers', () => {
    const js = fs.readFileSync('js/editor.js', 'utf8');

    // Initialization markers
    assert.ok(js.includes("document.addEventListener('DOMContentLoaded'"), 'should wait for DOMContentLoaded');
    assert.ok(js.includes('const startEditor = async () => {'), 'should have startEditor async function');
    assert.ok(js.includes('function tryStartEditor(user)'), 'should have tryStartEditor wrapper');

    // Compatibility glue markers
    assert.ok(js.includes('window.LoveBudEditorDataLoaderFallbacks'), 'should read global fallbacks');
    assert.ok(js.includes('window.registerOnAuthReady'), 'should hook into auth ready');

    // Global exposure (temporary compat)
    assert.ok(js.includes('window.updateDetailPanel = updateDetailPanel'), 'exposes updateDetailPanel globally');
    assert.ok(js.includes('window.refreshMemories = refreshMemories'), 'exposes refreshMemories globally');

    // Extracted responsibilities
    assert.ok(!js.includes('const createEditorDomRefs = () => ({'), 'EXTRACTED: createEditorDomRefs should not be inline');
    assert.ok(!js.includes('const createEditorFormRefs = () => ({'), 'EXTRACTED: createEditorFormRefs should not be inline');
    assert.ok(js.includes('window.LoveBudEditorDomRefsBuilder'), 'must use DOM refs builder namespace');
});

test('js/editor.js contains specific responsibility areas (Audit candidates)', () => {
    const js = fs.readFileSync('js/editor.js', 'utf8');

    // 1. Bootstrapping / Shell Copy
    assert.ok(!js.includes('const createEditorShellCopyApplier = ({ safeI18nText, i18n }) => {'), 'EXTRACTED: shell copy applier should not be inline');
    assert.ok(!js.includes('const prepareEditorShell = () => {'), 'EXTRACTED: prepare editor shell should not be inline');
    
    // Instead it uses the namespace
    assert.ok(js.includes('window.LoveBudEditorShellCopyApplier'), 'must use shell copy applier namespace');

    // 2. Data Loading Orchestration
    assert.ok(js.includes('loadInitialEditorTree'), 'Candidate: initial tree loading');
    assert.ok(js.includes('loadEditorMemories'), 'Candidate: editor memories loading');

    // 3. UI Orchestration / Detail flow
    assert.ok(js.includes('updateCanvasEmptyGuide'), 'Candidate: empty guide logic');
    assert.ok(js.includes('updateSidebarTreeActions'), 'Candidate: sidebar visibility actions');
    
    // 4. Event Wiring (Direct DOM binding)
    assert.ok(!js.includes('sidebarVisibilityToggleBtn.addEventListener'), 'EXTRACTED: sidebar toggle binding');
    assert.ok(js.includes('window.LoveBudEditorSidebarUI'), 'must use sidebar UI namespace');
    assert.ok(!js.includes('canvasEmptyStartBtn.addEventListener'), 'EXTRACTED: canvas empty start binding');
    assert.ok(js.includes('window.LoveBudEditorEmptyGuideUI'), 'must use editor empty guide UI namespace');
    assert.ok(!js.includes('canvasEmptyYoutubeInput.addEventListener'), 'EXTRACTED: canvas empty input binding');

    // 5. Save Status orchestration
    assert.ok(!js.includes('function updateSaveStatus(status, message) {'), 'EXTRACTED: updateSaveStatus should not be inline');
    assert.ok(js.includes('window.LoveBudEditorSaveStatusOrchestration'), 'must use save status orchestration namespace');
});
