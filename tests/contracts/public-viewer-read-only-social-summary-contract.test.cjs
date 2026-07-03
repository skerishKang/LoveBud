const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const templateSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'css/editor/editor-overrides.css'), 'utf8');

function reactionCardSlice() {
  const start = templateSource.indexOf('id="momentReactionsCard"');
  assert.notEqual(start, -1, 'momentReactionsCard must exist');
  const before = templateSource.lastIndexOf('<div', start);
  const end = templateSource.indexOf('</div>\n                </div>', start);
  assert.notEqual(before, -1, 'reaction card opening div must exist');
  assert.notEqual(end, -1, 'reaction card closing boundary must exist');
  return templateSource.slice(before, end + '</div>'.length);
}

function readOnlyBoundarySlice() {
  const start = uiSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const end = uiSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  assert.notEqual(start, -1, 'read-only reaction summary boundary must exist');
  assert.notEqual(end, -1, 'tree meta boundary must follow reaction summary boundary');
  return uiSource.slice(start, end);
}

test('public viewer social row is marked as read-only summary', () => {
  assert.match(reactionCardSlice(), /data-read-only-summary="true"/);
});

test('public viewer social row contains no button elements', () => {
  assert.doesNotMatch(reactionCardSlice(), /<button\b/i);
});

test('obsolete compatibility IDs and helper routines are removed', () => {
  const combined = [templateSource, uiSource].join('\n');
  assert.doesNotMatch(combined, /momentLikeBtn/);
  assert.doesNotMatch(combined, /momentCommentBtn/);
  assert.doesNotMatch(combined, /momentLikeCount/);
  assert.doesNotMatch(combined, /momentCommentCount/);
  assert.doesNotMatch(combined, /applyReadOnlyReactionFallback/);
  assert.doesNotMatch(combined, /updateReadOnlyReactionCounts/);
});

test('read-only visible copy is present', () => {
  assert.match(reactionCardSlice(), /반응 기능은 준비 중이에요\./);
  assert.match(reactionCardSlice(), /좋아요 정보 없음/);
  assert.match(reactionCardSlice(), /댓글 정보 없음/);
  assert.match(reactionCardSlice(), /—/);
});

test('social row has status role and no interactive elements/classes', () => {
  const slice = reactionCardSlice();
  assert.doesNotMatch(slice, /\btabindex=/i);
  assert.doesNotMatch(slice, /\brole="button"/i);
  assert.doesNotMatch(slice, /\baria-pressed=/i);
  assert.doesNotMatch(slice, /\bonclick=/i);
  assert.match(slice, /role="status"/);
  assert.doesNotMatch(slice, /\beditor-moment-reaction\b(?!s-card|-readonly-note)/);
  assert.doesNotMatch(slice, /editor-reaction-like-btn/);
  assert.doesNotMatch(slice, /editor-reaction-comment-btn/);
  assert.doesNotMatch(slice, /editor-moment-reaction-stat/);
});

test('CSS selectors are scoped to public read-only boundary', () => {
  assert.match(cssSource, /\.editor-moment-reactions-card\.is-public-readonly\s+\.public-viewer-social-status/);
  assert.doesNotMatch(cssSource, /\.editor-moment-reaction-stat\b/);
});

test('modified sources do not add public viewer reaction writes or provider/db hooks', () => {
  const combined = [templateSource, uiSource, cssSource].join('\n');
  assert.doesNotMatch(combined, /toggleReaction/);
  assert.doesNotMatch(combined, /createComment|commentsDrawer|commentComposer/);
  assert.doesNotMatch(combined, /from=editor/);
  assert.doesNotMatch(combined, /\b(?:insert|update|delete|upsert)\s*\(/i);
  assert.doesNotMatch(combined, /\b(?:Neon|provider|database|migration)\b/i);
});

test('modified files do not close #1882', () => {
  const files = [
    'js/viewer/public-viewer-detail-view-mode-template.js',
    'js/viewer/public-viewer-detail-ui.js',
    'css/editor/editor-overrides.css',
    'tests/contracts/public-viewer-reaction-safe-fallback-contract.test.cjs',
    'tests/routes/public-viewer-reactions-contract.test.cjs',
    'tests/contracts/public-viewer-read-only-social-summary-contract.test.cjs'
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /(?:Closes|Fixes|Resolves) #1882/);
  }
});
