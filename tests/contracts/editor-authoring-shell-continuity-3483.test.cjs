/**
 * Behavioral + source contracts for Issue #3483 authoring shell continuity.
 * Covers form inert/aria, toolbar fail-closed gating, and connect vs new-moment routing.
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

test('connect action has no new-moment fallback in source', () => {
  assert.match(affordanceSrc, /canActivateConnectButton/);
  assert.match(affordanceSrc, /function connectExistingMoment/);
  // The connect path must not call startNewMomentFromSelection.
  const connectFn = affordanceSrc.match(/function connectExistingMoment\([\s\S]*?\n    \}/);
  assert.ok(connectFn, 'connectExistingMoment must be extractable');
  assert.equal(
    /startNewMomentFromSelection|continueFromMomentBtn|addMemoryBtn/.test(connectFn[0]),
    false,
    'connectExistingMoment must not fall back to new-moment handlers'
  );
});

test('memory form suppresses inactive detail with inert + aria-hidden', () => {
  assert.match(formSrc, /detailContent\.setAttribute\('aria-hidden'/);
  assert.match(formSrc, /detailContent\.inert/);
  assert.match(formSrc, /is-memory-form-open/);
});

test('floating toolbar requires explicit edit mode (fail closed)', () => {
  assert.match(visibilitySrc, /interactionMode\s*!==\s*'edit'/);
  assert.equal(
    /layout-structured['"]\)\s*!==\s*-1\s*\)\s*return false/.test(visibilitySrc),
    false,
    'must not return false solely because body has layout-structured'
  );
});

function loadVisibilityApi() {
  const sandbox = {
    window: { innerWidth: 1024 },
    document: {
      body: {
        className: '',
        classList: { contains(name) { return sandbox.document.body._classes.has(name); } },
        getAttribute(name) {
          const v = sandbox.document.body._attrs[name];
          return v === undefined ? null : v;
        },
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
  sandbox.window.document = sandbox.document;
  sandbox.window.innerWidth = 1024;
  vm.createContext(sandbox);
  vm.runInContext(
    'var window = this.window; var document = this.document;\n' + visibilitySrc,
    sandbox,
    { filename: 'visibility.js' }
  );
  return {
    api: sandbox.window.LoveBudFloatingToolbarVisibility,
    sandbox
  };
}

test('toolbar shouldShow behavioral matrix (fail-closed modes)', () => {
  const { api, sandbox } = loadVisibilityApi();
  assert.ok(api && typeof api.shouldShow === 'function');
  const ctx = { getSelectedNode: () => ({ id: 'n1' }), mobileBreakpoint: 480 };

  assert.equal(api.shouldShow(ctx), true, 'explicit edit + selection should show');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = 'view';
  assert.equal(api.shouldShow(ctx), false, 'view hides toolbar');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = null;
  assert.equal(api.shouldShow(ctx), false, 'null mode hides toolbar');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = '';
  assert.equal(api.shouldShow(ctx), false, 'empty mode hides toolbar');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = 'unknown';
  assert.equal(api.shouldShow(ctx), false, 'unknown mode hides toolbar');

  sandbox.document.body._attrs['data-editor-interaction-mode'] = 'edit';
  sandbox.document._formOpen = true;
  assert.equal(api.shouldShow(ctx), false, 'form open hides toolbar');
  sandbox.document._formOpen = false;

  sandbox.document.body._classes.add('editor-readonly');
  assert.equal(api.shouldShow(ctx), false, 'readonly hides toolbar');
  sandbox.document.body._classes.delete('editor-readonly');

  assert.equal(api.shouldShow(ctx), true, 'structured layout alone still allows eligible edit toolbar');
  assert.equal(api.shouldShow({ getSelectedNode: () => null }), false, 'no selection hides toolbar');
});

function loadAffordanceRouting(options) {
  const opts = options || {};
  const clicks = {
    connect: 0,
    continue: 0,
    addMemory: 0
  };

  function makeButton(overrides) {
    const btn = Object.assign({
      disabled: false,
      hidden: false,
      style: { display: '' },
      getAttribute(name) {
        if (name === 'aria-hidden') return this._ariaHidden || null;
        return null;
      },
      closest(sel) {
        if (sel === '#connectExistingCtaSection') return this._section || null;
        return null;
      },
      click() {
        this._onClick && this._onClick();
      },
      addEventListener(type, fn) {
        if (type === 'click') this._listener = fn;
      },
      _listener: null,
      _onClick: null,
      _ariaHidden: null,
      _section: null
    }, overrides || {});
    return btn;
  }

  const connectBtn = opts.connect === 'missing'
    ? null
    : makeButton({
      disabled: Boolean(opts.connectDisabled),
      hidden: Boolean(opts.connectHidden),
      _ariaHidden: opts.connectAriaHidden ? 'true' : null,
      _section: opts.connectSectionHidden
        ? { hidden: true, style: { display: 'none' }, getAttribute() { return null; } }
        : { hidden: false, style: { display: '' }, getAttribute() { return null; } },
      _onClick: () => { clicks.connect += 1; }
    });

  const continueBtn = makeButton({
    _onClick: () => { clicks.continue += 1; }
  });
  const addMemoryBtn = makeButton({
    _onClick: () => { clicks.addMemory += 1; }
  });

  const branchBtn = makeButton();
  const forkBtn = makeButton();

  const elements = {
    connectExistingCtaBtn: connectBtn,
    continueFromMomentBtn: continueBtn,
    addMemoryBtn: addMemoryBtn
  };

  const sandbox = {
    window: {},
    document: {
      getElementById(id) {
        return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
      },
      querySelector() { return null; }
    }
  };
  sandbox.window = sandbox;
  sandbox.window.LoveBudFloatingToolbarDropdown = {
    hide() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(
    'var window = this.window; var document = this.document;\n' + affordanceSrc,
    sandbox,
    { filename: 'affordance.js' }
  );

  const api = sandbox.window.LoveBudFloatingToolbarAffordance;
  const ctx = {
    branchBtn,
    forkBtn,
    dropdown: {},
    moreBtn: {},
    quickAdd: null,
    toolbar: {}
  };
  api.bindConnectionButtons(ctx);

  return {
    clicks,
    fireBranch() {
      if (branchBtn._listener) branchBtn._listener({ stopPropagation() {} });
    },
    fireFork() {
      if (forkBtn._listener) forkBtn._listener({ stopPropagation() {} });
    },
    api
  };
}

test('branch click routes only to active connect button', () => {
  const h = loadAffordanceRouting({});
  h.fireBranch();
  assert.equal(h.clicks.connect, 1);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('missing connect button fails closed (no new-moment handlers)', () => {
  const h = loadAffordanceRouting({ connect: 'missing' });
  h.fireBranch();
  assert.equal(h.clicks.connect, 0);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('disabled connect button fails closed', () => {
  const h = loadAffordanceRouting({ connectDisabled: true });
  h.fireBranch();
  assert.equal(h.clicks.connect, 0);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('hidden connect button fails closed', () => {
  const h = loadAffordanceRouting({ connectHidden: true });
  h.fireBranch();
  assert.equal(h.clicks.connect, 0);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('aria-hidden connect button fails closed', () => {
  const h = loadAffordanceRouting({ connectAriaHidden: true });
  h.fireBranch();
  assert.equal(h.clicks.connect, 0);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('hidden connect section fails closed', () => {
  const h = loadAffordanceRouting({ connectSectionHidden: true });
  h.fireBranch();
  assert.equal(h.clicks.connect, 0);
  assert.equal(h.clicks.continue, 0);
  assert.equal(h.clicks.addMemory, 0);
});

test('fork path preserves explicit new-moment handler', () => {
  const h = loadAffordanceRouting({});
  h.fireFork();
  assert.equal(h.clicks.continue, 1);
  assert.equal(h.clicks.connect, 0);
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
  assert.match(formSrc, /hideAddMemoryForm[\s\S]*setEmptyGuideSuppressed\(false\)/);
  assert.match(formSrc, /showAddMemoryForm[\s\S]*setEmptyGuideSuppressed\(true\)/);
});
