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

test('editor entrypoint requires createInlineShowToastFallback shell helper', () => {
  assert.match(
    editorSource,
    /const\s+createInlineShowToastFallback\s*=\s*shellHelpers\.createInlineShowToastFallback/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createInlineShowToastFallback\s*=\s*shellHelpers\.createInlineShowToastFallback\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createInlineShowToastFallback missing/
  );

  const guardStart = editorSource.indexOf('LoveBudEditorShellHelpers.createInlineShowToastFallback missing');
  assert.notEqual(guardStart, -1, 'createInlineShowToastFallback missing guard must exist');
  const guardEnd = editorSource.indexOf('const showToast =', guardStart);
  assert.notEqual(guardEnd, -1, 'showToast initialization must exist after guard');
  const guardBlock = editorSource.slice(guardStart, guardEnd);
  assert.doesNotMatch(guardBlock, /reportError/);

  assert.match(editorSource, /const showToast\s*=/);
});

test('editor html loads shell helpers before editor entrypoint for toast fallback availability', () => {
  const shellHelpersIndex = editorHtmlSource.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtmlSource.indexOf('js/editor.js');

  assert.notEqual(shellHelpersIndex, -1, 'editor-shell-helpers.js script must exist');
  assert.notEqual(editorIndex, -1, 'editor.js script must exist');
  assert.ok(shellHelpersIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
