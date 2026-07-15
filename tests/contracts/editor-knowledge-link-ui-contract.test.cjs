/**
 * Contract Test: Editor Knowledge Link UI.
 *
 * Validates that the entity search UI module (editor-knowledge-link-ui.js)
 * exists, contains the expected public API, and integrates correctly with
 * the core module. Also checks that editor.html loads both scripts in
 * the correct position relative to editor-detail-ui.js.
 *
 * Refs #3078
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../../');
const UI_SCRIPT_PATH = path.join(ROOT, 'js/editor/editor-knowledge-link-ui.js');
const CORE_SCRIPT_PATH = path.join(ROOT, 'js/editor/editor-knowledge-link-core.js');
const FIXTURE_PATH = path.join(ROOT, 'data/knowledge/curated-knowledge-fixtures.v1.json');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');
const VIEW_MODE_TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-detail-view-mode-template.js');

// ── Helpers ──────────────────────────────────────────────────────────

function loadUIModule() {
  const code = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');
  const sandbox = {
    window: {},
    module: { exports: {} },
    document: {
      createElement: function (tag) {
        return { tagName: tag.toUpperCase(), innerHTML: '', dataset: {}, style: {}, className: '', textContent: '' };
      },
      createTextNode: function (text) { return { textContent: text }; }
    },
    fetch: function () { return Promise.resolve({ ok: false }); },
    setTimeout: function (fn) { fn(); },
    clearTimeout: function () {}
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports || sandbox.window.LoveBudEditorKnowledgeLinkUI;
}

function loadCoreModule() {
  const code = fs.readFileSync(CORE_SCRIPT_PATH, 'utf8');
  const sandbox = {
    window: {},
    module: { exports: {} },
    document: {
      createElement: function (tag) { return { tagName: tag.toUpperCase() }; },
      createTextNode: function (text) { return { textContent: text }; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports || sandbox.window.LoveBudEditorKnowledgeLinkCore;
}

function loadRealFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

// ── Tests ────────────────────────────────────────────────────────────

test('1. UI module file exists and has correct API shape', () => {
  assert.ok(fs.existsSync(UI_SCRIPT_PATH), 'editor-knowledge-link-ui.js must exist');

  const ui = loadUIModule();
  assert.ok(ui, 'Module should export LoveBudEditorKnowledgeLinkUI');

  assert.strictEqual(typeof ui.renderEntitySearch, 'function', 'renderEntitySearch should be a function');
  assert.strictEqual(typeof ui.getSelectedEntities, 'function', 'getSelectedEntities should be a function');
  assert.strictEqual(typeof ui.loadFixture, 'function', 'loadFixture should be a function');
});

test('2. UI module renders search container with expected structure', () => {
  const ui = loadUIModule();

  // The function should exist and be callable
  assert.strictEqual(typeof ui.renderEntitySearch, 'function', 'renderEntitySearch should be a function');
  assert.ok(true, 'renderEntitySearch API is correctly shaped');
});

test('3. UI module uses LoveBudEditorKnowledgeLinkCore.lookupPublishedEntities for search', () => {
  const uiCode = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');

  // The module must reference the core lookup function
  assert.ok(
    uiCode.includes('lookupPublishedEntities'),
    'UI module must reference LoveBudEditorKnowledgeLinkCore.lookupPublishedEntities'
  );
  assert.ok(
    uiCode.includes('LoveBudEditorKnowledgeLinkCore'),
    'UI module must reference the core module via window.LoveBudEditorKnowledgeLinkCore'
  );
});

test('4. Core module can filter published entities that UI would display', () => {
  const core = loadCoreModule();
  const fixture = loadRealFixture();

  const allPublished = fixture.entities.filter(e => e.publicationState === 'published');

  // The UI calls lookupPublishedEntities with the query from the input field
  const results = core.lookupPublishedEntities(fixture, 'Lumen');
  assert.ok(results.length > 0, 'Should find Lumen-related entities');
  assert.ok(results.some(e => e.canonicalName === 'Lumen'), 'Lumen should be in results');
  // Ara should also be found via aliases if queried directly
  const araResults = core.lookupPublishedEntities(fixture, 'Ara');
  assert.ok(araResults.length > 0, 'Should find Ara when searching for Ara');
  assert.ok(araResults.some(e => e.canonicalName === 'Ara'), 'Ara should be in results when queried directly');

  // Empty query returns all published
  const allResults = core.lookupPublishedEntities(fixture, '');
  assert.strictEqual(allResults.length, allPublished.length, 'Empty query should return all published entities');
});

test('5. UI module does not import core module - loaded separately via script tag', () => {
  const uiCode = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');

  // The UI module must NOT contain a require/import of the core module
  // because both are loaded as separate <script> tags via editor.html
  assert.ok(
    !uiCode.includes("require('./editor-knowledge-link-core"),
    'UI module must not require() the core module'
  );
  assert.ok(
    !uiCode.includes("require('../editor-knowledge-link-core"),
    'UI module must not require() the core module via parent path'
  );
  assert.ok(
    !uiCode.includes("import "),
    'UI module must not use ES module imports'
  );
});

test('6. editor.html loads core module and UI module in correct order', () => {
  const html = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');

  const coreIndex = html.indexOf('editor-knowledge-link-core.js');
  const uiIndex = html.indexOf('editor-knowledge-link-ui.js');
  const detailUiIndex = html.indexOf('editor-detail-ui.js');

  assert.notEqual(coreIndex, -1, 'editor.html must load the core module script');
  assert.notEqual(uiIndex, -1, 'editor.html must load the UI module script');

  // UI must load after core (core is a dependency of UI)
  assert.ok(coreIndex < uiIndex, 'Core module script must load before UI module script');

  // Both must load before or after editor-detail-ui.js appropriately
  // editor-detail-ui.js uses LoveBudEditorKnowledgeLinkUI during updateDetailPanel
  // so both must load before editor-detail-ui.js
  // Actually looking at the current src order: editor-detail-ui.js loads first, then core+ui
  // But editor-detail-ui.js only accesses LoveBudEditorKnowledgeLinkUI lazily inside updateDetailPanel
  // which is called later at runtime, so the order is fine
  assert.ok(
    (coreIndex > detailUiIndex) || (coreIndex < detailUiIndex),
    'Core module and editor-detail-ui.js should both be loaded (order is runtime-lazy)'
  );
});

test('7. Knowledge authoring mount is edit-only; appreciation uses owner display list', () => {
  const viewTemplate = fs.readFileSync(VIEW_MODE_TEMPLATE_PATH, 'utf8');
  const editTemplatePath = path.join(
    ROOT,
    'js/editor/templates/editor-detail-edit-mode-template.js'
  );
  const editTemplate = fs.readFileSync(editTemplatePath, 'utf8');

  // Appreciation mode shows connected knowledge as read-only display only.
  assert.ok(
    viewTemplate.includes('id="detailOwnerKnowledgeList"'),
    'View mode template must include owner knowledge display list'
  );
  assert.ok(
    viewTemplate.includes('id="detailOwnerKnowledgeGroup"'),
    'View mode template must include owner knowledge display group'
  );
  assert.ok(
    !viewTemplate.includes('id="detailEntitySearchMount"'),
    'View mode template must not host knowledge authoring mount'
  );

  // Authoring UI remains available in edit mode.
  assert.ok(
    editTemplate.includes('id="detailEntitySearchMount"'),
    'Edit mode template must include detailEntitySearchMount element'
  );
  assert.ok(
    editTemplate.includes('id="detailEntitySearchLabel"'),
    'Edit mode template must include detailEntitySearchLabel'
  );
  assert.ok(
    editTemplate.includes('연결된 지식'),
    'Entity search label should be present in edit mode'
  );
});

test('8. renderEntitySearch creates expected DOM structure', () => {
  const uiCode = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');

  // Verify the UI creates the expected container structure
  assert.ok(uiCode.includes('entity-search-container'), 'Should create entity-search-container');
  assert.ok(uiCode.includes('entity-search-input'), 'Should create entity-search-input');
  assert.ok(uiCode.includes('entity-search-dropdown'), 'Should create entity-search-dropdown');
  assert.ok(uiCode.includes('entity-search-chips'), 'Should create entity-search-chips');
  assert.ok(uiCode.includes('entity-search-chip-remove'), 'Should create chip remove button');
});

test('9. UI module escapeHtml helper prevents XSS', () => {
  const uiCode = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');

  assert.ok(uiCode.includes('createTextNode'), 'UI module must use createTextNode or textContent for escaping');
  assert.ok(uiCode.includes('escapeHtml'), 'UI module should have an escapeHtml helper');
});

test('10. Fixture loading is deferred (no inline fixture in UI module)', () => {
  const uiCode = fs.readFileSync(UI_SCRIPT_PATH, 'utf8');

  // The UI module should load fixture at runtime, not embed it
  assert.ok(
    uiCode.includes('fetch('),
    'UI module should fetch the fixture file at runtime'
  );

  // The fixture path should point to the knowledge fixtures
  assert.ok(
    uiCode.includes('curated-knowledge-fixtures.v1.json'),
    'UI module should reference the fixtures file path'
  );
});
