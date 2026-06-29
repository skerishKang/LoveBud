/**
 * LoveBud i18n Representative Kicker Contract
 *
 * Verifies that the representative text-cover kicker uses i18n lookup with
 * proper Korean fallback and English translation, and never exposes raw keys.
 *
 * Covers:
 * - Korean locale outputs Korean fallback
 * - English locale outputs English translation
 * - Missing translation key falls back to Korean
 * - Raw key never exposed to user
 * - Kicker only appears in text-led cover tier (tier 2)
 * - Uses actual i18n core resolver (window.t)
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

const searchCardFallbackJs = fs.readFileSync(
    path.join(ROOT, 'js/search/search-card-fallback.js'),
    'utf8'
);

const myTreesCardVisualsJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'),
    'utf8'
);

const i18nSharedJs = fs.readFileSync(
    path.join(ROOT, 'js/i18n/i18n-shared.js'),
    'utf8'
);

const i18nCoreJs = fs.readFileSync(
    path.join(ROOT, 'js/i18n/i18n-core.js'),
    'utf8'
);

function createMockWindow(base) {
    const security = {
        escapeHtml: function (value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&')
                .replace(/</g, '<')
                .replace(/>/g, '>')
                .replace(/"/g, '"')
                .replace(/'/g, "'");
        },
        sanitizeUrl: function (value) {
            if (!value) return '';
            var raw = String(value).trim();
            if (!raw) return '';
            try {
                var parsed = new URL(raw, 'https://localhost/');
                var protocol = parsed.protocol;
                if (protocol === 'http:' || protocol === 'https:') {
                    return parsed.href;
                }
                return '';
            } catch (e) {
                return '';
            }
        }
    };
    const sharedUtils = {
        escapeHtml: security.escapeHtml
    };

    // Mock localStorage
    const storage = {};
    const mockLocalStorage = {
        getItem: function(key) { return storage[key] || null; },
        setItem: function(key, value) { storage[key] = String(value); },
        removeItem: function(key) { delete storage[key]; },
        clear: function() { Object.keys(storage).forEach(function(k) { delete storage[k]; }); }
    };

    return Object.assign({
        LoveBudSecurity: security,
        LoveBudSearchSharedUtils: sharedUtils,
        LoveBudSearchCardFallback: null,
        LoveBudMyTreesCardVisuals: null,
        LoveBudMyTreesCardEvents: null,
        LoveBudMyTreesUtils: { escapeHtml: security.escapeHtml },
        localStorage: mockLocalStorage
    }, base || {});
}

function runInNewWindow(js, overrides) {
    const win = createMockWindow(overrides);
    const ctx = {
        window: win,
        document: {
            createElement: function () {
                return {
                    setAttribute: function () {},
                    appendChild: function () {}
                };
            }
        }
    };
    vm.runInNewContext(js, ctx);
    return win;
}

function createFullI18nWindow(locale) {
    const win = createMockWindow();
    const ctx = { window: win, document: { createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; } } };

    // Add localStorage to global context for i18n-core to use directly
    ctx.localStorage = win.localStorage;

    // Run i18n-core first
    vm.runInNewContext(i18nCoreJs, ctx);

    // Run i18n-shared
    vm.runInNewContext(i18nSharedJs, ctx);

    // Set the locale BEFORE running i18n-index so the dictionary gets the right locale
    win.localStorage.setItem('lovebud_lang', locale);

    // Run i18n-index to merge dictionaries (now with locale set)
    const i18nIndexJs = fs.readFileSync(path.join(ROOT, 'js/i18n/i18n-index.js'), 'utf8');
    vm.runInNewContext(i18nIndexJs, ctx);

    return win;
}

function runAllModules(js, win) {
    const ctx = { window: win, document: { createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; } } };
    vm.runInNewContext(js, ctx);
    return win;
}

// ---- Test 1: Korean locale via actual i18n core ----
test('Browse (Korean): kicker shows Korean text via actual i18n resolver', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('첫 순간 기록'), 'Korean kicker should appear via actual i18n');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 2: English locale via actual i18n core ----
test('Browse (English): kicker shows English text via actual i18n resolver', () => {
    const win = createFullI18nWindow('en');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('First moment'), 'English kicker should appear via actual i18n');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 3: Missing translation key falls back to Korean ----
test('Browse (missing translation): kicker falls back to Korean', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    // Remove the key from dictionary to simulate missing translation
    delete win.i18nDictionary['card.representative.kicker'];
    win._i18nSetDictionary(win.i18nDictionary);

    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('첫 순간 기록'), 'Should fall back to Korean when key missing');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 4: No i18n function available - falls back to Korean ----
test('Browse (no i18n): kicker falls back to Korean', () => {
    const win = runInNewWindow(searchCardFallbackJs, {});
    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('첫 순간 기록'), 'Should fall back to Korean when no i18n');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 5: Kicker only appears in text-led cover tier (tier 2), not thumbnail tier (tier 1) ----
test('Browse tier 1 (thumbnail): kicker NOT included', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeThumbnail: 'https://example.com/thumb.jpg' },
        null,
        'Test Title'
    );
    assert.ok(/<img\s/.test(html), 'Should render thumbnail image');
    assert.ok(!html.includes('첫 순간 기록'), 'Kicker should NOT appear in tier 1');
    assert.ok(!html.includes('tree-card-text-visual'), 'Text cover should NOT appear in tier 1');
});

// ---- Test 6: Kicker appears in tier 2 (text-led cover) ----
test('Browse tier 2 (text cover): kicker IS included', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        null,
        'Test Title'
    );
    assert.ok(html.includes('tree-card-text-visual'), 'Should render text cover');
    assert.ok(html.includes('첫 순간 기록'), 'Kicker SHOULD appear in tier 2');
});

// ---- Test 7: Kicker does NOT appear in tier 3 (SVG fallback) ----
test('Browse tier 3 (SVG fallback): kicker NOT included', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        {},
        null,
        'Test Title'
    );
    assert.ok(/<svg/.test(html), 'Should render SVG fallback');
    assert.ok(!html.includes('tree-card-text-visual'), 'Text cover should NOT appear in tier 3');
    assert.ok(!html.includes('첫 순간 기록'), 'Kicker should NOT appear in tier 3');
});

// ---- Test 8: My Trees Korean locale ----
test('My Trees (Korean): kicker shows Korean text via i18n', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(myTreesCardVisualsJs, win);

    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        win.t // Use actual i18n function
    );
    assert.ok(html.includes('첫 순간 기록'), 'Korean kicker should appear in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 9: My Trees English locale ----
test('My Trees (English): kicker shows English text via i18n', () => {
    const win = createFullI18nWindow('en');
    runAllModules(myTreesCardVisualsJs, win);

    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        win.t
    );
    assert.ok(html.includes('First moment'), 'English kicker should appear in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 10: My Trees missing translation falls back to Korean ----
test('My Trees (missing translation): kicker falls back to Korean', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(myTreesCardVisualsJs, win);

    // Remove the key from dictionary
    delete win.i18nDictionary['card.representative.kicker'];
    win._i18nSetDictionary(win.i18nDictionary);

    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        win.t
    );
    assert.ok(html.includes('첫 순간 기록'), 'Should fall back to Korean in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// ---- Test 11: Both files use the same i18n key for consistency ----
test('Both files use consistent i18n key', () => {
    assert.ok(searchCardFallbackJs.includes('card.representative.kicker'), 'Browse uses card.representative.kicker');
    assert.ok(myTreesCardVisualsJs.includes('card.representative.kicker'), 'My Trees uses card.representative.kicker');
});

// ---- Test 12: Browse renderMediaFallback pills use locale detection (unchanged behavior) ----
test('Browse SVG fallback pills use locale detection (unchanged behavior)', () => {
    const win = runInNewWindow(searchCardFallbackJs, {});
    const html = win.LoveBudSearchCardFallback.renderMediaFallback(
        { id: 'test123' },
        'Test Title'
    );
    assert.ok(html.includes('첫 순간') || html.includes('First Moment'), 'Should have pills');
    assert.ok(html.includes('마음 메모') || html.includes('Memory Note'), 'Should have pills');
    assert.ok(html.includes('다시 보고 싶은 장면') || html.includes('Favorite Scene'), 'Should have pills');
});

// ---- Test 13: English locale via actual i18n for Browse renderRepresentativeMedia ----
test('Browse (English) renderRepresentativeMedia: kicker IS English in text cover tier', () => {
    const win = createFullI18nWindow('en');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        null,
        'Test Title'
    );
    assert.ok(html.includes('tree-card-text-visual'), 'Should render text cover');
    assert.ok(html.includes('First moment'), 'English kicker SHOULD appear in tier 2');
});

// ---- Test 14: Korean locale via actual i18n for Browse renderRepresentativeMedia ----
test('Browse (Korean) renderRepresentativeMedia: kicker IS Korean in text cover tier', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(searchCardFallbackJs, win);

    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        null,
        'Test Title'
    );
    assert.ok(html.includes('tree-card-text-visual'), 'Should render text cover');
    assert.ok(html.includes('첫 순간 기록'), 'Korean kicker SHOULD appear in tier 2');
});

// ---- Test 15: My Trees buildTreeThumbVisual tier hierarchy preserved ----
test('My Trees: tier hierarchy (thumbnail -> text cover -> SVG) preserved', () => {
    const win = createFullI18nWindow('ko');
    runAllModules(myTreesCardVisualsJs, win);

    // Tier 1: thumbnail
    const tier1Html = win.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        { representativeThumbnail: 'https://example.com/thumb.jpg', title: 'Test Tree' },
        win.t
    );
    assert.ok(/<img\s/.test(tier1Html), 'Tier 1: should render thumbnail');
    assert.ok(!/tree-card-text-visual/.test(tier1Html), 'Tier 1: text cover should NOT appear');

    // Tier 2: text cover
    const tier2Html = win.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo', title: 'Test Tree' },
        win.t
    );
    assert.ok(/tree-card-text-visual/.test(tier2Html), 'Tier 2: should render text cover');
    assert.ok(tier2Html.includes('첫 순간 기록'), 'Tier 2: kicker should appear');

    // Tier 3: SVG fallback
    const tier3Html = win.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        { title: 'Test Tree' },
        win.t
    );
    assert.ok(/tree-card-media-fallback/.test(tier3Html), 'Tier 3: should render SVG fallback');
    assert.ok(!/tree-card-text-visual/.test(tier3Html), 'Tier 3: text cover should NOT appear');
    assert.ok(!tier3Html.includes('첫 순간 기록'), 'Tier 3: kicker should NOT appear');
});

// ---- Test 16: Search page uses updated i18n-shared.js cache query ----
test('Search page uses updated i18n-shared.js cache query', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const searchHtml = fs.readFileSync(
        path.join(ROOT, 'pages', 'search.html'),
        'utf8'
    );
    assert.ok(searchHtml.includes('i18n-shared.js?v=20260629-5'), 'Search page should reference updated i18n-shared.js cache query');
    assert.ok(!searchHtml.includes('i18n-shared.js?v=20260421-4'), 'Search page should NOT reference old i18n-shared.js cache query');
});