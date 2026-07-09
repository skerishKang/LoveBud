'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const COMPOSER_PATH = path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js');
const SUMMARY_PATH = path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js');
const TEMPLATE_PATH = path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js');

function readSrc(relPath) {
    return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

describe('1. Clarified composer status copy present', () => {
    it('validation (empty) copy clarified', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerErrorEl.textContent = '댓글 내용을 입력해 주세요.';"),
            'Validation empty copy must be clarified');
    });

    it('validation (length) copy clarified', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerErrorEl.textContent = '댓글은 5,000자 이하로 입력해 주세요.';"),
            'Validation length copy must be clarified');
    });

    it('pending/submitting copy clarified', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("submitBtn.textContent = '남기는 중...';"),
            'Pending copy must be clarified to 남기는 중');
    });

    it('success copy clarified', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerSuccessEl.textContent = '댓글을 남겼어요.';"),
            'Success copy must be clarified');
    });

    it('safe error copy clarified and consistent', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerErrorEl.textContent = '댓글을 남기지 못했어요. 다시 시도해 주세요.';"),
            'Safe error copy must be clarified and consistent with 남기다 verb');
    });
});

describe('2. Old/inconsistent composer copy removed', () => {
    it('does not contain legacy success copy', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes('댓글이 등록되었습니다'), 'Legacy success copy must be removed');
    });

    it('does not contain legacy pending copy', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes("submitBtn.textContent = '등록 중...'"), 'Legacy pending copy must be removed');
    });

    it('does not contain legacy error copy', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes('등록하지 못했습니다'), 'Legacy error copy must be removed');
    });

    it('does not contain space-less validation copy', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes('댓글 내용을 입력해주세요'), 'Space-less validation copy must be removed');
    });
});

describe('3. Stable composer IDs and accessibility semantics preserved', () => {
    it('composer mounts into stable momentCommentsPanel', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("document.getElementById('momentCommentsPanel')"),
            'Composer must still resolve the stable momentCommentsPanel ID');
    });

    it('template still exposes momentCommentsPanel', () => {
        const template = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(template.includes('id="momentCommentsPanel"'), 'Template must expose momentCommentsPanel');
    });

    it('composer error region keeps aria-live polite', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerErrorEl.setAttribute('aria-live', 'polite')"),
            'Error region must keep aria-live polite');
    });

    it('composer success region keeps aria-live polite', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerSuccessEl.setAttribute('aria-live', 'polite')"),
            'Success region must keep aria-live polite');
    });

    it('input keeps aria-label and cancel keeps aria-label', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes("composerInputEl.setAttribute('aria-label', '댓글 입력')"),
            'Input aria-label must be preserved');
        assert.ok(src.includes("composerCancelBtn.setAttribute('aria-label', '댓글 입력 취소')"),
            'Cancel aria-label must be preserved');
    });
});

describe('4. No API / auth / session / write behavior change', () => {
    it('createComment call preserved', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('createComment('), 'createComment call must be preserved');
    });

    it('auth/session gating preserved', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('hasConfirmedAuthSession'), 'hasConfirmedAuthSession gating must be preserved');
    });

    it('idempotency key generation preserved', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('composerDraftIdemKey'), 'Idempotency key handling must be preserved');
    });

    it('refresh/reconcile semantics preserved', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(src.includes('reconcilePublicSummary'), 'reconcilePublicSummary refresh must be preserved');
    });

    it('no new API client or auth policy introduced', () => {
        const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
        assert.ok(!src.includes('apiClient'), 'Must not introduce apiClient');
        assert.ok(!src.includes('LoveTreeAuthPolicy'), 'Must not introduce auth policy');
        assert.ok(!src.includes('localStorage'), 'Must not introduce localStorage');
        assert.ok(!src.includes('optimistic'), 'Must not introduce optimistic rendering');
        assert.ok(!src.includes('login'), 'Must not introduce login implementation');
    });

    it('read-only social summary unchanged in meaning', () => {
        const src = readSrc('js/viewer/public-viewer-read-only-social-summary.js');
        assert.ok(src.includes('fetchPublicMomentReactionSummary') || src.includes('fetchReactionSummary'),
            'Summary fetch dependency must remain');
        assert.ok(!src.includes('createComment'), 'Summary must not introduce write behavior');
    });
});

describe('5. No out-of-scope changes (tree social / #3264 / Netlify / Browse / My Trees / Scout / Editor)', () => {
    const src = readSrc('js/viewer/public-viewer-authenticated-comment-composer.js');
    const treePatterns = ['likeTree', 'unlikeTree', 'fetchTreeLikes', 'createTreeComment', 'fetchTreeComments'];
    for (const p of treePatterns) {
        it('composer does not reference tree-level social: ' + p, () => {
            assert.ok(!src.includes(p), 'Must not reference tree-level social: ' + p);
        });
    }

    it('composer does not reference Netlify / dashboard / #3348 ops', () => {
        assert.ok(!src.toLowerCase().includes('netlify'), 'Must not reference Netlify');
        assert.ok(!src.includes('dashboard'), 'Must not reference dashboard');
    });

    it('composer does not reference Browse/My Trees/Scout/Editor', () => {
        assert.ok(!src.includes('my-trees'), 'Must not reference my-trees');
        assert.ok(!src.includes('Scout') && !src.includes('scout'), 'Must not reference Scout');
        assert.ok(!src.includes('search'), 'Must not reference search/Browse');
    });

    it('template has no DB/API/deploy references', () => {
        const template = readSrc('js/viewer/public-viewer-detail-view-mode-template.js');
        assert.ok(!template.includes('migration'), 'Template must not reference migration');
        assert.ok(!template.includes('schema'), 'Template must not reference schema');
        assert.ok(!template.includes('deploy'), 'Template must not reference deploy');
    });
});
