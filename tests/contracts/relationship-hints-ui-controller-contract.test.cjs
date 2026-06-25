const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const CONTROLLER_PATH = path.join(ROOT, 'js/editor/relationship-hints-ui-controller.js');
const STATE_MACHINE_PATH = path.join(ROOT, 'js/editor/relationship-hints-state-machine.js');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createFakeDocument() {
  const elements = new Map();

  function createElement(tagName) {
    const element = {
      tagName: String(tagName).toUpperCase(),
      type: '',
      className: '',
      textContent: '',
      hidden: false,
      disabled: false,
      style: {},
      attributes: {},
      children: [],
      parentNode: null,
      listeners: new Map(),
      _id: '',
      classList: {
        values: new Set(),
        add(value) {
          this.values.add(value);
        },
        remove(value) {
          this.values.delete(value);
        },
        toggle(value, force) {
          if (force === false) {
            this.values.delete(value);
          } else {
            this.values.add(value);
          }
        }
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] || null;
      },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
      },
      removeEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        this.listeners.set(type, handlers.filter((candidate) => candidate !== handler));
      },
      click() {
        (this.listeners.get('click') || []).forEach((handler) => handler());
      },
      querySelector(selector) {
        const idSelector = selector.startsWith('#') ? selector.slice(1) : null;
        const queue = this.children.slice();
        while (queue.length) {
          const child = queue.shift();
          if (idSelector && child.id === idSelector) return child;
          queue.push(...child.children);
        }
        return null;
      }
    };
    Object.defineProperty(element, 'id', {
      get() {
        return this._id;
      },
      set(value) {
        const nextId = String(value || '');
        if (this._id && elements.get(this._id) === this) elements.delete(this._id);
        this._id = nextId;
        if (nextId) elements.set(nextId, this);
      }
    });
    return element;
  }

  const body = createElement('body');
  elements.set(body.id || 'body', body);

  return {
    body,
    createElement,
    getElementById(id) {
      return elements.get(id) || null;
    },
    _elements: elements
  };
}

delete require.cache[require.resolve(STATE_MACHINE_PATH)];
require(STATE_MACHINE_PATH);
const stateMachineApi = globalThis.LoveBudRelationshipHintStateMachine;

delete require.cache[require.resolve(CONTROLLER_PATH)];
require(CONTROLLER_PATH);
const controllerApi = globalThis.LoveBudRelationshipHintsUIController;

assert.ok(stateMachineApi && typeof stateMachineApi.createRelationshipHintStateMachine === 'function');
assert.ok(controllerApi && typeof controllerApi.createRelationshipHintsUIController === 'function');

test('Relationship hints UI controller exposes the expected UI-only API', () => {
  assert.deepEqual(controllerApi, {
    createRelationshipHintsUIController: controllerApi.createRelationshipHintsUIController,
    RELATIONSHIP_HINTS_UI_PANEL_ID: 'relationshipHintsPanel',
    RELATIONSHIP_HINTS_UI_TITLE_ID: 'relationshipHintsTitle',
    RELATIONSHIP_HINTS_UI_BODY_ID: 'relationshipHintsBody',
    RELATIONSHIP_HINTS_UI_ACCEPT_ID: 'relationshipHintsAcceptBtn',
    RELATIONSHIP_HINTS_UI_DISMISS_ID: 'relationshipHintsDismissBtn',
    RELATIONSHIP_HINTS_UI_HIDE_ID: 'relationshipHintsHideBtn',
    RELATIONSHIP_HINTS_UI_RETRY_ID: 'relationshipHintsRetryBtn'
  });
});

test('Relationship hints UI controller safe-disables when state machine helper is missing', () => {
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef: createFakeDocument(),
    stateMachineFactory: null
  });

  assert.equal(controller.canTransition('present_hint'), false);

  const present = controller.presentRelationshipHint({ reason: 'same source' });
  assert.equal(present.accepted, false);
  assert.equal(controller.getState(), 'not_shown');

  const accept = controller.acceptRelationshipHint();
  assert.equal(accept.accepted, false);
  assert.equal(controller.getState(), 'not_shown');

  const dismiss = controller.dismissRelationshipHint();
  assert.equal(dismiss.accepted, false);
  assert.equal(controller.getState(), 'not_shown');

  const hide = controller.hideRelationshipHint();
  assert.equal(hide.accepted, false);
  assert.equal(controller.getState(), 'not_shown');
});

