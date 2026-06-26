/**
 * LoveBud Browse Card Thumbnail Priority Contract
 *
 * Locks the Browse card thumbnail selection order for #2903 follow-up:
 *
 * 1. tree.representativeThumbnail (대표 커버) - highest priority
 * 2. first moment thumbnail (첫 번째 순간 썸네일)
 * 3. tree.thumbnail (트리 기본 썸네일)
 *
 * This test verifies:
 * - representativeThumbnail takes precedence over first moment thumbnail
 * - fallback chain remains intact when representativeThumbnail is absent
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

function createWindow() {
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
            return value || '';
        }
    };
    const sharedUtils = {
        escapeHtml: security.escapeHtml
    };

    const mockElement = function () {
        return {
            setAttribute: function () {},
            appendChild: function () {}
        };
    };

    const win = {
        LoveBudSecurity: security,
        LoveBudSearchSharedUtils: sharedUtils,
        LoveBudSearchCardFallback: null
    };
    win.window = win;

    const ctx = { window: win, document: { createElement: function () { return new mockElement(); } } };
    vm.runInNewContext(searchCardFallbackJs, ctx);
    return ctx.window;
}

function renderMedia(tree, firstMem, titleText) {
    const win = createWindow();
    win.LoveBudSearchCardFallback.renderRepresentativeImage = function(src, alt) {
        return '<img src="' + src + '" alt="' + alt + '" />';
    };
    return win.LoveBudSearchCardFallback.renderRepresentativeMedia(
        tree,
        firstMem,
        titleText
    );
}

const TREE_DEFAULT = 'tree-default.jpg';
const CROWD = 'crowd.jpg';
const STANDING = 'members-standing.jpg';

test('Browse card selects tree.representativeThumbnail before first moment thumbnail', () => {
    const tree = { representativeThumbnail: STANDING, thumbnail: TREE_DEFAULT };
    const firstMem = { thumbnail: CROWD, title: '첫 순간' };
    const html = renderMedia(tree, firstMem, '테스트');

    assert.match(
        html,
        new RegExp(STANDING.replace('.', '\\.')),
        'representativeThumbnail should be selected when present'
    );
    assert.ok(
        !html.includes(CROWD),
        'firstMem.thumbnail should be ignored when representativeThumbnail exists'
    );
});

test('Browse card falls back to firstMem.thumbnail when no representativeThumbnail', () => {
    const tree = { thumbnail: TREE_DEFAULT };
    const firstMem = { thumbnail: CROWD, title: '첫 순간' };
    const html = renderMedia(tree, firstMem, '테스트');

    assert.match(
        html,
        new RegExp(CROWD.replace('.', '\\.')),
        'firstMem.thumbnail should be selected when representativeThumbnail is absent'
    );
    assert.ok(
        !html.includes(STANDING),
        'representativeThumbnail should not appear when absent'
    );
});

test('Browse card falls back to tree.thumbnail when both representativeThumbnail and firstMem.thumbnail are absent', () => {
    const tree = { thumbnail: TREE_DEFAULT };
    const firstMem = { title: '빈 순간' };
    const html = renderMedia(tree, firstMem, '테스트');

    assert.match(
        html,
        new RegExp(TREE_DEFAULT.replace('.', '\\.')),
        'tree.thumbnail should be selected when higher-priority thumbnails are absent'
    );
    assert.ok(
        !html.includes(STANDING),
        'representativeThumbnail should not appear when absent'
    );
    assert.ok(
        !html.includes(CROWD),
        'firstMem.thumbnail should not appear when absent'
    );
});

test('Browse card does NOT include representative_thumbnail or thumbnailUrl/thumbnailURL fallbacks', () => {
    assert.ok(
        !/representative_thumbnail/.test(searchCardFallbackJs),
        'representative_thumbnail fallback must not be added (outside agreed scope)'
    );
    assert.ok(
        !/thumbnailUrl/.test(searchCardFallbackJs),
        'thumbnailUrl fallback must not be added (outside agreed scope)'
    );
    assert.ok(
        !/thumbnailURL/.test(searchCardFallbackJs),
        'thumbnailURL fallback must not be added (outside agreed scope)'
    );
});
