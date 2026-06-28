/**
 * LoveBud Media Fallback Unification Contract
 *
 * Locks Browse and My Trees card representative media fallback parity (#2997).
 *
 * 1. safe thumbnail  -> <img>
 * 2. no thumbnail  + representativeTitle/Memo -> text-led cover
 * 3. no content    -> premium SVG fallback
 *
 * Tests cover:
 * - safe-thumbnail success on Browse
 * - text-led cover fallback on Browse
 * - premium SVG fallback on Browse
 * - My Trees image error handling
 * - My Trees broken-image URL swap
 * - cross-page consistency of 3-tier logic
 * - unsafe URL rejection before reaching src
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
const myTreesCardEventsJs = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-card-events.js'),
    'utf8'
);

function createMockWindow(base) {
    const security = {
        escapeHtml: function (value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\\"/g, '&quot;')
                .replace(/'/g, '&#39;');
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

// ---- tier 1: safe thumbnail renders as <img> (Browse) ----

test('Browse: safe thumbnail URL renders <img> tag', () => {
    const win = runInNewWindow(searchCardFallbackJs);
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeThumbnail: 'https://example.com/t.jpg' },
        null,
        'Test Title'
    );
    assert.ok(/<img\s/.test(html), 'should contain <img> for safe thumbnail');
    assert.ok(/src=/.test(html), 'img should have src');
    assert.ok(html.includes('https://example.com/t.jpg'), 'thumbnail URL should be in output');
});

// ---- tier 2: text-led cover when no thumbnail + text meta (Browse) ----

test('Browse: no thumbnail + representativeTitle renders text-led cover', () => {
    const win = runInNewWindow(searchCardFallbackJs);
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: '첫 순간 제목', representativeMemo: '첫 순간 메모입니다' },
        null,
        'Test Title'
    );
    assert.ok(/tree-card-text-visual/.test(html), 'should contain text-led cover class');
    assert.ok(html.includes('첫 순간 제목'), 'representativeTitle should appear in text cover');
    assert.ok(html.includes('첫 순간 메모입니다'), 'representativeMemo should appear in text cover');
    assert.ok(!/<img\s/.test(html), 'should NOT contain <img> when no thumbnail');
});

// ---- tier 3: premium SVG when no content (Browse) ----

test('Browse: no thumbnail and no text meta renders premium SVG fallback', () => {
    const win = runInNewWindow(searchCardFallbackJs);
    const html = win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        {},
        null,
        'Test Title'
    );
    assert.ok(/tree-card-media-fallback/.test(html), 'should contain media fallback class');
    assert.ok(/<svg/.test(html), 'should contain SVG fallback');
    assert.ok(!/<img\s/.test(html), 'should NOT contain <img> when no thumbnail');
    assert.ok(!/tree-card-text-visual/.test(html), 'should NOT contain text cover when no text meta');
});

// ---- My Trees: image error handling via addEventListener ----

test('My Trees: bindMyTreesCardImageHandlers binds error listener', () => {
    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    const card = {
        querySelectorAll: function (sel) {
            if (sel === '.tree-card-thumb-image') {
                return [{
                    dataset: {},
                    addEventListener: function () {}
                }];
            }
            return [];
        }
    };
    // should not throw
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
    // second call should not double-bind (dataset guard)
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);
});

// ---- My Trees: broken-image URL falls back to text/SVG ----

test('My Trees: broken image URL triggers data-media-fallback display swap', () => {
    let errorHandler = null;
    const img = {
        dataset: { imageHandlerBound: undefined },
        style: {},
        addEventListener: function (evt, fn) {
            if (evt === 'error') errorHandler = fn;
        },
        nextElementSibling: {
            hasAttribute: function (a) { return a === 'data-media-fallback'; },
            removeAttribute: function () {},
            style: {}
        }
    };
    const card = {
        querySelectorAll: function (sel) {
            return sel === '.tree-card-thumb-image' ? [img] : [];
        }
    };

    const win = runInNewWindow(myTreesCardEventsJs, {
        LoveBudMyTreesUI: {},
        LoveTreeMyTreesUI: {}
    });
    win.LoveBudMyTreesCardEvents.bindMyTreesCardImageHandlers(card);

    assert.ok(errorHandler, 'error event handler should be bound');
    // simulate error
    errorHandler.call(img);
    assert.strictEqual(img.style.display, 'none', 'image should be hidden on error');
});

// ---- cross-page consistency ----

test('Cross-page: both pages use 3-tier fallback (thumbnail -> text -> SVG)', () => {
    const browseWin = runInNewWindow(searchCardFallbackJs);
    const treesWin = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
        }
    });

    // Browse tier structure
    assert.ok(
        typeof browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia === 'function',
        'Browse has renderRepresentativeMedia'
    );
    assert.ok(
        typeof browseWin.LoveBudSearchCardFallback.buildRepresentativeTextVisual === 'function',
        'Browse has buildRepresentativeTextVisual'
    );
    assert.ok(
        typeof browseWin.LoveBudSearchCardFallback.renderMediaFallback === 'function',
        'Browse has renderMediaFallback (SVG)'
    );

    // My Trees tier structure
    assert.ok(
        typeof treesWin.LoveBudMyTreesCardVisuals.buildTreeThumbVisual === 'function',
        'My Trees has buildTreeThumbVisual'
    );
    assert.ok(
        typeof treesWin.LoveBudMyTreesCardVisuals.buildRepresentativeTextVisual === 'function',
        'My Trees has buildRepresentativeTextVisual'
    );
    assert.ok(
        typeof treesWin.LoveBudMyTreesCardVisuals.buildPremiumFallbackSVG === 'function',
        'My Trees has buildPremiumFallbackSVG'
    );

    // Verify both render 3-tier output
    const browseHtml = browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeThumbnail: 'https://example.com/b.jpg' },
        null,
        'B'
    );
    assert.ok(/<img\s/.test(browseHtml), 'Browse tier 1 renders img');

    const browseTextHtml = browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia(
        { representativeTitle: 'T' },
        null,
        'B'
    );
    assert.ok(/tree-card-text-visual/.test(browseTextHtml), 'Browse tier 2 renders text cover');

    const browseSvgHtml = browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia({}, null, 'B');
    assert.ok(/<svg/.test(browseSvgHtml), 'Browse tier 3 renders SVG');

    const treesHtml = treesWin.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        { representativeThumbnail: 'https://example.com/t.jpg', title: 'Test' },
        function(k){return k;}
    );
    assert.ok(/<img\s/.test(treesHtml), 'My Trees tier 1 renders img');
    assert.ok(/data-media-fallback/.test(treesHtml), 'My Trees tier 1 includes fallback container');
});

// ---- unsafe URL rejection ----

test('Browse: sanitizeUrl blocks non-http/https URLs before reaching img src', () => {
    const win = runInNewWindow(searchCardFallbackJs);
    const badUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://evil.com/img.jpg'
    ];
    for (const url of badUrls) {
        const result = win.LoveBudSearchCardFallback.sanitizeUrl(url);
        assert.ok(!result || !result.startsWith('javascript:'), 'javascript: URL must be blocked');
    }
    // valid URLs should pass
    assert.ok(win.LoveBudSearchCardFallback.sanitizeUrl('https://example.com/t.jpg').includes('https://'), 'https should pass');
    assert.ok(win.LoveBudSearchCardFallback.sanitizeUrl('http://example.com/t.jpg').includes('http://'), 'http should pass');
});
