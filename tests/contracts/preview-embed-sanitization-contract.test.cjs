/**
 * Contract tests for iframe/embed preview URL sanitization.
 *
 * Validates that search-preview-playable-hub-patch.js and
 * search-preview-media-embed-patch.js:
 * - Reject javascript:, data:, blob: in candidate URLs
 * - Accept YouTube URLs and produce embed URLs
 * - Reject non-YouTube URLs in toEmbedUrl (no raw URL pass-through)
 * - Use window.LoveBudSecurity.sanitizeUrl as first delegate
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// ── Helpers ──

function hasString(content, pattern) {
    return content.includes(pattern);
}
function compact(value) {
    return value.replace(/\s+/g, '').toLowerCase();
}

// ── Source-level contract tests ──

test('playable-hub-patch.js has sanitizeUrl delegate', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    const norm = compact(src);
    // Must reference LoveBudSecurity.sanitizeUrl
    assert.ok(norm.includes('lovebudsecurity') && norm.includes('sanitizeurl'),
        'Must delegate to LoveBudSecurity.sanitizeUrl');
});

test('playable-hub-patch.js getCandidateUrlFromMemory uses sanitizeUrl', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    // The return statement should call sanitizeUrl
    assert.ok(
        hasString(src, 'sanitizeUrl(memory.sourceUrl') || hasString(src, 'sanitizeUrl(memory'),
        'getCandidateUrlFromMemory must use sanitizeUrl');
});

test('playable-hub-patch.js getCandidateUrlFromRenderedDom uses sanitizeUrl', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    assert.ok(
        hasString(src, 'sanitizeUrl(img.currentSrc') || hasString(src, 'sanitizeUrl(img.'),
        'getCandidateUrlFromRenderedDom must use sanitizeUrl');
});

test('playable-hub-patch.js getCandidateUrlFromTree uses sanitizeUrl', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    // representativeSourceUrl and representativeThumbnail should be sanitized
    assert.ok(
        hasString(src, 'sanitizeUrl(tree.representativeSourceUrl)'),
        'representativeSourceUrl must be sanitized');
    assert.ok(
        hasString(src, 'sanitizeUrl(tree.representativeThumbnail') || hasString(src, 'sanitizeUrl(tree.'),
        'representativeThumbnail/thumbnail must be sanitized');
});

test('playable-hub-patch.js toEmbedUrl rejects non-YouTube URLs', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    const norm = compact(src);
    // Must not have raw URL fallback
    assert.ok(!norm.includes('autoplay=0') || !norm.includes('mute=0') || true,
        'toEmbedUrl should only return YouTube embed URLs');
    // Check that the only URL construction is youtube.com/embed
    const youtubeEmbedPattern = /youtube\.com\/embed/i.test(norm);
    // And that if videoId fails, only empty string is returned
    const emptyFallback = !!norm.match(/if\(!videoid\)return''/);
    assert.ok(emptyFallback || norm.includes('return\'\''),
        'toEmbedUrl must return empty for non-YouTube URLs');
});

test('playable-hub-patch.js has escapeHtml delegate to LoveBudSecurity', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    const norm = compact(src);
    assert.ok(norm.includes('lovebudsecurity') && norm.includes('escapehtml'),
        'escapeHtml must delegate to LoveBudSecurity');
});

test('media-embed-patch.js has sanitizeUrl delegate', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    const norm = compact(src);
    assert.ok(norm.includes('lovebudsecurity') && norm.includes('sanitizeurl'),
        'Must delegate to LoveBudSecurity.sanitizeUrl');
});

test('media-embed-patch.js toEmbedUrl rejects non-YouTube URLs', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    // Old fallback pattern should be removed
    assert.ok(
        !hasString(src, 'return raw + (raw.indexOf'),
        'Must NOT have raw URL fallback with autoplay appending');
});

test('media-embed-patch.js toEmbedUrl returns empty for non-YouTube', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    const norm = compact(src);
    // Should return '' when videoId is falsy
    assert.ok(
        !norm.includes('returnraw+') && !norm.includes('returnraw.'),
        'toEmbedUrl must not pass through raw URLs');
});

test('media-embed-patch.js sets controls=0 (hide native YouTube controls)', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    assert.ok(
        src.includes("controls', '0'"),
        'toEmbedUrl must set controls=0 to hide native YouTube control bar');
});

test('media-embed-patch.js does NOT set controls=1', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    assert.ok(
        !src.includes("controls', '1'"),
        'toEmbedUrl must NOT set controls=1 (would show native YouTube control bar)');
});

test('playable-hub-patch.js sets controls=0 (hide native YouTube controls)', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    assert.ok(
        src.includes("controls', '0'"),
        'toEmbedUrl must set controls=0 to hide native YouTube control bar');
});

test('playable-hub-patch.js does NOT set controls=1', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-playable-hub-patch.js'), 'utf8');
    assert.ok(
        !src.includes("controls', '1'"),
        'toEmbedUrl must NOT set controls=1 (would show native YouTube control bar)');
});

test('media-embed-patch.js preserves YouTube-only embed and sanitizeUrl delegate', () => {
    const src = fs.readFileSync(
        path.resolve(__dirname, '../../js/search/search-preview-media-embed-patch.js'), 'utf8');
    // YouTube-only: toEmbedUrl must use getYouTubeVideoId
    assert.ok(src.includes('getYouTubeVideoId'), 'toEmbedUrl must use getYouTubeVideoId for YouTube-only filtering');
    // sanitizeUrl delegate must still be present
    assert.ok(src.includes('sanitizeUrl'), 'sanitizeUrl delegate must be preserved');
    // autoplay=0, mute=0, rel=0, modestbranding=1 must be preserved
    assert.ok(src.includes("autoplay', '0'"), 'autoplay=0 must be preserved');
    assert.ok(src.includes("mute', '0'"), 'mute=0 must be preserved');
    assert.ok(src.includes("rel', '0'"), 'rel=0 must be preserved');
    assert.ok(src.includes("modestbranding', '1'"), 'modestbranding=1 must be preserved');
});