test('Relationship hints UI controller falls back when i18n returns the key itself', () => {
  const documentRef = createFakeDocument();
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef,
    stateMachineFactory: stateMachineApi.createRelationshipHintStateMachine,
    i18n: (key) => key
  });

  controller.presentRelationshipHint({ id: 'hint-i18n' });

  assert.equal(
    documentRef.getElementById('relationshipHintsTitle').textContent,
    'Possible next connection'
  );
});

test('Relationship hints UI controller keeps current hint unchanged on rejected present', () => {
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef: createFakeDocument(),
    stateMachineFactory: stateMachineApi.createRelationshipHintStateMachine
  });

  const firstHint = { id: 'hint-1' };
  const secondHint = { id: 'hint-2' };

  assert.equal(controller.presentRelationshipHint(firstHint).accepted, true);
  assert.equal(controller.getCurrentHint(), firstHint);

  const rejected = controller.presentRelationshipHint(secondHint);
  assert.equal(rejected.accepted, false);
  assert.equal(controller.getCurrentHint(), firstHint);
});

test('editor.html loads relationship hints helper scripts before editor.js', () => {
  const html = read('pages/editor.html');
  const stateMachineIndex = html.indexOf('../js/editor/relationship-hints-state-machine.js?v=20260613-2462');
  const uiControllerIndex = html.indexOf('../js/editor/relationship-hints-ui-controller.js?v=20260613-2462');
  const editorIndex = html.indexOf('../js/editor.js');

  assert.notEqual(stateMachineIndex, -1, 'relationship-hints-state-machine.js must be loaded');
  assert.notEqual(uiControllerIndex, -1, 'relationship-hints-ui-controller.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must still be loaded');
  assert.ok(stateMachineIndex < uiControllerIndex, 'state machine must load before UI controller');
  assert.ok(uiControllerIndex < editorIndex, 'UI controller must load before editor.js');
});

test('Relationship hints UI controller wires accept/dismiss/hide without persistence', () => {
  const documentRef = createFakeDocument();
  const calls = {
    accept: [],
    dismiss: [],
    hide: [],
    present: [],
    retry: []
  };
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef,
    stateMachineFactory: stateMachineApi.createRelationshipHintStateMachine,
    i18n: (key) => ({
      relationship_hints_accept: '이어보기',
      relationship_hints_dismiss: '숨기기',
      relationship_hints_hide: '닫기',
      relationship_hints_retry: '다시 시도'
    })[key],
    onPresent: (hint, result) => calls.present.push([hint, result]),
    onAccept: (hint, result) => calls.accept.push([hint, result]),
    onDismiss: (hint, result) => calls.dismiss.push([hint, result]),
    onHide: (hint, result) => calls.hide.push([hint, result]),
    onRetry: (hint, result) => calls.retry.push([hint, result])
  });

  const panel = documentRef.getElementById('relationshipHintsPanel');
  const acceptButton = documentRef.getElementById('relationshipHintsAcceptBtn');
  const dismissButton = documentRef.getElementById('relationshipHintsDismissBtn');
  const hideButton = documentRef.getElementById('relationshipHintsHideBtn');
  const retryButton = documentRef.getElementById('relationshipHintsRetryBtn');

  assert.equal(controller.getState(), 'not_shown');
  assert.equal(panel.hidden, true);

  const presentResult = controller.presentRelationshipHint({ id: 'hint-1', label: 'possible connection' });
  assert.equal(presentResult.accepted, true);
  assert.equal(presentResult.from, 'not_shown');
  assert.equal(presentResult.to, 'presented');
  assert.equal(controller.getState(), 'presented');
  assert.equal(panel.hidden, false);
  assert.equal(acceptButton.hidden, false);
  assert.equal(dismissButton.hidden, false);
  assert.equal(hideButton.hidden, false);
  assert.equal(calls.present.length, 1);

  const acceptResult = controller.acceptRelationshipHint();
  assert.equal(acceptResult.accepted, true);
  assert.equal(acceptResult.event, 'accept_for_review');
  assert.equal(acceptResult.to, 'accepted_pending_save');
  assert.equal(controller.getState(), 'accepted_pending_save');
  assert.equal(calls.accept[0][1].event, 'accept_for_review');

  const dismissResult = controller.dismissRelationshipHint();
  assert.equal(dismissResult.accepted, true);
  assert.equal(dismissResult.event, 'dismiss_pending_hint');
  assert.equal(dismissResult.to, 'dismissed');
  assert.equal(controller.getState(), 'dismissed');
  assert.equal(calls.dismiss[0][1].event, 'dismiss_pending_hint');

  const hideResult = controller.hideRelationshipHint();
  assert.equal(hideResult.accepted, true);
  assert.equal(hideResult.event, 'hide_dismissed_hint');
  assert.equal(hideResult.to, 'hidden');
  assert.equal(controller.getState(), 'hidden');
  assert.equal(panel.hidden, true);
  assert.equal(calls.hide[0][1].event, 'hide_dismissed_hint');

  assert.deepEqual(
    controller.getTransitionLog().map((result) => result.event),
    ['present_hint', 'accept_for_review', 'dismiss_pending_hint', 'hide_dismissed_hint']
  );
  assert.equal(controller.getTransitionLog().some((result) => result.event === 'confirm_save_relationship'), false);
  assert.equal(controller.getTransitionLog().some((result) => result.persistenceEffect !== 'none'), false);

  controller.destroy();
  assert.equal(controller.isDestroyed(), true);
});

