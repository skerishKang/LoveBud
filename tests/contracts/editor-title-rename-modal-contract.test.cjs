/**
 * editor-title-rename-modal-contract.test.cjs
 *
 * PR #2464 (UX): replace native browser prompt with an in-app editor tree rename modal.
 *
 * Contract locks:
 * 1. No native window.prompt usage.
 * 2. Existing apiClient.updateTree(treeId, { title }) + syncEditorTreeTitle flow remains.
 * 3. Modal prefill, save, empty-title guard, Esc close, outside-click close behavior.
 * 4. Sidebar copy and rename button text are polished.
 * 5. Editor page cache-busts changed runtime files.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const RENAME_UI_PATH = 'js/editor/editor-rename-ui.js';
const SIDEBAR_TEMPLATE_PATH = 'js/editor/templates/editor-sidebar-template.js';
const EDITOR_HTML_PATH = 'pages/editor.html';
const I18N_REFRESH_PATH = 'js/editor/editor-i18n-refresh.js';

function createFakeDocument() {
  const elements = new Map();
  const listeners = {};

  function makeElement(id, tagName) {
    const element = {
      id,
      tagName: (tagName || 'div').toUpperCase(),
      className: '',
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      style: {},
      attributes: {},
      dataset: {},
      children: [],
      parentElement: null,
      _listeners: {},
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      remove() {
        if (this.parentElement) {
          this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
          this.parentElement = null;
        }
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'class') this.className = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
      },
      addEventListener(type, handler) {
        this._listeners[type] = handler;
      },
      removeEventListener(type) {
        delete this._listeners[type];
      },
      focus() {
        documentRef.activeElement = this;
      },
    };
    let innerHTML = '';
    Object.defineProperty(element, 'innerHTML', {
      get() {
        return innerHTML;
      },
      set(html) {
        innerHTML = String(html || '');
        const idPattern = /id="([^"]+)"/g;
        let match;
        while ((match = idPattern.exec(innerHTML)) !== null) {
          if (!elements.has(match[1])) elements.set(match[1], makeElement(match[1], 'div'));
        }
        const tagPattern = /<([a-zA-Z0-9-]+)([^>]*)>/g;
        let tagMatch;
        while ((tagMatch = tagPattern.exec(innerHTML)) !== null) {
          const attrs = {};
          const attrPattern = /([a-zA-Z0-9:-]+)="([^"]*)"/g;
          let attrMatch;
          while ((attrMatch = attrPattern.exec(tagMatch[2])) !== null) {
            attrs[attrMatch[1]] = attrMatch[2];
          }
          if (attrs['data-rename-modal-close'] === '1') {
            elements.set('__renameBackdrop', {
              getAttribute(name) {
                return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
              },
            });
          }
        }
      },
    });
    if (id) elements.set(id, element);
    return element;
  }

  const documentRef = {
    activeElement: null,
    body: makeElement('', 'body'),
    createElement(tagName) {
      return makeElement('', tagName);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === '.editor-rename-modal-backdrop') {
        return elements.get('editorRenameModalBackdrop') || elements.get('__renameBackdrop') || null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    _listeners: listeners,
  };

  documentRef.body.classList = {
    add(name) {
      documentRef.body.attributes[`class:${name}`] = '1';
    },
    remove(name) {
      delete documentRef.body.attributes[`class:${name}`];
    },
  };

  return documentRef;
}

function createFakeWindow() {
  const calls = [];
  const windowRef = {
    location: { search: '?treeId=tree-1' },
    currentTreeData: { id: 'tree-1', title: '우리 트리' },
    URLSearchParams,
    apiClient: {
      async updateTree(treeId, payload) {
        calls.push({ treeId, payload });
        return { id: treeId, title: payload.title };
      },
    },
    LoveBudUI: {
      showToast(message, type) {
        calls.push({ toast: message, type });
      },
    },
    t(key) {
      return key;
    },
    _renameCalls: calls,
  };
  return windowRef;
}

function loadRenameApi(windowRef, documentRef) {
  const source = fs.readFileSync(RENAME_UI_PATH, 'utf8');
  const context = {
    window: windowRef,
    document: documentRef,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.LoveBudEditorRenameModal;
}

async function click(element) {
  let current = element;
  let handler = null;
  while (current && !handler) {
    handler = current._listeners && current._listeners.click;
    current = current.parentElement;
  }
  if (!handler) return;
  const event = { target: element, preventDefault() {}, stopPropagation() {} };
  const result = handler(event);
  if (result && typeof result.then === 'function') await result;
}

function keydown(documentRef, key) {
  const handler = documentRef._listeners.keydown;
  if (!handler) return;
  handler({ key, keyCode: key === 'Escape' ? 27 : 0, preventDefault() {}, stopPropagation() {} });
}

test('editor title rename modal contract: no native prompt and existing update flow remains', () => {
  const source = fs.readFileSync(RENAME_UI_PATH, 'utf8');

  assert.doesNotMatch(source, /window\.prompt|\bprompt\s*\(/, 'native browser prompt must be removed');
  assert.match(source, /apiClient\.updateTree\(treeId, \{ title: nextTitle \}\)/, 'updateTree title payload must be preserved');
  assert.match(source, /syncEditorTreeTitle\(nextTitle\)/, 'syncEditorTreeTitle must still update visible title after save');
  assert.match(source, /createRenameModalController/, 'modal controller must be exposed');
});

test('editor title rename modal contract: prefill, save, and empty-title guard', async () => {
  const windowRef = createFakeWindow();
  const documentRef = createFakeDocument();
  const modalApi = loadRenameApi(windowRef, documentRef);
  const controller = modalApi.createRenameModalController({
    windowRef,
    documentRef,
    getCurrentTitle: () => '우리 트리',
    saveTitle: async (title) => {
      windowRef._savedTitle = title;
      return { id: 'tree-1', title };
    },
  });

  controller.open({ currentTitle: '우리 트리' });
  assert.equal(controller.isOpen(), true, 'modal should open');
  assert.equal(controller.getInput().value, '우리 트리', 'current title should be prefilled');

  controller.getInput().value = '새 러브트리';
  await click(documentRef.getElementById('editorRenameSaveBtn'));
  assert.equal(windowRef._savedTitle, '새 러브트리', 'save should call saveTitle with trimmed title');
  assert.equal(controller.isOpen(), false, 'modal should close after successful save');

  controller.open({ currentTitle: '우리 트리' });
  controller.getInput().value = '   ';
  await click(documentRef.getElementById('editorRenameSaveBtn'));
  assert.equal(windowRef._savedTitle, '새 러브트리', 'blank title should not call saveTitle again');
  assert.equal(controller.isOpen(), true, 'blank title should keep modal open');
  assert.equal(documentRef.getElementById('editorRenameTitleError').hidden, false, 'empty-title error should be visible');
});

test('editor title rename modal contract: Esc and outside click close modal', async () => {
  const windowRef = createFakeWindow();
  const documentRef = createFakeDocument();
  const modalApi = loadRenameApi(windowRef, documentRef);
  const controller = modalApi.createRenameModalController({
    windowRef,
    documentRef,
    getCurrentTitle: () => '우리 트리',
    saveTitle: async () => ({ id: 'tree-1', title: '우리 트리' }),
  });

  controller.open({ currentTitle: '우리 트리' });
  keydown(documentRef, 'Escape');
  assert.equal(controller.isOpen(), false, 'Esc should close modal');

  controller.open({ currentTitle: '우리 트리' });
  const backdrop = documentRef.querySelector('.editor-rename-modal-backdrop');
  assert.notEqual(backdrop, null, 'backdrop should exist after modal open');
  await click(backdrop);
  assert.equal(controller.isOpen(), false, 'outside/backdrop click should close modal');
});

test('editor title rename modal contract: sidebar copy and cache-bust', () => {
  // The original assertion pinned editor.css / sidebar-template /
  // rename-ui / i18n-refresh cache-bust values to a single PR number
  // (#2464). That hard-pin blocked every legitimate future cache-bust
  // bump (e.g. #2820 followup) and produced a red CI for unrelated
  // editor work. The contract intent is "if these scripts / styles
  // are loaded, the page-level cache-bust is in effect" — not "the
  // specific version number must never change". Softened accordingly:
  // each script / style must be present with a non-empty ?v= query
  // string, and the editor.css pattern remains a date-bounded check
  // because that file is bundled in the main cache-bust cycle and
  // is the one place where a missing ?v= is most likely to surface
  // a stale browser cache.
  const sidebar = fs.readFileSync(SIDEBAR_TEMPLATE_PATH, 'utf8');
  const editorHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');
  const i18nRefresh = fs.readFileSync(I18N_REFRESH_PATH, 'utf8');

  assert.match(sidebar, /현재 트리/, 'sidebar badge should use natural Korean copy');
  assert.doesNotMatch(sidebar, /Our LoveTree/, 'old English sidebar badge should be removed');
  assert.match(sidebar, />수정<\/button>/, 'rename button text should be short');

  assert.match(editorHtml, /editor\.css\?v=\d{8}-[^"'\s>]+/, 'editor.css must carry a date-bounded cache-bust query string');
  assert.match(editorHtml, /editor-sidebar-template\.js\?v=[^"'\s>]+/, 'sidebar template must carry a cache-bust query string');
  assert.match(editorHtml, /editor-rename-ui\.js\?v=[^"'\s>]+/, 'rename UI must carry a cache-bust query string');
  assert.match(editorHtml, /editor-i18n-refresh\.js\?v=[^"'\s>]+/, 'i18n refresh must carry a cache-bust query string');
  assert.match(i18nRefresh, /setAttr\('renameTreeBtn'.*트리 제목 수정/, 'rename button aria/title should stay prompt-free');
});
