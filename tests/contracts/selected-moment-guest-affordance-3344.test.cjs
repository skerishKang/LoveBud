'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js');
const AUTH_LIKE_PATH = path.join(ROOT, 'js/viewer/public-viewer-authenticated-like.js');
const CANVAS_ENTRY_PATH = path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js');
const CANVAS_INIT_PATH = path.join(ROOT, 'js/viewer/public-canvas-init.js');

function readSrc(relPath) {
    return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Guest affordance text exists
// ---------------------------------------------------------------------------

describe('1. Guest affordance text in template', () => {
    it('momentReactionLikeGuestNote contains the combined guest affordance text', () => {
        const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(src.includes('momentReactionLikeGuestNote'),
            'momentReactionLikeGuestNote element must exist');
        assert.ok(src.includes('로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요'),
            'Template default guest note must contain the combined affordance text');
    });

    it('authenticated-like.js showGuestMode uses the combined guest affordance text', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요'),
            'Runtime guest note must contain the combined affordance text');
    });

    it('authenticated-like.js keeps guest note hidden by default before guest mode activates', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('guestNoteEl.style.display'),
            'authenticated-like must manage guestNoteEl display state');
    });
});

describe('2. Authenticated behavior unchanged', () => {
    it('authenticated-like.js still gates on hasConfirmedAuthSession', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('hasConfirmedAuthSession'),
            'Auth gating must remain');
    });

    it('authenticated-like.js still calls fetchReactionSummary for private state', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('fetchReactionSummary'),
            'Private reaction summary fetch must remain');
    });

    it('authenticated-like.js still calls toggleReaction for writes', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('toggleReaction'),
            'Toggle reaction call must remain');
    });

    it('authenticated-comment-composer.js still gates on hasConfirmedAuthSession', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('hasConfirmedAuthSession'),
            'Comment composer auth gating must remain');
    });

    it('authenticated-comment-composer.js still calls createComment for writes', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('createComment'),
            'Comment composer createComment call must remain');
    });
});

describe('3. Guest mutation calls remain blocked / read-only', () => {
    it('showGuestMode hides like button and disables it', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        const showGuestModeMatch = src.match(/function showGuestMode[\s\S]*?^        }/m);
        assert.ok(showGuestModeMatch, 'showGuestMode function must exist');
        const fnBody = showGuestModeMatch[0];
        assert.ok(fnBody.includes('likeButtonEl.style.display = \'none\''),
            'Guest mode must hide like button');
        assert.ok(fnBody.includes('likeButtonEl.disabled = true'),
            'Guest mode must disable like button');
    });

    it('showGuestMode sets card to read-only', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(src.includes('setCardReadOnly'),
            'Guest mode must set card to read-only');
        assert.ok(src.includes('data-read-only-summary'),
            'Card must have read-only summary marker');
    });

    it('template like button is disabled by default', () => {
        const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(src.includes('id="momentReactionLikeButton"'),
            'Like button element must exist');
        assert.ok(src.includes('disabled'),
            'Like button must be disabled in template');
    });
});

describe('4. Selected-moment social IDs remain stable', () => {
    const requiredIds = [
        'momentReactionNote',
        'momentReactionLikeStatus',
        'momentReactionLikeButton',
        'momentReactionLikeGuestNote',
        'momentReactionCommentStatus',
        'momentCommentsPanel',
        'momentReactionLikeValue',
        'momentReactionCommentValue',
        'momentCommentsList',
    ];

    for (const id of requiredIds) {
        it(`preserves element ID: ${id}`, () => {
            const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
            assert.ok(src.includes(`id="${id}"`), `Element ID ${id} must exist in template`);
        });
    }
});

describe('5. No API/auth/session/runtime behavior changed', () => {
    it('detail-view-mode-template.js has no fetch/toggle API calls', () => {
        const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(!src.includes('fetchReactionSummary'), 'No fetchReactionSummary in template');
        assert.ok(!src.includes('toggleReaction'), 'No toggleReaction in template');
        assert.ok(!src.includes('createComment'), 'No createComment in template');
    });

    it('auth-like does not reference LoveTreeAuthPolicy directly', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(!src.includes('LoveTreeAuthPolicy'),
            'Should not import LoveTreeAuthPolicy directly');
    });

    it('auth-like does not reference optimistic/idempotency', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        // Optimistic write pattern via rollback is correct; direct idempotency in like is not
        assert.ok(!src.includes('idempotencyKey'), 'No idempotency key in auth like');
    });

    it('no localStorage or sessionStorage in relevant files', () => {
        for (const relPath of ['js/viewer/public-viewer-detail-view-mode-template.js']) {
            const src = readSrc(relPath);
            assert.ok(!src.includes('localStorage'), `${relPath} must not use localStorage`);
            assert.ok(!src.includes('sessionStorage'), `${relPath} must not use sessionStorage`);
        }
    });
});

describe('6. No tree-level social, Browse/My Trees/Scout/Editor scope', () => {
    const treePatterns = ['likeTree', 'unlikeTree', 'fetchTreeLikes', 'createTreeComment', 'fetchTreeComments'];

    for (const relPath of ['js/viewer/public-viewer-detail-view-mode-template.js',
                           'js/viewer/public-viewer-authenticated-like.js']) {
        for (const pattern of treePatterns) {
            it(`${relPath} does not reference ${pattern}`, () => {
                const src = readSrc(relPath);
                assert.ok(!src.includes(pattern),
                    `${relPath} must not reference ${pattern}`);
            });
        }
    }

    it('authenticated-like.js does not reference Scout, Browse, My Trees', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-like.js');
        assert.ok(!src.includes('Scout') && !src.includes('scout'), 'No Scout reference');
        assert.ok(!src.includes('browse') && !src.includes('Browse'), 'No Browse reference');
        assert.ok(!src.includes('my-trees') && !src.includes('My Trees'), 'No My Trees reference');
    });

    it('template does not reference migration, schema, deploy', () => {
        const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(!src.includes('migration'), 'No migration reference');
        assert.ok(!src.includes('schema'), 'No schema reference');
        assert.ok(!src.includes('deploy'), 'No deploy reference');
    });

    it('canvas-entry and canvas-init createDetailUIOptions still reference toggleReaction', () => {
        const entrySrc = readSrc('js/viewer/public-viewer-canvas-entry.js');
        const initSrc = readSrc('js/viewer/public-canvas-init.js');
        assert.ok(entrySrc.includes('toggleReaction'),
            'canvas-entry must still inject toggleReaction');
        assert.ok(initSrc.includes('toggleReaction'),
            'canvas-init must still inject toggleReaction');
    });
});
