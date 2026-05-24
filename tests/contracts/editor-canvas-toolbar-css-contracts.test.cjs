const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/editor/editor-canvas-toolbar.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/editor.css');

test('editor-canvas-toolbar css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('editor-canvas-toolbar css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './editor-canvas-toolbar/layout.css',
        './editor-canvas-toolbar/groups.css',
        './editor-canvas-toolbar/view-options.css',
        './editor-canvas-toolbar/buttons.css',
        './editor-canvas-toolbar/compact.css',
        './editor-canvas-toolbar/responsive.css',
        './editor-canvas-toolbar/drop-feedback.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('editor-canvas-toolbar css — split files exist and contain core selectors', () => {
    const files = {
        'layout.css': ['.editor-canvas-topbar', '.editor-canvas-toolbar'],
        'groups.css': ['.editor-canvas-toolbar-group', '[aria-label="레이아웃 모드"]'],
        'view-options.css': ['.editor-canvas-view-options-group', '.editor-view-options-panel'],
        'buttons.css': ['.editor-canvas-tool-btn', '.editor-canvas-zoom-indicator'],
        'compact.css': ['.editor-canvas-toolbar.is-compact', '.editor-canvas-tool-label'],
        'responsive.css': ['@media (max-width: 1024px)', '@media (max-width: 768px)'],
        'drop-feedback.css': ['.editor-drop-active::after', '@keyframes editor-drop-pulse']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/editor/editor-canvas-toolbar/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('editor-canvas-toolbar css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/editor\/editor-canvas-toolbar\.css/, 'Parent manifest must still import the toolbar manifest');
});
