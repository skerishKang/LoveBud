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
    'js/editor/editor-canvas-layout-helpers.js',
    'js/editor/editor-canvas-layout-storage.js',
    'js/editor/editor-canvas-node.js',
    'js/editor/editor-canvas-interaction.js',
    'js/editor/editor-canvas-viewport.js',
    'js/editor/editor-canvas-edges.js',
    'js/editor/editor-canvas-state-boundary.js',
    'js/editor/editor-canvas-growth-affordance.js',
    'js/editor/editor-canvas.js',
    'js/editor/editor-rename-ui.js',
    'js/editor/editor-detail-sidebar-status-boundary.js',
    'js/editor/editor-detail-ui-builders.js',
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
    'js/editor/editor-refresh-save-runtime.js',
    'js/editor/editor-entry-dependencies.js',
  ];

  for (const helper of helpers) {
    assertLoadedBefore(sources, helper, 'js/editor.js');
  }
});

test('canvas layout helpers load before canvas runtime', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(
    sources,
    'js/editor/editor-canvas-layout-helpers.js',
    'js/editor/editor-canvas.js'
  );
});

test('canvas layout storage loads before canvas runtime', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(
    sources,
    'js/editor/editor-canvas-layout-storage.js',
    'js/editor/editor-canvas.js'
  );
});

test('canvas state boundary loads before canvas runtime', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(
    sources,
    'js/editor/editor-canvas-state-boundary.js',
    'js/editor/editor-canvas.js'
  );
});

test('canvas edge helper loads before canvas runtime', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(
    sources,
    'js/editor/editor-canvas-edges.js',
    'js/editor/editor-canvas.js'
  );
});

test('canvas growth affordance helper loads before canvas runtime', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(
    sources,
    'js/editor/editor-canvas-growth-affordance.js',
    'js/editor/editor-canvas.js'
  );
});

test('data-loader fallback boundary is explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-data-loader.js', 'js/editor/editor-data-loader-fallbacks.js');
  assertLoadedBefore(sources, 'js/editor/editor-data-loader-fallbacks.js', 'js/editor.js');
});

test('detail UI builders load before detail UI', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-detail-ui-builders.js', 'js/editor/editor-detail-ui.js');
});

test('detail sidebar status boundary loads before detail UI', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-detail-sidebar-status-boundary.js', 'js/editor/editor-detail-ui.js');
});

test('entry fallback boundary is explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-entry-fallbacks.js', 'js/editor.js');
});

test('editor entry delegates entry fallback factories through boundary', () => {
  const editor = read('js/editor.js');
  const boundary = read('js/editor/editor-entry-fallbacks.js');
  const entryDeps = read('js/editor/editor-entry-dependencies.js');

  assert.match(entryDeps, /windowRef\.LoveBudEditorEntryFallbacks/, 'entry dependencies must resolve the entry fallback boundary');

  assert.match(boundary, /createInlineRedirectToEditorLoginFallback\s*:/, 'entry fallback boundary must expose createInlineRedirectToEditorLoginFallback');
  assert.doesNotMatch(editor, /entryFallbacks\.createInlineRedirectToEditorLoginFallback/, 'editor entry no longer delegates createInlineRedirectToEditorLoginFallback through entryFallbacks');
  assert.match(editor, /redirectToEditorLogin:\s*deps\.redirectToEditorLogin/, 'editor entry requires redirectToEditorLogin from deps');
  assert.doesNotMatch(editor, /LoveBudEditorPageHelpers\.redirectToEditorLogin missing/, 'redirectToEditorLogin guard no longer in editor.js');

  assert.match(editor, /showToast:\s*deps\.showToast/, 'editor entry requires showToast from deps');
});

test('shell helpers are explicitly mounted before editor entry', () => {
  const sources = scriptSources(editorHtml());

  assertLoadedBefore(sources, 'js/editor/editor-shell-utils.js', 'js/editor.js');
  assertLoadedBefore(sources, 'js/editor/editor-shell-bridges.js', 'js/editor.js');
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

  const scriptsExpectedBeforeEntry = [
    'firebase-app.js',
    'firebase-auth.js',
    'js/firebase-config.js',
    'js/auth/auth-state.js',
    'js/auth/auth-callbacks.js',
    'js/auth/auth-cache.js',
    'js/auth/auth-ui.js',
    'js/auth/auth-session.js',
    'js/auth/auth-firebase.js',
    'js/auth.js',
    'js/shared-header.js',
  ];

  const scriptsExpectedAfterEntry = [
    'js/editor/editor-i18n-refresh.js',
    'js/i18n/i18n-core.js',
    'js/i18n/i18n-editor.js',
    'js/i18n.js',
  ];

  for (const script of scriptsExpectedBeforeEntry) {
    const index = sourceIndex(sources, script);
    assert.notEqual(index, -1, `${script} should be loaded by pages/editor.html`);
    assert.ok(index < entry, `${script} currently loads before js/editor.js`);
  }

  for (const script of scriptsExpectedAfterEntry) {
    const index = sourceIndex(sources, script);
    assert.notEqual(index, -1, `${script} should be loaded by pages/editor.html`);
    assert.ok(index > entry, `${script} currently loads after js/editor.js`);
  }

  const editor = read('js/editor.js');
  assert.match(editor, /document\.addEventListener\('DOMContentLoaded'/);
});
