const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/search/search-preview-sidebar.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/search.css');

test('search-preview-sidebar css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('search-preview-sidebar css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './search-preview.css',
        './search-preview-sidebar/layout.css',
        './search-preview-sidebar/header.css',
        './search-preview-sidebar/states.css',
        './search-preview-sidebar/metadata.css',
        './search-preview-sidebar/media.css',
        './search-preview-sidebar/flow.css',
        './search-preview-sidebar/actions.css',
        './search-preview-sidebar/responsive.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('search-preview-sidebar css — split files exist and contain core selectors', () => {
    const files = {
        'layout.css': ['.preview-sidebar', 'body.preview-sheet-open'],
        'header.css': ['.preview-panel-header', '.preview-badge'],
        'states.css': ['.preview-empty-state', '.preview-empty-guide'],
        'metadata.css': ['.tree-meta', '.preview-panel-title'],
        'media.css': ['.video-container', '.preview-media-frame'],
        'flow.css': ['.preview-flow-list', '.preview-flow-stage'],
        'actions.css': ['.preview-primary-action', '.preview-share-action'],
        'responsive.css': ['@media (max-width: 480px)', '@media (max-width: 375px)']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/search/search-preview-sidebar/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('search-preview-sidebar css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/search\/search-preview-sidebar\.css['"]\);/, 'Parent manifest must still import the sidebar manifest');
});
