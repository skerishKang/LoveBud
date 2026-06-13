const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const helperPath = 'js/editor/editor-page-event-bindings.js';
const helperSource = fs.readFileSync(helperPath, 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function loadHelper() {
  const context = {
    window: {}
  };
  vm.runInNewContext(helperSource, context, { filename: helperPath });
  return context.window.LoveBudEditorPageEventBindings;
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

test('editor page event bindings helper exposes a frozen browser global', () => {
  const helper = loadHelper();

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
  const helper = loadHelper();
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

test('bindEditorPageEvents skips edit-only binding groups when canEdit is false', () => {
  const helper = loadHelper();
  const calls = createCalls();
  const options = createBaseOptions(calls, false);
  const result = helper.bindEditorPageEvents(options);

  assert.deepEqual(calls.map((call) => call.name), ['bindEmptyGuideEvents']);
  assertBindingResult(result, {
    sidebarVisibilityToggle: false,
    memoryCreateControls: false,
    detailEmptyStartButton: false,
    emptyGuideEvents: true,
    detailActionButtons: false
  });
});

test('bindEditorPageEvents tolerates missing helper methods without throwing', () => {
  const helper = loadHelper();
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
