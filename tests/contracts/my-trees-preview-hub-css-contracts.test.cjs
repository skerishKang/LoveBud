const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/my-trees/my-trees-preview-hub.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/my-trees.css');

test('my-trees-preview-hub css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('my-trees-preview-hub css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './my-trees-preview-hub/layout.css',
        './my-trees-preview-hub/content.css',
        './my-trees-preview-hub/flow.css',
        './my-trees-preview-hub/states.css',
        './my-trees-preview-hub/actions.css',
        './my-trees-preview-hub/responsive.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}(?:\\?[^'"]*)?['"]\\);`), `Manifest must import ${file}`);
    }
});

test('my-trees-preview-hub css — split files exist and contain core selectors', () => {
    const files = {
        'layout.css': ['.my-trees-hub-panel.is-empty', '.my-trees-hub-panel:not(.is-empty) .my-trees-hub-placeholder'],
        'content.css': ['.my-trees-hub-tree-title', '.my-trees-hub-rep'],
        'flow.css': ['.my-trees-hub-flow', '.my-trees-hub-flow-label', '.my-trees-hub-flow-controls'],
        'states.css': ['.my-trees-hub-placeholder', '.my-trees-hub-no-moments'],
        'actions.css': ['.my-trees-hub-open-btn', '.my-trees-hub-edit-btn'],
        'responsive.css': ['@media (max-width: 1024px)', '@media (max-width: 768px)', '@media (max-width: 375px)']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/my-trees/my-trees-preview-hub/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('my-trees-preview-hub css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    // Cache-bust query string on the hub manifest import is allowed.
    assert.match(parentContent, /@import url\(['"]\.\/my-trees\/my-trees-preview-hub\.css(?:\?[^'"]*)?['"]\);/, 'Parent manifest must still import the hub manifest (cache-bust query string allowed)');
});
