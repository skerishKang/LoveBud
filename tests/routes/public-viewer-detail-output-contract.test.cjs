const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function buildPublicHtml() {
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFile('js/shared/canonical-appreciation-detail-presentation.js'), ctx);
  return ctx.window.LoveBudCanonicalAppreciationDetailPresentation.buildDetailViewModeHtml({
    authority: 'public-safe'
  });
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
  const html = buildPublicHtml();

  // Thin wrapper must not re-own a full independent template.
  assert.ok(templateSrc.includes('LoveBudCanonicalAppreciationDetailPresentation'));
  assert.ok(!templateSrc.includes('const template'), 'public wrapper must not embed a second full template literal');

  PUBLIC_DETAIL_MOUNTS.forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `public-safe shared builder output exposes #${id}`);
  });

  assert.equal(html.includes('id="editMemoryBtn"'), false, 'public viewer output does not expose editor edit action');
  assert.equal(html.includes('id="continueFromMomentBtn"'), false, 'public viewer output does not expose editor continue action');
  assert.equal(html.includes('id="viewMomentDetailBtn"'), false, 'public viewer output does not expose noop detail action');
});

test('public viewer adapter no longer delegates detail rendering to editor core', () => {
  const adapterSrc = readFile('js/viewer/public-viewer-detail-ui.js');

  assert.ok(adapterSrc.includes("var detailUI = {};"), 'public viewer adapter creates its own detail UI shell');
  assert.equal(adapterSrc.includes('window.createEditorDetailUI(deps)'), false, 'public viewer adapter no longer constructs through editor detail factory');
  assert.equal(adapterSrc.includes('var delegatedUpdateDetailPanel'), false, 'public viewer adapter no longer captures delegated detail update');
  assert.equal(adapterSrc.includes('delegatedUpdateDetailPanel(data);'), false, 'public viewer adapter no longer delegates detail rendering to editor core');
  assert.ok(adapterSrc.includes('updateReadOnlyReactionSummary(data);'), 'public viewer adapter applies read-only reaction summary');
});
