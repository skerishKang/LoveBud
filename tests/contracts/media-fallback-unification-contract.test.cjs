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
 * - cross-page output parity: same tree input produces same fallback tier
 * - unsafe URL rejection on both Browse and My Trees
 * - My Trees unsafe thumbnail falls back to text/SVG
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
                .replace(/\\\"/g, '&quot;')
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
        LoveBudMyTreesUtils: { escapeHtml: security.escapeHtml, sanitizeUrl: security.sanitizeUrl }
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

// ---- cross-page output parity: same input -> same tier ----

test('Cross-page: same tree with memories (no thumbnail) produces text cover on both pages', () => {
    const tree = {
        title: 'BTS Tree',
        memories: [
            { title: '첫 만남', memo: '처음 본 순간', createdAt: '2026-01-01' }
        ]
    };

    // Browse
    const browseWin = runInNewWindow(searchCardFallbackJs);
    const browseHtml = browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia(
        tree,
        tree.memories[0],
        'BTS Tree'
    );
    assert.ok(/tree-card-text-visual/.test(browseHtml),
        'Browse must render text-led cover when memories have title/memo');
    assert.ok(browseHtml.includes('첫 만남'),
        'Browse text cover must show memory title');
    assert.ok(browseHtml.includes('처음 본 순간'),
        'Browse text cover must show memory memo');
    assert.ok(!/<svg/.test(browseHtml), 'Browse must not fall through to SVG');

    // My Trees
    const treesWin = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
            sanitizeUrl: function (v) { return v || ''; }
        }
    });
    const treesHtml = treesWin.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        tree,
        function(k) { return k; }
    );
    assert.ok(/tree-card-text-visual/.test(treesHtml),
        'My Trees must render text-led cover when memories have title/memo');
    assert.ok(treesHtml.includes('첫 만남'),
        'My Trees text cover must show memory title');
});

test('Cross-page: same tree with no thumbnail and no meta produces SVG fallback on both pages', () => {
    const tree = { title: 'Empty Tree', memories: [] };

    // Browse
    const browseWin = runInNewWindow(searchCardFallbackJs);
    const browseHtml = browseWin.LoveBudSearchCardFallback.renderRepresentativeMedia(
        tree,
        null,
        'Empty Tree'
    );
    assert.ok(/tree-card-media-fallback/.test(browseHtml),
        'Browse must render SVG fallback');
    assert.ok(/<svg/.test(browseHtml),
        'Browse SVG fallback must contain SVG');
    assert.ok(!/tree-card-text-visual/.test(browseHtml),
        'Browse must NOT render text cover');

    // My Trees
    const treesWin = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
            sanitizeUrl: function (v) { return v || ''; }
        }
    });
    const treesHtml = treesWin.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        tree,
        function(k) { return k; }
    );
    assert.ok(/tree-card-media-fallback/.test(treesHtml),
        'My Trees must render SVG fallback');
    assert.ok(/<svg/.test(treesHtml),
        'My Trees SVG fallback must contain SVG');
    assert.ok(!/tree-card-text-visual/.test(treesHtml),
        'My Trees must NOT render text cover');
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
        assert.strictEqual(result, '', url + ' must be sanitized to empty string');
    }
    // valid URLs should pass
    assert.ok(win.LoveBudSearchCardFallback.sanitizeUrl('https://example.com/t.jpg').includes('https://'), 'https should pass');
    assert.ok(win.LoveBudSearchCardFallback.sanitizeUrl('http://example.com/t.jpg').includes('http://'), 'http should pass');
});

test('My Trees: sanitizeUrl blocks non-http/https URLs', () => {
    const win = runInNewWindow(myTreesCardVisualsJs, {
        LoveBudMyTreesUtils: {
            escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
            sanitizeUrl: function (v) { return v || ''; }
        }
    });
    const badUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'vbscript:Execute("1")',
        'ftp://evil.com/img.jpg'
    ];
    for (const url of badUrls) {
        const result = win.LoveBudMyTreesCardVisuals._sanitizeUrl(url);
        assert.strictEqual(result, '', 'Unsafe URL "' + url + '" must be sanitized to empty');
    }
    assert.ok(win.LoveBudMyTreesCardVisuals._sanitizeUrl('https://example.com/t.jpg').includes('https://'), 'https should pass');
    assert.ok(win.LoveBudMyTreesCardVisuals._sanitizeUrl('http://example.com/t.jpg').includes('http://'), 'http should pass');
});

// ---- My Trees: unsafe thumbnail falls back to text/SVG ----

test('My Trees: unsafe thumbnail URL is rejected and falls back to text/SVG', () => {
    const unsafeUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'vbscript:Execute("1")',
        'ftp://evil.com/img.jpg'
    ];

    const utils = {
        escapeHtml: function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        sanitizeUrl: function (v) { return v || ''; }
    };

    for (const url of unsafeUrls) {
        const win = runInNewWindow(myTreesCardVisualsJs, { LoveBudMyTreesUtils: utils });
        const treeWithNoText = {
            title: 'Test',
            representativeThumbnail: url,
            memories: []
        };
        const html = win.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
            treeWithNoText,
            function(k) { return k; }
        );
        // unsafe URL should NOT appear in any src attribute
        const srcMatch = html.match(/src="([^"]+)"/g);
        if (srcMatch) {
            for (const s of srcMatch) {
                assert.ok(!s.includes(url), 'Unsafe URL "' + url + '" must not appear in src');
            }
        }
        // Should fall back to SVG or text
        assert.ok(
            /tree-card-media-fallback/.test(html) || /tree-card-text-visual/.test(html),
            'Unsafe thumbnail must fall back to SVG or text cover'
        );
    }

    // With unsafe thumbnail + text meta -> text-led cover
    const win2 = runInNewWindow(myTreesCardVisualsJs, { LoveBudMyTreesUtils: utils });
    const treeWithText = {
        title: 'Test',
        representativeThumbnail: 'javascript:alert(1)',
        representativeTitle: 'Safe Title',
        representativeMemo: 'Safe memo',
        memories: []
    };
    const htmlText = win2.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        treeWithText,
        function(k) { return k; }
    );
    assert.ok(/tree-card-text-visual/.test(htmlText),
        'Unsafe thumbnail with text meta must render text-led cover');
    assert.ok(htmlText.includes('Safe Title'), 'Text cover must show the title');

    // Safe https thumbnail must still render <img>
    const win3 = runInNewWindow(myTreesCardVisualsJs, { LoveBudMyTreesUtils: utils });
    const treeSafe = {
        title: 'Safe',
        representativeThumbnail: 'https://example.com/safe.jpg',
        memories: []
    };
    const safeHtml = win3.LoveBudMyTreesCardVisuals.buildTreeThumbVisual(
        treeSafe,
        function(k) { return k; }
    );
    assert.ok(/<img\s/.test(safeHtml), 'Safe https thumbnail must render <img>');
    assert.ok(safeHtml.includes('safe.jpg'), 'Safe thumbnail URL must appear in output');
});
