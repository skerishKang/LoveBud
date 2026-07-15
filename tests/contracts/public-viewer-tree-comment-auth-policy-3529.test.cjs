/**
 * Executed regression: whole-tree comment composer auth detection (#3529).
 *
 * Root cause: public-viewer-detail-ui.js queried window.LoveBudAuthPolicy
 * (typo) instead of the canonical window.LoveTreeAuthPolicy export.
 *
 * These tests execute the tree-meta assembly boundary from
 * public-viewer-detail-ui.js with a fake DOM and injectable policy.
 *
 * Refs #3529, #3527, #3188, #3075, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DETAIL_UI_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-detail-ui.js');
const TREE_META_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-detail-tree-meta.js');
const PANEL_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-tree-comments.js');
const COMPOSER_PATH = path.join(
  ROOT,
  'js',
  'viewer',
  'public-viewer-tree-comment-composer.js'
);
const WRITE_CLIENT_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-write-client.js');

const VALID_TREE_ID = '11111111-1111-4111-8111-111111111111';
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

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
    el.replaceChildren = function (...nodes) {
      el.children.forEach((c) => {
        c.parentNode = null;
        c.parentElement = null;
      });
      el.children = [];
      nodes.forEach((n) => el.appendChild(n));
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
      return null;
    };
    el.classList = {
      _set: new Set(),
      add(...names) {
        names.forEach((n) => el.classList._set.add(n));
      },
      remove(...names) {
        names.forEach((n) => el.classList._set.delete(n));
      },
      contains(n) {
        return el.classList._set.has(n);
      },
      toggle() {}
    };

    return el;
  }

  const body = makeEl('body');
  const document = {
    body,
    createElement: makeEl,
    createTextNode(text) {
      return {
        nodeType: 3,
        textContent: String(text == null ? '' : text),
        parentNode: null
      };
    },
    getElementById(id) {
      return idMap.get(id) || null;
    },
    get activeElement() {
      return activeElement;
    }
  };

  return { document, idMap, body };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
async function flush() {
  for (let i = 0; i < 8; i += 1) await tick();
}

/**
 * @param {{ policy?: object|null, loveBudAuth?: object|null, createTreeCommentImpl?: Function }} opts
 */
