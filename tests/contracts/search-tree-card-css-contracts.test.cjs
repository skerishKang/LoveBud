const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/search/search-tree-card.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/search.css');

test('search-tree-card css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('search-tree-card css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './search-tree-card/layout.css',
        './search-tree-card/media.css',
        './search-tree-card/preview.css',
        './search-tree-card/fallback.css',
        './search-tree-card/content.css',
        './search-tree-card/metadata.css',
        './search-tree-card/actions.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('search-tree-card css — split files exist and contain core selectors', () => {
    const files = {
        'layout.css': ['.tree-card', '.tree-card:hover'],
        'media.css': ['.tree-card-media', '.tree-card-featured .tree-card-media'],
        'preview.css': ['.tree-card-preview-strip', '.tree-card-preview-node'],
        'fallback.css': ['.tree-card-media-fallback', '.fallback-title'],
        'content.css': ['.tree-card-body', '.tree-title'],
        'metadata.css': ['.tree-meta-row', '.tree-meta-chip'],
        'actions.css': ['.tree-card-open-link']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/search/search-tree-card/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('search-tree-card css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/search\/search-tree-card\.css['"]\);/, 'Parent manifest must still import the card manifest');
});

test('search-tree-card css — loaded cover trace hides when image is present', () => {
    const mediaContent = fs.readFileSync(path.join(ROOT, 'css/search/search-tree-card/media.css'), 'utf8');
    assert.ok(mediaContent.includes('.tree-card-media:has(> img[data-search-card-image])::before'),
        'media.css must contain the :has() rule for img[data-search-card-image]');
    assert.ok(mediaContent.includes('content: none'),
        'The :has() rule must set content to none when a loaded image is present');
    assert.ok(mediaContent.includes('.tree-card-media::before'),
        'Base .tree-card-media::before decoration must still be defined for fallback/empty states');
});
