/**
 * Final #3519 corrective runtime contracts:
 * A) mounted view/edit template ID uniqueness
 * B) comment panel stays closed during background load
 * C) connect-existing parent card visibility gating
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sha12(rel) {
  return crypto
    .createHash('sha256')
    .update(read(rel).replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex')
    .slice(0, 12);
}

function extractTemplateHtml(source) {
  // Prefer exported builder return body; fall back to full source.
  const m = source.match(/return\s+`([\s\S]*?)`\s*;/);
  return m ? m[1] : source;
}

function extractIds(html) {
  const ids = [];
  const re = /\bid\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

function countId(html, id) {
  const re = new RegExp(`\\bid\\s*=\\s*["']${id}["']`, 'g');
  return (html.match(re) || []).length;
}

function collectText(node) {
  if (!node) return '';
  if (typeof node.textContent === 'string' && node.textContent) {
    // Prefer explicit textContent when set by production code.
    // Still recurse for containers that only hold children.
  }
  var parts = [];
  if (typeof node.textContent === 'string' && node.textContent) {
    parts.push(node.textContent);
  }
  var kids = node.childNodes || node.children || [];
  for (var i = 0; i < kids.length; i += 1) {
    parts.push(collectText(kids[i]));
  }
  return parts.join(' ');
}

function makeEl(id, extras) {
  const el = Object.assign(
    {
      id: id || '',
      textContent: '',
      hidden: true,
      disabled: false,
      style: { display: 'none' },
      dataset: {},
      attributes: Object.create(null),
      childNodes: [],
      children: [],
      firstChild: null,
      value: '',
      scrollTop: 0,
      className: '',
      listeners: Object.create(null),
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
          ? this.attributes[name]
          : null;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      addEventListener(type, fn) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(fn);
      },
      replaceChildren() {
        this.childNodes = [];
        this.children = [];
        this.firstChild = null;
        this.textContent = '';
      },
      appendChild(child) {
        this.childNodes.push(child);
        this.children.push(child);
        if (!this.firstChild) this.firstChild = child;
      },
      querySelector() {
        return null;
      },
      focus() {},
      scrollIntoView() {},
    },
    extras || {}
  );
  return el;
}

// ── A. Template ID uniqueness ─────────────────────────────────────────────

test('mounted view/edit templates have unique IDs and no appreciation action duplication', () => {
  const viewSrc = read('js/editor/templates/editor-detail-view-mode-template.js');
  const editSrc = read('js/editor/templates/editor-detail-edit-mode-template.js');
  const viewHtml = extractTemplateHtml(viewSrc);
  const editHtml = extractTemplateHtml(editSrc);

  const viewIds = extractIds(viewHtml);
  const editIds = extractIds(editHtml);

  const viewDupes = viewIds.filter((id, i) => viewIds.indexOf(id) !== i);
  const editDupes = editIds.filter((id, i) => editIds.indexOf(id) !== i);
  assert.deepEqual(viewDupes, [], 'view template must not contain internal duplicate ids');
  assert.deepEqual(editDupes, [], 'edit template must not contain internal duplicate ids');

  const viewSet = new Set(viewIds);
  const editSet = new Set(editIds);
  const intersection = [...viewSet].filter((id) => editSet.has(id));
  assert.deepEqual(
    intersection,
    [],
    'view/edit template ids must not intersect when both are mounted'
  );

  const combined = viewHtml + '\n' + editHtml;
  assert.equal(countId(combined, 'viewMomentDetailBtn'), 1);
  assert.equal(countId(combined, 'continueFromMomentBtn'), 1);
  assert.equal(countId(combined, 'detailActionsPrimaryLabel'), 1);
  assert.equal(countId(combined, 'cancelEditBtn'), 1);
  assert.equal(countId(viewHtml, 'viewMomentDetailBtn'), 1);
  assert.equal(countId(viewHtml, 'continueFromMomentBtn'), 1);
  assert.equal(countId(viewHtml, 'detailActionsPrimaryLabel'), 1);
  assert.equal(countId(editHtml, 'viewMomentDetailBtn'), 0);
  assert.equal(countId(editHtml, 'continueFromMomentBtn'), 0);
  assert.equal(countId(editHtml, 'detailActionsPrimaryLabel'), 0);
  assert.equal(countId(editHtml, 'cancelEditBtn'), 1);
  assert.equal(countId(editHtml, 'editConnectExistingCard'), 1);
});

// ── B. Comment panel background load stays closed ─────────────────────────

test('comment controller background load never opens panel; A→B stale guard holds', async () => {
  const store = Object.create(null);
  function get(id) {
    if (!store[id]) store[id] = makeEl(id);
    return store[id];
  }

  // seed required elements
  [
    'momentCommentsPanel',
    'momentCommentsList',
    'momentCommentsPanelStatus',
    'momentCommentComposer',
    'momentCommentInput',
    'momentCommentSubmitBtn',
    'momentCommentFeedback',
    'momentReactionCommentStatus',
    'momentReactionCommentValue',
  ].forEach(get);

  const panel = get('momentCommentsPanel');
  panel.hidden = true;
  const list = get('momentCommentsList');
  const status = get('momentCommentsPanelStatus');
  const commentBtn = get('momentReactionCommentStatus');
  const commentCount = get('momentReactionCommentValue');
  commentCount.textContent = '⋯';

  let resolveA = null;
  const aPromise = new Promise((resolve) => {
    resolveA = resolve;
  });
  let bResolved = false;
  const fetchCalls = [];

  const context = {
    window: {
      apiClient: {
        fetchComments(memoryId) {
          fetchCalls.push(String(memoryId));
          if (String(memoryId) === 'A') return aPromise;
          return Promise.resolve({
            comments: [
              {
                body: 'B comment',
                authorDisplayLabel: 'Owner',
                createdAt: '2026-07-15T00:00:00.000Z',
              },
            ],
          }).then((payload) => {
            bResolved = true;
            return payload;
          });
        },
        createComment() {
          return Promise.resolve({});
        },
      },
    },
    document: {
      getElementById(id) {
        return get(id);
      },
      createElement(tag) {
        return makeEl('', { tagName: String(tag).toUpperCase() });
      },
    },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Intl,
    Number,
    String,
    Object,
    Array,
  };
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-moment-comments.js'), context);

  const controller = context.window.createEditorMomentCommentsController();
  assert.equal(typeof controller.update, 'function');
  assert.equal(panel.hidden, true);

  controller.update({ memoryId: 'A' });
  assert.equal(fetchCalls[0], 'A');
  assert.equal(panel.hidden, true, 'A fetch start must not open panel');

  // A still pending: still closed
  assert.equal(panel.hidden, true);

  resolveA({
    comments: [
      {
        body: 'A comment',
        authorDisplayLabel: 'A-author',
        createdAt: '2026-07-14T00:00:00.000Z',
      },
    ],
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(panel.hidden, true, 'A resolve must not open panel');
  assert.match(collectText(list), /A comment/);
  assert.equal(commentCount.textContent, '1');
  assert.equal(status.dataset.state, 'ready');

  // Owner toggle opens panel
  commentBtn.dataset.ownerToggleBound = '1';
  // simulate owner reactions controller ownership: open via direct state
  // (comments controller fallback is skipped when ownerToggleBound=1)
  panel.hidden = false;
  commentBtn.setAttribute('aria-expanded', 'true');
  assert.equal(panel.hidden, false);
  assert.equal(commentBtn.getAttribute('aria-expanded'), 'true');

  // Switch to B: panel closes; B background load keeps it closed
  controller.update({ memoryId: 'B' });
  assert.equal(panel.hidden, true, 'B selection closes panel');
  assert.equal(commentBtn.getAttribute('aria-expanded'), 'false');

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(bResolved, true);
  assert.equal(panel.hidden, true, 'B background resolve must keep panel closed');
  assert.match(collectText(list), /B comment/);
  assert.equal(commentCount.textContent, '1');

  // Late A-like overwrite attempt is already generation-guarded by controller;
  // force a second late resolve path by calling fetch for A after B loaded is not possible
  // through public API; assert current B state remains authoritative.
  assert.doesNotMatch(collectText(list), /A comment/);
  assert.equal(status.dataset.state, 'ready');
});

// ── C. Connect parent card visibility ─────────────────────────────────────

test('connect-existing parent card visibility is gated by edit eligibility', () => {
  const store = Object.create(null);
  function get(id) {
    if (!store[id]) {
      store[id] = makeEl(id, {
        style: { display: id === 'editConnectExistingCard' ? 'none' : 'none' },
        hidden: id === 'editConnectExistingCard',
      });
    }
    return store[id];
  }

  [
    'editConnectExistingCard',
    'connectExistingCtaSection',
    'connectExistingCtaBtn',
    'connectExistingPendingSection',
    'connectExistingCancelBtn',
    'connectExistingConfirmSection',
    'connectExistingConfirmHint',
    'connectExistingConfirmBtn',
    'connectExistingConfirmCancelBtn',
  ].forEach(get);

  let modeEdit = false;
  const subscribers = [];
  const mode = {
    isEditMode() {
      return modeEdit;
    },
    subscribe(fn) {
      subscribers.push(fn);
    },
  };

  let currentMem = null;
  let pendingSourceId = null;
  const canvas = {
    getPendingConnectSourceId() {
      return pendingSourceId;
    },
    clearPendingConnect() {
      pendingSourceId = null;
    },
    setPendingConnect(id) {
      pendingSourceId = id || null;
    },
    calcPosition() {
      return { x: 0, y: 0 };
    },
    setOnPendingConnectCleared() {},
    drawConnectPreview() {},
  };

  const context = {
    window: {
      LoveBudEditorInteractionMode: mode,
    },
    document: {
      getElementById(id) {
        return get(id);
      },
    },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    String,
    Object,
  };
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-bindings.js'), context);

  const parent = get('editConnectExistingCard');
  const cta = get('connectExistingCtaSection');
  const pending = get('connectExistingPendingSection');
  const confirm = get('connectExistingConfirmSection');

  const controller =
    context.window.LoveBudEditorBindings.createConnectExistingController({
      connectMemory: async () => true,
      getCurrentEditingMemory: () => currentMem,
      isRootMemory: (mem) => mem && mem.id === 'root',
      getCanonicalRootId: () => 'root',
      showToast() {},
      i18n: (k) => k,
      validateConnectCandidate: () => ({ ok: true }),
      canEdit: true,
    });

  controller.setEditorCanvas(canvas);
  controller.bindControls();

  assert.equal(parent.hidden, true, 'bindControls initial parent hidden');
  assert.equal(parent.style.display, 'none');

  // appreciation mode
  modeEdit = false;
  currentMem = { id: 'm1', title: 'non-root' };
  controller.updateCtaNow();
  assert.equal(parent.hidden, true, 'appreciation mode keeps parent hidden');

  // edit + root
  modeEdit = true;
  currentMem = { id: 'root', title: 'root' };
  controller.updateCtaNow();
  assert.equal(parent.hidden, true, 'root moment keeps parent hidden');
  assert.equal(cta.style.display, 'none');

  // edit + non-root + canEdit
  currentMem = { id: 'm1', title: 'leaf' };
  controller.updateCtaNow();
  assert.equal(parent.hidden, false, 'eligible edit shows parent');
  assert.equal(parent.style.display, '');
  assert.equal(cta.style.display, '');
  assert.equal(pending.style.display, 'none');
  assert.equal(confirm.style.display, 'none');

  // pending
  controller.startConnectMode();
  assert.equal(parent.hidden, false);
  assert.equal(cta.style.display, 'none');
  assert.equal(pending.style.display, '');
  assert.equal(confirm.style.display, 'none');

  // confirm
  controller.handleConnectTargetSelect({ id: 'm2', title: 'target' }, { x: 1, y: 2 });
  assert.equal(parent.hidden, false);
  assert.equal(cta.style.display, 'none');
  assert.equal(pending.style.display, 'none');
  assert.equal(confirm.style.display, '');

  // reset/cancel
  controller.resetConnectFlow();
  // after reset, eligible cta may reappear via updateCtaVisibility
  assert.equal(parent.hidden, false, 'eligible after reset shows cta parent');
  assert.equal(cta.style.display, '');

  // force unavailable: canEdit false controller
  const controllerNoEdit =
    context.window.LoveBudEditorBindings.createConnectExistingController({
      connectMemory: async () => true,
      getCurrentEditingMemory: () => ({ id: 'm1' }),
      isRootMemory: () => false,
      getCanonicalRootId: () => 'root',
      showToast() {},
      i18n: (k) => k,
      validateConnectCandidate: () => ({ ok: true }),
      canEdit: false,
    });
  controllerNoEdit.setEditorCanvas(canvas);
  controllerNoEdit.bindControls();
  controllerNoEdit.updateCtaNow();
  assert.equal(get('editConnectExistingCard').hidden, true);
  assert.equal(get('editConnectExistingCard').style.display, 'none');
});

test('final corrective browser asset tokens match content fingerprints', () => {
  const editorHtml = read('pages/editor.html');
  assert.match(editorHtml, /base-api-fetch\.js\?v=20260715-3517-1/);

  const assets = [
    'js/editor/templates/editor-detail-edit-mode-template.js',
    'js/editor/editor-moment-comments.js',
    'js/editor/editor-bindings.js',
  ];
  for (const file of assets) {
    const expected = sha12(file);
    const base = path.basename(file).replace(/\./g, '\\.');
    const re = new RegExp(`${base}\\?v=([^"']+)`);
    const match = editorHtml.match(re);
    assert.ok(match, `token present for ${file}`);
    assert.equal(match[1], expected, `${file} token matches sha12`);
  }
});
