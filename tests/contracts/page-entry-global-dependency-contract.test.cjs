/**
 * page-entry-global-dependency-contract.test.cjs
 *
 * Fixed-point contract for page-entry global dependency order.
 *
 * All entry pages that depend on window.apiClient must load:
 *   1. base-api-fetch  (creates window.LoveTreeBaseApiFetch)
 *   2. postgres-client (reads window.LoveTreeBaseApiFetch, creates window.apiClient)
 *   3. page entrypoint (reads window.apiClient)
 *
 * Editor additionally requires editor-page-event-bindings before
 * editor-entry-dependencies, and the full editor non-module script chain
 * to load only after postgres-client has provided window.apiClient.
 *
 * Does NOT lock query fingerprint, total script count, or every window global.
 * Does NOT duplicate existing script-order contracts (search, detail) for
 * sub-module ordering—only fixes the base dependency chain gap.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getNonModuleScriptSources(html) {
  return [...html.matchAll(/<script\s+(?:[^>]*?\s)?src=["']([^"']+)["'][^>]*>/g)]
    .filter((m) => !m[0].includes('type="module"'))
    .map((m) => m[1]);
}

function findScriptIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

function assertScriptBefore(sources, beforeNeedle, afterNeedle) {
  const beforeIdx = findScriptIndex(sources, beforeNeedle);
  const afterIdx = findScriptIndex(sources, afterNeedle);
  assert.notEqual(beforeIdx, -1, `"${beforeNeedle}" must be present`);
  assert.notEqual(afterIdx, -1, `"${afterNeedle}" must be present`);
  assert.ok(
    beforeIdx < afterIdx,
    `"${beforeNeedle}" (index ${beforeIdx}) must load before "${afterNeedle}" (index ${afterIdx})`
  );
}

// ── Pages that load the API client stack ─────────────────────────────
const API_CLIENT_PAGES = [
  { page: 'editor',        entry: 'editor-entry-dependencies' },
  { page: 'my-trees',      entry: 'my-trees-page-bootstrap' },
  { page: 'search',        entry: 'search-page-shell-init' },
  { page: 'detail',        entry: 'detail-page-shell-init' },
  { page: 'public-canvas', entry: 'public-canvas-init' },
  { page: 'tree',          entry: 'tree-viewer' },
  { page: 'view',          entry: 'public-viewer-copy-polish' },
];

const BASE_API_FETCH_NEEDLE = 'base-api-fetch';
const POSTGRES_CLIENT_NEEDLE = 'postgres-client';

// ═════════════════════════════════════════════════════════════════════
// A. All API-client pages: base-api-fetch before postgres-client
// ═════════════════════════════════════════════════════════════════════
test('all API-client pages: base-api-fetch loads before postgres-client', () => {
  for (const { page } of API_CLIENT_PAGES) {
    const html = readRepoFile(`pages/${page}.html`);
    const sources = getNonModuleScriptSources(html);
    assertScriptBefore(sources, BASE_API_FETCH_NEEDLE, POSTGRES_CLIENT_NEEDLE);
  }
});

// ═════════════════════════════════════════════════════════════════════
// B. All API-client pages: postgres-client before page entrypoint
// ═════════════════════════════════════════════════════════════════════
test('all API-client pages: postgres-client loads before page entrypoint', () => {
  for (const { page, entry } of API_CLIENT_PAGES) {
    const html = readRepoFile(`pages/${page}.html`);
    const sources = getNonModuleScriptSources(html);
    assertScriptBefore(sources, POSTGRES_CLIENT_NEEDLE, entry);
  }
});

// ═════════════════════════════════════════════════════════════════════
// C. Editor specific: postgres-client before API-dependent editor scripts
//    (editor-helpers, save-status, bindings, data-loader, shell, etc.)
//    Early editor scripts (canvas, UI, templates) load before the API
//    stack because they do not reference window.apiClient.
// ═════════════════════════════════════════════════════════════════════
test('editor: postgres-client before API-dependent editor scripts', () => {
  const html = readRepoFile('pages/editor.html');
  const sources = getNonModuleScriptSources(html);
  const pgIdx = findScriptIndex(sources, POSTGRES_CLIENT_NEEDLE);
  assert.notEqual(pgIdx, -1, 'postgres-client must be present');

  // Scripts known to reference window.apiClient or be part of the
  // API-dependent chain (post-postgres-client zone).
  // Use full path patterns to avoid matching -ui / -utils variants.
  const apiDependentEditorScripts = [
    '/editor/editor-helpers',         // uses window.apiClient
    '/editor/editor-save-status.',    // core save-status (not -ui variant)
    '/editor/editor-page-helpers',    // uses apiClient
    '/editor/editor-tree-helpers',    // uses apiClient
    '/editor/editor-selection-ui',    // uses apiClient via memory actions
    '/editor/editor-bindings',        // binds detail actions using apiClient
    '/editor/editor-auth-helpers',    // auth uses apiClient
    '/editor/editor-data-loader',     // loads tree/memory data via apiClient
    '/editor/editor-entry-fallbacks',
    '/editor/editor-shell-utils',
    '/editor/editor-shell-bridges',
    '/editor/editor-shell-guards',
    '/editor/editor-shell-startup',
    '/editor/editor-shell-canvas-ui',
    '/editor/editor-shell-memory',
    '/editor/editor-shell-helpers',
    '/editor/editor-shell-copy-applier',
    '/editor/editor-dom-refs-builder',
    '/editor/editor-startup-context',
    '/editor/editor-save-status-orchestration',
    '/editor/editor-panel-history',
    '/editor/relationship-hints-state-machine',
    '/editor/relationship-hints-ui-controller',
    '/editor/editor-page-event-bindings',
    '/editor/editor-shortcuts-help',
    '/editor/editor-initial-load-flow',
    '/editor/editor-refresh-save-runtime',
    '/editor/editor-entry-dependencies',
  ];

  for (const script of apiDependentEditorScripts) {
    const idx = findScriptIndex(sources, script);
    assert.notEqual(idx, -1, `"${script}" must be present in editor.html`);
    assert.ok(
      pgIdx < idx,
      `"postgres-client" (index ${pgIdx}) must load before "${script}" (index ${idx})`
    );
  }
});

// ═════════════════════════════════════════════════════════════════════
// D. Editor: page-event-bindings before entry-dependencies
// ═════════════════════════════════════════════════════════════════════
test('editor: page-event-bindings loads before entry-dependencies', () => {
  const html = readRepoFile('pages/editor.html');
  const sources = getNonModuleScriptSources(html);
  assertScriptBefore(sources, 'editor-page-event-bindings', 'editor-entry-dependencies');
});

// ═════════════════════════════════════════════════════════════════════
// E. Source-level: base-api-fetch provides window.LoveTreeBaseApiFetch
// ═════════════════════════════════════════════════════════════════════
test('base-api-fetch exposes LoveTreeBaseApiFetch on window', () => {
  const source = readRepoFile('js/api/base-api-fetch.js');
  assert.ok(
    source.includes('window.LoveTreeBaseApiFetch') ||
    source.includes('window[\'LoveTreeBaseApiFetch\']'),
    'base-api-fetch.js must expose LoveTreeBaseApiFetch on window'
  );
});

// ═════════════════════════════════════════════════════════════════════
// F. Source-level: postgres-client reads LoveTreeBaseApiFetch from window
// ═════════════════════════════════════════════════════════════════════
test('postgres-client reads LoveTreeBaseApiFetch from window and exposes apiClient', () => {
  const source = readRepoFile('js/postgres-client.js');
  assert.ok(
    source.includes('window.LoveTreeBaseApiFetch'),
    'postgres-client.js must reference window.LoveTreeBaseApiFetch'
  );
  assert.ok(
    source.includes('window.apiClient'),
    'postgres-client.js must expose apiClient on window'
  );
  // Verify it reads the base fetch at the top level (dependency assumption)
  assert.ok(
    source.includes('const BaseApiFetch = window.LoveTreeBaseApiFetch;'),
    'postgres-client.js must capture LoveTreeBaseApiFetch at module top'
  );
});

// ═════════════════════════════════════════════════════════════════════
// G. Editor: page-event-bindings defines bindEditorPageEvents
// ═════════════════════════════════════════════════════════════════════
test('editor page event bindings module exposes bindEditorPageEvents', () => {
  const source = readRepoFile('js/editor/editor-page-event-bindings.js');
  assert.ok(
    source.includes('bindEditorPageEvents'),
    'editor-page-event-bindings.js must define bindEditorPageEvents'
  );
});

// ═════════════════════════════════════════════════════════════════════
// H. Editor: entry-dependencies references bindEditorPageEvents
// ═════════════════════════════════════════════════════════════════════
test('editor entry dependencies reads bindEditorPageEvents from window', () => {
  const source = readRepoFile('js/editor/editor-entry-dependencies.js');
  assert.ok(
    source.includes('bindEditorPageEvents'),
    'editor-entry-dependencies.js must reference bindEditorPageEvents'
  );
  assert.ok(
    source.includes('window.LoveBudEditorEntryDependencies'),
    'editor-entry-dependencies.js must expose LoveBudEditorEntryDependencies on window'
  );
});
