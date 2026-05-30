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

  const createPayload = calls.find((call) => call.name === 'bindMemoryCreateControlsFromDom').payload;
  assert.equal(createPayload.showAddMemoryForm, options.showAddMemoryForm);
  assert.equal(createPayload.hideAddMemoryForm, options.hideAddMemoryForm);
  assert.equal(createPayload.addMemoryFromForm, options.addMemoryFromForm);
  assert.equal(createPayload.updateSaveStatus, options.updateSaveStatus);
  assert.equal(createPayload.showToast, options.showToast);
  assert.equal(createPayload.i18n, options.i18n);

  const emptyStartPayload = calls.find((call) => call.name === 'bindDetailEmptyStartButton').payload;
  assert.equal(emptyStartPayload.showAddMemoryForm, options.showAddMemoryForm);

  const emptyGuidePayload = calls.find((call) => call.name === 'bindEmptyGuideEvents').payload;
  assert.equal(emptyGuidePayload.getEditorCanvas, options.getEditorCanvas);
  assert.equal(emptyGuidePayload.showAddMemoryForm, options.showAddMemoryForm);
  assert.equal(emptyGuidePayload.addMemoryFromForm, options.addMemoryFromForm);
  assert.equal(emptyGuidePayload.getTreeMemories, options.getTreeMemories);
  assert.equal(emptyGuidePayload.showToast, options.showToast);
  assert.equal(emptyGuidePayload.i18n, options.i18n);

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

test('editor entrypoint still owns local event binding block until follow-up callsite PR', () => {
  assert.match(editorSource, /sidebarUIHelper\.bindSidebarVisibilityToggle/);
  assert.match(editorSource, /editorBindings\.bindMemoryCreateControlsFromDom/);
  assert.match(editorSource, /editorBindings\.bindDetailEmptyStartButton/);
  assert.match(editorSource, /emptyGuideUIHelper\.bindEmptyGuideEvents/);
  assert.match(editorSource, /editorBindings\.bindDetailActionButtons/);
  assert.doesNotMatch(editorSource, /LoveBudEditorPageEventBindings/);
});