function loadTreeMetaAssembly(opts) {
  const options = opts || {};
  const posts = [];
  const getCalls = [];
  const dom = createDom();

  const mount = dom.document.createElement('div');
  mount.id = 'detailTreeMetaMount';
  dom.document.body.appendChild(mount);

  const createTreeCommentImpl =
    typeof options.createTreeCommentImpl === 'function'
      ? options.createTreeCommentImpl
      : async (treeId, body, key) => {
          posts.push({ treeId, body, key, endpointKind: 'tree' });
          return {
            ok: true,
            state: 'created',
            comment: {
              id: 'c-created-' + posts.length,
              treeId: treeId,
              body: body,
              createdAt: '2026-07-15T00:00:00Z',
              updatedAt: '2026-07-15T00:00:00Z',
              authorDisplayLabel: 'fan'
            },
            idempotencyKey: key
          };
        };

  const sandbox = {
    window: {
      location: {
        search: '?tree=' + VALID_TREE_ID,
        pathname: '/pages/view.html',
        origin: 'https://lovebud.pages.dev'
      },
      URLSearchParams,
      LoveTreeAuthPolicy: options.policy === undefined ? undefined : options.policy,
      LoveBudAuth: options.loveBudAuth === undefined ? undefined : options.loveBudAuth,
      // Explicitly do NOT set LoveBudAuthPolicy — production must not depend on it.
      LoveBudTreeComments: {
        fetchTreeComments: async (id) => {
          getCalls.push({ id });
          return {
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
          };
        }
      },
      LoveBudTreeCommentsWrite: {
        createTreeComment: createTreeCommentImpl,
        generateIdempotencyKey() {
          return 'tc-auth-3529-' + Math.random().toString(36).slice(2, 10);
        }
      },
      LoveBudTreeLikeControl: null
    },
    document: dom.document,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    URLSearchParams
  };
  // Mirror window onto sandbox for code that uses bare identifiers via window only.
  sandbox.window.document = dom.document;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(TREE_META_PATH, 'utf8'), sandbox, {
    filename: TREE_META_PATH
  });
  vm.runInContext(fs.readFileSync(PANEL_PATH, 'utf8'), sandbox, { filename: PANEL_PATH });
  vm.runInContext(fs.readFileSync(COMPOSER_PATH, 'utf8'), sandbox, {
    filename: COMPOSER_PATH
  });
  vm.runInContext(fs.readFileSync(DETAIL_UI_PATH, 'utf8'), sandbox, {
    filename: DETAIL_UI_PATH
  });

  const factory =
    sandbox.window.LoveBudPublicViewerDetailUI &&
    sandbox.window.LoveBudPublicViewerDetailUI.createPublicViewerTreeMetaBoundary;
  assert.equal(typeof factory, 'function', 'tree meta boundary factory must load');

  const treeData = {
    id: VALID_TREE_ID,
    title: 'Fixture Tree',
    visibility: 'public'
  };

  const updateTreeMeta = factory({
    i18n: (k, fb) => fb || k,
    formatI18nText: (k, fb) => fb || k,
    resolveTreeTitleText: () => 'Fixture Tree',
    createInlineIcon: () => dom.document.createElement('span'),
    showToast: () => {},
    getCurrentTreeData: () => treeData,
    getCanonicalRootId: () => 'root-1',
    getTreeMemories: () => [{ id: 'mem-1', treeId: VALID_TREE_ID }],
    isRootMemory: (m, root) => m && m.id === root,
    getLocalSaveMode: () => false
  });

  return {
    sandbox,
    dom,
    posts,
    getCalls,
    updateTreeMeta,
    openPanelAndAwaitComposer: async function () {
      updateTreeMeta({});
      await flush();
      const toggle = dom.document.getElementById('wholeTreeCommentsToggle');
      assert.ok(toggle, 'whole-tree comments toggle must exist for public tree');
      toggle.click();
      await flush();
    }
  };
}

// ─── Source guard (secondary) ───────────────────────────────────────────────

test('detail-ui uses LoveTreeAuthPolicy and never LoveBudAuthPolicy', () => {
  const src = fs.readFileSync(DETAIL_UI_PATH, 'utf8');
  assert.ok(
    src.includes('window.LoveTreeAuthPolicy'),
    'must reference canonical LoveTreeAuthPolicy'
  );
  // Property access / window lookup of the typo must not return.
  assert.ok(
    !/window\.LoveBudAuthPolicy/.test(src),
    'must not query window.LoveBudAuthPolicy'
  );
  assert.ok(
    !/LoveBudAuthPolicy\.hasConfirmedAuthSession/.test(src),
    'must not call typo policy hasConfirmedAuthSession'
  );
  assert.ok(
    /function getHasConfirmedAuthSession\s*\(/.test(src),
    'tree-comment auth helper must exist'
  );
});

test('auth-policy module exports LoveTreeAuthPolicy only', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'api', 'auth-policy.js'), 'utf8');
  assert.ok(src.includes('window.LoveTreeAuthPolicy'));
  assert.ok(!src.includes('window.LoveBudAuthPolicy'));
});

// ─── Executed assembly: authenticated via LoveTreeAuthPolicy ────────────────

test('LoveTreeAuthPolicy true mounts authenticated whole-tree composer', async () => {
  const env = loadTreeMetaAssembly({
    policy: {
      hasConfirmedAuthSession: () => true
    }
  });
  await env.openPanelAndAwaitComposer();

  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  const guest = env.dom.document.getElementById('wholeTreeCommentGuestNote');

  assert.ok(input, 'textarea mounted when policy confirms auth');
  assert.ok(submit, 'submit mounted when policy confirms auth');
  assert.equal(guest, null, 'guest note must not show when authenticated');
  assert.equal(env.posts.length, 0, 'open alone must not POST');
});

// ─── Guest: policy false ────────────────────────────────────────────────────

