/**
 * Route authority + owner social interaction boundary contract.
 * Issue #3519 / parent #3475
 *
 * Primary: EXECUTED_FAKE for owner reactions controller lifecycle.
 * Secondary: SOURCE_STATIC guards for mode selection preservation bindings,
 * nested click stopPropagation, and asset token correctness.
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
  const content = read(rel).replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12);
}

function createElementMap() {
  const store = Object.create(null);

  function makeEl(id) {
    return {
      id,
      textContent: id === 'momentReactionLikeValue' || id === 'momentReactionCommentValue' ? '⋯' : '',
      style: { display: '' },
      dataset: {},
      disabled: true,
      hidden: true,
      className: '',
      classList: {
        _set: new Set(),
        add(...names) { names.forEach((name) => this._set.add(name)); },
        remove(...names) { names.forEach((name) => this._set.delete(name)); },
        contains(name) { return this._set.has(name); },
      },
      attributes: Object.create(null),
      childNodes: [],
      onclick: null,
      listeners: Object.create(null),
      querySelector(sel) {
        if (sel === '.editor-reaction-like-icon') {
          if (!this._icon) {
            this._icon = { textContent: '🤍' };
          }
          return this._icon;
        }
        return null;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'aria-pressed') this['aria-pressed'] = String(value);
        if (name === 'aria-expanded') this['aria-expanded'] = String(value);
        if (name === 'aria-disabled') this['aria-disabled'] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] || null;
      },
      removeAttribute(name) {
        delete this.attributes[name];
        if (name === 'aria-disabled') delete this['aria-disabled'];
      },
      addEventListener(type, fn) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(fn);
      },
      focus() {},
    };
  }

  return {
    get(id) {
      if (!store[id]) store[id] = makeEl(id);
      return store[id];
    },
    all: store,
  };
}

test('owner reactions controller: loading → ready enables like/comment and preserves selection epoch', async () => {
  const els = createElementMap();
  const card = els.get('momentReactionsCard');
  card.classList.add('is-public-readonly');
  card.classList.add('is-read-only');
  card.setAttribute('data-read-only-summary', 'true');

  const likeBtn = els.get('momentReactionLikeButton');
  const commentBtn = els.get('momentReactionCommentStatus');
  const likeValue = els.get('momentReactionLikeValue');
  const commentValue = els.get('momentReactionCommentValue');
  const panel = els.get('momentCommentsPanel');
  panel.hidden = true;

  let summaryCalls = 0;
  let toggleCalls = 0;
  const apiClient = {
    fetchReactionSummary(memoryId) {
      summaryCalls += 1;
      if (memoryId === 'mem-A') {
        return Promise.resolve({
          like_count: 0,
          comment_count: 2,
          user_reacted: false,
        });
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            like_count: 9,
            comment_count: 1,
            user_reacted: true,
          });
        }, 20);
      });
    },
    toggleReaction(memoryId) {
      toggleCalls += 1;
      return Promise.resolve({
        like_count: 1,
        user_reacted: true,
      });
    },
  };

  const source = read('js/editor/editor-detail-ui.js');
  const context = {
    window: {},
    document: {
      getElementById(id) {
        return els.get(id);
      },
    },
    console,
    setTimeout,
    clearTimeout,
    Promise,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof context.makeMomentReactionsController, 'function');

  const controller = context.makeMomentReactionsController({
    getElementById: (id) => els.get(id),
    apiClient,
    showToast() {},
    i18n(key) { return key; },
  });

  controller.update({
    data: { id: 'mem-A' },
    canonicalRootId: 'root',
    isRootMemoryFn: () => false,
  });

  assert.equal(card.dataset.socialState, 'loading');
  assert.equal(likeBtn.disabled, true);
  assert.equal(commentBtn.disabled, true);
  assert.equal(likeValue.textContent, '⋯');
  assert.equal(commentValue.textContent, '⋯');
  assert.equal(card.classList.contains('is-public-readonly'), false);
  assert.equal(card.classList.contains('is-read-only'), false);
  assert.equal(card.getAttribute('data-read-only-summary'), null);

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(card.dataset.socialState, 'ready');
  assert.equal(likeBtn.disabled, false);
  assert.equal(commentBtn.disabled, false);
  assert.equal(likeValue.textContent, '0');
  assert.equal(commentValue.textContent, '2');
  assert.equal(likeBtn.getAttribute('aria-pressed'), 'false');

  // Nested comment toggle should open panel and stop parent navigation callers
  // by preventDefault/stopPropagation in the bound handler.
  assert.equal(commentBtn.dataset.ownerToggleBound, '1');
  const clickHandlers = commentBtn.listeners.click || [];
  assert.ok(clickHandlers.length >= 1);
  let stopped = false;
  clickHandlers[0]({
    preventDefault() {},
    stopPropagation() { stopped = true; },
  });
  assert.equal(stopped, true);
  assert.equal(panel.hidden, false);
  assert.equal(commentBtn.getAttribute('aria-expanded'), 'true');

  // Selection switch A→B: stale A summary must not overwrite B.
  controller.update({
    data: { id: 'mem-B' },
    canonicalRootId: 'root',
    isRootMemoryFn: () => false,
  });
  assert.equal(card.dataset.socialState, 'loading');
  assert.equal(likeValue.textContent, '⋯');

  // Resolve B after A was already ready earlier.
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(summaryCalls >= 2, true);
  assert.equal(likeValue.textContent, '9');
  assert.equal(commentValue.textContent, '1');
  assert.equal(likeBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(card.dataset.socialState, 'ready');

  // Like submit path with temporary submitting state.
  await likeBtn.onclick({ preventDefault() {}, stopPropagation() {} });
  assert.equal(toggleCalls, 1);
  assert.equal(likeValue.textContent, '1');
  assert.equal(likeBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(likeBtn.disabled, false);
});

test('mode transition labels and selection-preserving bindings remain present', () => {
  const viewTpl = read('js/editor/templates/editor-detail-view-mode-template.js');
  const editTpl = read('js/editor/templates/editor-detail-edit-mode-template.js');
  const bindings = read('js/editor/editor-bindings.js');
  const i18nRefresh = read('js/editor/editor-i18n-refresh.js');
  const memoryActions = read('js/editor/editor-memory-actions.js');

  assert.match(viewTpl, /id="editMemoryBtn"/);
  assert.match(editTpl, /id="cancelEditBtn"/);
  assert.match(editTpl, /connectExistingCtaSection/);
  assert.match(editTpl, /id="deleteMemoryBtn"/);
  assert.doesNotMatch(viewTpl, /connectExistingCtaSection/);
  assert.doesNotMatch(viewTpl, /id="deleteMemoryBtn"/);

  assert.match(bindings, /editMemoryBtn/);
  assert.match(bindings, /cancelEditBtn/);
  assert.match(bindings, /exitEditMode/);
  assert.match(memoryActions, /enterEditMode/);
  assert.match(memoryActions, /exitEditMode/);
  assert.match(i18nRefresh, /editor_back_to_appreciation|감상 모드/);
});

test('modified browser assets have non-stale tokens and protected base-api-fetch matches main-current', () => {
  const editorHtml = read('pages/editor.html');
  const viewHtml = read('pages/view.html');

  // Protected #3520 token must remain the current main value.
  assert.match(
    editorHtml,
    /base-api-fetch\.js\?v=20260715-3517-1/
  );
  assert.match(
    viewHtml,
    /base-api-fetch\.js\?v=20260715-3517-1/
  );

  const fingerprintAssets = [
    {
      file: 'js/editor/templates/editor-detail-view-mode-template.js',
      page: editorHtml,
      pattern: /editor-detail-view-mode-template\.js\?v=([^"']+)/,
    },
    {
      file: 'js/shared/appreciation-presentation-slots.js',
      page: editorHtml,
      pattern: /appreciation-presentation-slots\.js\?v=([^"']+)/,
    },
    {
      file: 'js/shared/appreciation-slot-dom.js',
      page: editorHtml,
      pattern: /appreciation-slot-dom\.js\?v=([^"']+)/,
    },
    {
      file: 'js/editor/editor-appreciation-model-adapter.js',
      page: editorHtml,
      pattern: /editor-appreciation-model-adapter\.js\?v=([^"']+)/,
    },
    {
      file: 'js/editor/editor-appreciation-composer.js',
      page: editorHtml,
      pattern: /editor-appreciation-composer\.js\?v=([^"']+)/,
    },
    {
      file: 'js/shared/appreciation-presentation-slots.js',
      page: viewHtml,
      pattern: /appreciation-presentation-slots\.js\?v=([^"']+)/,
    },
    {
      file: 'js/shared/appreciation-slot-dom.js',
      page: viewHtml,
      pattern: /appreciation-slot-dom\.js\?v=([^"']+)/,
    },
    {
      file: 'js/viewer/public-viewer-appreciation-presentation-model.js',
      page: viewHtml,
      pattern: /public-viewer-appreciation-presentation-model\.js\?v=([^"']+)/,
    },
    {
      file: 'js/viewer/public-viewer-appreciation-composer.js',
      page: viewHtml,
      pattern: /public-viewer-appreciation-composer\.js\?v=([^"']+)/,
    },
    {
      file: 'js/viewer/public-viewer-appreciation-dom-renderer.js',
      page: viewHtml,
      pattern: /public-viewer-appreciation-dom-renderer\.js\?v=([^"']+)/,
    },
  ];

  for (const asset of fingerprintAssets) {
    const expected = sha12(asset.file);
    const match = asset.page.match(asset.pattern);
    assert.ok(match, `token missing for ${asset.file}`);
    assert.equal(
      match[1],
      expected,
      `${asset.file} token must match content sha12 ${expected}`
    );
  }

  // Date-token assets must be bumped for this corrective pass.
  assert.match(editorHtml, /editor-detail-ui\.js\?v=20260715-3519-1/);
  assert.match(editorHtml, /editor-i18n-refresh\.js\?v=20260715-3519-1/);
  assert.match(editorHtml, /i18n-editor\.js\?v=20260715-3519-1/);

  // Content-fingerprint assets modified in final corrective pass.
  const finalFingerprintAssets = [
    {
      file: 'js/editor/templates/editor-detail-edit-mode-template.js',
      pattern: /editor-detail-edit-mode-template\.js\?v=([^"']+)/,
    },
    {
      file: 'js/editor/editor-moment-comments.js',
      pattern: /editor-moment-comments\.js\?v=([^"']+)/,
    },
    {
      file: 'js/editor/editor-bindings.js',
      pattern: /editor-bindings\.js\?v=([^"']+)/,
    },
  ];
  for (const asset of finalFingerprintAssets) {
    const expected = sha12(asset.file);
    const match = editorHtml.match(asset.pattern);
    assert.ok(match, `token missing for ${asset.file}`);
    assert.equal(match[1], expected, `${asset.file} token must match content sha12`);
  }

  // Same shared assets must stay synchronized across routes.
  const editorSlots = editorHtml.match(/appreciation-presentation-slots\.js\?v=([^"']+)/)[1];
  const viewSlots = viewHtml.match(/appreciation-presentation-slots\.js\?v=([^"']+)/)[1];
  assert.equal(editorSlots, viewSlots);
  const editorDom = editorHtml.match(/appreciation-slot-dom\.js\?v=([^"']+)/)[1];
  const viewDom = viewHtml.match(/appreciation-slot-dom\.js\?v=([^"']+)/)[1];
  assert.equal(editorDom, viewDom);
});

test('editor detail-ui does not import viewer route modules; viewer does not import editor adapter', () => {
  const editorDetail = read('js/editor/editor-detail-ui.js');
  const viewerDetail = read('js/viewer/public-viewer-detail-ui.js');
  const viewerComposer = read('js/viewer/public-viewer-appreciation-composer.js');
  const editorComposer = read('js/editor/editor-appreciation-composer.js');

  assert.doesNotMatch(editorDetail, /LoveBudPublicViewerAppreciation/);
  assert.match(editorDetail, /LoveBudEditorAppreciationComposer/);
  assert.match(editorDetail, /LoveBudAppreciationSlotDom/);

  assert.doesNotMatch(viewerDetail, /LoveBudEditorAppreciation/);
  assert.match(viewerDetail, /LoveBudPublicViewerAppreciationComposer/);
  assert.doesNotMatch(viewerComposer, /LoveBudEditorAppreciation/);
  assert.doesNotMatch(editorComposer, /LoveBudPublicViewerAppreciation/);
});
