const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor-save-status-orchestration.js exists and exposes correct namespace', () => {
    const js = fs.readFileSync('js/editor/editor-save-status-orchestration.js', 'utf8');

    assert.ok(js.includes('window.LoveBudEditorSaveStatusOrchestration = {'), 'must expose namespace');
    assert.ok(js.includes('createEditorSaveStatusOrchestration'), 'must contain createEditorSaveStatusOrchestration');
    assert.ok(js.includes('updateSaveStatus'), 'must contain updateSaveStatus');
    
    // Check DOM id markers
    assert.ok(js.includes("document.getElementById('saveStatusIndicator')"), 'must retain saveStatusIndicator id');
    assert.ok(js.includes("document.getElementById('saveStatusIcon')"), 'must retain saveStatusIcon id');
    assert.ok(js.includes("document.getElementById('saveStatusText')"), 'must retain saveStatusText id');
    assert.ok(js.includes("document.getElementById('lastSavedTime')"), 'must retain lastSavedTime id');

    // Check status markers
    assert.ok(js.includes("status === 'saving'"), 'must retain saving status condition');
    assert.ok(js.includes("status === 'saved'"), 'must retain saved status condition');
    assert.ok(js.includes("status === 'failed'"), 'must retain failed status condition');

    // Check icon markers
    assert.ok(js.includes("'hourglass_empty'"), 'must retain hourglass_empty icon');
    assert.ok(js.includes("'check_circle'"), 'must retain check_circle icon');
    assert.ok(js.includes("'error'"), 'must retain error icon');

    // Check class markers
    assert.ok(js.includes("'save-status-indicator saving'"), 'must retain saving class');
    assert.ok(js.includes("'save-status-indicator saved'"), 'must retain saved class');
    assert.ok(js.includes("'save-status-indicator failed'"), 'must retain failed class');

    // Check timeout markers
    assert.ok(js.includes("hideLater(3000)"), 'must retain 3000ms hide timer for saved');
    assert.ok(js.includes("hideLater(5000)"), 'must retain 5000ms hide timer for failed');
});

test('editor.html loads editor-save-status-orchestration.js before editor.js', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const orchestrationIndex = html.indexOf('js/editor/editor-save-status-orchestration.js');
    const editorJsIndex = html.indexOf('js/editor.js');
    const saveStatusBaseIndex = html.indexOf('js/editor/editor-save-status.js');

    assert.notEqual(orchestrationIndex, -1, 'orchestration script must be loaded');
    assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
    assert.ok(orchestrationIndex < editorJsIndex, 'orchestration must load before editor.js');

    if (saveStatusBaseIndex !== -1) {
        assert.ok(saveStatusBaseIndex < orchestrationIndex, 'orchestration must load after base save status module if present');
    }
});
