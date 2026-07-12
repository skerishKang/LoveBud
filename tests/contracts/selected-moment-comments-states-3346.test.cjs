'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const SUMMARY_PATH = path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js');
const TEMPLATE_PATH = path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js');
const COMPOSER_PATH = path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js');

function readSrc(relPath) {
    return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

describe('1. Comments panel empty state copy clarified', () => {
    it('summary shows clarified empty copy (open path)', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(src.includes('아직 댓글이 없어요. 이 순간에 첫 댓글을 남겨보세요.'),
            'Empty state must use clarified copy in openCommentPanel');
    });

    it('summary shows clarified empty copy (reconcile path)', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        const occurrences = src.split('아직 댓글이 없어요. 이 순간에 첫 댓글을 남겨보세요.').length - 1;
        assert.ok(occurrences >= 1,
            'Clarified empty copy must appear in the panel status assignment');
    });

    it('old terse empty copy removed', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        // The bare phrase alone (without the clarified suffix) is no longer assigned to the panel status.
        assert.ok(!src.includes("commentsPanelStatusEl.textContent = '아직 댓글이 없어요.';"),
            'Bare empty copy must not remain as panel status assignment');
    });
});

describe('2. Comments panel loading state copy clarified', () => {
    it('summary shows loading copy during open-panel reconciliation', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(src.includes("commentsPanelStatusEl.textContent = '댓글을 불러오는 중이에요.';"),
            'Loading copy must be shown in the panel status during preservePanel reload');
    });

    it('template/summary retains read-only toggle loading aria-label', () => {
        const summary = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        const template = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(summary.includes("'댓글 불러오는 중'"),
            'Toggle loading aria-label must be preserved in summary');
        assert.ok(template.includes('aria-label="댓글 불러오는 중"'),
            'Toggle loading aria-label must be preserved in template');
    });
});

describe('3. Stable selected-moment comments IDs preserved', () => {
    const ids = [
        'momentReactionCommentStatus',
        'momentReactionCommentValue',
        'momentCommentsPanel',
        'momentCommentsPanelStatus',
        'momentCommentsList'
    ];
    for (const id of ids) {
        it('template preserves ID ' + id, () => {
            const template = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
            assert.ok(template.includes('id="' + id + '"'), 'Template must contain ' + id);
        });
    }

    it('summary still resolves all comments-panel elements', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        for (const id of ['momentCommentsPanel', 'momentCommentsList', 'momentCommentsPanelStatus', 'momentReactionCommentStatus', 'momentReactionCommentValue']) {
            assert.ok(src.includes("getElementById('" + id + "')"),
                'Summary must still resolve ' + id);
        }
    });
});

describe('4. Existing error / permission copy preserved (no behavior change)', () => {
    it('card-level reaction-unavailable note preserved', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(src.includes("noteEl.textContent = '반응 정보를 불러올 수 없어요.';"),
            'Reaction-unavailable note must be preserved');
    });

    it('guest read-only comment note preserved', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요.'),
            'Guest permission note must be preserved');
    });

    it('guest affordance (like/comment) note preserved', () => {
        const template = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(template.includes('로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.'),
            'Guest affordance note from #3345 must be preserved');
    });
});

describe('5. No API / auth / runtime behavior change', () => {
    it('summary introduces no new API client calls', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(!src.includes('apiClient'), 'Summary must not introduce apiClient calls');
        assert.ok(src.includes('fetchPublicMomentReactionSummary') || src.includes('fetchReactionSummary'),
            'Existing fetch dependency reference must remain unchanged in meaning');
    });

    it('summary introduces no new write behavior', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(!src.includes('createComment'), 'Summary must not introduce createComment');
        assert.ok(!src.includes('localStorage'), 'Summary must not introduce localStorage');
        assert.ok(!src.includes('optimistic'), 'Summary must not introduce optimistic updates');
    });

    it('summary introduces no auth policy references', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(!src.includes('LoveTreeAuthPolicy'), 'Summary must not reference auth policy');
    });

    it('template has no DB/API/deploy references', () => {
        const src = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(!src.includes('migration'), 'Template must not reference migration');
        assert.ok(!src.includes('schema'), 'Template must not reference schema');
        assert.ok(!src.includes('deploy'), 'Template must not reference deploy');
    });

    it('comment composer introduces no new auth/login implementation', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes('login'), 'Composer must not introduce login implementation');
    });
});

describe('6. No tree-level social / out-of-scope changes', () => {
    it('summary does not reference tree-level social', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        const treePatterns = ['likeTree', 'unlikeTree', 'fetchTreeLikes', 'createTreeComment', 'fetchTreeComments'];
        for (const p of treePatterns) {
            assert.ok(!src.includes(p), 'Summary must not reference tree-level social: ' + p);
        }
    });

    it('summary does not reference Browse/My Trees/Scout/Editor', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(!src.includes('my-trees'), 'Summary must not reference my-trees');
        assert.ok(!src.includes('Scout') && !src.includes('scout'), 'Summary must not reference Scout');
    });
});
