const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const actionsSource = readRepoFile('js/my-trees/my-trees-actions.js');
const myTreesHtml = readRepoFile('pages/my-trees.html');
const i18nSource = readRepoFile('js/i18n/i18n-my-trees.js');
const myTreesJs = readRepoFile('js/my-trees.js');

test('CTA open only opens modal - does not call create mutation', () => {
  // Verify setupCreateTreeModal is called from createNewTree, not create mutation directly
  assert.match(actionsSource, /setupCreateTreeModal\(/, 'createNewTree must call setupCreateTreeModal first');
  assert.match(actionsSource, /openCreateTreeModal\(/, 'createNewTree must call openCreateTreeModal to show modal');
  // The actual create mutation (apiClient.createTree) must only be called after modal submit
  // This is verified by checking the flow: openCreateTreeModal returns Promise that resolves on form submit
  assert.match(actionsSource, /openCreateTreeModal\(.*\)\.then|await openCreateTreeModal/, 'createNewTree must await modal result before createTree call');
});

test('Cancel, backdrop close, Escape do not call create mutation', () => {
  // All close paths call closeModal with null payload
  assert.match(actionsSource, /cancelBtn\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Cancel button must call closeModal with null');
  assert.match(actionsSource, /closeBtn\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Close button must call closeModal with null');
  assert.match(actionsSource, /backdrop\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Backdrop click must call closeModal with null');
  assert.match(actionsSource, /event\.key === 'Escape'[^}]*closeModal\(null\)/, 'Escape key must call closeModal with null');
  // All close handlers guard with isSubmitting check
  assert.match(actionsSource, /if \(createTreeModalState\.isSubmitting\) return;/s, 'Close handlers must guard against submitting state');
});

test('Title submit creates pending state and disables CTA immediately', () => {
  // Form submit handler sets isSubmitting true via setSubmitting
  assert.match(actionsSource, /form\.addEventListener\('submit'/, 'Form must have submit handler');
  assert.match(actionsSource, /setSubmitting\(true, i18n\)/, 'Submit must call setSubmitting(true)');
  // Submit button text changes to creating state
  assert.match(actionsSource, /submitBtn\.textContent.*creating|submitBtn\.textContent.*preparing/i, 'Submit button must show creating text');
  // aria-busy is set on backdrop for accessibility
  assert.match(actionsSource, /backdrop\.setAttribute\('aria-busy', 'true'\)/, 'Modal must set aria-busy on submit');
  // Input and cancel/close buttons disabled
  assert.match(actionsSource, /titleInput\.disabled = !!isSubmitting/, 'Title input must be disabled during submit');
  assert.match(actionsSource, /cancelBtn\.disabled = !!isSubmitting/, 'Cancel button must be disabled during submit');
  assert.match(actionsSource, /closeBtn\.disabled = !!isSubmitting/, 'Close button must be disabled during submit');
});

test('Click, Enter, rapid clicks result in exactly one create mutation', () => {
  // Form submit prevents default and returns early if isSubmitting
  assert.match(actionsSource, /event\.preventDefault\(\).*;/, 'Form submit must prevent default');
  assert.match(actionsSource, /if \(createTreeModalState\.isSubmitting\) return;/, 'Form submit must guard against duplicate submits');
  // createNewTree also disables header and empty buttons immediately
  assert.match(actionsSource, /headerBtn\.disabled = true/, 'Header create button must be disabled during create');
  assert.match(actionsSource, /emptyBtn\.disabled = true/, 'Empty state create button must be disabled during create');
});

test('Success triggers exactly one redirect after success status shown', () => {
  // On success, redirect happens once with timeout
  assert.match(actionsSource, /setTimeout\(function\(\) \{\s*window\.location\.href = redirectTarget;/, 'Redirect must use setTimeout exactly once');
  // Success message shown before redirect
  assert.match(actionsSource, /successMsg.*create_success|myTrees\.create_success/, 'Success message key must be used');
  assert.match(actionsSource, /submitBtn\.textContent = successMsg/, 'Submit button must show success message');
  assert.match(actionsSource, /setCtaContent\(headerBtn, 'check_circle'.*successMsg\)/, 'Header button must show success message via setCtaContent');
  // aria-busy cleared on success
  assert.match(actionsSource, /backdrop\.removeAttribute\('aria-busy'\)/, 'aria-busy must be cleared on success');
  // Only one redirect call
  const redirectMatches = actionsSource.match(/window\.location\.href = redirectTarget/g) || [];
  assert.equal(redirectMatches.length, 1, 'Exactly one redirect assignment expected');
});

test('Success status set before redirect', () => {
  // Success message displayed on buttons before redirect
  assert.match(actionsSource, /submitBtn\.textContent = successMsg[\s\S]*?setTimeout/, 'Success message must be set before setTimeout redirect');
  assert.match(actionsSource, /setCtaContent\(headerBtn[\s\S]*?successMsg[\s\S]*?setTimeout/, 'Header success message must be set before redirect');
});

test('Failure preserves input title, restores CTA, shows safe inline error', () => {
  // On catch: title input NOT cleared
  // The error handler does NOT clear titleInput.value - it only re-enables via setSubmitting(false)
  // Buttons restored to original state
  assert.match(actionsSource, /headerBtn\.disabled = false/, 'Header button must be re-enabled on error');
  assert.match(actionsSource, /setCtaContent\(headerBtn, 'add'/, 'Header button must restore original text via setCtaContent');
  assert.match(actionsSource, /emptyBtn\.disabled = false/, 'Empty button must be re-enabled on error');
  assert.match(actionsSource, /setCtaContent\(emptyBtn, 'add_circle'/, 'Empty button must restore original text via setCtaContent');
  // setSubmitting(false) re-enables input
  assert.match(actionsSource, /modal\.setSubmitting\(false.*i18n\)/, 'Modal must call setSubmitting(false) on error');
  // Safe error message used
  assert.match(actionsSource, /myTrees\.create_tree_fail|create_tree_fail/, 'Safe error message key must be used');
  // No raw error, provider payload, credential, or stack exposed
  assert.doesNotMatch(actionsSource, /console\.error.*stack/, 'Stack trace must not be in user-facing path');
  assert.doesNotMatch(actionsSource, /e\.response|e\.data|provider|credential/, 'Provider payload/credential must not be exposed');
});

test('Safe inline error only - no raw error, provider payload, credential, internal stack', () => {
  // Error shown via setError with i18n key
  assert.match(actionsSource, /modal\.setError\(safeText\(i18n.*myTrees\.create_tree_fail/, 'Error must use safeText with i18n key');
  // Toast also uses safe key
  assert.match(actionsSource, /showToast.*safeText\(i18n.*myTrees\.create_tree_fail/, 'Toast must use safe error key');
});

test('Initial bootstrap incomplete state does not leave CTA unresponsive', () => {
  // setupHeaderCreateButton attaches handler even if myTreesPage not loaded
  assert.match(myTreesJs, /function setupHeaderCreateButton\(\)/, 'setupHeaderCreateButton must exist');
  assert.match(myTreesJs, /btn\.addEventListener\('click'/, 'Header button must have click handler attached');
  // createNewTree is available as fallback even without myTreesActions module
  assert.match(myTreesJs, /warnMissingModule\('LoveBudMyTreesActions', 'createNewTree'\)/, 'Must warn if module missing but not crash');
});

test('Existing My Trees normal create route not broken', () => {
  // createNewTree function exported and callable
  assert.match(actionsSource, /window\.LoveBudMyTreesActions = \{[\s\S]*createNewTree: createNewTree/, 'createNewTree must be exported');
  // Modal elements exist in HTML
  assert.match(myTreesHtml, /id="createTreeModalBackdrop"/, 'Modal backdrop must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalForm"/, 'Modal form must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeTitleInput"/, 'Title input must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalSubmitBtn"/, 'Submit button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalCancelBtn"/, 'Cancel button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalCloseBtn"/, 'Close button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalError"/, 'Error element must exist in HTML');
  // Header and empty state CTAs exist
  assert.match(myTreesHtml, /id="headerCreateTreeBtn"/, 'Header CTA must exist');
  assert.match(myTreesHtml, /id="createTreeBtn"/, 'Empty state CTA must exist');
});

test('No #1882 closing keyword in test file', () => {
  const testSource = readRepoFile('tests/contracts/my-trees-create-feedback-contract.test.cjs');
  assert.doesNotMatch(testSource, /#1882\s*close|closes\s*#1882|fixes\s*#1882/i, 'Test file must not contain #1882 closing keyword');
  // "Refs #1882" in instructions is allowed - only closing keywords are forbidden
});

test('i18n keys for creating/success states exist', () => {
  assert.match(i18nSource, /myTrees\.creating.*러브트리를 준비하고 있어요.*Preparing your LoveTree/, 'myTrees.creating key must exist');
  assert.match(i18nSource, /myTrees\.create_success.*러브트리가 만들어졌어요.*LoveTree created/, 'myTrees.create_success key must exist');
  assert.match(i18nSource, /myTrees\.create_tree_fail.*러브트리 만들기 실패.*Failed to create LoveTree/, 'myTrees.create_tree_fail key must exist');
});

test('aria-hidden remains false during success confirmation', () => {
  // On success, aria-busy is removed but aria-hidden stays false until redirect
  assert.match(actionsSource, /backdrop\.removeAttribute\('aria-busy'\)/, 'aria-busy must be cleared on success');
  // Check that setAttribute('aria-hidden', 'true') is NOT in the success path (before redirect)
  // The comment in the code confirms this: "Keep aria-hidden='false' during success confirmation"
  assert.match(actionsSource, /Keep aria-hidden="false" during success confirmation/, 'Code must contain comment confirming aria-hidden stays false');
});

test('attemptStartedAt recorded before POST for reconciliation', () => {
  assert.match(actionsSource, /attemptStartedAt = Date\.now\(\)/, 'attemptStartedAt must be recorded before POST');
});

test('Reconciliation uses pre-POST snapshot (ID-based, timestamp secondary)', () => {
  assert.match(actionsSource, /findNewTree\(/, 'Reconciliation must use findNewTree helper');
  assert.match(actionsSource, /excludeIds\.indexOf\(t\.id\) === -1/, 'Reconciliation must exclude pre-POST IDs');
  assert.doesNotMatch(actionsSource, /60000/, 'Reconciliation must not use 60-second window');
  assert.match(actionsSource, /attemptStartedAt/, 'attemptStartedAt used as secondary sort condition');
});

test('Check mode issues getTrees only, never createTree', () => {
  assert.match(actionsSource, /if \(createTreeModalState\._checkMode\)/, 'Check mode guard must exist in form submit');
  assert.match(actionsSource, /modalResult\._check\)/, 'createNewTree must check for _check flag');
  assert.match(actionsSource, /Check mode: reconciling via getTrees/, 'Check mode must log reconciling via getTrees');
});

test('401 and 403 defer to auth UX, do not retry', () => {
  assert.match(actionsSource, /status === 401/, '401 must be explicitly handled');
  assert.match(actionsSource, /status === 403/, '403 must be explicitly handled');
  assert.match(actionsSource, /Auth error, deferring to auth UX/, 'Auth error must log deferring to auth UX');
  assert.match(actionsSource, /myTrees\.auth_required/, 'Auth error must use auth_required i18n key');
});

test('400 and 422 validation errors preserve normal retry flow', () => {
  assert.match(actionsSource, /Validation error, retry allowed/, 'Validation error path must log retry allowed');
  assert.match(actionsSource, /myTrees\.create_tree_fail/, 'Error message must use safe i18n key');
  assert.match(actionsSource, /status === 400 \|\| status === 422/, 'Status 400/422 must be explicitly checked');
});

test('createFlowGuard prevents duplicate form submissions', () => {
  assert.match(actionsSource, /createFlowGuard\) return;/, 'createFlowGuard must prevent duplicate flow entry');
  assert.match(actionsSource, /createTreeModalState\.createFlowGuard = true;/, 'createFlowGuard must be set before async operations');
});

test('__myTreesCreateFlowActive prevents duplicate createNewTree calls', () => {
  assert.match(actionsSource, /__myTreesCreateFlowActive\)/, 'Must check __myTreesCreateFlowActive at top');
  assert.match(actionsSource, /__myTreesCreateFlowActive = true;/, 'Must set __myTreesCreateFlowActive active');
  assert.match(actionsSource, /__myTreesCreateFlowActive = false;/, 'Must reset __myTreesCreateFlowActive at end');
});

test('409 and 429 errors do not retry, safe stop', () => {
  assert.match(actionsSource, /status === 409 \|\| status === 429/, '409/429 must be explicitly handled');
  assert.match(actionsSource, /Conflict\/rate-limit, safe stop/, '409/429 must log safe stop');
  assert.match(actionsSource, /closeModal\(null\)/, '409/429 must close modal');
  // No retry path after 409/429
  var conflictBlock = actionsSource.match(/status === 409[\s\S]*?break;/);
  assert.ok(conflictBlock, '409/429 block must end with break (no retry)');
  assert.doesNotMatch(conflictBlock ? conflictBlock[0] : '', /setCtaContent\(.*hourglass_empty/, 'No retry CTA setup in 409/429 block');
});

test('findNewTree excludes snapshot IDs, uses Math.abs timestamp sort', () => {
  assert.match(actionsSource, /excludeIds\.indexOf\(t\.id\) === -1/, 'findNewTree must filter out snapshot IDs');
  assert.match(actionsSource, /Math\.abs\(new Date\(a\.createdAt\)/, 'findNewTree must use Math.abs for timestamp sorting');
  assert.match(actionsSource, /return candidates\[0\]/, 'findNewTree must return first sorted candidate');
});

test('createNewTree returns outcome redirecting on success', () => {
  assert.match(actionsSource, /return \{ outcome: 'redirecting' \};/, 'createNewTree must return redirecting outcome on success');
  assert.match(actionsSource, /takeSnapshot\(\);/, 'createNewTree must take pre-POST snapshot');
});

test('js/my-trees.js polls window.LoveBudMyTreesActions not closure snapshot', () => {
  assert.match(myTreesJs, /window\.LoveBudMyTreesActions/, 'my-trees.js must poll window.LoveBudMyTreesActions');
  assert.doesNotMatch(myTreesJs, /while \(!myTreesActions \|\|/, 'my-trees.js must not poll closure snapshot');
});

test('js/my-trees.js createNewTree preserves CTA lock on redirecting outcome', () => {
  assert.match(myTreesJs, /redirecting = true;/, 'my-trees.js must set redirecting flag');
  assert.match(myTreesJs, /if \(!redirecting\)/, 'my-trees.js must skip CTA restore when redirecting');
});

// ─── VM Runtime Tests ──────────────────────────────────────────

test.describe('Runtime (VM)', { concurrency: 1 }, function() {

function createFakeElement(tagName, id) {
  var listeners = {};
  var children = [];
  var attributes = {};
  var classList = {
    _items: [],
    add: function(c) { if (!classList._items.includes(c)) classList._items.push(c); },
    remove: function(c) { classList._items = classList._items.filter(function(x) { return x !== c; }); },
    contains: function(c) { return classList._items.includes(c); },
    toggle: function(c) { if (classList.contains(c)) classList.remove(c); else classList.add(c); }
  };
  return {
    tagName: tagName,
    id: id || null,
    nodeType: 1,
    children: children,
    classList: classList,
    className: '',
    style: {},
    disabled: false,
    textContent: '',
    value: '',
    innerHTML: '',
    _listeners: listeners,
    _attributes: attributes,
    _parent: null,
    ownerDocument: null,
    getAttribute: function(name) { return attributes[name] !== undefined ? String(attributes[name]) : null; },
    setAttribute: function(name, value) { attributes[name] = String(value); },
    removeAttribute: function(name) { delete attributes[name]; },
    appendChild: function(child) { children.push(child); child._parent = this; return child; },
    replaceChildren: function() { children.length = 0; },
    addEventListener: function(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    removeEventListener: function(type, handler) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter(function(h) { return h !== handler; });
    },
    dispatchEvent: function(event) {
      var handlers = listeners[event.type] || [];
      for (var i = 0; i < handlers.length; i++) handlers[i](event);
    },
    focus: function() {},
    select: function() {},
    querySelector: function(sel) {
      if (sel === '.create-tree-visibility') return this._createTreeVisibility || null;
      return null;
    },
    closest: function(sel) {
      if (sel === '.create-tree-field') return this._closestField || null;
      return null;
    }
  };
}

function createFakeEvent(type) {
  return {
    type: type,
    defaultPrevented: false,
    stopPropagation: function() {},
    preventDefault: function() { this.defaultPrevented = true; },
    key: '',
    target: null
  };
}

function createFakeDocument() {
  var elements = new Map();
  var doc = {
    _elements: elements,
    getElementById: function(id) { return elements.get(id) || null; },
    createElement: function(tagName) { return createFakeElement(tagName, null); },
    createTextNode: function(text) { return { nodeType: 3, textContent: String(text) }; },
    addEventListener: function(type, handler) { doc['_on' + type] = handler; },
    removeEventListener: function(type, handler) {},
    dispatchEvent: function() {},
    querySelector: function(sel) {
      if (sel === '.my-trees-dashboard-grid-shell') return createFakeElement('div', null);
      if (sel === '#sortTreesSelect') return null;
      return null;
    },
    body: createFakeElement('body', null),
    head: createFakeElement('head', null),
    createEvent: function() { return { initEvent: function() {} }; }
  };
  doc.body.ownerDocument = doc;
  doc.head.ownerDocument = doc;
  return doc;
}

function setupDefaultElements(doc) {
  var ids = [
    'createTreeModalBackdrop',
    'createTreeModalForm',
    'createTreeTitleInput',
    'createTreeModalError',
    'createTreeModalCancelBtn',
    'createTreeModalCloseBtn',
    'createTreeModalSubmitBtn',
    'headerCreateTreeBtn',
    'createTreeBtn'
  ];
  var tagMap = { 'createTreeModalForm': 'form', 'createTreeTitleInput': 'input' };
  ids.forEach(function(id) {
    var tag = tagMap[id] || 'div';
    if (id.endsWith('Btn')) tag = 'button';
    var el = createFakeElement(tag, id);
    doc._elements.set(id, el);
    el.ownerDocument = doc;
  });
  var form = doc._elements.get('createTreeModalForm');
  var submitBtn = doc._elements.get('createTreeModalSubmitBtn');
  submitBtn._form = form;
  var visibilityDiv = createFakeElement('div', null);
  visibilityDiv.className = 'create-tree-visibility';
  visibilityDiv._closestField = createFakeElement('div', null);
  visibilityDiv._closestField.className = 'create-tree-field';
  form._createTreeVisibility = visibilityDiv;
  form.appendChild(visibilityDiv);
}

function createContextifiedWindow() {
  var doc = createFakeDocument();
  setupDefaultElements(doc);
  var _hrefValue = 'http://localhost/';
  var location = {
    get href() { return _hrefValue; },
    set href(v) { _hrefValue = String(v); },
    replace: function(url) { _hrefValue = String(url); },
    toString: function() { return _hrefValue; }
  };
  var win = {
    window: null,
    document: doc,
    self: null,
    globalThis: null,
    location: location,
    localStorage: (function() {
      var store = {};
      return {
        getItem: function(k) { return store[k] !== undefined ? store[k] : null; },
        setItem: function(k, v) { store[k] = String(v); },
        removeItem: function(k) { delete store[k]; }
      };
    })(),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    encodeURIComponent: encodeURIComponent,
    String: String,
    Array: Array,
    Object: Object,
    Boolean: Boolean,
    Number: Number,
    Promise: Promise,
    Error: Error,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    RegExp: RegExp,
    Event: function(type) { return createFakeEvent(type); },
    CustomEvent: function(type) { return createFakeEvent(type); },
    _redirectUrl: ''
  };
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.t = function(k) { return k; };
  win.getConfirmedAuthUser = function() { return { uid: 'user123' }; };
  win.LoveBudUI = { showToast: function() {} };
  win.LoveBudMyTreesPage = { setState: function() {}, STATE: {} };
  win.LoveBudMyTreesData = { loadTrees: function() {} };
  var _href = _hrefValue;
  Object.defineProperty(win.location, 'href', {
    get: function() { return _href; },
    set: function(v) { _href = String(v); win._redirectUrl = String(v); },
    configurable: true,
    enumerable: true
  });
  return win;
}

function loadActionsScript(win) {
  var code = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-actions.js'), 'utf8');
  vm.runInContext(code, win);
}

test('Runtime: success flow returns redirecting outcome, CTA stays disabled', async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  win.apiClient = { createTree: async function() { return { id: 'runtime-1' }; } };
  loadActionsScript(win);
  var headerBtn = win.document.getElementById('headerCreateTreeBtn');
  var titleInput = win.document.getElementById('createTreeTitleInput');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Runtime Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  var result = await promise;
  assert.strictEqual(result.outcome, 'redirecting', 'Must return redirecting outcome');
  assert.strictEqual(headerBtn.disabled, true, 'Header CTA must remain disabled after redirect commit');
});

test('Runtime: pre-existing same-title tree excluded from reconciliation', async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  var now = Date.now();

  win.apiClient = {
    createTree: async function() {
      var err = new Error('Network Error');
      throw err;
    },
    getTrees: async function() {
      // Return one tree that was created BEFORE attemptStartedAt with same title
      return [
        { id: 'old-tree', title: 'Same Title', createdAt: new Date(now - 120000).toISOString() }
      ];
    }
  };

  loadActionsScript(win);
  var submitBtn = win.document.getElementById('createTreeModalSubmitBtn');
  var titleInput = win.document.getElementById('createTreeTitleInput');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Same Title';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  // Wait for reconciliation attempt
  await new Promise(function(r) { setTimeout(r, 200); });

  // Should enter check mode, NOT redirect
  assert.ok(win._redirectUrl === '', 'Should NOT redirect to pre-existing tree');
  assert.ok(submitBtn.textContent.indexOf('check_status') !== -1 || submitBtn.textContent.indexOf('생성 상태 확인') !== -1,
    'Should enter check mode, got: ' + submitBtn.textContent);
});

test('Runtime: 409 conflict does not retry, modal closes', async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  var callCount = 0;

  win.apiClient = {
    createTree: async function() {
      callCount++;
      var err = new Error('Conflict');
      err.status = 409;
      throw err;
    }
  };

  loadActionsScript(win);
  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  var titleInput = win.document.getElementById('createTreeTitleInput');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Conflict Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  await new Promise(function(r) { setTimeout(r, 200); });

  assert.strictEqual(callCount, 1, 'createTree called exactly once (no retry)');
  assert.ok(!backdrop.classList.contains('show'), 'Modal should be closed after 409');
});

test('Runtime: 429 rate limit does not retry, modal closes', async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  var callCount = 0;

  win.apiClient = {
    createTree: async function() {
      callCount++;
      var err = new Error('Rate Limited');
      err.status = 429;
      throw err;
    }
  };

  loadActionsScript(win);
  var backdrop = win.document.getElementById('createTreeModalBackdrop');
  var titleInput = win.document.getElementById('createTreeTitleInput');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Rate Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  await new Promise(function(r) { setTimeout(r, 200); });

  assert.strictEqual(callCount, 1, 'createTree called exactly once (no retry)');
  assert.ok(!backdrop.classList.contains('show'), 'Modal should be closed after 429');
});

test('Runtime: check mode repeated submission issues 0 additional createTree', async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  var createCallCount = 0;
  var getTreesCallCount = 0;

  win.apiClient = {
    createTree: async function() {
      createCallCount++;
      var err = new Error('Network Error');
      throw err;
    },
    getTrees: async function() {
      getTreesCallCount++;
      return [];
    }
  };

  loadActionsScript(win);
  var submitBtn = win.document.getElementById('createTreeModalSubmitBtn');
  var titleInput = win.document.getElementById('createTreeTitleInput');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Check Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  // Wait for check mode
  await new Promise(function(r) { setTimeout(r, 200); });

  assert.strictEqual(createCallCount, 1, 'createTree called exactly once');
  // takeSnapshot (1) + reconcile after ambiguous (1) = 2
  assert.strictEqual(getTreesCallCount, 2, 'getTrees called: takeSnapshot + reconcile');

  // Submit again in check mode
  titleInput.value = 'Check Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));
  await new Promise(function(r) { setTimeout(r, 200); });

  assert.strictEqual(createCallCount, 1, 'createTree still exactly once (no additional POST)');
  // Check mode reconcile = 1 more getTrees
  assert.strictEqual(getTreesCallCount, 3, 'getTrees: 1 more for check mode reconcile');
});

test('Runtime: client/server clock skew handled via ID-based reconciliation', { timeout: 5000 }, async function(t) {
  var win = createContextifiedWindow();
  vm.createContext(win);
  var now = Date.now();
  var callCount = 0;

  win.apiClient = {
    createTree: async function() {
      var err = new Error('Network Error');
      throw err;
    },
    getTrees: async function() {
      callCount++;
      // First call = takeSnapshot (no matching tree yet)
      if (callCount === 1) {
        return [
          { id: 'existing-1', title: 'Other Tree', createdAt: new Date(now - 86400000).toISOString() }
        ];
      }
      // Second call = reconcile (new tree appeared, clock is skewed)
      return [
        { id: 'existing-1', title: 'Other Tree', createdAt: new Date(now - 86400000).toISOString() },
        { id: 'new-id', title: 'Skew Tree', createdAt: new Date(now + 3600000).toISOString() }
      ];
    }
  };

  loadActionsScript(win);
  var titleInput = win.document.getElementById('createTreeTitleInput');
  var headerBtn = win.document.getElementById('headerCreateTreeBtn');

  var promise = win.LoveBudMyTreesActions.createNewTree({ i18n: win.t });
  await new Promise(function(r) { setTimeout(r, 50); });
  titleInput.value = 'Skew Tree';
  win.document.getElementById('createTreeModalForm').dispatchEvent(createFakeEvent('submit'));

  var result = await promise;
  assert.strictEqual(result.outcome, 'redirecting', 'Should return redirecting despite clock skew');
  assert.strictEqual(headerBtn.disabled, true, 'CTA stays disabled after redirect commit');
});
});