test('Relationship hints UI controller supports retry from error without network/provider wiring', () => {
  const documentRef = createFakeDocument();
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef,
    stateMachineFactory: stateMachineApi.createRelationshipHintStateMachine
  });

  controller.presentRelationshipHint({ id: 'hint-error' });
  const errorResult = controller.showError({ message: 'preview failed' });
  assert.equal(errorResult.accepted, true);
  assert.equal(errorResult.to, 'error');
  assert.equal(controller.getState(), 'error');
  assert.equal(documentRef.getElementById('relationshipHintsRetryBtn').hidden, false);

  const retryResult = controller.retryRelationshipHint();
  assert.equal(retryResult.accepted, true);
  assert.equal(retryResult.event, 'retry_hint');
  assert.equal(retryResult.to, 'presented');
  assert.equal(controller.getState(), 'presented');
});

test('Relationship hints UI controller rejects save-confirmation and edge-creation paths', () => {
  const documentRef = createFakeDocument();
  const controller = controllerApi.createRelationshipHintsUIController({
    documentRef,
    stateMachineFactory: stateMachineApi.createRelationshipHintStateMachine
  });

  assert.equal(controller.canTransition('confirm_save_relationship'), false);
  assert.equal(controller.canTransition('automatic_relationship_creation'), false);
  assert.equal(controller.canTransition('draw_relationship_edge'), false);

  controller.presentRelationshipHint({ id: 'hint-save-guard' });
  assert.equal(controller.acceptRelationshipHint().to, 'accepted_pending_save');

  assert.equal(controller.canTransition('confirm_save_relationship'), false);

  const saveResult = controller.transition('confirm_save_relationship');
  assert.equal(saveResult.accepted, false);
  assert.equal(saveResult.event, 'confirm_save_relationship');
  assert.equal(controller.getState(), 'accepted_pending_save');
  assert.equal(controller.getTransitionLog().some((result) => result.event === 'confirm_save_relationship'), false);
});

test('Relationship hints UI controller source stays UI-only and non-persistent', () => {
  const source = read('js/editor/relationship-hints-ui-controller.js');
  const forbiddenTokens = [
    'localStorage',
    'sessionStorage',
    'fetch',
    'XMLHttpRequest',
    'apiClient',
    'Scout',
    'provider',
    'drawBranch',
    'drawNode',
    'rerenderCanvas',
    'graph layout',
    'pages/editor.html'
  ];

  forbiddenTokens.forEach((token) => {
    assert.doesNotMatch(source, new RegExp(escapeRegExp(token)));
  });
  assert.match(source, /BLOCKED_UI_EVENTS/);
  assert.doesNotMatch(source, /stateMachine\.transition\(\s*['"]confirm_save_relationship['"]/);
});
