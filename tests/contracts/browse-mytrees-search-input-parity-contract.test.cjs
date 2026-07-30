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

test('search-input does not use transition: all — explicit properties required', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    const searchInputBlock = cssContent.match(/\.search-input\s*\{[^}]*\}/s);
    assert.ok(searchInputBlock, 'Must have .search-input rule block');
    const block = searchInputBlock[0];
    const transitionDecl = block.match(/transition:\s*([^;]+);/);
    assert.ok(transitionDecl, '.search-input must have transition declaration');
    assert.ok(!/\ball\b/.test(transitionDecl[1]), '.search-input must not transition: all');
    assert.match(transitionDecl[1], /border-color/);
    assert.match(transitionDecl[1], /box-shadow/);
});

test('search-input has :focus-visible ring using existing token family', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    assert.match(
        cssContent,
        /\.search-input:focus-visible\s*\{/,
        '.search-input must declare :focus-visible pseudo-class'
    );
    const focusVisibleBlock = cssContent.match(/\.search-input:focus-visible\s*\{[^}]*\}/s);
    assert.ok(focusVisibleBlock, 'Must have .search-input:focus-visible rule block');
    const block = focusVisibleBlock[0];
    assert.match(block, /border-color/);
    assert.match(block, /box-shadow/);
    assert.match(block, /rgba\(144,\s*73,\s*81/);
});

test('prefers-reduced-motion removes nonessential input transitions', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    assert.match(
        cssContent,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
        'Must declare prefers-reduced-motion: reduce media query'
    );
    const rmBlock = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\}/s);
    assert.ok(rmBlock, 'Must have prefers-reduced-motion rule block with content');
    const block = rmBlock[0];
    assert.match(block, /transition:\s*none/);
});

test('tag-chip and browse-sort-select also avoid transition: all', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    const tagChipBlock = cssContent.match(/\.tag-chip\s*\{[^}]*\}/s);
    assert.ok(tagChipBlock, 'Must have .tag-chip rule block');
    const tagBlock = tagChipBlock[0];
    assert.ok(
        !/\btransition:\s*all\b/.test(tagBlock),
        '.tag-chip must not contain transition: all'
    );
    const sortSelectBlock = cssContent.match(/\.browse-sort-select\s*\{[^}]*\}/s);
    assert.ok(sortSelectBlock, 'Must have .browse-sort-select rule block');
    const sortBlock = sortSelectBlock[0];
    assert.ok(
        !/\btransition:\s*all\b/.test(sortBlock),
        '.browse-sort-select must not contain transition: all'
    );
});

test('geometry anchors remain unchanged', () => {
    const cssContent = fs.readFileSync(SEARCH_CONTROLS_CSS_PATH, 'utf8');
    const searchInputBlock = cssContent.match(/\.search-input\s*\{[^}]*\}/s);
    assert.ok(searchInputBlock, 'Must have .search-input rule block');
    const block = searchInputBlock[0];
    assert.match(block, /width:\s*100%/);
    assert.match(block, /box-sizing:\s*border-box/);
    assert.match(block, /padding:\s*15px\s+18px\s+15px\s+48px/);
    assert.match(block, /border-radius:\s*999px/);
    assert.match(block, /background:\s*rgba\(255,255,255,0.82\)/);
    assert.match(block, /box-shadow:\s*0\s+10px\s+22px\s+rgba\(0,0,0,0.022\)/);
    assert.match(block, /font-size:\s*0.96rem/);
});

test('no My Trees page-local search-input override is introduced', () => {
    const myTreesFinderCss = fs.readFileSync(MYTREES_FINDER_CSS_PATH, 'utf8');
    const forbiddenBaseBlocks = [
        /\.my-trees-search-input\s*\{[^}]*\}/s,
        /\.myTreesSearchInput\s*\{[^}]*\}/s,
    ];
    for (const pattern of forbiddenBaseBlocks) {
        assert.ok(
            !pattern.test(myTreesFinderCss),
            `my-trees-finder.css must not introduce base style block matching: ${pattern}`
        );
    }
});
