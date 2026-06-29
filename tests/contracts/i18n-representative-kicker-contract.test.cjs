/**
 * LoveBud i18n Representative Kicker Contract
 *
 * Verifies that the representative text-cover kicker uses i18n lookup with
 * proper Korean fallback and English translation, and never exposes raw keys.
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

    return Object.assign({
        LoveBudSecurity: security,
        LoveBudSearchSharedUtils: sharedUtils,
        LoveBudSearchCardFallback: null,
        LoveBudMyTreesCardVisuals: null,
        LoveBudMyTreesCardEvents: null,
        LoveBudMyTreesUtils: { escapeHtml: security.escapeHtml }
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

// Test 1: Korean locale outputs Korean fallback
test('Browse (Korean): kicker shows Korean text via i18n', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            if (key === 'card.representative.kicker') return '첫 순간 기록';
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('첫 순간 기록'), 'Korean kicker should appear');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 2: English locale outputs English translation
test('Browse (English): kicker shows English text via i18n', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            if (key === 'card.representative.kicker') return 'First moment';
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('First moment'), 'English kicker should appear');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 3: Missing translation key falls back to Korean
test('Browse (missing translation): kicker falls back to Korean', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        null
    );
    assert.ok(html.includes('첫 순간 기록'), 'Should fall back to Korean');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 4: No i18n function available - falls back to Korean
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

// Test 5: Kicker only appears in text-led cover tier (tier 2), not thumbnail tier (tier 1)
test('Browse tier 1 (thumbnail): kicker NOT included', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            if (key === 'card.representative.kicker') return '첫 순간 기록';
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeThumbnail: 'https://example.com/thumb.jpg' },
        null,
        'Test Title'
    );
    assert.ok(/<img\s/.test(html), 'Should render thumbnail image');
    assert.ok(!html.includes('첫 순간 기록'), 'Kicker should NOT appear in tier 1');
    assert.ok(!html.includes('tree-card-text-visual'), 'Text cover should NOT appear in tier 1');
});

// Test 6: Kicker appears in tier 2 (text-led cover)
test('Browse tier 2 (text cover): kicker IS included', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            if (key === 'card.representative.kicker') return '첫 순간 기록';
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        null,
        'Test Title'
    );
    assert.ok(html.includes('tree-card-text-visual'), 'Should render text cover');
    assert.ok(html.includes('첫 순간 기록'), 'Kicker SHOULD appear in tier 2');
});

// Test 7: Kicker does NOT appear in tier 3 (SVG fallback)
test('Browse tier 3 (SVG fallback): kicker NOT included', () => {
    const win = runInNewWindow(searchCardFallbackJs, {
        t: function(key) {
            if (key === 'card.representative.kicker') return '첫 순간 기록';
            return key;
        }
    });
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        {},
        null,
        'Test Title'
    );
    assert.ok(/<svg/.test(html), 'Should render SVG fallback');
    assert.ok(!html.includes('tree-card-text-visual'), 'Text cover should NOT appear in tier 3');
    assert.ok(!html.includes('첫 순간 기록'), 'Kicker should NOT appear in tier 3');
});

// Test 8: My Trees Korean locale
test('My Trees (Korean): kicker shows Korean text via i18n', () => {
    const win = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function(v) { return String(v || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }
        }
    });
    const i18nFn = function(key) {
        if (key === 'card.representative.kicker') return '첫 순간 기록';
        return key;
    };
    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        i18nFn
    );
    assert.ok(html.includes('첫 순간 기록'), 'Korean kicker should appear in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 9: My Trees English locale
test('My Trees (English): kicker shows English text via i18n', () => {
    const win = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function(v) { return String(v || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }
        }
    });
    const i18nFn = function(key) {
        if (key === 'card.representative.kicker') return 'First moment';
        return key;
    };
    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        i18nFn
    );
    assert.ok(html.includes('First moment'), 'English kicker should appear in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 10: My Trees missing translation falls back to Korean
test('My Trees (missing translation): kicker falls back to Korean', () => {
    const win = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function(v) { return String(v || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }
        }
    });
    const i18nFn = function(key) { return key; };
    const html = win.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual(
        { representativeTitle: 'Test Title', representativeMemo: 'Test Memo' },
        { leafSoft: 'rgba(0,0,0,0.1)', accent: '#904951' },
        i18nFn
    );
    assert.ok(html.includes('첫 순간 기록'), 'Should fall back to Korean in My Trees');
    assert.ok(!html.includes('card.representative.kicker'), 'Raw key should not appear');
});

// Test 11: Both files use i18n key for kicker
test('Both files use i18n key for kicker', () => {
    assert.ok(searchCardFallbackJs.includes('card.representative.kicker'), 'Browse uses card.representative.kicker');
    assert.ok(myTreesCardVisualsJs.includes('card.representative.kicker'), 'My Trees uses card.representative.kicker');
});

// Test 12: Browse renderMediaFallback pills use locale detection (unchanged behavior)
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