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
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

const searchCardFallbackJs = fs.readFileSync(
    path.join(ROOT, 'js/search/search-card-fallback.js'),
    'utf8'
);

test('Browse card selects tree.representativeThumbnail before first moment thumbnail', () => {
    assert.match(
        searchCardFallbackJs,
        /tree\.representativeThumbnail\s*\|\|\s*firstMem\?\.thumbnail\s*\|\|\s*tree\.thumbnail/,
        'Browse card must prioritize tree.representativeThumbnail over first moment thumbnail'
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

test('Browse card preserves fallback chain: firstMem.thumbnail -> tree.thumbnail when no representativeThumbnail', () => {
    const fallbackChain = /firstMem\?\.thumbnail\s*\|\|\s*tree\.thumbnail/.test(searchCardFallbackJs);
    assert.ok(
        fallbackChain,
        'Fallback chain from first moment thumbnail to tree thumbnail must be preserved'
    );
});
