const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer/visitor-viewer-panel.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer.css');

test('visitor viewer panel css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('visitor viewer panel css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './visitor-viewer-panel/panel-base.css',
        './visitor-viewer-panel/panel-header.css',
        './visitor-viewer-panel/branch-moments.css',
        './visitor-viewer-panel/moment-details.css',
        './visitor-viewer-panel/moment-actions.css',
        './visitor-viewer-panel/comments.css',
        './visitor-viewer-panel/sharing.css',
        './visitor-viewer-panel/navigation.css',
        './visitor-viewer-panel/icons.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('visitor viewer panel css — split files exist and contain core selectors', () => {
    const files = {
        'panel-base.css': ['.vv-panel', '.vv-panel-empty'],
        'panel-header.css': ['.vv-panel-header', '.vv-panel-title'],
        'branch-moments.css': ['.vv-branch-moment-grid', '.vv-branch-moment-item'],
        'moment-details.css': ['.vv-moment-media', '.vv-moment-caption'],
        'moment-actions.css': ['.vv-moment-actions', '.vv-moment-action-btn'],
        'comments.css': ['.vv-comment-input', '.vv-comment-list'],
        'sharing.css': ['.vv-share-preview', '.vv-share-actions'],
        'navigation.css': ['.vv-moment-nav', '.vv-sort-tabs'],
        'icons.css': ['.vv-icon']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/visitor-viewer/visitor-viewer-panel/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('visitor viewer panel css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/visitor-viewer\/visitor-viewer-panel\.css['"]\);/, 'Parent manifest must still import the panel manifest');
});
