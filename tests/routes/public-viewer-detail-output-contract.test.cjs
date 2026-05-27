const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

const PUBLIC_DETAIL_MOUNTS = [
  'detailViewMode',
  'detailTreeMetaMount',
  'detailCurrentMomentBadge',
  'detailCurrentMomentTitle',
  'detailCurrentMomentHint',
  'detailImg',
  'detailMomentInfoLabel',
  'detailDateText',
  'detailTags',
  'detailMemo',
  'momentReactionsCard',
  'momentLikeBtn',
  'momentCommentBtn'
];

test('public viewer detail template exposes the current rendered output mounts', () => {
  const templateSrc = readFile('js/viewer/public-viewer-detail-view-mode-template.js');

  PUBLIC_DETAIL_MOUNTS.forEach((id) => {
    assert.ok(templateSrc.includes(`id="${id}"`), `public viewer detail template exposes #${id}`);
  });

  assert.equal(templateSrc.includes('id="editMemoryBtn"'), false, 'public viewer output does not expose editor edit action');
  assert.equal(templateSrc.includes('id="continueFromMomentBtn"'), false, 'public viewer output does not expose editor continue action');
  assert.equal(templateSrc.includes('id="viewMomentDetailBtn"'), false, 'public viewer output does not expose noop detail action');
});

test('public viewer adapter preserves delegated detail rendering before viewer-only post-processing', () => {
  const adapterSrc = readFile('js/viewer/public-viewer-detail-ui.js');

  assert.ok(adapterSrc.includes('window.createEditorDetailUI(deps)'), 'public viewer adapter still delegates to editor detail core');
  assert.ok(adapterSrc.includes('var delegatedUpdateDetailPanel = typeof detailUI.updateDetailPanel === \'function\''), 'public viewer adapter captures the delegated detail update');
  assert.ok(adapterSrc.includes('delegatedUpdateDetailPanel(data);'), 'public viewer adapter preserves delegated detail rendering first');
  assert.ok(adapterSrc.includes('updateReadOnlyReactionSummary(data);'), 'public viewer adapter applies read-only reaction summary after rendering');
});
