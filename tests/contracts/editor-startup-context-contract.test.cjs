const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const helperPath = 'js/editor/editor-startup-context.js';
const helperSource = fs.readFileSync(helperPath, 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function loadHelper() {
  const context = {
    window: {
      location: { search: '' },
      URLSearchParams
    }
  };
  vm.runInNewContext(helperSource, context, { filename: helperPath });
  return context.window.LoveBudEditorStartupContext;
}

test('editor startup context helper exposes a frozen browser global', () => {
  const helper = loadHelper();

  assert.equal(typeof helper.createEditorStartupContext, 'function');
  assert.equal(Object.isFrozen(helper), true);
  assert.match(helperSource, /window\.LoveBudEditorStartupContext\s*=\s*Object\.freeze\(\{/);
});

test('editor startup context helper has no backend auth api imports or lifecycle calls', () => {
  assert.doesNotMatch(helperSource, /require\(/);
  assert.doesNotMatch(helperSource, /import\s+/);
  assert.doesNotMatch(helperSource, /apiClient/);
  assert.doesNotMatch(helperSource, /registerOnAuthReady/);
  assert.doesNotMatch(helperSource, /LoveBudProtectedRoute/);
  assert.doesNotMatch(helperSource, /initCanvas/);
  assert.doesNotMatch(helperSource, /createEditorCanvas/);
  assert.doesNotMatch(helperSource, /createEditorMemoryActions/);
  assert.doesNotMatch(helperSource, /createEditorMemoryForm/);
});

test('createEditorStartupContext calls createEditorDomRefs once and returns DOM references', () => {
  const helper = loadHelper();
  const refs = {
    canvas: { id: 'canvas' },
    svg: { id: 'svg' },
    detailPanel: { id: 'detail' },
    addBtn: { id: 'add' }
  };
  let calls = 0;

  const result = helper.createEditorStartupContext({
    createEditorDomRefs: () => {
      calls += 1;
      return refs;
    },
    locationRef: { search: '' },
    URLSearchParamsRef: URLSearchParams
  });

  assert.equal(calls, 1);
  assert.equal(result.canvas, refs.canvas);
  assert.equal(result.svg, refs.svg);
  assert.equal(result.detailPanel, refs.detailPanel);
  assert.equal(result.addBtn, refs.addBtn);
});

test('createEditorStartupContext reads urlTreeId from treeId query parameter', () => {
  const helper = loadHelper();
  const result = helper.createEditorStartupContext({
    createEditorDomRefs: () => ({}),
    locationRef: { search: '?treeId=tree-123&readonly=0' },
    URLSearchParamsRef: URLSearchParams
  });

  assert.equal(result.urlTreeId, 'tree-123');
});

test('createEditorStartupContext derives canEdit from readonly query parameter', () => {
  const helper = loadHelper();

  const editable = helper.createEditorStartupContext({
    createEditorDomRefs: () => ({}),
    locationRef: { search: '?readonly=0' },
    URLSearchParamsRef: URLSearchParams
  });
  const defaultEditable = helper.createEditorStartupContext({
    createEditorDomRefs: () => ({}),
    locationRef: { search: '' },
    URLSearchParamsRef: URLSearchParams
  });
  const readOnly = helper.createEditorStartupContext({
    createEditorDomRefs: () => ({}),
    locationRef: { search: '?readonly=1' },
    URLSearchParamsRef: URLSearchParams
  });

  assert.equal(editable.canEdit, true);
  assert.equal(defaultEditable.canEdit, true);
  assert.equal(readOnly.canEdit, false);
});

test('createEditorStartupContext throws when createEditorDomRefs is missing', () => {
  const helper = loadHelper();

  assert.throws(() => helper.createEditorStartupContext({}), /createEditorDomRefs must be a function/);
});

test('editor startup context helper is not wired into editor entrypoint yet', () => {
  assert.doesNotMatch(editorSource, /LoveBudEditorStartupContext/);
  assert.match(editorSource, /createEditorDomRefs\(\)/);
  assert.match(editorSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(editorSource, /urlParams\.get\('treeId'\)/);
  assert.match(editorSource, /urlParams\.get\('readonly'\) !== '1'/);
});
