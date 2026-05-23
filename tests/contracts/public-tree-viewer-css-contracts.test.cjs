const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const VIEWER_CSS_MANIFEST = path.join(ROOT, 'css/viewer/public-tree-viewer.css');
const HTML_FILE = path.join(ROOT, 'pages/public-tree-viewer-shell.html'); // Verify if this is the right file, also check others like tree.html
const TREE_HTML_FILE = path.join(ROOT, 'pages/tree.html');

test('public tree viewer css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(VIEWER_CSS_MANIFEST, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('public tree viewer css — manifest contains expected imports', () => {
    const content = fs.readFileSync(VIEWER_CSS_MANIFEST, 'utf8');
    const expectedImports = [
        './public-tree-viewer/shell.css',
        './public-tree-viewer/layout.css',
        './public-tree-viewer/tree.css',
        './public-tree-viewer/preview.css',
        './public-tree-viewer/state.css',
        './public-tree-viewer/responsive.css',
        './public-tree-viewer/print.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('public tree viewer css — split files exist and contain core selectors', () => {
    const files = {
        'shell.css': ['.viewer-page-shell', '.viewer-topbar'],
        'layout.css': ['.viewer-layout'],
        'tree.css': ['.viewer-tree-shell', '.viewer-node'],
        'preview.css': ['.viewer-preview-section', '.viewer-moment-title'],
        'state.css': ['.viewer-state'],
        'responsive.css': ['@media (max-width: 768px)', '@media (max-width: 375px)'],
        'print.css': ['@media print']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/viewer/public-tree-viewer/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
    }
});

test('public tree viewer css — HTML links are preserved', () => {
    // Check if the original link is still in the html files
    const filesToCheck = [TREE_HTML_FILE];
    
    for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
            const htmlContent = fs.readFileSync(file, 'utf8');
            assert.match(htmlContent, /<link rel="stylesheet" href="[\./]*css\/viewer\/public-tree-viewer\.css/, `HTML file ${path.basename(file)} must preserve link to public-tree-viewer.css`);
        }
    }
});
