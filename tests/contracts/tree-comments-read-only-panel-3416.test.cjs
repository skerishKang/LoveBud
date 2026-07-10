/**
 * Focused tests for the read-only whole-tree comments panel (Issue #3416).
 *
 * These tests verify js/viewer/public-viewer-tree-comments.js adds a read-only
 * whole-tree comments disclosure to the public viewer tree-meta area, using a
 * deterministic minimal DOM mock and a mocked window.LoveBudTreeComments adapter.
 * No production/staging network is used.
 *
 * Refs #3416, #3188, #3414, #3415, #3412, #3413, #3408, #3410, #3404, #3372,
 *       #3374, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const WTREE_COMMENTS_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-tree-comments.js');
const TREE_COMMENTS_CLIENT_PATH = path.join(ROOT, 'js', 'social', 'tree-comments-client.js');
const TREE_META_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-detail-tree-meta.js');
const DETAIL_UI_PATH = path.join(ROOT, 'js', 'viewer', 'public-viewer-detail-ui.js');
const VIEW_HTML_PATH = path.join(ROOT, 'pages', 'view.html');

const VALID_TREE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TREE_ID = '22222222-2222-4222-8222-222222222222';

// ─── minimal deterministic DOM mock ────────────────────────────────────────

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
      _attributes: {},
      _listeners: {},
      _id: '',
      _text: '',
      hidden: false,
      tabIndex: 0,
      className: '',
    };

    Object.defineProperty(el, 'id', {
      get() { return el._id; },
      set(v) {
        if (el._id) idMap.delete(el._id);
        el._id = v;
        if (v) idMap.set(v, el);
      },
    });

    Object.defineProperty(el, 'textContent', {
      get() {
        if (el.children.length === 0) return el._text;
        return el.children.map((c) => c.textContent).join('');
      },
      set(v) {
        el._text = String(v == null ? '' : v);
        el.children = [];
      },
    });

    Object.defineProperty(el, 'firstChild', {
      get() { return el.children[0] || null; },
    });

    Object.defineProperty(el, 'isConnected', {
      get() {
        let node = el;
        while (node) {
          if (node === document.body) return true;
          node = node.parentNode;
        }
        return false;
      },
    });

    el.appendChild = function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    };
    el.removeChild = function (child) {
      const idx = el.children.indexOf(child);
      if (idx !== -1) el.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    };
    el.replaceChildren = function (...nodes) {
      el.children.forEach((c) => { c.parentNode = null; });
      el.children = [];
      nodes.forEach((n) => el.appendChild(n));
    };
    el.setAttribute = function (k, v) {
      if (k === 'id') { el.id = v; return; }
      el._attributes[k] = String(v);
    };
    el.getAttribute = function (k) {
      return k in el._attributes ? el._attributes[k] : null;
    };
    el.hasAttribute = function (k) {
      return k in el._attributes;
    };
    el.removeAttribute = function (k) {
      delete el._attributes[k];
    };
    el.addEventListener = function (type, fn) {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    };
    el.removeEventListener = function (type, fn) {
      if (el._listeners[type]) {
        el._listeners[type] = el._listeners[type].filter((f) => f !== fn);
      }
    };
    el.click = function () {
      (el._listeners.click || []).forEach((fn) => fn.call(el, { type: 'click' }));
    };
    el.focus = function () {
      activeElement = el;
    };
    el.contains = function (node) {
      if (node === el) return true;
      return el.children.some((c) => c.contains && c.contains(node));
    };
    el.querySelector = function (sel) {
      // minimal: support [data-x="y"] and #id
      if (sel[0] === '#') return idMap.get(sel.slice(1)) || null;
      const m = /^\[([\w-]+)="(.+)"\]$/.exec(sel);
      if (m) {
        const want = m[1];
        const val = m[2];
        const stack = [el];
        while (stack.length) {
          const cur = stack.pop();
          if (cur._attributes && cur._attributes[want] === val) return cur;
          (cur.children || []).forEach((c) => stack.push(c));
        }
      }
      return null;
    };

    el.classList = {
      _set: new Set(),
      add(...names) { names.forEach((n) => el.classList._set.add(n)); },
      remove(...names) { names.forEach((n) => el.classList._set.delete(n)); },
      toggle(n, force) {
        if (force === undefined) {
          if (el.classList._set.has(n)) el.classList._set.delete(n);
          else el.classList._set.add(n);
        } else if (force) el.classList._set.add(n);
        else el.classList._set.delete(n);
      },
      contains(n) { return el.classList._set.has(n); },
    };

    return el;
  }

  const document = {
    body: makeEl('body'),
    createElement: makeEl,
    getElementById(id) { return idMap.get(id) || null; },
    get activeElement() { return activeElement; },
  };

  return { document, idMap };
}

function loadModules(dom, adapterMock) {
  const sandbox = {
    window: {
      // Provide a mocked adapter; the real js/social/tree-comments-client.js
      // is covered by its own focused test, not loaded here.
      LoveBudTreeComments: { fetchTreeComments: adapterMock },
    },
    document: dom.document,
    console,
    Promise,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WTREE_COMMENTS_PATH, 'utf8'), sandbox, { filename: WTREE_COMMENTS_PATH });
  return sandbox.window.LoveBudPublicViewerTreeComments;
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
async function flush() {
  for (let i = 0; i < 5; i++) await tick();
}

// ─── 1. view.html script dependency order ──────────────────────────────────

test('pages/view.html loads adapter after base-api-fetch and new module after adapter, both before public-canvas-init', () => {
  const html = fs.readFileSync(VIEW_HTML_PATH, 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="\.\.\/([^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
  const idx = (name) => scripts.findIndex((s) => s.endsWith(name));

  const baseApi = idx('js/api/base-api-fetch.js');
  const adapter = idx('js/social/tree-comments-client.js');
  const wtree = idx('js/viewer/public-viewer-tree-comments.js');
  const init = idx('js/viewer/public-canvas-init.js');

  assert.ok(baseApi !== -1, 'base-api-fetch.js must be present');
  assert.ok(adapter !== -1, 'tree-comments-client.js must be present');
  assert.ok(wtree !== -1, 'public-viewer-tree-comments.js must be present');
  assert.ok(init !== -1, 'public-canvas-init.js must be present');
  assert.ok(adapter > baseApi, 'adapter must load after base-api-fetch.js');
  assert.ok(wtree > adapter, 'new viewer module must load after adapter');
  assert.ok(wtree < init, 'new viewer module must load before public viewer init');
});

// ─── 2. module loads and factory exists ────────────────────────────────────

test('module exposes createTreeCommentsReadOnlyControl on window', () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  assert.equal(typeof ns.createTreeCommentsReadOnlyControl, 'function');
});

// ─── 3. real button, tree-scope accessible name, aria ──────────────────────

test('toggle is a real button with tree-scope name and aria-expanded/aria-controls', () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  const btn = control.getElement();
  assert.equal(btn.tagName, 'BUTTON');
  assert.equal(btn.type, 'button');
  assert.equal(btn.textContent, '트리 전체 댓글');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('aria-controls'), 'wholeTreeCommentsPanel');
  assert.equal(btn.id, 'wholeTreeCommentsToggle');
});

// ─── 4. lazy first open = adapter call 1회 ─────────────────────────────────

test('first open triggers exactly one adapter call', async () => {
  let calls = 0;
  const dom = createDom();
  const ns = loadModules(dom, async () => { calls++; return { ok: true, state: 'loaded_with_comments', comments: [] }; });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(calls, 1, 'first open must call adapter exactly once');
});

// ─── 5. repeated open during loading = no duplicate request ────────────────

test('repeated open while loading does not create a duplicate request', async () => {
  let calls = 0;
  const dom = createDom();
  const ns = loadModules(dom, async () => {
    calls++;
    await tick();
    return { ok: true, state: 'loaded_with_comments', comments: [] };
  });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  control.open(); // during loading
  control.open();
  await flush();
  assert.equal(calls, 1, 'loading-in-progress repeated open must not duplicate request');
});

// ─── 6. success then close/reopen = no uncontrolled duplicate ──────────────

test('close and reopen after success does not refetch', async () => {
  let calls = 0;
  const dom = createDom();
  const ns = loadModules(dom, async () => {
    calls++;
    return { ok: true, state: 'loaded_with_comments', comments: [{ id: 'c1', treeId: VALID_TREE_ID, body: 'hi', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a' }] };
  });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(calls, 1);
  control.close();
  control.open(); // reopen reuses cached results
  await flush();
  assert.equal(calls, 1, 'reopen after success must not refetch');
});

// ─── 7. explicit retry = exactly one new adapter call ──────────────────────

test('explicit retry button triggers exactly one new adapter call', async () => {
  let calls = 0;
  const dom = createDom();
  const ns = loadModules(dom, async () => {
    calls++;
    // First call fails, retry succeeds
    if (calls === 1) return { ok: false, state: 'upstream_unavailable' };
    return { ok: true, state: 'loaded_with_comments', comments: [{ id: 'c1', treeId: VALID_TREE_ID, body: 'retried', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a' }] };
  });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(calls, 1, 'first open fails');
  assert.equal(control.getState(), 'upstream_unavailable');
  const panel = control.getPanelElement();
  const retry = panel.querySelector('#wholeTreeCommentsRetry');
  assert.ok(retry, 'retry button must exist in error state');
  retry.click();
  await flush();
  assert.equal(calls, 2, 'explicit retry must call adapter exactly once');
  assert.equal(control.getState(), 'loaded_with_comments');
});

// ─── 8. loaded empty state ─────────────────────────────────────────────────

test('loaded empty state renders empty copy and state', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'loaded_empty');
  const status = dom.document.getElementById('wholeTreeCommentsStatus');
  assert.equal(status.textContent, '아직 트리 전체에 남겨진 댓글이 없어요.');
});

// ─── 9. loaded with comments state ─────────────────────────────────────────

test('loaded with comments state renders list', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({
    ok: true, state: 'loaded_with_comments',
    comments: [{ id: 'c1', treeId: VALID_TREE_ID, body: 'first', createdAt: '2024-01-01T00:00:00Z', updatedAt: 't', authorDisplayLabel: 'anonym' }],
  }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'loaded_with_comments');
  const list = dom.document.getElementById('wholeTreeCommentsList');
  assert.equal(list.children.length, 1, 'one comment item');
  assert.equal(list.children[0].textContent.includes('first'), true);
});

// ─── 10. invalid tree ID state ─────────────────────────────────────────────

test('invalid tree id state exposed (no network call)', async () => {
  let calls = 0;
  const dom = createDom();
  const ns = loadModules(dom, async () => { calls++; return { ok: true, state: 'loaded_empty', comments: [] }; });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: 'not-a-uuid' });
  control.open();
  await flush();
  assert.equal(calls, 0, 'adapter must not be called for invalid tree id');
  assert.equal(control.getState(), 'invalid_tree_id');
});

// ─── 11. not-found/private/non-public collapsed state ──────────────────────

test('not found / private / non-public collapses to unavailable copy, no private exposure', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: false, state: 'not_found_private_non_public' }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'not_found_private_non_public');
  const status = dom.document.getElementById('wholeTreeCommentsStatus');
  assert.equal(status.textContent, '트리 전체 댓글을 불러오지 못했어요. 다시 시도해 주세요.');
  assert.ok(!/비공개|private|존재하지/.test(status.textContent), 'must not expose private/presence detail');
});

// ─── 12. upstream unavailable ──────────────────────────────────────────────

test('upstream unavailable state', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: false, state: 'upstream_unavailable' }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'upstream_unavailable');
});

// ─── 13. upstream timeout ──────────────────────────────────────────────────

test('upstream timeout state renders timeout copy', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: false, state: 'upstream_timeout' }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'upstream_timeout');
  const status = dom.document.getElementById('wholeTreeCommentsStatus');
  assert.equal(status.textContent, '댓글을 불러오는 데 시간이 걸리고 있어요. 다시 시도해 주세요.');
});

// ─── 14. unexpected safe error ─────────────────────────────────────────────

test('unexpected safe error state', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: false, state: 'unexpected_safe_error' }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'unexpected_safe_error');
});

// ─── 15. safe fields only render ───────────────────────────────────────────

test('rendered comment shows only safe fields (body + author + date)', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({
    ok: true, state: 'loaded_with_comments',
    comments: [{
      id: 'c1', treeId: VALID_TREE_ID, body: 'hello', createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z', authorDisplayLabel: '익명',
    }],
  }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  const li = dom.document.getElementById('wholeTreeCommentsList').children[0];
  const text = li.textContent;
  assert.ok(text.includes('hello'), 'body shown');
  assert.ok(text.includes('익명'), 'authorDisplayLabel shown');
  assert.ok(text.includes('2024-01-01'), 'createdAt shown');
  assert.ok(!text.includes(VALID_TREE_ID), 'treeId not shown');
  assert.ok(!text.includes('c1'), 'comment id not shown');
});

// ─── 16. raw account identifiers not rendered ──────────────────────────────

test('raw account identifiers are not rendered', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({
    ok: true, state: 'loaded_with_comments',
    comments: [{ id: 'c1', treeId: VALID_TREE_ID, body: 'hi', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a', ownerId: 'evil-owner', owner_id: 'evil-2', uid: 'evil-uid', email: 'evil@example.com' }],
  }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  const text = dom.document.getElementById('wholeTreeCommentsList').children[0].textContent;
  for (const bad of ['evil-owner', 'evil-2', 'evil-uid', 'evil@example.com']) {
    assert.ok(!text.includes(bad), `raw account identifier ${bad} must not be rendered`);
  }
});

// ─── 17. textContent-based safe body rendering (no HTML injection) ─────────

test('comment body uses textContent (no HTML parsing)', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({
    ok: true, state: 'loaded_with_comments',
    comments: [{ id: 'c1', treeId: VALID_TREE_ID, body: '<img src=x onerror=alert(1)>', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a' }],
  }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  const li = dom.document.getElementById('wholeTreeCommentsList').children[0];
  assert.equal(li.textContent.includes('<img src=x onerror=alert(1)>'), true, 'body kept as literal text');
});

// ─── 18. tree ID change resets state ───────────────────────────────────────

test('reset on tree id change clears state and cached results', async () => {
  let lastTreeId = null;
  const dom = createDom();
  const ns = loadModules(dom, async (id) => {
    lastTreeId = id;
    return { ok: true, state: 'loaded_with_comments', comments: [{ id: 'c', treeId: id, body: 'b', createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a' }] };
  });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(control.getState(), 'loaded_with_comments');
  control.reset(OTHER_TREE_ID);
  assert.equal(control.getState(), 'idle');
  assert.equal(control.getComments().length, 0);
  control.open();
  await flush();
  assert.equal(lastTreeId, OTHER_TREE_ID, 'reset must target the new tree id');
});

// ─── 19. stale response guard ──────────────────────────────────────────────

test('stale async response does not overwrite a newer tree panel', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async (id, opts) => {
    // Resolve after a delay so a reset can invalidate the generation.
    await tick();
    return { ok: true, state: 'loaded_with_comments', comments: [{ id: 'c', treeId: id, body: 'stale-' + id, createdAt: 't', updatedAt: 't', authorDisplayLabel: 'a' }] };
  });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  // Immediately reset to another tree before the first response resolves.
  control.reset(OTHER_TREE_ID);
  control.open();
  await flush();
  // The panel must reflect the newer tree, not the stale first response.
  assert.equal(control.getState(), 'loaded_with_comments');
  const text = dom.document.getElementById('wholeTreeCommentsList').textContent;
  assert.ok(text.includes('stale-' + OTHER_TREE_ID), 'newer tree comments shown');
  assert.ok(!text.includes('stale-' + VALID_TREE_ID), 'stale first response ignored');
});

// ─── 20. open focus moves to heading ───────────────────────────────────────

test('opening moves focus to the panel heading', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.equal(dom.document.activeElement, dom.document.getElementById('wholeTreeCommentsHeading'));
});

// ─── 21. close returns focus to toggle ─────────────────────────────────────

test('closing returns focus to the toggle button', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  control.close();
  await tick();
  assert.equal(dom.document.activeElement, control.getElement());
});

// ─── 22. panel / status live semantics ─────────────────────────────────────

test('panel hidden toggles and status has live semantics', async () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  const panel = control.getPanelElement();
  const status = dom.document.getElementById('wholeTreeCommentsStatus');
  assert.equal(panel.hidden, true, 'panel starts hidden');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  control.open();
  await flush();
  assert.equal(panel.hidden, false, 'panel opens');
  control.close();
  await tick();
  assert.equal(panel.hidden, true, 'panel closes');
});

// ─── 23. no moment DOM ids ─────────────────────────────────────────────────

test('control DOM ids are tree-scope only (no moment ids)', () => {
  const dom = createDom();
  const ns = loadModules(dom, async () => ({ ok: true, state: 'loaded_empty', comments: [] }));
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  const btn = control.getElement();
  const panel = control.getPanelElement();
  assert.ok(!/moment/i.test(btn.id), 'toggle id must not reference moment');
  assert.ok(!/moment/i.test(panel.id), 'panel id must not reference moment');
  assert.equal(btn.id, 'wholeTreeCommentsToggle');
  assert.equal(panel.id, 'wholeTreeCommentsPanel');
});

// ─── 24. no memoryId / memory_id ───────────────────────────────────────────

test('module source contains no memory_id / memoryId', () => {
  const src = fs.readFileSync(WTREE_COMMENTS_PATH, 'utf8');
  assert.ok(!/memory_id/.test(src), 'no memory_id in source');
  assert.ok(!/memoryId/.test(src), 'no memoryId in source');
});

// ─── 25. no moment endpoint / adapter reuse ────────────────────────────────

test('module source does not use moment endpoints or moment comment adapters', () => {
  const src = fs.readFileSync(WTREE_COMMENTS_PATH, 'utf8');
  assert.ok(!/memories\//.test(src), 'no moment endpoint path');
  assert.ok(!/fetchPublicMomentComments|fetchComments|createComment/.test(src), 'no moment comment adapter reuse');
});

// ─── 26. no composer / POST / Idempotency-Key ──────────────────────────────

test('module source has no composer, POST, or Idempotency-Key', () => {
  const src = fs.readFileSync(WTREE_COMMENTS_PATH, 'utf8');
  assert.ok(!/\bPOST\b/.test(src), 'no POST');
  assert.ok(!/Idempotency-Key/.test(src), 'no Idempotency-Key');
  assert.ok(!/createComment|composer|textarea|input|submit/.test(src), 'no composer/input/submit');
  assert.ok(!/Authorization/.test(src), 'no Authorization header construction');
});

// ─── 27. adapter is called with treeId only (no moment key) ─────────────────

test('adapter is invoked with treeId and tree-target only', async () => {
  let received = null;
  const dom = createDom();
  const ns = loadModules(dom, async (id, opts) => { received = { id, opts }; return { ok: true, state: 'loaded_empty', comments: [] }; });
  const control = ns.createTreeCommentsReadOnlyControl({ i18n: (k, fb) => fb, treeId: VALID_TREE_ID });
  control.open();
  await flush();
  assert.ok(received, 'adapter was called');
  assert.equal(received.id, VALID_TREE_ID);
  assert.ok(!received.opts || !received.opts.memoryId, 'no memoryId passed to adapter');
  assert.ok(received.opts && received.opts.limit >= 1 && received.opts.limit <= 50, 'limit within 1..50');
});

// ─── 28. integration wiring: detail-ui builds control for public tree ───────

test('detail-ui creates tree comments control for public tree (integration smoke)', () => {
  const src = fs.readFileSync(DETAIL_UI_PATH, 'utf8');
  const metaSrc = fs.readFileSync(TREE_META_PATH, 'utf8');
  assert.ok(/LoveBudPublicViewerTreeComments/.test(src), 'detail-ui references tree comments namespace');
  assert.ok(/createTreeCommentsReadOnlyControl/.test(src), 'detail-ui creates the control');
  assert.ok(/treeCommentsControlEl/.test(metaSrc), 'tree meta accepts control element');
  assert.ok(/treeCommentsPanelEl/.test(metaSrc), 'tree meta accepts panel element');
  // Only for public trees; non-public must not mount.
  assert.ok(/isPublic/.test(src), 'detail-ui gates on public visibility');
});

// ─── 29. Scout / backend / #3075 scope guards ──────────────────────────────

test('no Scout files, backend route/reader, or moment-comment files changed by this PR', () => {
  const status = require('node:child_process').execSync('git status --porcelain', { cwd: ROOT }).toString();
  for (const line of status.split('\n')) {
    if (/js\/scout\//.test(line)) assert.fail(`Scout file changed: ${line}`);
    if (/functions\/api\/trees\/\[tree_id\]\/comments\.js|modal_compute\/tree_comments\.py|modal_compute\/app\.py/.test(line)) {
      assert.fail(`Backend route/reader changed: ${line}`);
    }
    if (/memories\/\[memory_id\]\/comments\.js|modal_compute\/comments\.py|public-viewer-authenticated-comment-composer\.js/.test(line)) {
      assert.fail(`Moment comment file changed: ${line}`);
    }
  }
});

test('this test suite does not import runtime/network/browser clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)/i.test(self), 'must not import axios');
  assert.ok(!/require\(['"]playwright['"]\)|require\(['"]puppeteer['"]\)/i.test(self), 'must not import browser automation');
  assert.ok(!/require\(['"]jsdom['"]\)/i.test(self), 'must not import jsdom (uses deterministic mock)');
});
