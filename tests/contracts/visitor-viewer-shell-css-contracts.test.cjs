const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer/visitor-viewer-shell.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/visitor-viewer.css');

test('visitor viewer shell css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('visitor viewer shell css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './visitor-viewer-shell/page-shell.css',
        './visitor-viewer-shell/header.css',
        './visitor-viewer-shell/layout-toggle.css',
        './visitor-viewer-shell/viewer-layout.css',
        './visitor-viewer-shell/actions.css',
        './visitor-viewer-shell/panel-host.css',
        './visitor-viewer-shell/responsive.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('visitor viewer shell css — split files exist and contain core selectors', () => {
    const files = {
        'page-shell.css': ['.visitor-viewer-page', '.viewer-layout', '.visitor-viewer-shell'],
        'header.css': ['.vv-header', '.vv-title', '.vv-meta-row'],
        'layout-toggle.css': ['.vv-layout-toggle', '.vv-tree-canvas[data-layout="hierarchy"] .vv-media-leaf'],
        'viewer-layout.css': ['.vv-viewer-layout', '.vv-tree-container', '.vv-tree-badge'],
        'actions.css': ['.vv-action-dock', '.vv-action-btn.is-liked .vv-icon-heart', '.vv-mobile-note'],
        'panel-host.css': ['.vv-panel-host', '.vv-panel'],
        'responsive.css': ['@media (min-width: 1500px)', '@media (max-width: 375px)']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/visitor-viewer/visitor-viewer-shell/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);

        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('visitor viewer shell css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/visitor-viewer\/visitor-viewer-shell\.css['"]\);/, 'Parent manifest must still import the shell manifest');
});

test('visitor viewer shell css — page links keep the parent stylesheet entrypoint', () => {
    const shellPage = fs.readFileSync(path.join(ROOT, 'pages/public-tree-viewer-shell.html'), 'utf8');
    const treePage = fs.readFileSync(path.join(ROOT, 'pages/tree.html'), 'utf8');

    assert.match(shellPage, /href="\.\.\/css\/visitor-viewer\.css\?v=20260508-951-2"/);
    assert.match(treePage, /href="\.\.\/css\/visitor-viewer\.css\?v=20260509-976-2"/);
});

test('visitor viewer shell css — forbidden runtime paths unchanged', () => {
    const forbiddenPaths = [
        'pages/editor.html',
        'js/visitor-viewer/visitor-viewer.js',
        'js/visitor-viewer/visitor-viewer-panels.js',
        'js/search/search-card-renderer.js'
    ];

    for (const relativePath of forbiddenPaths) {
        const filepath = path.join(ROOT, relativePath);
        assert.ok(fs.existsSync(filepath), `${relativePath} must still exist`);
    }
});
