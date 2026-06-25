const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const MYTREES_HTML_PATH = path.join(ROOT, 'pages/my-trees.html');
const SEARCH_CONTROLS_CSS_PATH = path.join(ROOT, 'css/search/search-controls.css');
const MYTREES_FINDER_CSS_PATH = path.join(ROOT, 'css/my-trees/my-trees-finder.css');

test('My Trees search input class keeps search-input shared class', () => {
    const htmlContent = fs.readFileSync(MYTREES_HTML_PATH, 'utf8');
    assert.match(
        htmlContent,
        /id="myTreesSearchInput"[^>]*?class="[^"]*?search-input[^"]*?"/,
        'myTreesSearchInput must preserve search-input class'
    );
});

test('Search controls css contains standard .search-input rules', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    assert.match(cssContent, /\.search-input\s*\{/);
    assert.match(cssContent, /width:\s*100%/);
    assert.match(cssContent, /box-sizing:\s*border-box/);
    assert.match(cssContent, /padding:\s*15px\s+18px\s+15px\s+48px/);
    assert.match(cssContent, /border-radius:\s*999px/);
    assert.match(cssContent, /background:\s*rgba\(255,255,255,0.82\)/);
    assert.match(cssContent, /box-shadow:\s*0\s+10px\s+22px\s+rgba\(0,0,0,0.022\)/);
    assert.match(cssContent, /font-size:\s*0.96rem/);
});

test('My Trees finder css does not contain base .my-trees-search-input block', () => {
    const cssContent = fs.readFileSync(MYTREES_FINDER_CSS_PATH, 'utf8');
    assert.ok(
        !/\.my-trees-search-input\s*\{[^\}]*?\}/.test(cssContent),
        'Should not contain base .my-trees-search-input definition'
    );
});

test('HTML structure of browse-utility-row and myTreesFinder is unmodified', () => {
    const myTreesHtml = fs.readFileSync(MYTREES_HTML_PATH, 'utf8');
    assert.match(myTreesHtml, /class="[^"]*?browse-utility-row[^"]*?my-trees-finder[^"]*?"\s+id="myTreesFinder"/);
});
