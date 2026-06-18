/**
 * LoveBud CSP Inline Cleanup - Contract Test
 * v20260618-2689-1
 *
 * Ensures all inline scripts and event handlers are kept out of Search and Public Viewer pathways,
 * and script versions are correctly bumped to prevent browser cache mismatch issues.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
const searchCardFallbackJs = fs.readFileSync(path.join(ROOT, 'js/search/search-card-fallback.js'), 'utf8');
const searchCardRendererJs = fs.readFileSync(path.join(ROOT, 'js/search/search-card-renderer.js'), 'utf8');
const publicTreeViewerJs = fs.readFileSync(path.join(ROOT, 'js/viewer/public-tree-viewer.js'), 'utf8');

// 1) inline LoveBudTreeViewModeSwitcher.init block 없음 in search.html
test('pages/search.html has no inline switcher init script block', () => {
    assert.ok(!searchHtml.includes('LoveBudTreeViewModeSwitcher.init'), 'search.html must not contain inline switcher init');
    assert.ok(!searchHtml.includes('lovebud:browse:viewMode'), 'search.html must not contain inline viewMode configuration');
});

// 2) script src cache key가 20260618-2689-1로 bump됨
test('pages/search.html modified scripts have bumped cache query parameters', () => {
    assert.match(searchHtml, /search-card-fallback\.js\?v=20260618-2689-1/, 'search-card-fallback.js version must be bumped');
    assert.match(searchHtml, /search-card-renderer\.js\?v=20260618-2689-1/, 'search-card-renderer.js version must be bumped');
    assert.match(searchHtml, /search-page-shell-init\.js\?v=20260618-2689-1/, 'search-page-shell-init.js version must be bumped');
});

// 3) search-card-fallback.js에 onerror= 없음
test('js/search/search-card-fallback.js has no onerror attributes', () => {
    assert.ok(!searchCardFallbackJs.includes('onerror='), 'search-card-fallback.js must not template inline onerror attributes');
});

// 4) public-tree-viewer.js에 onerror= 없음
test('js/viewer/public-tree-viewer.js has no onerror attributes', () => {
    assert.ok(!publicTreeViewerJs.includes('onerror='), 'public-tree-viewer.js must not template inline onerror attributes');
});

// 5) search-card-renderer.js에 addEventListener('error' 있음
test('js/search/search-card-renderer.js registers addEventListener for errors', () => {
    assert.match(searchCardRendererJs, /addEventListener\(\s*['"]error['"]/, 'search-card-renderer.js must use event listener instead of onerror');
});

// 6) hqdefault.jpg -> mqdefault.jpg fallback 유지
test('fallback logic from hqdefault to mqdefault is preserved', () => {
    assert.match(searchCardRendererJs, /hqdefault\.jpg/, 'hqdefault.jpg query must exist in card renderer');
    assert.match(searchCardRendererJs, /mqdefault\.jpg/, 'mqdefault.jpg replacement must exist in card renderer');
    assert.match(publicTreeViewerJs, /hqdefault\.jpg/, 'hqdefault.jpg query must exist in public viewer');
    assert.match(publicTreeViewerJs, /mqdefault\.jpg/, 'mqdefault.jpg replacement must exist in public viewer');
});

// 7) LoveBud-Local-Verification-Report-20260618.md 없음
test('LoveBud-Local-Verification-Report-20260618.md should not exist in the workspace', () => {
    const reportPath = path.join(ROOT, 'LoveBud-Local-Verification-Report-20260618.md');
    assert.ok(!fs.existsSync(reportPath), 'The local verification report must be deleted from the repository');
});
