const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-tree-meta.js', 'utf8');

test('public viewer tree meta helper keeps share action but omits inert detail action', () => {
  assert.ok(source.includes('const createShareTreeButton = () => createPillButton'), 'share button helper remains');
  assert.ok(source.includes('shareButtonEl: shareBtn'), 'render model still exposes share button element');
  assert.ok(source.includes('bindShareButton({'), 'render boundary still binds share action');

  assert.equal(source.includes('createOpenDetailButton'), false, 'public viewer tree meta must not create detail action button');
  assert.equal(source.includes('bindOpenDetailButton'), false, 'public viewer tree meta must not bind inert detail action');
  assert.equal(source.includes('openDetailButtonEl'), false, 'render model must not expose detail action element');
  assert.equal(source.includes('openDetailBtn'), false, 'render model must not expose detail action button');
});

test('public viewer tree meta helper no longer depends on openCurrentMomentDetail', () => {
  assert.equal(source.includes('openCurrentMomentDetail'), false, 'public tree meta helper should not depend on editor detail navigation');
});
