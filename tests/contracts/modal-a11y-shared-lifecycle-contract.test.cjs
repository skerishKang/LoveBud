'use strict';

// Shared modal accessibility lifecycle contract (Issue #3795).
// 1) Executes window.LoveBudModalA11y against a deterministic fake DOM to prove
//    live focusable discovery, Tab/Shift+Tab containment, busy-gated Escape,
//    guarded focus restoration, reference-counted body scroll locking, and
//    open/close/dispose idempotence + listener cleanup.
// 2) Source-bound checks that all six core modal controllers delegate the
//    approved lifecycle responsibilities to the shared helper while page-owned
//    media/inert/submit/Auth/backdrop logic remains in the controller, retired
//    duplicate lifecycle blocks are absent where replaced, excluded surfaces
//    are not migrated, and no native <dialog> is introduced.

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(ROOT, 'js', 'shared', 'modal-a11y.js');
const HELPER_SRC = fs.readFileSync(HELPER_PATH, 'utf8');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

// ── Minimal deterministic fake DOM ──────────────────────────────────────────

function parseGroup(group) {
  let tag = null;
  const tm = group.match(/^([a-zA-Z][\w-]*)/);
  if (tm) tag = tm[1];
  let rest = group.slice(tag ? tag.length : 0);
  const requires = [];
  const forbids = [];
  let pos = 0;
  while (pos < rest.length) {
    if (rest[pos] === '[') {
      const end = rest.indexOf(']', pos);
      const inner = rest.slice(pos + 1, end);
      const eq = inner.indexOf('=');
      let name = inner;
      let value = null;
      if (eq >= 0) {
        name = inner.slice(0, eq).trim().replace(/"/g, '');
        value = inner.slice(eq + 1).trim().replace(/"/g, '');
      }
      requires.push({ name, value });
      pos = end + 1;
    } else if (rest.slice(pos).startsWith(':not(')) {
      const end = rest.indexOf(')', pos);
      const inner = rest.slice(pos + 5, end).trim();
      const att = inner.slice(inner.indexOf('[') + 1, inner.lastIndexOf(']'));
      const eq = att.indexOf('=');
      let name = att;
      let value = null;
      if (eq >= 0) {
        name = att.slice(0, eq).trim().replace(/"/g, '');
        value = att.slice(eq + 1).trim().replace(/"/g, '');
      }
      forbids.push({ name, value });
      pos = end + 1;
    } else {
      pos++;
    }
  }
  return { tag, requires, forbids };
}

function matchesGroup(el, group) {
  if (group.tag && el.tagName !== group.tag.toUpperCase()) return false;
  for (const r of group.requires) {
    if (!el.hasAttribute(r.name)) return false;
    if (r.value !== null && el.getAttribute(r.name) !== r.value) return false;
  }
  for (const f of group.forbids) {
    if (el.hasAttribute(f.name) && (f.value === null || el.getAttribute(f.name) === f.value)) return false;
  }
  return true;
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this._classes = new Set();
    this.style = { overflow: '' };
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    this._isConnected = true;
    this._rects = [{ width: 10, height: 10 }];
    this._computedStyle = null;
    this._listeners = {};
    this.focusCalls = 0;
  }
  get id() { return this.attributes.id || null; }
  set id(v) { this.attributes.id = String(v); }
  get className() { return Array.from(this._classes).join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const self = this;
    return {
      add: (...c) => c.forEach((x) => self._classes.add(x)),
      remove: (...c) => c.forEach((x) => self._classes.delete(x)),
      contains: (c) => self._classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classes.has(c) : force;
        if (on) self._classes.add(c); else self._classes.delete(c);
        return on;
      }
    };
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  get isConnected() { return this._isConnected; }
  appendChild(child) { child.parentElement = this; child._isConnected = true; this.children.push(child); return child; }
  remove() {
    if (this.parentElement) {
      const i = this.parentElement.children.indexOf(this);
      if (i >= 0) this.parentElement.children.splice(i, 1);
      this.parentElement = null;
      this._isConnected = false;
    }
  }
  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }
  closest(selector) {
    const groups = selector.split(',').map((s) => s.trim()).map(parseGroup);
    let cur = this;
    while (cur) {
      if (groups.some((g) => matchesGroup(cur, g))) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  querySelectorAll(selector) {
    const groups = selector.split(',').map((s) => s.trim()).map(parseGroup);
    const out = [];
    (function walk(node) {
      for (const child of node.children) {
        if (groups.some((g) => matchesGroup(child, g))) out.push(child);
        walk(child);
      }
    })(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getClientRects() { return this._rects; }
  focus() {
    this.focusCalls++;
    if (FakeElement.docRef) FakeElement.docRef.activeElement = this;
  }
  get offsetParent() { return this._rects.length ? {} : null; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._listeners[type];
    if (a) {
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    }
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
    this.activeElement = null;
    this._listeners = {};
    FakeElement.docRef = this;
  }
  createElement(tag) { return new FakeElement(tag); }
  getElementById(id) { return this.body.querySelectorAll('[id]').find((el) => el.id === id) || null; }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._listeners[type];
    if (a) {
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    }
  }
  emit(type, event) {
    const a = (this._listeners[type] || []).slice();
    a.forEach((fn) => fn(event));
  }
}

function makeFakeWindow() {
  const win = {
    getComputedStyle: function (el) {
      if (el._computedStyle) return el._computedStyle;
      return { display: 'block', visibility: 'visible', position: 'static' };
    }
  };
  win.LoveBudModalA11yScrollRegistry = new WeakMap();
  return win;
}

// Load the helper once against a shared fake window.
const FAKE_WIN = makeFakeWindow();
global.window = FAKE_WIN;
require(HELPER_PATH);
const LoveBudModalA11y = FAKE_WIN.LoveBudModalA11y;

function fakeKey(key, extra) {
  const ev = Object.assign({
    key: key,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault: function () { ev.defaultPrevented = true; },
    stopPropagation: function () { ev.stopPropagationCalled = true; }
  }, extra || {});
  return ev;
}

function buildModalFixture(doc) {
  const modal = new FakeElement('div');
  doc.body.appendChild(modal);
  const closeBtn = new FakeElement('button');
  modal.appendChild(closeBtn);
  const input = new FakeElement('input');
  modal.appendChild(input);
  const hiddenBtn = new FakeElement('button');
  hiddenBtn.hidden = true;
  modal.appendChild(hiddenBtn);
  const disabledBtn = new FakeElement('button');
  disabledBtn.disabled = true;
  modal.appendChild(disabledBtn);
  const inertBtn = new FakeElement('button');
  inertBtn.setAttribute('inert', '');
  modal.appendChild(inertBtn);
  const tabindexNeg = new FakeElement('button');
  tabindexNeg.tabIndex = -1;
  modal.appendChild(tabindexNeg);
  const link = new FakeElement('a');
  link.setAttribute('href', '#x');
  modal.appendChild(link);
  return { modal, closeBtn, input, hiddenBtn, disabledBtn, inertBtn, tabindexNeg, link };
}

function createLifecycle(doc, win, extra) {
  const overrides = extra || {};
  return LoveBudModalA11y.createLifecycle(Object.assign({
    documentRef: doc,
    windowRef: win,
    getModal: overrides.getModal || (() => overrides.modal),
    isOpen: overrides.isOpen || (() => true),
    onRequestClose: overrides.onRequestClose || (() => { overrides.closeCount = (overrides.closeCount || 0) + 1; }),
    canClose: overrides.canClose || (() => true),
    getInitialFocus: overrides.getInitialFocus || (() => overrides.initialTarget || null),
    getRestoreFocus: overrides.getRestoreFocus || (() => overrides.restoreTarget || null),
    onFallbackFocus: overrides.onFallbackFocus || (() => { overrides.fallbackCount = (overrides.fallbackCount || 0) + 1; }),
    focusinContain: overrides.focusinContain,
    bindTarget: overrides.bindTarget || 'document',
    scrollLock: overrides.scrollLock
  }, overrides));
}

// ── Executed helper behavior (deterministic fake DOM) ───────────────────────

test('helper exports a bounded frozen API', () => {
  assert.ok(LoveBudModalA11y, 'window.LoveBudModalA11y defined');
  assert.equal(Object.isFrozen(LoveBudModalA11y), true, 'API object frozen');
  assert.deepEqual(Object.keys(LoveBudModalA11y), ['createLifecycle'], 'only createLifecycle exported');
  const doc = new FakeDocument();
  const lifecycle = createLifecycle(doc, FAKE_WIN, {});
  const methods = ['bind', 'unbind', 'handleKeydown', 'handleFocusIn', 'focusInitial', 'restoreFocus',
    'restoreFocusElement', 'isRestorable', 'lockScroll', 'unlockScroll', 'getFocusables',
    'open', 'close', 'dispose', 'isDisposed', 'isBound'];
  for (const m of methods) {
    assert.equal(typeof lifecycle[m], 'function', `lifecycle.${m} is a function`);
  }
});

test('focusable discovery is live and filters hidden/disabled/inert/disconnected/tabindex=-1', () => {
  const doc = new FakeDocument();
  const { modal, closeBtn, input, hiddenBtn, disabledBtn, inertBtn, tabindexNeg, link } = buildModalFixture(doc);
  // disconnected: create then detach
  const detachedBtn = new FakeElement('button');
  modal.appendChild(detachedBtn);
  detachedBtn.remove();

  const lifecycle = createLifecycle(doc, FAKE_WIN, { modal, isOpen: () => true });
  const focusables = lifecycle.getFocusables();
  assert.equal(focusables.includes(closeBtn), true, 'close button included');
  assert.equal(focusables.includes(input), true, 'input included');
  assert.equal(focusables.includes(link), true, 'link included');
  assert.equal(focusables.includes(hiddenBtn), false, 'hidden excluded');
  assert.equal(focusables.includes(disabledBtn), false, 'disabled excluded');
  assert.equal(focusables.includes(inertBtn), false, 'inert excluded');
  assert.equal(focusables.includes(tabindexNeg), false, 'tabindex=-1 excluded');
  assert.equal(focusables.includes(detachedBtn), false, 'disconnected excluded');

  // Live: a newly attached button appears on the next call (no stale list).
  const lateBtn = new FakeElement('button');
  modal.appendChild(lateBtn);
  const lateFocusables = lifecycle.getFocusables();
  assert.equal(lateFocusables.includes(lateBtn), true, 'newly attached button discovered live');
});

test('Tab wraps last to first; Shift+Tab wraps first to last; outside focus is pulled in', () => {
  const doc = new FakeDocument();
  const { modal, closeBtn, input, link } = buildModalFixture(doc);
  const lifecycle = createLifecycle(doc, FAKE_WIN, { modal, isOpen: () => true });
  lifecycle.bind();

  const tab = fakeKey('Tab');
  doc.activeElement = link; // last live focusable
  doc.emit('keydown', tab);
  assert.equal(tab.defaultPrevented, true, 'Tab on last prevented');
  assert.equal(doc.activeElement, closeBtn, 'focus wrapped to first');

  const shiftTab = fakeKey('Tab', { shiftKey: true });
  doc.activeElement = closeBtn; // first
  doc.emit('keydown', shiftTab);
  assert.equal(shiftTab.defaultPrevented, true, 'Shift+Tab on first prevented');
  assert.equal(doc.activeElement, link, 'focus wrapped to last');

  // Focus outside the modal → Tab pulls focus into the modal.
  const outside = new FakeElement('button');
  doc.body.appendChild(outside);
  doc.activeElement = outside;
  const tab2 = fakeKey('Tab');
  doc.emit('keydown', tab2);
  assert.equal(tab2.defaultPrevented, true, 'Tab from outside prevented');
  assert.equal(doc.activeElement, closeBtn, 'outside focus redirected to first');

  lifecycle.dispose();
});

test('Escape honors busy gate and emits exactly one close request', () => {
  const doc = new FakeDocument();
  const { modal } = buildModalFixture(doc);
  const state = { modal, closeCount: 0, busy: false };
  const lifecycle = createLifecycle(doc, FAKE_WIN, Object.assign(state, {
    canClose: () => !state.busy
  }));
  lifecycle.bind();

  doc.emit('keydown', fakeKey('Escape'));
  assert.equal(state.closeCount, 1, 'close requested once');

  doc.emit('keydown', fakeKey('Escape'));
  assert.equal(state.closeCount, 2, 'second Escape requests again');

  state.busy = true;
  doc.emit('keydown', fakeKey('Escape'));
  assert.equal(state.closeCount, 2, 'busy gate blocks Escape close');

  lifecycle.dispose();
});

test('guarded focus restoration handles connected, removed, hidden, and disabled invokers', () => {
  const doc = new FakeDocument();
  const { modal } = buildModalFixture(doc);
  const fallback = new FakeElement('button');
  doc.body.appendChild(fallback);
  const overrides = { modal, fallbackCount: 0 };
  const lifecycle = createLifecycle(doc, FAKE_WIN, Object.assign({}, overrides, {
    onFallbackFocus: () => { overrides.fallbackCount++; fallback.focus(); }
  }));

  // Connected visible invoker → restored.
  const invoker = new FakeElement('button');
  doc.body.appendChild(invoker);
  const ok = lifecycle.restoreFocusElement(invoker);
  assert.equal(ok, true, 'connected invoker restored');
  assert.equal(doc.activeElement, invoker, 'focus on invoker');

  // Removed invoker → fallback, no throw.
  const removed = new FakeElement('button');
  doc.body.appendChild(removed);
  removed.remove();
  const okRemoved = lifecycle.restoreFocusElement(removed);
  assert.equal(okRemoved, false, 'removed invoker not restored');
  assert.equal(overrides.fallbackCount, 1, 'fallback used for removed invoker');
  assert.equal(doc.activeElement, fallback, 'fallback focused');

  // Hidden invoker → fallback.
  const hiddenInvoker = new FakeElement('button');
  hiddenInvoker.hidden = true;
  doc.body.appendChild(hiddenInvoker);
  lifecycle.restoreFocusElement(hiddenInvoker);
  assert.equal(overrides.fallbackCount, 2, 'fallback used for hidden invoker');

  // Disabled invoker → fallback.
  const disabledInvoker = new FakeElement('button');
  disabledInvoker.disabled = true;
  doc.body.appendChild(disabledInvoker);
  lifecycle.restoreFocusElement(disabledInvoker);
  assert.equal(overrides.fallbackCount, 3, 'fallback used for disabled invoker');

  // Non-element → false, no throw.
  assert.equal(lifecycle.restoreFocusElement(null), false, 'null invoker safe');
  assert.equal(lifecycle.restoreFocusElement({}), false, 'non-element safe');
});

test('body scroll lock preserves prior overflow and handles nested ownership', () => {
  const doc = new FakeDocument();
  doc.body.style.overflow = 'auto';
  const { modal } = buildModalFixture(doc);
  const lifecycle = createLifecycle(doc, FAKE_WIN, { modal });

  const token1 = lifecycle.lockScroll();
  assert.equal(doc.body.style.overflow, 'hidden', 'locked to hidden');
  const token2 = lifecycle.lockScroll();
  assert.equal(doc.body.style.overflow, 'hidden', 'nested lock still hidden');

  lifecycle.unlockScroll(token2);
  assert.equal(doc.body.style.overflow, 'hidden', 'one unlock keeps lock (ownership)');
  lifecycle.unlockScroll(token1);
  assert.equal(doc.body.style.overflow, 'auto', 'prior overflow restored exactly');

  // Idempotent repeated lock/unlock.
  const t3 = lifecycle.lockScroll();
  lifecycle.unlockScroll(t3);
  lifecycle.unlockScroll(t3);
  assert.equal(doc.body.style.overflow, 'auto', 'double unlock idempotent');
  // Unlock of an unknown token is a no-op.
  lifecycle.unlockScroll({});
  assert.equal(doc.body.style.overflow, 'auto', 'unknown token no-op');
});

test('focusInitial only focuses after the modal is visible and attached', () => {
  const doc = new FakeDocument();
  const { modal, closeBtn } = buildModalFixture(doc);
  const target = closeBtn;

  // Detached modal → refuse.
  modal.remove();
  const detachedLifecycle = createLifecycle(doc, FAKE_WIN, { modal, isOpen: () => true, initialTarget: target });
  assert.equal(detachedLifecycle.focusInitial(), false, 'detached modal: no focus');
  assert.equal(closeBtn.focusCalls, 0, 'no focus while detached');

  // Hidden modal → refuse.
  doc.body.appendChild(modal);
  modal.hidden = true;
  const hiddenLifecycle = createLifecycle(doc, FAKE_WIN, { modal, isOpen: () => true, initialTarget: target });
  assert.equal(hiddenLifecycle.focusInitial(), false, 'hidden modal: no focus');
  assert.equal(closeBtn.focusCalls, 0, 'no focus while hidden');

  // Visible + attached → focus applied.
  modal.hidden = false;
  assert.equal(hiddenLifecycle.focusInitial(), true, 'visible modal: focus applied');
  assert.equal(closeBtn.focusCalls, 1, 'focus applied once');
});

test('open/close/dispose are idempotent and remove listeners', () => {
  const doc = new FakeDocument();
  const { modal, closeBtn } = buildModalFixture(doc);
  const overrides = { modal, initialTarget: closeBtn, closeCount: 0, restoreTarget: null };
  const lifecycle = createLifecycle(doc, FAKE_WIN, Object.assign({}, overrides, { scrollLock: true }));

  assert.equal(lifecycle.isBound(), false, 'initially unbound');
  lifecycle.open();
  lifecycle.open();
  assert.equal(lifecycle.isBound(), true, 'open binds');
  assert.equal((doc._listeners.keydown || []).length, 1, 'exactly one keydown listener after double open');
  assert.equal(doc.body.style.overflow, 'hidden', 'open with scrollLock locks body');
  assert.equal(closeBtn.focusCalls >= 1, true, 'initial focus applied');

  lifecycle.close();
  lifecycle.close();
  assert.equal(lifecycle.isBound(), false, 'close unbinds');
  assert.equal((doc._listeners.keydown || []).length, 0, 'listener removed');
  assert.equal(doc.body.style.overflow, '', 'scroll lock released on close');

  lifecycle.open();
  lifecycle.dispose();
  lifecycle.dispose();
  assert.equal(lifecycle.isDisposed(), true, 'dispose idempotent');
  assert.equal(lifecycle.isBound(), false, 'dispose unbinds');
  assert.equal((doc._listeners.keydown || []).length, 0, 'no listeners after dispose');
  assert.equal(doc.body.style.overflow, '', 'scroll released after dispose');
});

// ── Source-bound delegation checks ──────────────────────────────────────────

const CONTROLLERS = {
  home: 'js/index-inline-init.js',
  memoryForm: 'js/editor/editor-memory-form.js',
  rename: 'js/editor/editor-rename-ui.js',
  shortcuts: 'js/editor/editor-shortcuts-help.js',
  myTrees: 'js/my-trees/my-trees-actions.js',
  auth: 'js/auth/auth-login-page.js'
};

const EXCLUDED_SURFACES = [
  'js/settings.js',
  'js/scout/scout-draft-ui.js',
  'js/ai/lovebud-ai-panel.js',
  'js/editor/editor-mobile-panel-hierarchy.js',
  'js/search/search-mobile-preview-sheet.js',
  'js/my-trees/my-trees-mobile-preview-sheet.js'
];

test('all six core modal controllers delegate to the shared helper', () => {
  for (const [name, rel] of Object.entries(CONTROLLERS)) {
    const src = read(rel);
    assert.ok(src.includes('LoveBudModalA11y'), `${name} (${rel}) references LoveBudModalA11y`);
    assert.ok(src.includes('createLifecycle'), `${name} creates a shared lifecycle`);
  }
});

test('retired duplicate local lifecycle blocks are absent where replaced', () => {
  const memoryForm = read(CONTROLLERS.memoryForm);
  assert.ok(memoryForm.includes('formA11y.handleKeydown'), 'memory-form focusTrap delegates to the shared lifecycle');
  assert.ok(memoryForm.includes('if (formA11y)'), 'memory-form fallback is gated by helper presence');
  assert.ok(memoryForm.includes('outsideClickHandler'), 'memory-form keeps page-owned outside-click');

  const home = read(CONTROLLERS.home);
  assert.ok(home.includes('modalA11y.open'), 'home primary path delegates to the shared lifecycle');
  assert.ok(home.includes('if (modalA11y) return'), 'home fallback handlers are gated by helper presence');
  assert.ok(home.includes('modalAttemptId'), 'home stale-attempt guard preserved');
  assert.ok(home.includes('cleanupModalTimers'), 'home timer cleanup preserved');

  const myTrees = read(CONTROLLERS.myTrees);
  assert.ok(myTrees.includes('createTreeA11y.open'), 'my-trees primary path delegates to the shared lifecycle');
  assert.ok(myTrees.includes('if (createTreeA11y)'), 'my-trees fallback is gated by helper presence');
  assert.ok(myTrees.includes('isSubmitting'), 'my-trees busy state preserved');

  const rename = read(CONTROLLERS.rename);
  assert.ok(rename.includes('renameA11y.handleKeydown'), 'rename delegates keydown to the shared lifecycle');
});

test('page-owned media/inert/submit/Auth/backdrop logic remains in each controller', () => {
  const home = read(CONTROLLERS.home);
  assert.ok(home.includes('iframe'), 'home keeps iframe/player lifecycle');
  assert.ok(home.includes('e.target === modalEl'), 'home keeps its backdrop policy');
  assert.ok(home.includes('handleModalLongWait'), 'home keeps long-wait');

  const memoryForm = read(CONTROLLERS.memoryForm);
  assert.ok(memoryForm.includes('setEmptyGuideSuppressed'), 'memory-form keeps inert/aria-hidden isolation');
  assert.ok(memoryForm.includes('inert'), 'memory-form keeps inert handling');
  assert.ok(memoryForm.includes('addMemoryFromForm'), 'memory-form keeps submit logic');

  const myTrees = read(CONTROLLERS.myTrees);
  assert.ok(myTrees.includes('apiClient'), 'my-trees keeps API calls');
  assert.ok(myTrees.includes('event.target === backdrop'), 'my-trees keeps backdrop policy');
  assert.ok(myTrees.includes('aria-hidden', ), 'my-trees keeps aria-hidden ordering concern');

  const auth = read(CONTROLLERS.auth);
  assert.ok(auth.includes('__lovebudEmailEntryKeydown'), 'auth keeps replace-listener compatibility key');
  assert.ok(auth.includes('lastTriggerButton'), 'auth keeps lastTriggerButton restore model');
  assert.ok(auth.includes('email-auth-email'), 'auth keeps email input focus target');
});

test('excluded surfaces are not silently migrated to the helper', () => {
  for (const rel of EXCLUDED_SURFACES) {
    const src = read(rel);
    assert.ok(!src.includes('LoveBudModalA11y'), `${rel} must not reference LoveBudModalA11y`);
  }
});

test('no native <dialog> or showModal introduced', () => {
  const files = [HELPER_SRC].concat(Object.values(CONTROLLERS).map(read));
  for (const src of files) {
    assert.ok(!src.includes('showModal('), 'no showModal usage');
    assert.ok(!/<dialog/.test(src), 'no native <dialog> markup');
  }
});
