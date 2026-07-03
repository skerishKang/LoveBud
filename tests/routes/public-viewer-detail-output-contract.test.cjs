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
  'momentReactionsCard'
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

test('public viewer adapter no longer delegates detail rendering to editor core', () => {
  const adapterSrc = readFile('js/viewer/public-viewer-detail-ui.js');

  assert.ok(adapterSrc.includes("var detailUI = {};"), 'public viewer adapter creates its own detail UI shell');
  assert.equal(adapterSrc.includes('window.createEditorDetailUI(deps)'), false, 'public viewer adapter no longer constructs through editor detail factory');
  assert.equal(adapterSrc.includes('var delegatedUpdateDetailPanel'), false, 'public viewer adapter no longer captures delegated detail update');
  assert.equal(adapterSrc.includes('delegatedUpdateDetailPanel(data);'), false, 'public viewer adapter no longer delegates detail rendering to editor core');
  assert.ok(adapterSrc.includes('updateReadOnlyReactionSummary(data);'), 'public viewer adapter applies read-only reaction summary');
});
