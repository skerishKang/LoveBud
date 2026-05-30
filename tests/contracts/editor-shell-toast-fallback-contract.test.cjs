const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const editorHtmlSource = fs.readFileSync('pages/editor.html', 'utf8');

function getCreateInlineShowToastFallbackBlock() {
  const start = shellHelpersSource.indexOf('createInlineShowToastFallback: function()');
  assert.notEqual(start, -1, 'createInlineShowToastFallback helper must exist');

  const end = shellHelpersSource.indexOf('// Shell copy application', start);
  assert.notEqual(end, -1, 'createInlineShowToastFallback block must end before shell copy application');

  return shellHelpersSource.slice(start, end);
}

test('editor shell helpers expose inline show toast fallback helper', () => {
  assert.match(shellHelpersSource, /createInlineShowToastFallback:\s*function\(\)/);
});

test('inline show toast fallback preserves returned callback signature', () => {
  const block = getCreateInlineShowToastFallbackBlock();

  assert.match(block, /return\s*\(message,\s*type\s*=\s*'info'\)\s*=>\s*\{/);
});

test('inline show toast fallback prefers LoveBudUI showToast with duration', () => {
  const block = getCreateInlineShowToastFallbackBlock();

  assert.match(block, /if \(window\.LoveBudUI\?\.showToast\)/);
  assert.match(block, /window\.LoveBudUI\.showToast\(message,\s*type,\s*3000\)/);
});

test('inline show toast fallback preserves one-shot degraded warning guard', () => {
  const block = getCreateInlineShowToastFallbackBlock();

  assert.match(block, /if \(!window\.__editorToastWarningShown\)/);
  assert.match(block, /console\.warn\('\[editor\] LoveBudUI not loaded, toast degraded to console'\)/);
  assert.match(block, /window\.__editorToastWarningShown\s*=\s*true/);
});

test('inline show toast fallback preserves console log fallback format', () => {
  const block = getCreateInlineShowToastFallbackBlock();

  assert.ok(
    block.includes('console.log(`[Toast ${type}] ${message}`);'),
    'console fallback log format must stay stable'
  );
});

test('editor entrypoint keeps toast fallback helper resolution intact', () => {
  assert.match(editorSource, /shellHelpers\.createInlineShowToastFallback/);
  assert.match(editorSource, /const createInlineShowToastFallback\s*=/);
  assert.match(editorSource, /: createInlineShowToastFallback\(\)/);
});

test('editor html loads shell helpers before editor entrypoint for toast fallback availability', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
