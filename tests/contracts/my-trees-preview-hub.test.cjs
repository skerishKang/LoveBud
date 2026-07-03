const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const HUB_PATH = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');

test('1. Hub does not call toggleReaction with tree IDs', () => {
    const hubSrc = fs.readFileSync(HUB_PATH, 'utf8');
    assert.ok(!hubSrc.includes('toggleReaction'), 'toggleReaction must not be called in My Trees preview hub');
});

test('2. Like button is disabled', () => {
    const hubSrc = fs.readFileSync(HUB_PATH, 'utf8');
    // Check for the disabled attribute on the like button
    const likeBtnPattern = '<button type="button" class="preview-social-action" aria-label="좋아요 0" disabled>';
    assert.ok(hubSrc.includes(likeBtnPattern), 'Like button must be disabled');
});

test('3. No optimistic reaction count updates', () => {
    const hubSrc = fs.readFileSync(HUB_PATH, 'utf8');
    // Check for potential optimistic update logic (e.g., likeCount++, likeCount--)
    // This is a simple heuristic.
    assert.ok(!hubSrc.includes('likeCount++'), 'Optimistic increment of likeCount found');
    assert.ok(!hubSrc.includes('likeCount--'), 'Optimistic decrement of likeCount found');
    assert.ok(!hubSrc.includes('like_count++'), 'Optimistic increment of like_count found');
    assert.ok(!hubSrc.includes('like_count--'), 'Optimistic decrement of like_count found');
});

test('4. Display count rendering is preserved', () => {
    const hubSrc = fs.readFileSync(HUB_PATH, 'utf8');
    assert.ok(hubSrc.includes('data-my-trees-social-likes'), 'Like count rendering element not found');
    assert.ok(hubSrc.includes('String(tree.likeCount || tree.like_count || 0)'), 'Like count rendering logic not found');
});