test('LoveTreeAuthPolicy false shows guest explanation and no composer POST', async () => {
  const env = loadTreeMetaAssembly({
    policy: {
      hasConfirmedAuthSession: () => false
    }
  });
  await env.openPanelAndAwaitComposer();

  assert.ok(env.dom.document.getElementById('wholeTreeCommentGuestNote'), 'guest note');
  assert.equal(env.dom.document.getElementById('wholeTreeCommentInput'), null);
  assert.equal(env.dom.document.getElementById('wholeTreeCommentSubmit'), null);
  assert.equal(env.posts.length, 0);
});

// ─── Fail-closed: missing policy ────────────────────────────────────────────

test('missing policy fails closed to guest mode', async () => {
  const env = loadTreeMetaAssembly({
    policy: undefined,
    loveBudAuth: null
  });
  // Ensure typo global alone cannot unlock write UI.
  env.sandbox.window.LoveBudAuthPolicy = {
    hasConfirmedAuthSession: () => true
  };
  await env.openPanelAndAwaitComposer();

  assert.ok(
    env.dom.document.getElementById('wholeTreeCommentGuestNote'),
    'missing LoveTreeAuthPolicy must guest'
  );
  assert.equal(env.dom.document.getElementById('wholeTreeCommentInput'), null);
  assert.equal(env.posts.length, 0);
});

// ─── Fail-closed: throwing policy ───────────────────────────────────────────

test('throwing LoveTreeAuthPolicy fails closed with zero POST', async () => {
  const env = loadTreeMetaAssembly({
    policy: {
      hasConfirmedAuthSession: () => {
        throw new Error('policy boom');
      }
    }
  });
  await env.openPanelAndAwaitComposer();

  assert.ok(env.dom.document.getElementById('wholeTreeCommentGuestNote'));
  assert.equal(env.dom.document.getElementById('wholeTreeCommentInput'), null);
  assert.equal(env.posts.length, 0, 'throwing policy must not unlock write');
});

// ─── Authenticated valid submit uses tree write path only ───────────────────

test('authenticated valid submit calls tree-comment write only once', async () => {
  const momentPosts = [];
  const env = loadTreeMetaAssembly({
    policy: {
      hasConfirmedAuthSession: () => true
    }
  });
  // Poison moment-style globals — tree path must not call them.
  env.sandbox.window.createComment = async () => {
    momentPosts.push('createComment');
    return { id: 'm1' };
  };
  env.sandbox.window.LoveBudMomentComments = {
    createComment: async () => {
      momentPosts.push('moment');
      return { id: 'm1' };
    }
  };

  await env.openPanelAndAwaitComposer();
  const input = env.dom.document.getElementById('wholeTreeCommentInput');
  const submit = env.dom.document.getElementById('wholeTreeCommentSubmit');
  input.value = 'authenticated tree comment';
  submit.click();
  await flush();

  assert.equal(env.posts.length, 1);
  assert.equal(env.posts[0].treeId, VALID_TREE_ID);
  assert.equal(env.posts[0].body, 'authenticated tree comment');
  assert.ok(KEY_PATTERN.test(env.posts[0].key));
  assert.equal(momentPosts.length, 0, 'moment write path must not be called');
  assert.ok(!/memory|moment/i.test(JSON.stringify(env.posts[0])));
});

// ─── Guest POST count 0 even with submit attempt impossible ─────────────────

test('guest mode cannot POST (no submit control)', async () => {
  const env = loadTreeMetaAssembly({
    policy: { hasConfirmedAuthSession: () => false }
  });
  await env.openPanelAndAwaitComposer();
  assert.equal(env.dom.document.getElementById('wholeTreeCommentSubmit'), null);
  assert.equal(env.posts.length, 0);
});

// ─── Write client still tree-only (executed smoke) ──────────────────────────

test('write client targets /trees/:id/comments only (executed)', async () => {
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
    'idem-key-3529-01'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, `/trees/${VALID_TREE_ID}/comments`);
  assert.ok(!/memory|memories/.test(calls[0].endpoint));
});
