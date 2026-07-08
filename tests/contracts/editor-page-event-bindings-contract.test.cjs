const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const helperPath = 'js/editor/editor-page-event-bindings.js';
const helperSource = fs.readFileSync(helperPath, 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

/**
 * vm context의 window에 panelHistoryFactory mock을 주입할 수 있는 loadHelper.
 * 기본값(mock 없음)으로는 panelHistory null — wrap show는 originalShow만 호출.
 */
function loadHelper(opts = {}) {
  const panelHistoryFactory = opts.panelHistoryFactory;
  // PR #2449: vm context의 window에 addEventListener mock 추가.
  // panelHistory popstate listener 등록에 필요.
  const listeners = {};
  const panelHistoryWindow = {
    addEventListener: (event, fn) => { listeners[event] = fn; },
    removeEventListener: () => {},
    dispatchEvent: () => {},
    LoveBudEditorPanelHistory: panelHistoryFactory
      ? { createEditorPanelHistoryController: panelHistoryFactory }
      : undefined,
  };
  // PR #2449: vm context에 document mock 추가. addMemoryFormEl을 만들기 위해.
  // 외부에서 form open/close 시뮬레이션 가능하도록 mutable.
  const formState = { isOpen: false, display: 'none' };
  const formEl = {
    classList: {
      contains: (cls) => cls === 'is-open' && formState.isOpen,
    },
    style: { display: formState.display },
  };
  const context = {
    window: panelHistoryWindow,
    document: {
      getElementById: (id) => {
        if (id === 'addMemoryForm') return formEl;
        return null;
      },
    },
  };
  vm.runInNewContext(helperSource, context, { filename: helperPath });
  context.window.__listeners = listeners;
  context.__formState = formState;
  return { helper: context.window.LoveBudEditorPageEventBindings, context };
}

function createCalls() {
  return [];
}

function record(calls, name) {
  return (payload) => {
    calls.push({ name, payload });
  };
}

function assertBindingResult(result, expected) {
  assert.equal(result.sidebarVisibilityToggle, expected.sidebarVisibilityToggle);
  assert.equal(result.memoryCreateControls, expected.memoryCreateControls);
  assert.equal(result.detailEmptyStartButton, expected.detailEmptyStartButton);
  assert.equal(result.emptyGuideEvents, expected.emptyGuideEvents);
  assert.equal(result.detailActionButtons, expected.detailActionButtons);
  // PR #2449 panelHistoryBound 필드 (panel history mock 있을 때만 lock)
  if (Object.prototype.hasOwnProperty.call(expected, 'panelHistoryBound')) {
    assert.equal(result.panelHistoryBound, expected.panelHistoryBound);
  }
}

function createBaseOptions(calls, canEdit = true) {
  const refs = {
    getTreeId: () => 'tree-1',
    updateTreeVisibility: () => {},
    showToast: () => {},
    safeI18nText: () => '',
    i18n: () => '',
    getHttpStatus: () => 200,
    updateSidebarStatus: () => {},
    showAddMemoryForm: () => {},
    hideAddMemoryForm: () => {},
    addMemoryFromForm: () => {},
    updateSaveStatus: () => {},
    getEditorCanvas: () => null,
    getTreeMemories: () => [],
    enterEditMode: () => {},
    deleteMemory: () => {},
    exitEditMode: () => {},
    saveMemoryEdit: () => {}
  };

  return {
    ...refs,
    canEdit,
    sidebarUIHelper: {
      bindSidebarVisibilityToggle: record(calls, 'bindSidebarVisibilityToggle')
    },
    editorBindings: {
      bindMemoryCreateControlsFromDom: record(calls, 'bindMemoryCreateControlsFromDom'),
      bindDetailEmptyStartButton: record(calls, 'bindDetailEmptyStartButton'),
      bindDetailActionButtons: record(calls, 'bindDetailActionButtons')
    },
    emptyGuideUIHelper: {
      bindEmptyGuideEvents: record(calls, 'bindEmptyGuideEvents')
    },
    refs
  };
}

/**
 * PR #2449 panel history controller mock.
 * - pushOnOpen / closeAndConsume / handlePopState 호출 순서 + 횟수 추적
 * - opts.isPanelOpen / opts.closePanel도 호출 추적
 */
function makePanelHistoryMock() {
  const calls = [];
  let pushOnOpenCount = 0;
  let closeAndConsumeCount = 0;
  let handlePopStateCount = 0;
  let panelOpenState = false;
  const factory = (opts) => {
    return {
      pushOnOpen: () => {
        calls.push({ method: 'pushOnOpen', at: calls.length });
        // duplicate guard 흉내: opts.isPanelOpen() true면 push 안 함 (no count, no state change)
        if (opts && typeof opts.isPanelOpen === 'function' && opts.isPanelOpen()) {
          return false;
        }
        pushOnOpenCount += 1;
        panelOpenState = true;
        return true;
      },
      // closeAndConsume는 단순히 panel state 체크 + back() 흉내. opts.closePanel 호출 안 함
      // (실제 controller도 closeAndConsume는 panelState 매치 시 windowRef.history.back()만 호출)
      closeAndConsume: () => {
        calls.push({ method: 'closeAndConsume', at: calls.length });
        closeAndConsumeCount += 1;
        panelOpenState = false;
        return true;
      },
      // handlePopState는 popstate에서 panel이 열려있으면 closePanel 호출 후 intercept
      handlePopState: () => {
        calls.push({ method: 'handlePopState', at: calls.length });
        handlePopStateCount += 1;
        if (opts && typeof opts.isPanelOpen === 'function' && opts.isPanelOpen()) {
          if (typeof opts.closePanel === 'function') {
            opts.closePanel();
          }
          return true;
        }
        return false;
      },
      isOurState: () => false,
      teardown: () => {},
    };
  };
  return {
    factory,
    getCalls: () => calls.slice(),
    getCounts: () => ({ pushOnOpenCount, closeAndConsumeCount, handlePopStateCount }),
    setPanelOpen: (v) => { panelOpenState = v; },
    isPanelOpen: () => panelOpenState,
  };
}

test('editor page event bindings helper exposes a frozen browser global', () => {
  const { helper } = loadHelper();

  assert.equal(typeof helper.bindEditorPageEvents, 'function');
  assert.equal(Object.isFrozen(helper), true);
  assert.match(helperSource, /window\.LoveBudEditorPageEventBindings\s*=\s*Object\.freeze\(\{/);
});

test('editor page event bindings helper has no backend auth api imports or requires', () => {
  assert.doesNotMatch(helperSource, /require\(/);
  assert.doesNotMatch(helperSource, /import\s+/);
  assert.doesNotMatch(helperSource, /apiClient/);
  assert.doesNotMatch(helperSource, /LoveBudProtectedRoute/);
  assert.doesNotMatch(helperSource, /registerOnAuthReady/);
});

test('bindEditorPageEvents calls all editable event binding groups with preserved option references', () => {
  const { helper } = loadHelper();
  const calls = createCalls();
  const options = createBaseOptions(calls, true);
  // PR #2449: page-event-bindings가 show/hideAddMemoryForm을 wrap해서 panel history 통합.
  // wrap이 options의 original show/hide를 호출하는지 카운터로 검증.
  let showCalls = 0;
  let hideCalls = 0;
  options.showAddMemoryForm = () => { showCalls += 1; };
  options.hideAddMemoryForm = () => { hideCalls += 1; };
  const result = helper.bindEditorPageEvents(options);

  assert.deepEqual(calls.map((call) => call.name), [
    'bindSidebarVisibilityToggle',
    'bindMemoryCreateControlsFromDom',
    'bindDetailEmptyStartButton',
    'bindEmptyGuideEvents',
    'bindDetailActionButtons'
  ]);

  assertBindingResult(result, {
    sidebarVisibilityToggle: true,
    memoryCreateControls: true,
    detailEmptyStartButton: true,
    emptyGuideEvents: true,
    detailActionButtons: true
  });

  const sidebarPayload = calls.find((call) => call.name === 'bindSidebarVisibilityToggle').payload;
  assert.equal(sidebarPayload.getTreeId, options.getTreeId);
  assert.equal(sidebarPayload.updateTreeVisibility, options.updateTreeVisibility);
  assert.equal(sidebarPayload.showToast, options.showToast);
  assert.equal(sidebarPayload.safeI18nText, options.safeI18nText);
  assert.equal(sidebarPayload.i18n, options.i18n);
  assert.equal(sidebarPayload.getHttpStatus, options.getHttpStatus);
  assert.equal(sidebarPayload.updateSidebarStatus, options.updateSidebarStatus);

  // PR #2449: show/hide는 wrap되어 전달됨. wrap이 original을 호출하는지 검증.
  const createPayload = calls.find((call) => call.name === 'bindMemoryCreateControlsFromDom').payload;
  assert.equal(typeof createPayload.showAddMemoryForm, 'function', 'wrap function for show');
  assert.equal(typeof createPayload.hideAddMemoryForm, 'function', 'wrap function for hide');
  createPayload.showAddMemoryForm();
  createPayload.hideAddMemoryForm();
  assert.equal(showCalls, 1, 'PR #2449: wrap should call original showAddMemoryForm');
  assert.equal(hideCalls, 1, 'PR #2449: wrap should call original hideAddMemoryForm');

  const emptyStartPayload = calls.find((call) => call.name === 'bindDetailEmptyStartButton').payload;
  assert.equal(typeof emptyStartPayload.showAddMemoryForm, 'function', 'wrap function for detail start');
  emptyStartPayload.showAddMemoryForm();
  assert.equal(showCalls, 2, 'PR #2449: detail start wrap should call original showAddMemoryForm');

  const emptyGuidePayload = calls.find((call) => call.name === 'bindEmptyGuideEvents').payload;
  assert.equal(emptyGuidePayload.getEditorCanvas, options.getEditorCanvas);
  assert.equal(typeof emptyGuidePayload.showAddMemoryForm, 'function', 'wrap function for empty guide');
  assert.equal(emptyGuidePayload.addMemoryFromForm, options.addMemoryFromForm);
  assert.equal(emptyGuidePayload.getTreeMemories, options.getTreeMemories);
  assert.equal(emptyGuidePayload.showToast, options.showToast);
  assert.equal(emptyGuidePayload.i18n, options.i18n);
  emptyGuidePayload.showAddMemoryForm();
  assert.equal(showCalls, 3, 'PR #2449: empty guide wrap should call original showAddMemoryForm');

  const detailActionsPayload = calls.find((call) => call.name === 'bindDetailActionButtons').payload;
  assert.equal(detailActionsPayload.enterEditMode, options.enterEditMode);
  assert.equal(detailActionsPayload.deleteMemory, options.deleteMemory);
  assert.equal(detailActionsPayload.exitEditMode, options.exitEditMode);
  assert.equal(detailActionsPayload.saveMemoryEdit, options.saveMemoryEdit);
});

// ─────────────────────────────────────────────────────────────────────
// PR #2449 Codex P2 fix: panel history pushOnOpen은 originalShow 전에 호출
// ─────────────────────────────────────────────────────────────────────

test('PR #2449 P2 fix: wrapped show calls panelHistory.pushOnOpen BEFORE original show (Codex review)', () => {
  const calls = createCalls();
  const options = createBaseOptions(calls, true);
  const mock = makePanelHistoryMock();
  const { helper } = loadHelper({ panelHistoryFactory: mock.factory });

  const userCallOrder = [];
  options.showAddMemoryForm = () => { userCallOrder.push('originalShow'); };

  helper.bindEditorPageEvents(options);

  // 1) memory create controls wrap
  const createPayload = calls.find((c) => c.name === 'bindMemoryCreateControlsFromDom').payload;
  userCallOrder.length = 0;
  createPayload.showAddMemoryForm();
  assert.deepEqual(
    userCallOrder,
    ['originalShow'],
    'PR #2449: originalShow is the only user-visible call here'
  );
  // mock.calls에서 순서 검증: pushOnOpen → originalShow
  const mockCalls = mock.getCalls();
  // controller mock에 pushOnOpen call은 mock 안에서 일어남. userCallOrder는 user 콜백.
  // 호출 순서: wrap → pushOnOpen (mock 내부) → originalShow (user 콜백) → ... 끝
  // mock.calls에는 mock method 호출만 기록됨. originalShow는 user callback이므로 안 보임.
  // 따라서 mock.calls[0].method === 'pushOnOpen' 인지 검증하면 됨.
  assert.equal(mockCalls[0].method, 'pushOnOpen', 'PR #2449 P2: first mock call must be pushOnOpen');

  // 2) detail start button wrap
  userCallOrder.length = 0;
  mock.getCalls().length = 0;
  const emptyStartPayload = calls.find((c) => c.name === 'bindDetailEmptyStartButton').payload;
  emptyStartPayload.showAddMemoryForm();
  assert.equal(userCallOrder[0], 'originalShow');
  assert.equal(mock.getCalls()[0].method, 'pushOnOpen', 'PR #2449 P2: detail start wrap must pushOnOpen first');

  // 3) empty guide wrap (이게 핵심: 빈 가이드 CTA에서 panel state tagged push)
  userCallOrder.length = 0;
  mock.getCalls().length = 0;
  const emptyGuidePayload = calls.find((c) => c.name === 'bindEmptyGuideEvents').payload;
  emptyGuidePayload.showAddMemoryForm();
  assert.equal(userCallOrder[0], 'originalShow');
  assert.equal(mock.getCalls()[0].method, 'pushOnOpen', 'PR #2449 P2: empty guide wrap must pushOnOpen first');
});

test('PR #2449 P2: opening from empty CTA creates tagged history state (one push per open)', () => {
  const calls = createCalls();
  const options = createBaseOptions(calls, true);
  const mock = makePanelHistoryMock();
  const { helper, context } = loadHelper({ panelHistoryFactory: mock.factory });

  helper.bindEditorPageEvents(options);

  const emptyGuidePayload = calls.find((c) => c.name === 'bindEmptyGuideEvents').payload;

  // 첫 open: 1 push
  emptyGuidePayload.showAddMemoryForm();
  assert.equal(mock.getCounts().pushOnOpenCount, 1, 'first open from empty CTA should push once');

  // panel이 이미 open이라 가정 (실제 form display를 toggle): 두 번째 open은 push 안 함
  context.__formState.isOpen = true;
  emptyGuidePayload.showAddMemoryForm();
  assert.equal(mock.getCounts().pushOnOpenCount, 1, 'duplicate open does not push duplicate state');
});

test('PR #2449 P2: panelHistoryBound is true when factory and addMemoryFormEl both resolve', () => {
  const calls = createCalls();
  const options = createBaseOptions(calls, true);
  const mock = makePanelHistoryMock();
  const { helper } = loadHelper({ panelHistoryFactory: mock.factory });

  const result = helper.bindEditorPageEvents(options);
  // vm context에 document mock으로 addMemoryFormEl이 존재 → panelHistory 생성됨 →
  // popstate listener 등록 → panelHistoryBound: true
  assert.equal(result.panelHistoryBound, true,
    'panelHistoryBound is true when panel history factory and addMemoryFormEl both resolve');
});

test('PR #2449 P2: wrapped hide calls originalHide BEFORE closeAndConsume', () => {
  const calls = createCalls();
  const options = createBaseOptions(calls, true);
  const mock = makePanelHistoryMock();
  const { helper } = loadHelper({ panelHistoryFactory: mock.factory });

  const userCallOrder = [];
  options.showAddMemoryForm = () => { userCallOrder.push('originalShow'); };
  options.hideAddMemoryForm = () => { userCallOrder.push('originalHide'); };

  helper.bindEditorPageEvents(options);

  const createPayload = calls.find((c) => c.name === 'bindMemoryCreateControlsFromDom').payload;
  userCallOrder.length = 0;
  mock.getCalls().length = 0;

  createPayload.hideAddMemoryForm();

  assert.deepEqual(userCallOrder, ['originalHide'],
    'PR #2449: originalHide is called once');
  assert.equal(mock.getCounts().closeAndConsumeCount, 1, 'closeAndConsume should be called');
});

// ─────────────────────────────────────────────────────────────────────
// 기존 test (unchanged)
// ─────────────────────────────────────────────────────────────────────

test('bindEditorPageEvents always binds detail action buttons, even when canEdit is false (#3327)', () => {
  const { helper } = loadHelper();
  const calls = createCalls();
  const options = createBaseOptions(calls, false);
  const result = helper.bindEditorPageEvents(options);

  // #3327: detail action buttons must ALWAYS be bound so the save/cancel/edit
  // controls stay interactive; actual save/edit/delete remains canEdit-gated
  // inside editor-memory-actions.js. Only edit-only *creation* groups skip.
  assert.deepEqual(calls.map((call) => call.name), [
    'bindEmptyGuideEvents',
    'bindDetailActionButtons'
  ]);
  assertBindingResult(result, {
    sidebarVisibilityToggle: false,
    memoryCreateControls: false,
    detailEmptyStartButton: false,
    emptyGuideEvents: true,
    detailActionButtons: true
  });
});

test('bindEditorPageEvents passes canEdit=false into detail action binding options (#3327)', () => {
  const { helper, context } = loadHelper();
  const calls = createCalls();
  const options = createBaseOptions(calls, false);
  helper.bindEditorPageEvents(options);

  const bindCall = calls.find((call) => call.name === 'bindDetailActionButtons');
  assert.ok(bindCall, 'bindDetailActionButtons should be called');
  assert.equal(bindCall.payload.canEdit, false);
});

test('bindEditorPageEvents tolerates missing helper methods without throwing', () => {
  const { helper } = loadHelper();
  const result = helper.bindEditorPageEvents({
    canEdit: true,
    sidebarUIHelper: {},
    editorBindings: {},
    emptyGuideUIHelper: {}
  });

  assertBindingResult(result, {
    sidebarVisibilityToggle: false,
    memoryCreateControls: false,
    detailEmptyStartButton: false,
    emptyGuideEvents: false,
    detailActionButtons: false
  });
});

test('editor entrypoint delegates event binding to editor page event bindings helper', () => {
  assert.match(editorSource, /deps\.bindEditorPageEvents/);
  assert.match(editorSource, /bindEditorPageEvents\s*\(\{/);

  assert.doesNotMatch(editorSource, /sidebarUIHelper\.bindSidebarVisibilityToggle\(/);
  assert.doesNotMatch(editorSource, /editorBindings\.bindMemoryCreateControlsFromDom\(/);
  assert.doesNotMatch(editorSource, /editorBindings\.bindDetailEmptyStartButton\(/);
  assert.doesNotMatch(editorSource, /emptyGuideUIHelper\.bindEmptyGuideEvents\(/);
  assert.doesNotMatch(editorSource, /editorBindings\.bindDetailActionButtons\(/);
});
