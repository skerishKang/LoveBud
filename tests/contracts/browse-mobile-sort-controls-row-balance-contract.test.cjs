/**
 * Browse Mobile Sort/View Controls Row Balance Contract Test
 * v20260618-browse-mobile-balance-1
 *
 * Ensures:
 * - 640px 이하에서 .browse-sort-select가 width: 100%로 고정되지 않고 compact pill 폭을 가질 것
 * - 480px 이하에서 #browseSortControls가 unshrinkable full-width (width: 100% !important)로 강제되지 않을 것
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

const searchControlsCss = fs.readFileSync(path.join(ROOT, 'css/search/search-controls.css'), 'utf8');
const searchHeroControlsCss = fs.readFileSync(path.join(ROOT, 'css/search/search-hero-controls.css'), 'utf8');

// Helper to extract a media query block's content from CSS
function getMediaQueryBlock(css, queryPattern) {
    const regex = new RegExp(`@media\\s*\\(${queryPattern}\\)\\s*\\{`, 'i');
    const match = css.match(regex);
    if (!match) return null;

    const startIndex = match.index + match[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    while (braceCount > 0 && endIndex < css.length) {
        if (css[endIndex] === '{') {
            braceCount++;
        } else if (css[endIndex] === '}') {
            braceCount--;
        }
        endIndex++;
    }

    return css.slice(startIndex, endIndex - 1);
}

test('768px breakpoint in search-controls.css ensures visual rhythm sort select', () => {
    const media768Block = getMediaQueryBlock(searchControlsCss, 'max-width:\\s*768px');
    assert.ok(media768Block, 'Should find @media (max-width: 768px) block in search-controls.css');

    // Extract .browse-sort-select rules from media block
    const selectMatch = media768Block.match(/\.browse-sort-select\s*\{([^}]+)\}/);
    assert.ok(selectMatch, 'Should find .browse-sort-select rule block inside 768px media query');

    const selectRules = selectMatch[1];

    // Check settings match My Trees summary-sort-control
    assert.match(selectRules, /width\s*:\s*100%/, '.browse-sort-select must have width: 100%');
    assert.match(selectRules, /min-height\s*:\s*40px/, '.browse-sort-select must have min-height: 40px');
    assert.match(selectRules, /font-size\s*:\s*13px/, '.browse-sort-select must have font-size: 13px');
});

test('768px breakpoint in search-hero-controls.css aligns sort controls flex', () => {
    const media768Block = getMediaQueryBlock(searchHeroControlsCss, 'max-width:\\s*768px');
    assert.ok(media768Block, 'Should find @media (max-width: 768px) block in search-hero-controls.css');

    // Extract #browseSortControls rules from media block
    const controlsMatch = media768Block.match(/#browseSortControls\s*\{([^}]+)\}/);
    assert.ok(controlsMatch, 'Should find #browseSortControls rule block inside 768px media query');

    const controlsRules = controlsMatch[1];

    // Check flex rhythm settings
    assert.match(controlsRules, /flex\s*:\s*0\s+1\s+50%/, '#browseSortControls must have flex: 0 1 50%');
    assert.match(controlsRules, /max-width\s*:\s*180px/, '#browseSortControls must have max-width: 180px');
});

test('768px breakpoint in search-controls.css ensures row balance layout properties', () => {
    const media768Block = getMediaQueryBlock(searchControlsCss, 'max-width:\\s*768px');
    assert.ok(media768Block, 'Should find @media (max-width: 768px) block in search-controls.css');

    const controlsMatch = media768Block.match(/\.browse-results-controls\s*\{([^}]+)\}/);
    assert.ok(controlsMatch, 'Should find .browse-results-controls rule block inside 768px media query');

    const rules = controlsMatch[1];
    assert.match(rules, /gap\s*:\s*18px/, '.browse-results-controls must have gap: 18px');
    assert.match(rules, /flex-wrap\s*:\s*nowrap/, '.browse-results-controls must have flex-wrap: nowrap');

    const mountMatch = media768Block.match(/#browseViewModeMount\s*\{([^}]+)\}/);
    assert.ok(mountMatch, 'Should find #browseViewModeMount rule block inside 768px media query');
    const mountRules = mountMatch[1];
    assert.match(mountRules, /margin-left\s*:\s*auto/, '#browseViewModeMount must have margin-left: auto');
});

test('Hero description styling in search-hero-controls.css matches My Trees', () => {
    const match = searchHeroControlsCss.match(/\.search-panel-header\s+p\s*\{([^}]+)\}/);
    assert.ok(match, 'Should find .search-panel-header p block in search-hero-controls.css');

    const rules = match[1];
    assert.match(rules, /font-size\s*:\s*1.02rem/, '.search-panel-header p must have font-size: 1.02rem');
    assert.match(rules, /line-height\s*:\s*1.78/, '.search-panel-header p must have line-height: 1.78');
    assert.match(rules, /opacity\s*:\s*0.82/, '.search-panel-header p must have opacity: 0.82');
    assert.match(rules, /max-width\s*:\s*520px/, '.search-panel-header p must have max-width: 520px');
    assert.match(rules, /margin-top\s*:\s*0/, '.search-panel-header p must have margin-top: 0');
    assert.match(rules, /margin-bottom\s*:\s*0/, '.search-panel-header p must have margin-bottom: 0');
});

test('Search input mobile density styling matches My Trees finder input', () => {
    const media768Block = getMediaQueryBlock(searchControlsCss, 'max-width:\\s*768px');
    assert.ok(media768Block, 'Should find @media (max-width: 768px) block in search-controls.css');

    const inputMatch = media768Block.match(/\.search-input\s*\{([^}]+)\}/);
    assert.ok(inputMatch, 'Should find .search-input rule block inside 768px media query');

    const rules = inputMatch[1];
    assert.match(rules, /height\s*:\s*40px/, '.search-input must have height: 40px');
    assert.match(rules, /min-height\s*:\s*40px/, '.search-input must have min-height: 40px');
    assert.match(rules, /max-height\s*:\s*40px/, '.search-input must have max-height: 40px');
    assert.match(rules, /padding\s*:\s*10px\s+12px\s+10px\s+38px/, '.search-input must have padding: 10px 12px 10px 38px');
    assert.match(rules, /font-size\s*:\s*0.86rem/, '.search-input must have font-size: 0.86rem');
});
