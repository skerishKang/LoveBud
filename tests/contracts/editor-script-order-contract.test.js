const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function editorHtml() {
  return read('pages/editor.html');
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g)).map((match) => match[1]);
}

function sourceIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

function assertLoadedBefore(sources, beforeNeedle, afterNeedle) {
  const before = sourceIndex(sources, beforeNeedle);
  const after = sourceIndex(sources, afterNeedle);

  assert.notEqual(before, -1, `${beforeNeedle} should be loaded by pages/editor.html`);
  assert.notEqual(after, -1, `${afterNeedle} should be loaded by pages/editor.html`);
  assert.ok(before < after, `${beforeNeedle} should load before ${afterNeedle}`);
}

test('editor helper scripts load before the editor entry script', () => {
  const sources = scriptSources(editorHtml());

  const helpers = [
    'js/cache-utils.js',
    'js/utils/normalize.js',
    'js/utils/path.js',
    'js/utils/ui.js',
    'js/utils/media.js',
    'js/editor/editor-root-helpers.js',
    'js/editor/editor-canvas-layout.js',
    'js/editor/editor-canvas-node.js',
    'js/editor/editor-canvas-interaction.js',
    'js/editor/editor-canvas-viewport.js',
    'js/editor/editor-canvas.js',
    'js/editor/editor-rename-ui.js',
    'js/editor/editor-detail-ui.js',
    'js/editor/editor-memory-actions.js',
    'js/editor/editor-memory-form.js',
    'js/editor/editor-helpers.js',
    'js/editor/editor-save-status.js',
    'js/editor/editor-page-helpers.js',
    'js/editor/editor-tree-helpers.js',
    'js/editor/editor-bindings.js',
    'js/editor/editor-auth-helpers.js',
    'js/editor/editor-data-loader.js',
    'js/editor/editor-data-loader-fallbacks.js',
  ];

  for (const helper of helpers) {
    assertLoadedBefore(sources, helper, 'js/editor.js');
  }
});

test('data-loader fallback boundary is explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-data-loader.js', 'js/editor/editor-data-loader-fallbacks.js');
  assertLoadedBefore(sources, 'js/editor/editor-data-loader-fallbacks.js', 'js/editor.js');
});

test('entry fallback boundary is explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-entry-fallbacks.js', 'js/editor.js');
});

test('shell helpers are explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-shell-helpers.js', 'js/editor.js');
});

test('resolver fallback module remains explicit audit gap', () => {
  const sources = scriptSources(editorHtml());

  assert.equal(
    sourceIndex(sources, 'js/editor/editor-resolver-fallbacks.js'),
    -1,
    'editor-resolver-fallbacks.js is not currently mounted by pages/editor.html'
  );
});

test('editor entry still depends on DOMContentLoaded timing for later i18n/auth scripts', () => {
  const sources = scriptSources(editorHtml());
  const entry = sourceIndex(sources, 'js/editor.js');

  assert.notEqual(entry, -1, 'js/editor.js should be loaded by pages/editor.html');

  const scriptsExpectedAfterEntry = [
    'js/editor/editor-i18n-refresh.js',
    'firebase-app.js',
    'firebase-auth.js',
    'js/firebase-config.js',
    'js/i18n/i18n-core.js',
    'js/i18n/i18n-editor.js',
    'js/i18n.js',
    'js/shared-header.js',
    'js/auth/auth-state.js',
    'js/auth/auth-callbacks.js',
    'js/auth/auth-cache.js',
    'js/auth/auth-ui.js',
    'js/auth/auth-session.js',
    'js/auth/auth-firebase.js',
    'js/auth.js',
  ];

  for (const script of scriptsExpectedAfterEntry) {
    const index = sourceIndex(sources, script);
    assert.notEqual(index, -1, `${script} should be loaded by pages/editor.html`);
    assert.ok(index > entry, `${script} currently loads after js/editor.js`);
  }

  const editor = read('js/editor.js');
  assert.match(editor, /document\.addEventListener\('DOMContentLoaded'/);
});
