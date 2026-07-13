/**
 * Behavioral + source contracts for Issue #3483 authoring shell continuity.
 * Covers form inert/aria, toolbar gating, and distinct connect vs new-moment actions.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const formSrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8');
const visibilitySrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-floating-toolbar-visibility.js'), 'utf8');
const affordanceSrc = fs.readFileSync(path.join(ROOT, 'js/editor/editor-floating-toolbar-affordance.js'), 'utf8');
const modeCss = fs.readFileSync(path.join(ROOT, 'css/editor/editor-mode-selection.css'), 'utf8');
const sidebarTpl = fs.readFileSync(path.join(ROOT, 'js/editor/templates/editor-sidebar-template.js'), 'utf8');
const editorHtml = fs.readFileSync(path.join(ROOT, 'pages/editor.html'), 'utf8');
const shellCopy = fs.readFileSync(path.join(ROOT, 'js/editor/editor-shell-copy-applier.js'), 'utf8');
const viewTpl = fs.readFileSync(path.join(ROOT, 'js/editor/templates/editor-detail-view-mode-template.js'), 'utf8');

test('accepted detailActionsPrimaryLabel remains 이 순간에서', () => {
  assert.match(viewTpl, /id="detailActionsPrimaryLabel">이 순간에서/);
  assert.match(shellCopy, /detailActionsPrimaryLabel[\s\S]*이 순간에서/);
});

test('view mode CSS hides connect-existing and continue authoring controls', () => {
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #continueFromMomentBtn/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #connectExistingCtaSection/);
  assert.match(modeCss, /\[data-editor-interaction-mode="view"\] #ftbBranchBtn/);
});

test('new-moment and connect-existing remain distinct handlers in source', () => {
  assert.match(viewTpl, /id="continueFromMomentBtn"/);
  assert.match(viewTpl, /id="connectExistingCtaBtn"/);
  assert.match(affordanceSrc, /connectExistingCtaBtn/);
  assert.match(affordanceSrc, /continueFromMomentBtn/);
  assert.match(affordanceSrc, /connectExistingMoment/);
  // branch prefers connect; continue path remains available via continueFromMomentBtn
  assert.match(affordanceSrc, /connectExistingMoment\(\)/);
});

test('memory form suppresses inactive detail with inert + aria-hidden', () => {
  assert.match(formSrc, /detailContent\.setAttribute\('aria-hidden'/);
  assert.match(formSrc, /detailContent\.inert/);
  assert.match(formSrc, /is-memory-form-open/);
  assert.match(formSrc, /editorMemoryFormContext|addMemoryForm/);
});

test('floating toolbar visibility does not blanket-hide structured layout', () => {
  assert.equal(
    /layout-structured['"]\)\s*!==\s*-1\s*\)\s*return false/.test(visibilitySrc),
    false,
    'must not return false solely because body has layout-structured'
  );
  assert.match(visibilitySrc, /data-editor-interaction-mode/);
  assert.match(visibilitySrc, /is-memory-form-open/);
  assert.match(visibilitySrc, /editor-readonly/);
});

test('toolbar shouldShow behavioral matrix', () => {
  const sandbox = {
    window: { innerWidth: 1024 },
    document: {
      body: {
        className: '',
        classList: { contains(name) { return this._classes && this._classes.has(name); } },
        getAttribute(name) { return this._attrs && this._attrs[name] || null; },
        _attrs: { 'data-editor-interaction-mode': 'edit' },
        _classes: new Set()
      },
      getElementById(id) {
        if (id === 'detailEditMode') return { style: { display: 'none' } };
        if (id === 'canvasEmptyGuide') return { classList: { contains() { return true; } } };
        return null;
      },
      querySelector(sel) {
        if (sel === '.editor-canvas-toolbar') return { classList: { contains() { return false; } } };
        if (String(sel).includes('is-memory-form-open')) {
          return sandbox.document._formOpen ? { className: 'is-memory-form-open' } : null;
        }
        return null;
      }
    }
  };
  sandbox.window = Object.assign(sandbox.window, { document: sandbox.document, innerWidth: 1024 });
  // Make document.body methods work with classList.contains for editor-readonly
  sandbox.document.body.classList = {
    contains(name) { return sandbox.document.body._classes.has(name); }
  };
  vm.createContext(sandbox);
  // visibility script uses window and document globals
  sandbox.window.document = sandbox.document;
  sandbox.window.innerWidth = 1024;
  // inject globals as used by IIFE
  const code = visibilitySrc.replace('(function () {', 'var window = globalThis.window; var document = globalThis.document; (function () {');
  sandbox.globalThis = sandbox;
  sandbox.window.LoveBudFloatingToolbarVisibility = undefined;
  vm.runInContext(
    'var window = this.window; var document = this.document;\n' + visibilitySrc,
    sandbox,
    { filename: 'visibility.js' }
  );

  const api = sandbox.window.LoveBudFloatingToolbarVisibility;
  assert.ok(api && typeof api.shouldShow === 'function');

  const ctx = { getSelectedNode: () => ({ id: 'n1' }), mobileBreakpoint: 480 };
  assert.equal(api.shouldShow(ctx), true, 'owner edit + selection should show');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = 'view';
  assert.equal(api.shouldShow(ctx), false, 'view/appreciation mode hides toolbar');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = 'edit';
  sandbox.document._formOpen = true;
  assert.equal(api.shouldShow(ctx), false, 'form open hides toolbar');
  sandbox.document._formOpen = false;

  sandbox.document.body._classes.add('editor-readonly');
  assert.equal(api.shouldShow(ctx), false, 'readonly hides toolbar');
  sandbox.document.body._classes.delete('editor-readonly');

  // structured layout alone must not hide
  sandbox.document.body.className = 'layout-structured';
  // className is unused; ensure no early return
  assert.equal(api.shouldShow(ctx), true, 'structured layout alone must allow toolbar');

  assert.equal(api.shouldShow({ getSelectedNode: () => null }), false, 'no selection hides toolbar');
});

test('sidebar template fingerprint in editor.html matches content hash', () => {
  const hash = crypto.createHash('sha256').update(sidebarTpl).digest('hex').slice(0, 12);
  assert.match(
    editorHtml,
    new RegExp(`editor-sidebar-template\\.js\\?v=${hash}`),
    `pages/editor.html must reference content hash ${hash}`
  );
});

test('setEmptyGuideSuppressed restores detail inert/aria on hide path', () => {
  // Source-level: hideAddMemoryForm calls setEmptyGuideSuppressed(false)
  assert.match(formSrc, /hideAddMemoryForm[\s\S]*setEmptyGuideSuppressed\(false\)/);
  assert.match(formSrc, /showAddMemoryForm[\s\S]*setEmptyGuideSuppressed\(true\)/);
});
