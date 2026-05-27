const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

test('public viewer detail template omits editor-only and noop controls', () => {
  const templateSrc = readFile('js/viewer/public-viewer-detail-view-mode-template.js');

  assert.equal(templateSrc.includes('id="editMemoryBtn"'), false, 'public viewer detail template must not render the editor memory edit action');
  assert.equal(templateSrc.includes('id="continueFromMomentBtn"'), false, 'public viewer detail template must not render the editor continue-from-moment action');
  assert.equal(templateSrc.includes('id="saveStatusIndicator"'), false, 'public viewer detail template must not render the editor save-status indicator');
  assert.equal(templateSrc.includes('class="editor-save-status-card"'), false, 'public viewer detail template must not render the editor save-status card');
  assert.equal(templateSrc.includes('id="viewMomentDetailBtn"'), false, 'public viewer detail template must not render a noop read-only detail action');
  assert.equal(templateSrc.includes('id="viewMomentDetailBtnLabel"'), false, 'public viewer detail template must not render noop detail action label');
  assert.ok(templateSrc.includes('id="momentReactionsCard"'), 'public viewer detail template keeps the reactions summary area');
  assert.ok(templateSrc.includes('id="detailMemo"'), 'public viewer detail template keeps memo rendering mount');
});

test('public viewer control visibility helper no longer carries stale editor-only fallback selectors', () => {
  const helperSrc = readFile('js/viewer/public-viewer-control-visibility-helper.js');

  assert.ok(helperSrc.includes('LoveBudPublicViewerControlVisibilityHelper'), 'public viewer control visibility helper must expose an inspectable namespace');
  assert.ok(helperSrc.includes('getControlSelectors'), 'public viewer control visibility helper must expose control selector rules');
  assert.equal(helperSrc.includes("'#editMemoryBtn'"), false, 'public viewer helper must not keep the stale editor memory edit selector');
  assert.equal(helperSrc.includes("'#continueFromMomentBtn'"), false, 'public viewer helper must not keep the stale continue-from-moment selector');
  assert.equal(helperSrc.includes("'.editor-save-status-card'"), false, 'public viewer helper must not keep the stale save-status selector');
  assert.ok(helperSrc.includes('return [];'), 'public viewer helper should currently return no fallback control selectors');
});

test('public viewer copy helper remains focused on copy rules', () => {
  const copyHelperSrc = readFile('js/viewer/public-viewer-copy-helper.js');

  assert.ok(copyHelperSrc.includes('LoveBudPublicViewerCopyHelper'), 'public viewer copy helper must expose an inspectable namespace');
  assert.ok(copyHelperSrc.includes('getTextRules'), 'public viewer copy helper must still expose text rules');
  assert.ok(copyHelperSrc.includes('getRawLayoutLabel'), 'public viewer copy helper must still expose layout label fallback rules');
  assert.equal(copyHelperSrc.includes('getHideSelectors'), false, 'copy helper must not own control visibility selector rules');
});

test('public viewer copy polish applies control visibility rules only in readonly viewer mode', () => {
  const polishSrc = readFile('js/viewer/public-viewer-copy-polish.js');

  assert.ok(polishSrc.includes('document.body.classList.contains(\'editor-readonly\')'), 'copy polish must only apply public viewer rules in readonly mode');
  assert.ok(polishSrc.includes('function hide(selector)'), 'copy polish must keep a dedicated hide routine');
  assert.ok(polishSrc.includes('el.hidden = true'), 'hide routine must set the hidden attribute');
  assert.ok(polishSrc.includes("el.style.display = 'none'"), 'hide routine must remove the element from layout');
  assert.ok(polishSrc.includes('LoveBudPublicViewerControlVisibilityHelper'), 'copy polish must read visibility rules from the control visibility helper');
  assert.ok(polishSrc.includes('helper.getControlSelectors().forEach(hide)'), 'copy polish must apply all helper-provided control selectors');
});
