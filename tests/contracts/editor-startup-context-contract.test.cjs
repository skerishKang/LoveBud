const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const helperPath = 'js/editor/editor-startup-context.js';
const helperSource = fs.readFileSync(helperPath, 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

// ── #3704 Editor initial-load-flow loading indicator contract ──
const loadFlowSource = fs.readFileSync('js/editor/editor-initial-load-flow.js', 'utf8');

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

test('editor entrypoint delegates startup context preparation to helper', () => {
  assert.match(editorSource, /LoveBudEditorStartupContext/);
  assert.match(editorSource, /createEditorStartupContext/);
  assert.match(editorSource, /createEditorStartupContext\(\{/);
  assert.match(editorSource, /createEditorDomRefs/);
  assert.match(editorSource, /locationRef:\s*window\.location/);
  assert.match(editorSource, /URLSearchParamsRef:\s*URLSearchParams/);

  assert.doesNotMatch(editorSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.doesNotMatch(editorSource, /urlParams\.get\('treeId'\)/);
  assert.doesNotMatch(editorSource, /urlParams\.get\('readonly'\) !== '1'/);
});

// ═══════════════════════════════════════════════════════════════
// #3704 Editor loading indicator contract assertions
// ═══════════════════════════════════════════════════════════════

test('#3704 showRegionLoading uses setTimeout with 500ms display delay', () => {
  assert.match(loadFlowSource, /setTimeout\(/, 'must use setTimeout for display delay');
  assert.match(loadFlowSource, /500/, 'delay must be 500ms');
  assert.match(loadFlowSource, /regionTimers\[containerId\]/, 'timer stored in regionTimers map');
});

test('#3704 hideRegionLoading clears pending timer before DOM removal', () => {
  assert.match(loadFlowSource, /clearTimeout\(regionTimers\[containerId\]\)/, 'must clear pending timer');
  assert.match(loadFlowSource, /regionTimers\[containerId\]\s*=\s*null/, 'timer entry cleaned after clear');
});

test('#3704 loading indicator uses createElement + textContent (no innerHTML)', () => {
  // Verify copy text is set via textContent, not innerHTML
  assert.match(loadFlowSource, /textContent\s*=/, 'copy text must use textContent');
  assert.match(loadFlowSource, /createElement\('span'\)/, 'spinner created via createElement');
  assert.match(loadFlowSource, /createElement\('span'\)[\s\S]*?textContent/, 'copy span uses textContent');

  // Verify no innerHTML is used in the loading indicator DOM construction
  const showRegionBody = loadFlowSource.match(/function showRegionLoading\(containerId,\s*className,\s*text\)\s*\{[\s\S]*?\n        \}/);
  assert.ok(showRegionBody, 'must find showRegionLoading function body');
  assert.doesNotMatch(showRegionBody[0], /innerHTML/, 'showRegionLoading must not use innerHTML');
});

test('#3704 loading indicator has correct ARIA attributes', () => {
  assert.match(loadFlowSource, /role.*status/, 'must have role="status"');
  assert.match(loadFlowSource, /aria-live.*polite/, 'must have aria-live="polite"');
  assert.match(loadFlowSource, /aria-hidden.*true/, 'spinner must have aria-hidden="true"');
});

test('#3704 async operations are wrapped in try/finally for guaranteed cleanup', () => {
  assert.match(loadFlowSource, /try\s*\{/, 'must use try block');
  assert.match(loadFlowSource, /\}\s*finally\s*\{/, 'must use finally block');
  assert.match(loadFlowSource, /finally[\s\S]*?hideRegionLoading/, 'finally must call hideRegionLoading');
});

test('#3704 hideRegionLoading called on all memory-loader missing paths', () => {
  // Both createNormalizeMemory and loadEditorMemories missing paths must clean up
  assert.match(loadFlowSource, /createNormalizeMemory.*missing[\s\S]*?hideRegionLoading\('canvasArea'\)/, 'normalizeMemory missing path cleans up canvas');
  assert.match(loadFlowSource, /loadEditorMemories.*missing[\s\S]*?hideRegionLoading\('canvasArea'\)/, 'loadEditorMemories missing path cleans up canvas');
});

test('#3704 i18n loadI18n variable avoids shadowing opts.i18n', () => {
  assert.match(loadFlowSource, /var loadI18n\s*=/, 'uses distinct loadI18n name');
  assert.doesNotMatch(loadFlowSource, /var i18n\s*=/, 'no var i18n shadowing opts.i18n');
});

test('#3704 editor loading i18n keys exist in i18n-editor.js', () => {
  const i18nSource = fs.readFileSync('js/i18n/i18n-editor.js', 'utf8');
  assert.match(i18nSource, /editor_loading_tree/, 'must define editor_loading_tree key');
  assert.match(i18nSource, /editor_loading_memories/, 'must define editor_loading_memories key');
  assert.match(i18nSource, /editor_loading_tree[\s\S]*?트리 정보를 불러오는 중/, 'Korean copy for tree loading');
  assert.match(i18nSource, /editor_loading_memories[\s\S]*?순간 목록을 불러오는 중/, 'Korean copy for memories loading');
});
