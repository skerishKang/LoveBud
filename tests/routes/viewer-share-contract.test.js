const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('share actions module exists', () => {
    assert.ok(fs.existsSync('js/viewer/share-actions.js'), 'js/viewer/share-actions.js must exist');
});

test('share actions module has expected API', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    assert.ok(content.includes('LoveBudShareActions'), 'must expose LoveBudShareActions');
    assert.ok(content.includes('copyLink'), 'must expose copyLink');
    assert.ok(content.includes('nativeShare'), 'must expose nativeShare');
    assert.ok(content.includes('navigator.clipboard') || content.includes('execCommand'), 'must handle clipboard');
});

test('share panel has actionable buttons', () => {
    const panels = fs.readFileSync('js/visitor-viewer/visitor-viewer-panels.js', 'utf8');
    assert.ok(panels.includes('data-action="copy-link"'), 'share panel must have copy-link button');
    assert.ok(panels.includes('data-action="native-share"'), 'share panel must have native-share button');
    assert.ok(panels.includes('vvShareStatus'), 'share panel must have status area');
});

test('tree-viewer handles share actions', () => {
    const viewer = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(viewer.includes('copy-link') || viewer.includes('copyLink'), 'tree-viewer must handle copy-link');
    assert.ok(viewer.includes('native-share') || viewer.includes('nativeShare'), 'tree-viewer must handle native-share');
    assert.ok(viewer.includes('showShareStatus'), 'tree-viewer must have share status feedback');
});

test('share actions module does not expose private identifiers', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    const privatePatterns = ['ownerId', 'owner_id', 'memoryId', 'memory_id', 'treeId', 'tree_id'];
    const matches = privatePatterns.filter(p => content.match(new RegExp(p, 'i')));
    assert.equal(matches.length, 0, 'share actions must not reference private identifiers: ' + matches.join(', '));
});

test('viewer route does not load Editor/Builder scripts', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const noEditorScript = !html.includes('js/editor.js') && !html.includes('pages/editor.html');
    assert.ok(noEditorScript, 'tree.html must not load editor entry script');
});

test('share module uses window.location.href without exposing raw values', () => {
    const content = fs.readFileSync('js/viewer/share-actions.js', 'utf8');
    assert.ok(content.includes('window.location.href'), 'share module must use current page URL');
    assert.ok(!content.includes('treeId='), 'share module must not hardcode treeId in source');
});
