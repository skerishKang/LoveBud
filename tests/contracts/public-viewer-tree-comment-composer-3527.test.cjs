/**
 * Focused executed tests for Public Viewer whole-tree comment composer (#3527).
 *
 * Exercises:
 * - js/viewer/public-viewer-tree-comment-composer.js
 * - js/viewer/public-viewer-tree-comments.js (additive APIs)
 * - pages/view.html script assembly order
 *
 * Deterministic DOM mock + injectable createTreeComment. No production network.
 *
 * Refs #3527, #3188, #3416, #3075, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPOSER_PATH = path.join(
  ROOT,
  'js',
  'viewer',
  'public-viewer-tree-comment-composer.js'
);
const PANEL_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-tree-comments.js');
const WRITE_CLIENT_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-write-client.js');
const VIEW_HTML_PATH = path.join(ROOT, 'pages', 'view.html');
const DETAIL_UI_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-detail-ui.js');
const MOMENT_COMPOSER_PATH = path.join(
  ROOT,
  'js',
  'viewer',
  'public-viewer-authenticated-comment-composer.js'
);

const VALID_TREE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TREE_ID = '22222222-2222-4222-8222-222222222222';
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

// ─── minimal deterministic DOM mock ─────────────────────────────────────────

function createDom() {
  const idMap = new Map();
  let activeElement = null;

  function makeEl(tag) {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      nodeType: 1,
      style: {},
      dataset: {},
      children: [],
      parentNode: null,
      parentElement: null,
      _attributes: {},
      _listeners: {},
      _id: '',
      _text: '',
      _value: '',
      _disabled: false,
      hidden: false,
      tabIndex: 0,
      className: '',
      type: '',
      rows: 0,
      maxLength: 0,
      placeholder: ''
    };

    Object.defineProperty(el, 'id', {
      get() {
        return el._id;
      },
      set(v) {
        if (el._id) idMap.delete(el._id);
        el._id = v;
        if (v) idMap.set(v, el);
      }
    });

    Object.defineProperty(el, 'textContent', {
      get() {
        if (el.children.length === 0) return el._text;
        return el.children.map((c) => c.textContent).join('');
      },
      set(v) {
        el._text = String(v == null ? '' : v);
        el.children = [];
      }
    });

    Object.defineProperty(el, 'value', {
      get() {
        return el._value;
      },
      set(v) {
        el._value = String(v == null ? '' : v);
      }
    });

    Object.defineProperty(el, 'disabled', {
      get() {
        return el._disabled;
      },
      set(v) {
        el._disabled = !!v;
      }
    });

    Object.defineProperty(el, 'firstChild', {
      get() {
        return el.children[0] || null;
      }
    });

    el.appendChild = function (child) {
      child.parentNode = el;
      child.parentElement = el;
      el.children.push(child);
      return child;
    };
    el.removeChild = function (child) {
      const idx = el.children.indexOf(child);
      if (idx !== -1) el.children.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
      return child;
    };
    el.setAttribute = function (k, v) {
      if (k === 'id') {
        el.id = v;
        return;
      }
      if (k === 'for') {
        el._attributes.for = String(v);
        el.htmlFor = String(v);
        return;
      }
      el._attributes[k] = String(v);
    };
    el.getAttribute = function (k) {
      return k in el._attributes ? el._attributes[k] : null;
    };
    el.addEventListener = function (type, fn) {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    };
    el.click = function () {
      (el._listeners.click || []).forEach((fn) =>
        fn.call(el, { type: 'click', preventDefault() {} })
      );
    };
    el.focus = function () {
      activeElement = el;
    };
    el.querySelector = function (sel) {
      if (sel[0] === '#') return idMap.get(sel.slice(1)) || null;
      const m = /^\[([\w-]+)="(.+)"\]$/.exec(sel);
      if (m) {
        const stack = [el];
        while (stack.length) {
          const cur = stack.pop();
          if (cur._attributes && cur._attributes[m[1]] === m[2]) return cur;
          (cur.children || []).forEach((c) => stack.push(c));
        }
      }
      return null;
    };

    return el;
  }

  const document = {
    body: makeEl('body'),
    createElement: makeEl,
    getElementById(id) {
      return idMap.get(id) || null;
    },
    get activeElement() {
      return activeElement;
    }
  };

  return { document, idMap, getActiveElement: () => activeElement };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
async function flush() {
  for (let i = 0; i < 8; i += 1) await tick();
}

function loadPanelAndComposer(dom, fetchTreeComments) {
  const sandbox = {
    window: {
      LoveBudTreeComments: { fetchTreeComments },
      LoveBudTreeCommentsWrite: {
        generateIdempotencyKey() {
          return 'tc-test-key-' + Math.random().toString(36).slice(2, 10);
        }
      }
    },
    document: dom.document,
    console,
    Promise,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(PANEL_PATH, 'utf8'), sandbox, { filename: PANEL_PATH });
  vm.runInContext(fs.readFileSync(COMPOSER_PATH, 'utf8'), sandbox, {
    filename: COMPOSER_PATH
  });
  return sandbox.window;
}

function findById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const c of root.children || []) {
    const found = findById(c, id);
    if (found) return found;
  }
  return null;
}

function createComposerEnv(opts) {
  const auth = { value: opts && opts.auth !== undefined ? !!opts.auth : true };
  const posts = [];
  let deferred = null;
  let resultFactory =
    opts && typeof opts.resultFactory === 'function'
      ? opts.resultFactory
      : function (n, body, key) {
          return {
            ok: true,
            state: 'created',
            comment: {
              id: 'c-' + n,
              treeId: VALID_TREE_ID,
              body: body,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
              authorDisplayLabel: 'fan'
            },
            idempotencyKey: key
          };
        };

  const createTreeComment = async (treeId, body, key) => {
    posts.push({ treeId, body, key, at: Date.now() });
    if (deferred) return deferred.promise;
    return resultFactory(posts.length, body, key);
  };

  function mkDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    deferred = { promise, resolve, reject };
    return deferred;
  }

  const onCreatedCalls = [];
  const refreshCalls = [];

  const dom = createDom();
  const win = loadPanelAndComposer(dom, async () => ({
    ok: true,
    state: 'loaded_with_comments',
    comments: [
      {
        id: 'existing-1',
        treeId: VALID_TREE_ID,
        body: 'existing tree comment',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        authorDisplayLabel: 'reader'
      }
    ]
  }));

  const panel = win.LoveBudPublicViewerTreeComments.createTreeCommentsReadOnlyControl({
    i18n: (k, fb) => fb || k,
    treeId: VALID_TREE_ID
  });

  const composer =
    win.LoveBudPublicViewerTreeCommentComposer.createPublicViewerTreeCommentComposerBoundary({
      i18n: (k, fb) => fb || k,
      hasConfirmedAuthSession: () => auth.value,
      createTreeComment,
      onCreated: (c) => {
        onCreatedCalls.push(c);
        panel.applyCreatedComment(c);
      },
      refreshTreeComments: () => {
        refreshCalls.push(1);
        panel.refresh();
      }
    });

  return {
    dom,
    panel,
    composer,
    posts,
    onCreatedCalls,
    refreshCalls,
    setAuth(v) {
      auth.value = !!v;
    },
    mkDeferred,
    resolveDeferred(v) {
      if (deferred) {
        deferred.resolve(v);
        deferred = null;
      }
    },
    rejectDeferred(e) {
      if (deferred) {
        deferred.reject(e);
        deferred = null;
      }
    },
    setResultFactory(fn) {
      resultFactory = fn;
    },
    openPanelAndMount() {
      panel.open();
      const mount = panel.getComposerMountElement();
      composer.update({
        open: true,
        treeId: VALID_TREE_ID,
        generation: panel.getGeneration(),
        mountEl: mount
      });
    },
    closePanel() {
      panel.close();
      composer.update({ open: false });
    }
  };
}

// ─── Assembly / separation ──────────────────────────────────────────────────

test('view.html loads write client and tree composer after read client, before canvas init', () => {
  const html = fs.readFileSync(VIEW_HTML_PATH, 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="\.\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(
    (m) => m[1]
  );
  const idx = (name) => scripts.findIndex((s) => s.endsWith(name));

  const readClient = idx('js/social/tree-comments-client.js');
  const writeClient = idx('js/social/tree-comments-write-client.js');
  const panel = idx('js/viewer/public-viewer-tree-comments.js');
  const composer = idx('js/viewer/public-viewer-tree-comment-composer.js');
  const init = idx('js/viewer/public-canvas-init.js');

  assert.ok(readClient !== -1);
  assert.ok(writeClient !== -1);
  assert.ok(panel !== -1);
  assert.ok(composer !== -1);
  assert.ok(writeClient > readClient);
  assert.ok(panel > writeClient || panel > readClient);
  assert.ok(composer > panel);
  assert.ok(composer < init);
});

test('detail-ui wires hasConfirmedAuthSession + createTreeComment (tree write path)', () => {
  const src = fs.readFileSync(DETAIL_UI_PATH, 'utf8');
  assert.ok(src.includes('LoveBudPublicViewerTreeCommentComposer'));
  assert.ok(src.includes('LoveBudTreeCommentsWrite'));
  assert.ok(src.includes('hasConfirmedAuthSession'));
  assert.ok(src.includes('createTreeComment'));
  assert.ok(src.includes('applyCreatedComment'));
  assert.ok(src.includes('ensureTreeCommentComposer'));
});

test('tree composer module does not reference moment/memory endpoints or moment composer', () => {
  const src = fs.readFileSync(COMPOSER_PATH, 'utf8');
  assert.ok(!/memories/.test(src));
  assert.ok(!/memoryId|memory_id/.test(src));
  assert.ok(!/public-viewer-authenticated-comment-composer/.test(src));
  assert.ok(!/createComment\s*:/.test(src));
  assert.ok(src.includes('createTreeComment'));
  assert.ok(src.includes('hasConfirmedAuthSession'));
});

test('moment composer file is unmodified relative to tree write (no tree write coupling)', () => {
  const src = fs.readFileSync(MOMENT_COMPOSER_PATH, 'utf8');
  assert.ok(!/LoveBudTreeCommentsWrite/.test(src));
  assert.ok(!/createTreeComment/.test(src));
  assert.ok(!/wholeTreeComment/.test(src));
});

// ─── Guest ──────────────────────────────────────────────────────────────────

test('guest: panel can open/read; composer shows note only; POST 0', async () => {
  const env = createComposerEnv({ auth: false });
  env.openPanelAndMount();
  await flush();

  assert.equal(env.panel.getState(), 'loaded_with_comments');
  const list = env.dom.document.getElementById('wholeTreeCommentsList');
  assert.equal(list.children.length, 1);

  const guest = env.dom.document.getElementById('wholeTreeCommentGuestNote');
  assert.ok(guest, 'guest note present');
  assert.ok(/로그인|login|읽을/i.test(guest.textContent));

  assert.equal(env.dom.document.getElementById('wholeTreeCommentInput'), null);
  assert.equal(env.dom.document.getElementById('wholeTreeCommentSubmit'), null);
  assert.equal(env.posts.length, 0);
});

// ─── Authenticated surface ──────────────────────────────────────────────────

test('authenticated: composer shows label, textarea, submit, cancel', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const label = env.dom.document.getElementById('wholeTreeCommentComposerLabel');
  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  const cancel = env.dom.document.getElementById('wholeTreeCommentCancel');

  assert.ok(label);
  assert.ok(/트리 전체/.test(label.textContent));
  assert.ok(input);
  assert.equal(input.tagName, 'TEXTAREA');
  assert.equal(input.maxLength, 5000);
  assert.ok(submit);
  assert.ok(cancel);
  assert.ok(submit.getAttribute('aria-label'));
  assert.ok(cancel.getAttribute('aria-label'));
  assert.ok(input.getAttribute('aria-label'));
});

// ─── Blank body / local validation ──────────────────────────────────────────

test('blank body: local validation, POST 0', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = '   ';
  submit.click();
  await flush();

  assert.equal(env.posts.length, 0);
  const err = env.dom.document.getElementById('wholeTreeCommentComposerError');
  assert.ok(err && err.textContent.includes('입력'));
});

// ─── Valid submit ───────────────────────────────────────────────────────────

test('valid submit: POST 1, tree route only, append once, clear input, success status', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const listBefore = env.dom.document.getElementById('wholeTreeCommentsList').children.length;
  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = '  new whole-tree note  ';
  submit.click();
  await flush();

  assert.equal(env.posts.length, 1);
  assert.equal(env.posts[0].treeId, VALID_TREE_ID);
  assert.equal(env.posts[0].body, 'new whole-tree note');
  assert.ok(KEY_PATTERN.test(env.posts[0].key));
  assert.ok(!/memory|moment/i.test(JSON.stringify(env.posts[0])));

  assert.equal(env.onCreatedCalls.length, 1);
  const listAfter = env.dom.document.getElementById('wholeTreeCommentsList').children.length;
  assert.equal(listAfter, listBefore + 1);
  assert.equal(input.value, '');

  const success = env.dom.document.getElementById('wholeTreeCommentComposerSuccess');
  assert.ok(success && /남겼어요/.test(success.textContent));
  assert.equal(success.getAttribute('role'), 'status');
  assert.equal(success.getAttribute('aria-live'), 'polite');
});

// ─── Rapid double submit ────────────────────────────────────────────────────

test('rapid double submit: POST exactly 1', async () => {
  const env = createComposerEnv({ auth: true });
  const d = env.mkDeferred();
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = 'rapid fire';
  submit.click();
  submit.click();
  submit.click();
  // createTreeComment is scheduled on a microtask after setPending(true)
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.posts.length, 1, 'in-flight guard must block second POST');

  d.resolve({
    ok: true,
    state: 'created',
    comment: {
      id: 'c-rapid',
      treeId: VALID_TREE_ID,
      body: 'rapid fire',
      createdAt: 't',
      updatedAt: 't',
      authorDisplayLabel: 'fan'
    },
    idempotencyKey: env.posts[0].key
  });
  await flush();
  assert.equal(env.posts.length, 1);
  assert.equal(env.onCreatedCalls.length, 1);
});

// ─── Pending state ──────────────────────────────────────────────────────────

test('pending: submit/cancel/input disabled while in flight', async () => {
  const env = createComposerEnv({ auth: true });
  const d = env.mkDeferred();
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  const cancel = env.dom.document.getElementById('wholeTreeCommentCancel');
  input.value = 'pending body';
  submit.click();

  assert.equal(input.disabled, true);
  assert.equal(submit.disabled, true);
  assert.equal(cancel.disabled, true);
  assert.ok(/남기는 중/.test(submit.textContent));

  d.resolve({
    ok: true,
    state: 'created',
    comment: {
      id: 'c-p',
      treeId: VALID_TREE_ID,
      body: 'pending body',
      createdAt: 't',
      updatedAt: 't',
      authorDisplayLabel: 'fan'
    }
  });
  await flush();
  assert.equal(input.disabled, false);
  assert.equal(submit.disabled, false);
  assert.equal(cancel.disabled, false);
});

// ─── Failure preserves list + body ──────────────────────────────────────────

test('failure: existing list preserved, body preserved, pending cleared, safe error', async () => {
  const env = createComposerEnv({ auth: true });
  env.setResultFactory(() => ({ ok: false, state: 'upstream_unavailable' }));
  env.openPanelAndMount();
  await flush();

  const listCount = env.dom.document.getElementById('wholeTreeCommentsList').children.length;
  assert.equal(listCount, 1);

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = 'keep this draft';
  submit.click();
  await flush();

  assert.equal(env.posts.length, 1);
  assert.equal(input.value, 'keep this draft');
  assert.equal(
    env.dom.document.getElementById('wholeTreeCommentsList').children.length,
    1,
    'list must not be wiped'
  );
  assert.equal(input.disabled, false);
  assert.equal(submit.disabled, false);
  const err = env.dom.document.getElementById('wholeTreeCommentComposerError');
  assert.ok(err && /남기지 못했어요/.test(err.textContent));
  assert.ok(!/upstream_unavailable|stack|Error/.test(err.textContent));
});

// ─── Retry idempotency key policy ───────────────────────────────────────────

test('retry same body reuses key; body change generates new key', async () => {
  const env = createComposerEnv({ auth: true });
  env.setResultFactory(() => ({ ok: false, state: 'rate_limited' }));
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');

  input.value = 'same logical body';
  submit.click();
  await flush();
  const key1 = env.posts[0].key;

  submit.click();
  await flush();
  const key2 = env.posts[1].key;
  assert.equal(key1, key2, 'same body retry keeps logical key');

  input.value = 'changed body';
  submit.click();
  await flush();
  const key3 = env.posts[2].key;
  assert.notEqual(key3, key1, 'body change must mint a new key');
});

// ─── Replay: render once ────────────────────────────────────────────────────

test('replay of same created comment id appends only once', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const comment = {
    id: 'c-replay',
    treeId: VALID_TREE_ID,
    body: 'once',
    createdAt: 't',
    updatedAt: 't',
    authorDisplayLabel: 'fan'
  };
  assert.equal(env.panel.applyCreatedComment(comment), true);
  assert.equal(env.panel.applyCreatedComment(comment), false);
  assert.equal(env.panel.applyCreatedComment(comment), false);

  const list = env.dom.document.getElementById('wholeTreeCommentsList');
  const matches = list.children.filter(
    (li) => li.getAttribute && li.getAttribute('data-tree-comment-id') === 'c-replay'
  );
  assert.equal(matches.length, 1);
});

// ─── Cancel ─────────────────────────────────────────────────────────────────

test('cancel clears draft and key; no API call; panel stays open', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const cancel = env.dom.document.getElementById('wholeTreeCommentCancel');
  input.value = 'will cancel';
  cancel.click();
  await flush();

  assert.equal(input.value, '');
  assert.equal(env.posts.length, 0);
  assert.equal(env.panel.getPanelElement().hidden, false);
  assert.equal(
    env.dom.document.getElementById('wholeTreeCommentsList').children.length,
    1
  );
});

// ─── Stale response after destroy ───────────────────────────────────────────

test('stale: destroy after submit ignores late success (no DOM update)', async () => {
  const env = createComposerEnv({ auth: true });
  const d = env.mkDeferred();
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = 'late success body';
  submit.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.posts.length, 1);

  env.composer.destroy();
  const listCountAtDestroy =
    env.dom.document.getElementById('wholeTreeCommentsList').children.length;

  d.resolve({
    ok: true,
    state: 'created',
    comment: {
      id: 'c-stale',
      treeId: VALID_TREE_ID,
      body: 'late success body',
      createdAt: 't',
      updatedAt: 't',
      authorDisplayLabel: 'fan'
    }
  });
  await flush();

  assert.equal(env.onCreatedCalls.length, 0, 'late success must not call onCreated');
  assert.equal(
    env.dom.document.getElementById('wholeTreeCommentsList').children.length,
    listCountAtDestroy
  );
});

test('stale: tree context change invalidates in-flight success', async () => {
  const env = createComposerEnv({ auth: true });
  const d = env.mkDeferred();
  env.openPanelAndMount();
  await flush();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = 'old tree body';
  submit.click();

  // Simulate tree switch
  env.composer.update({
    open: true,
    treeId: OTHER_TREE_ID,
    generation: 99,
    mountEl: env.panel.getComposerMountElement()
  });

  d.resolve({
    ok: true,
    state: 'created',
    comment: {
      id: 'c-old-tree',
      treeId: VALID_TREE_ID,
      body: 'old tree body',
      createdAt: 't',
      updatedAt: 't',
      authorDisplayLabel: 'fan'
    }
  });
  await flush();
  assert.equal(env.onCreatedCalls.length, 0);
});

// ─── Focus return ───────────────────────────────────────────────────────────

test('panel close returns focus to whole-tree comments toggle', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();
  env.closePanel();
  await flush();
  assert.equal(env.dom.getActiveElement(), env.panel.getElement());
});

// ─── Accessibility ──────────────────────────────────────────────────────────

test('accessibility: labels, live regions, submit/cancel names present', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();

  const label = env.dom.document.getElementById('wholeTreeCommentComposerLabel');
  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  const cancel = env.dom.document.getElementById('wholeTreeCommentCancel');
  const err = env.dom.document.getElementById('wholeTreeCommentComposerError');
  const success = env.dom.document.getElementById('wholeTreeCommentComposerSuccess');

  assert.equal(label.getAttribute('for') || label.htmlFor, 'wholeTreeCommentInput');
  assert.ok(input.getAttribute('aria-label'));
  assert.ok(submit.getAttribute('aria-label'));
  assert.ok(cancel.getAttribute('aria-label'));
  assert.equal(err.getAttribute('role'), 'status');
  assert.equal(err.getAttribute('aria-live'), 'polite');
  assert.equal(success.getAttribute('role'), 'status');
  assert.equal(success.getAttribute('aria-live'), 'polite');
});

// ─── Failed refresh does not wipe successful list ───────────────────────────

test('cached refresh failure preserves list, state, close/reopen without auto GET', async () => {
  let n = 0;
  const dom = createDom();
  const win = loadPanelAndComposer(dom, async () => {
    n += 1;
    if (n === 1) {
      return {
        ok: true,
        state: 'loaded_with_comments',
        comments: [
          {
            id: 'keep-me',
            treeId: VALID_TREE_ID,
            body: 'keep',
            createdAt: 't',
            updatedAt: 't',
            authorDisplayLabel: 'a'
          }
        ]
      };
    }
    return { ok: false, state: 'upstream_unavailable' };
  });

  const panel = win.LoveBudPublicViewerTreeComments.createTreeCommentsReadOnlyControl({
    i18n: (k, fb) => fb || k,
    treeId: VALID_TREE_ID
  });
  panel.open();
  await flush();
  assert.equal(panel.getState(), 'loaded_with_comments', 'initial state');
  assert.equal(panel.getComments().length, 1);
  assert.equal(n, 1, 'initial open issues one GET');

  panel.refresh();
  await flush();
  assert.equal(n, 2, 'refresh issues one GET');
  assert.equal(panel.getComments().length, 1, 'cache preserved after refresh failure');
  assert.equal(
    dom.document.getElementById('wholeTreeCommentsList').children.length,
    1,
    'DOM list preserved'
  );
  assert.equal(
    panel.getState(),
    'loaded_with_comments',
    'state remains loaded_with_comments after cached refresh failure'
  );
  const status = dom.document.getElementById('wholeTreeCommentsStatus');
  assert.ok(status && /불러오지 못했어요|다시 시도/.test(status.textContent));
  const retry = panel.getPanelElement().querySelector('#wholeTreeCommentsRetry');
  assert.ok(retry, 'explicit retry affordance present after cached refresh failure');

  const getCountBeforeClose = n;
  panel.close();
  panel.open();
  await flush();
  assert.equal(n, getCountBeforeClose, 'reopen must not issue an automatic GET when cache is loaded');
  assert.equal(panel.getComments().length, 1, 'cache still present after close/reopen');
  assert.equal(
    dom.document.getElementById('wholeTreeCommentsList').children.length,
    1,
    'DOM still shows cached comment after close/reopen'
  );
  assert.equal(panel.getState(), 'loaded_with_comments');
});

// ─── Late pre-write GET must not overwrite successful POST append ───────────

test('late initial GET after successful POST does not drop created comment', async () => {
  let getResolve;
  let getCount = 0;
  const getPromise = new Promise((resolve) => {
    getResolve = resolve;
  });

  const posts = [];
  const dom = createDom();
  const sandbox = {
    window: {
      LoveBudTreeComments: {
        fetchTreeComments: async () => {
          getCount += 1;
          return getPromise;
        }
      },
      LoveBudTreeCommentsWrite: {
        generateIdempotencyKey() {
          return 'tc-race-key-0001';
        }
      }
    },
    document: dom.document,
    console,
    Promise,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(PANEL_PATH, 'utf8'), sandbox, { filename: PANEL_PATH });
  vm.runInContext(fs.readFileSync(COMPOSER_PATH, 'utf8'), sandbox, {
    filename: COMPOSER_PATH
  });
  const win = sandbox.window;

  const panel = win.LoveBudPublicViewerTreeComments.createTreeCommentsReadOnlyControl({
    i18n: (k, fb) => fb || k,
    treeId: VALID_TREE_ID
  });

  const composer =
    win.LoveBudPublicViewerTreeCommentComposer.createPublicViewerTreeCommentComposerBoundary({
      i18n: (k, fb) => fb || k,
      hasConfirmedAuthSession: () => true,
      createTreeComment: async (treeId, body, key) => {
        posts.push({ treeId, body, key });
        return {
          ok: true,
          state: 'created',
          comment: {
            id: 'c-created-race',
            treeId: VALID_TREE_ID,
            body: body,
            createdAt: '2026-07-15T00:00:00Z',
            updatedAt: '2026-07-15T00:00:00Z',
            authorDisplayLabel: 'fan'
          },
          idempotencyKey: key
        };
      },
      onCreated: (c) => {
        panel.applyCreatedComment(c);
      },
      refreshTreeComments: () => {
        panel.refresh();
      }
    });

  // 1-2: open panel → initial GET pending
  panel.open();
  await Promise.resolve();
  assert.equal(getCount, 1, 'initial open starts one GET');
  assert.equal(panel.getState(), 'loading');

  // 3: mount authenticated composer while GET is still pending
  composer.update({
    open: true,
    treeId: VALID_TREE_ID,
    generation: panel.getGeneration(),
    mountEl: panel.getComposerMountElement()
  });
  await flush();

  const input = dom.document.getElementById('wholeTreeCommentInput');
  const submit = dom.document.getElementById('wholeTreeCommentSubmit');
  assert.ok(input && submit, 'authenticated composer mounted during pending GET');

  // 4-5: POST succeeds first
  input.value = 'created before late GET';
  submit.click();
  await flush();

  assert.equal(posts.length, 1, 'POST exactly once');
  assert.equal(posts[0].treeId, VALID_TREE_ID);
  assert.ok(!/memory|moment/i.test(JSON.stringify(posts[0])));

  // 6: created comment appears once
  let list = dom.document.getElementById('wholeTreeCommentsList');
  let createdItems = list.children.filter(
    (li) => li.getAttribute && li.getAttribute('data-tree-comment-id') === 'c-created-race'
  );
  assert.equal(createdItems.length, 1, 'created item rendered once after POST');
  assert.equal(panel.getComments().some((c) => c.id === 'c-created-race'), true);
  assert.equal(panel.getState(), 'loaded_with_comments');

  // 7: initial GET resolves later with older list that omits created comment
  getResolve({
    ok: true,
    state: 'loaded_with_comments',
    comments: [
      {
        id: 'existing-old',
        treeId: VALID_TREE_ID,
        body: 'old snapshot without created',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        authorDisplayLabel: 'reader'
      }
    ]
  });
  await flush();

  // 8-11: created comment remains; no overwrite; no duplicate
  assert.equal(getCount, 1, 'no extra GET from create path');
  assert.equal(posts.length, 1, 'still one POST');
  assert.equal(panel.getState(), 'loaded_with_comments');
  const cached = panel.getComments();
  assert.equal(cached.some((c) => c.id === 'c-created-race'), true, 'cache keeps created');
  assert.equal(
    cached.filter((c) => c.id === 'c-created-race').length,
    1,
    'created id once in cache'
  );
  // Late GET must not replace cache with old-only snapshot.
  assert.equal(
    cached.some((c) => c.id === 'existing-old' && cached.length === 1),
    false,
    'must not be only the late GET old list'
  );

  list = dom.document.getElementById('wholeTreeCommentsList');
  createdItems = list.children.filter(
    (li) => li.getAttribute && li.getAttribute('data-tree-comment-id') === 'c-created-race'
  );
  assert.equal(createdItems.length, 1, 'DOM still shows created comment once');
  assert.equal(
    list.children.length,
    cached.length,
    'DOM list length matches cachedComments'
  );
  assert.ok(
    list.textContent.includes('created before late GET'),
    'created body still visible'
  );
  assert.ok(!/memories|memory_id/.test(JSON.stringify({ posts, cached })));
});

// ─── Separation: write client endpoint only ─────────────────────────────────

test('write client only targets /trees/:id/comments (executed)', async () => {
  const src = fs.readFileSync(WRITE_CLIENT_PATH, 'utf8');
  assert.ok(src.includes("/trees/' + encodeURIComponent(cleanTreeId) + '/comments'"));
  assert.ok(!/\/memories\//.test(src));
  assert.ok(!/memory_id/.test(src));

  const calls = [];
  const sandbox = {
    window: {
      LoveTreeBaseApiFetch: {
        apiFetch: async (endpoint, opts) => {
          calls.push({ endpoint, opts });
          return {
            id: 'c1',
            treeId: VALID_TREE_ID,
            body: 'x',
            createdAt: 't',
            updatedAt: 't',
            authorDisplayLabel: 'a'
          };
        }
      }
    },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WRITE_CLIENT_PATH, 'utf8'), sandbox, {
    filename: WRITE_CLIENT_PATH
  });
  await sandbox.window.LoveBudTreeCommentsWrite.createTreeComment(
    VALID_TREE_ID,
    'x',
    'idem-key-sep-01'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, `/trees/${VALID_TREE_ID}/comments`);
  assert.ok(!/memory/.test(calls[0].endpoint));
});

// ─── Raw account IDs not in DOM ─────────────────────────────────────────────

test('applyCreatedComment does not expose raw owner/account IDs in DOM', async () => {
  const env = createComposerEnv({ auth: true });
  env.openPanelAndMount();
  await flush();
  env.panel.applyCreatedComment({
    id: 'c-safe',
    treeId: VALID_TREE_ID,
    body: 'safe body',
    createdAt: '2026-01-01',
    authorDisplayLabel: 'fan',
    ownerId: 'OWNER-RAW-999',
    uid: 'UID-RAW',
    email: 'raw@example.com'
  });
  const panelText = env.panel.getPanelElement().textContent;
  assert.ok(panelText.includes('safe body'));
  assert.ok(!panelText.includes('OWNER-RAW-999'));
  assert.ok(!panelText.includes('UID-RAW'));
  assert.ok(!panelText.includes('raw@example.com'));
});
