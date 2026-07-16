'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(ROOT, 'js/shared/canonical-appreciation-detail-presentation.js');

function readSrc(relPath) {
    return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

describe('1. Stale placeholder removed from template', () => {
    it('does not contain the stale "반응 기능은 준비 중이에요" string', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('반응 기능은 준비 중이에요'),
            'Template must not contain the stale placeholder text');
    });
});

describe('2. Replacement placeholder present', () => {
    it('contains the loading placeholder "반응 정보를 불러오는 중이에요"', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('반응 정보를 불러오는 중이에요'),
            'Template must contain the loading placeholder text');
    });
});

describe('3. Existing selected-moment social IDs preserved', () => {
    it('preserves momentReactionNote element ID', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('id="momentReactionNote"'), 'momentReactionNote ID must exist');
    });

    it('preserves momentReactionLikeStatus element ID', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('id="momentReactionLikeStatus"'), 'momentReactionLikeStatus ID must exist');
    });

    it('preserves momentReactionLikeButton element ID', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('id="momentReactionLikeButton"'), 'momentReactionLikeButton ID must exist');
    });

    it('preserves momentReactionCommentStatus element ID', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('id="momentReactionCommentStatus"'), 'momentReactionCommentStatus ID must exist');
    });

    it('preserves momentCommentsPanel element ID', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(src.includes('id="momentCommentsPanel"'), 'momentCommentsPanel ID must exist');
    });
});

describe('4. No API/auth/runtime behavior changed', () => {
    it('detail-view-mode-template.js has no API client calls', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('apiClient'), 'Template must not contain apiClient calls');
        assert.ok(!src.includes('fetchReactionSummary'), 'Template must not contain fetchReactionSummary');
        assert.ok(!src.includes('toggleReaction'), 'Template must not contain toggleReaction');
        assert.ok(!src.includes('createComment'), 'Template must not contain createComment');
    });

    it('detail-view-mode-template.js has no auth policy references', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('LoveTreeAuthPolicy'), 'Template must not reference auth policy');
        assert.ok(!src.includes('hasConfirmedAuthSession'), 'Template must not reference hasConfirmedAuthSession');
    });

    it('detail-view-mode-template.js has no write behavior', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('localStorage'), 'Template must not use localStorage');
        assert.ok(!src.includes('optimistic'), 'Template must not reference optimistic updates');
        assert.ok(!src.includes('idempotencyKey'), 'Template must not reference idempotency key');
    });
});

describe('5. No tree-level social or out-of-scope changes', () => {
    it('detail-view-mode-template.js does not reference tree-level social', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        const treePatterns = ['likeTree', 'unlikeTree', 'fetchTreeLikes', 'createTreeComment', 'fetchTreeComments'];
        for (const p of treePatterns) {
            assert.ok(!src.includes(p), 'Template must not reference tree-level social: ' + p);
        }
    });

    it('detail-view-mode-template.js does not reference Browse/My Trees/Scout', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('search'), 'Template must not reference search');
        assert.ok(!src.includes('my-trees'), 'Template must not reference my-trees');
        assert.ok(!src.includes('Scout') && !src.includes('scout'), 'Template must not reference Scout');
    });

    it('detail-view-mode-template.js is pure DOM template with no DB/API/deploy references', () => {
        const src = readSrc('js/shared/canonical-appreciation-detail-presentation.js');
        assert.ok(!src.includes('migration'), 'Template must not reference migration');
        assert.ok(!src.includes('schema'), 'Template must not reference schema');
        assert.ok(!src.includes('deploy'), 'Template must not reference deploy');
    });
});
