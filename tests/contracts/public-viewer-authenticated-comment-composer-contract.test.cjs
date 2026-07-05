'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// ---------------------------------------------------------------------------
// Source-level contract tests
// ---------------------------------------------------------------------------

it('1. guest path: read-only boundary must NOT contain createComment or composer', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);
  assert.equal(boundary.includes('createComment'), false,
    'read-only boundary must not reference createComment');
  assert.equal(boundary.includes('composer'), false,
    'read-only boundary must not reference composer');
  assert.equal(boundary.includes('toggleReaction'), false,
    'read-only boundary must not reference toggleReaction');
});

it('2. authenticated composer boundary exists and references createComment', () => {
  const composerStart = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  assert.ok(composerStart >= 0, 'composer boundary function must exist');

  const composerEnd = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const composer = scriptSource.slice(composerStart, composerEnd);

  assert.ok(composer.includes('createComment'), 'composer boundary must use createComment');
  assert.ok(composer.includes('hasConfirmedAuthSession'), 'composer boundary must check auth');
  assert.ok(composer.includes('maxLength'), 'composer must enforce maxLength');
  assert.ok(composer.includes('aria-live'), 'composer error must have aria-live');
  assert.ok(composer.includes('composerDraftIdemKey'), 'composer must track idempotency key');
  assert.ok(composer.includes('submitGen'), 'composer must track submission generation');
  assert.ok(composer.includes('reconcilePublicSummary'), 'composer must trigger reconciliation on success');
  assert.ok(!composer.includes('toggleReaction'), 'composer must not reference toggleReaction');
});

it('3. composer wired in createPublicViewerDetailUI', () => {
  const mainFn = scriptSource.indexOf('function createPublicViewerDetailUI(deps)');
  const rest = scriptSource.slice(mainFn);

  assert.ok(rest.includes('updateCommentComposer'), 'detailUI must create composer update function');
  assert.ok(rest.includes('createPublicViewerAuthenticatedCommentComposerBoundary'),
    'detailUI must instantiate composer boundary');
  assert.ok(rest.includes('reconcilePublicSummary: updateReadOnlyReactionSummary'),
    'composer must reconcile via read-only summary');
});

it('4. canvas-entry.js injects createComment via apiClient', () => {
  const entrySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(entrySrc.includes('createComment: typeof apiClient.createComment'),
    'canvas-entry must inject createComment from apiClient');
});

it('5. canvas-init.js injects createComment via apiClient (safe fallback)', () => {
  const initSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(initSrc.includes('apiClient.createComment'),
    'canvas-init must reference apiClient.createComment');
});

it('6. guest read-only, reaction summary, retry features intact', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);

  assert.ok(boundary.includes('fetchPublicMomentReactionSummary'), 'must use public reaction callback');
  assert.ok(boundary.includes('fetchPublicMomentComments') || boundary.includes('fetchComments'),
    'must use public comments callback');
  assert.ok(boundary.includes('resetCommentsPanel'), 'must have reset function');
  assert.ok(boundary.includes('renderUnavailable'), 'must handle unavailable state');
  assert.ok(boundary.includes('[data-social-retry'), 'must have retry support');

  assert.equal(boundary.includes('toggleReaction'), false, 'no toggleReaction in read-only');
  assert.equal(boundary.includes('createComment'), false, 'no createComment in read-only');
});
