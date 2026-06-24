const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');
const startupSource = fs.readFileSync('js/editor/editor-shell-startup.js', 'utf8');

test('editor shell startup sub-module exposes editability shell state helper', () => {
  assert.match(startupSource, /applyEditorEditabilityState:\s*function/);
  assert.match(startupSource, /editorNamespace\.canEdit\s*=\s*canEdit/);
  assert.match(startupSource, /classList\.toggle\('editor-readonly',\s*!canEdit\)/);
});

test('editability shell state helper keeps testable body and namespace hooks', () => {
  assert.match(startupSource, /opts\.editorNamespace/);
  assert.match(startupSource, /opts\.body/);
});

test('editor delegates editability shell state through startup shell applier', () => {
  assert.match(editorSource, /deps\.applyEditorEditabilityState/);
  assert.match(editorSource, /const applyEditorEditabilityState\s*=/);
  assert.match(editorSource, /applyEditorEditabilityState,\s*canEdit:\s*false,\s*log/s);
  assert.match(editorSource, /applyEditorStartupShell\(\);/);
  assert.doesNotMatch(editorSource, /window\.LoveBudEditor\.canEdit\s*=\s*nextCanEdit/);
  assert.doesNotMatch(editorSource, /classList\?\.toggle\('editor-readonly',\s*!nextCanEdit\)/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.applyEditorEditabilityState missing/);
});

test('editor no longer applies editability state inline in start flow', () => {
  const start = editorSource.indexOf('createEditorStartupContext({');
  assert.notEqual(start, -1, 'createEditorStartupContext call must exist in start flow');

  const end = editorSource.indexOf('const initialLoadResult = await runEditorInitialLoadFlow({', start);
  assert.notEqual(end, -1, 'initial load flow setup must follow editability state setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /applyEditorStartupShell\(\);/);
  assert.doesNotMatch(block, /window\.LoveBudEditor\s*=\s*window\.LoveBudEditor\s*\|\|\s*\{\}/);
  assert.doesNotMatch(block, /document\.body\.classList\.toggle\('editor-readonly'/);
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
