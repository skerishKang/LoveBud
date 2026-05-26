const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

test('public viewer control visibility helper declares editor action and status rules', () => {
  const helperSrc = readFile('js/viewer/public-viewer-control-visibility-helper.js');

  assert.ok(helperSrc.includes('LoveBudPublicViewerControlVisibilityHelper'), 'public viewer control visibility helper must expose an inspectable namespace');
  assert.ok(helperSrc.includes('getControlSelectors'), 'public viewer control visibility helper must expose control selector rules');
  assert.ok(helperSrc.includes("'#editMemoryBtn'"), 'public viewer must hide the editor memory edit action');
  assert.ok(helperSrc.includes("'#continueFromMomentBtn'"), 'public viewer must hide the editor continue-from-moment action');
  assert.ok(helperSrc.includes("'.editor-save-status-card'"), 'public viewer must hide the editor save-status card');
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
