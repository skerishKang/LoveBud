const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const templateSource = fs.readFileSync('js/viewer/templates/public-viewer-sidebar-template.js', 'utf8');
const initSource = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

function createClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, force) {
      if (force === undefined) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      }
      if (force) classes.add(name);
      else classes.delete(name);
      return !!force;
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function createElement(initial = {}) {
  const attrs = new Map();
  const classList = createClassList();
  if (initial.hiddenClass) {
    classList.add('editor-canvas-empty-guide-hidden');
  }
  return {
    textContent: initial.textContent || '',
    innerHTML: initial.innerHTML || '',
    style: initial.style || {},
    disabled: !!initial.disabled,
    classList,
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : undefined;
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

function createRuntimeHarness(options = {}) {
  const events = [];
  let resolveLoad;
  let rejectLoad;
  const loadPromise = new Promise((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });

  const body = createElement();
  const elements = {
    canvasArea: createElement(),
    canvasSvg: createElement(),
    detailPanel: createElement(),
    viewerSidebarMomentCount: createElement({ textContent: 'stale' }),
    viewerSidebarTreeTitle: createElement({ textContent: '러브트리' }),
    viewerSidebarSummary: createElement({ style: { display: 'none' } }),
    viewerSidebarOwnerMode: createElement({ style: { display: 'none' } }),
    viewerSidebarViewBtn: createElement(),
    viewerSidebarEditBtn: createElement(),
    viewerSidebarBackLink: createElement(),
    viewerSidebarBackLabel: createElement(),
    viewerSidebarKicker: createElement(),
    canvasEmptyGuide: createElement()
  };

  const documentObject = {
    readyState: 'complete',
    body,
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };

  const fallbackCalls = [];

  const fallbackImpl = options.includeFallback === false
    ? null
    : {
        escapeHtml(value) {
          return String(value || '');
        },
        appendMissingRouteState() {
          fallbackCalls.push({ type: 'missing-route' });
        },
        handlePublicCanvasLoadFailure(error) {
          fallbackCalls.push({
            type: 'load-failure',
            message: error && error.message ? error.message : '',
            loading: body.classList.contains('public-viewer-loading'),
            busy: body.getAttribute('aria-busy'),
            count: elements.viewerSidebarMomentCount.textContent
          });
        }
      };

  const sandbox = {
    window: {
      location: {
        search: '?treeId=tree-1',
        pathname: '/pages/view'
      },
      matchMedia() {
        return {
          matches: false,
          addEventListener() {}
        };
      },
      LoveBudPublicCanvasBridge: {
        loadPublicTreeData(treeId) {
          events.push({
            type: 'load-start',
            treeId,
            loading: body.classList.contains('public-viewer-loading'),
            busy: body.getAttribute('aria-busy'),
            count: elements.viewerSidebarMomentCount.textContent,
            guideHidden: elements.canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden')
          });
          return loadPromise;
        },
        normalizeForCanvas(tree, memories) {
          return {
            treeData: tree,
            treeMemories: memories
          };
        }
      },
      LoveBudPublicCanvasErrorFallback: fallbackImpl,
      createEditorCanvas() {
        return {
          initCanvas() {
            events.push({ type: 'init-canvas', loading: body.classList.contains('public-viewer-loading') });
          }
        };
      },
      createPublicViewerDetailUI() {
        return {
          setDetailEmptyState() {},
          updateFocusSelectedBtn() {},
          updateSidebarStatus() {
            events.push({
              type: 'update-sidebar-status',
              loading: body.classList.contains('public-viewer-loading'),
              busy: body.getAttribute('aria-busy')
            });
          },
          updateDetailPanel() {}
        };
      },
      URLSearchParams,
      setTimeout(fn) {
        fn();
        return 1;
      },
      console,
      LoveBudPublicCanvasInit: {}
    },
    document: documentObject,
    URLSearchParams,
    setTimeout(fn) {
      fn();
      return 1;
    },
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(initSource, sandbox);

  return {
    events,
    elements,
    body,
    resolveLoad,
    rejectLoad,
    fallbackCalls,
    flush: () => Promise.resolve(),
    publicCanvasInit: sandbox.window.LoveBudPublicCanvasInit
  };
}

test('A. public Viewer sidebar template initial count is loading copy, not 0 moments', () => {
  assert.ok(templateSource.includes('viewerSidebarMomentCount'));
  assert.ok(templateSource.includes('불러오는 중…'));
  assert.equal(templateSource.includes('0개의 순간'), false);
  assert.ok(templateSource.includes('aria-live="polite"'));
});

test('B/C/G. init enters loading state before public fetch, hides empty guide, and clears loading after normalized refresh', async () => {
  const harness = createRuntimeHarness();

  const loadStart = harness.events.find((event) => event.type === 'load-start');
  assert.ok(loadStart, 'public fetch must start during init');
  assert.equal(loadStart.loading, true, 'loading class must be set before bridge.loadPublicTreeData starts');
  assert.equal(loadStart.busy, 'true', 'body aria-busy must be true while loading');
  assert.equal(loadStart.count, '불러오는 중…', 'sidebar count must not claim 0 while loading');
  assert.equal(loadStart.guideHidden, true, 'empty guide must be hidden while loading');

  harness.resolveLoad({
    tree: { id: 'tree-1', title: 'Loaded Tree' },
    memories: [
      { id: 'root', parentId: null, title: 'Root' },
      { id: 'm-1', parentId: 'root', title: 'Moment 1' },
      { id: 'm-2', parentId: 'm-1', title: 'Moment 2' }
    ]
  });
  await harness.flush();
  await harness.flush();

  const updateEvent = harness.events.find((event) => event.type === 'update-sidebar-status');
  assert.ok(updateEvent, 'normalized sidebar refresh must run on success');
  assert.equal(updateEvent.loading, true, 'loading state must remain until normalized sidebar refresh runs');

  assert.equal(harness.body.classList.contains('public-viewer-loading'), false, 'loading class must clear after success');
  assert.equal(harness.body.getAttribute('aria-busy'), undefined, 'aria-busy must clear after success');
  assert.equal(harness.elements.viewerSidebarMomentCount.textContent, '2개의 순간', 'final count must come from normalized non-root memories');
  assert.equal(harness.elements.canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden'), true, 'non-empty tree must keep guide hidden after settle');
});

test('D/E. rejection clears loading before error fallback without using tree.memoryCount shortcut', async () => {
  const harness = createRuntimeHarness();

  const helperSourceStart = initSource.indexOf('function setPublicViewerLoadingState(isLoading)');
  const helperSourceEnd = initSource.indexOf('function initPublicCanvas()');
  const helperSource = initSource.slice(helperSourceStart, helperSourceEnd);

  assert.notEqual(helperSourceStart, -1, 'loading helper must exist');
  assert.equal(helperSource.includes('memoryCount'), false, 'loading helper must not inspect tree.memoryCount');
  assert.equal(initSource.includes('ensurePublicCanvasLoadFailureHandler'), false, 'source must not keep global load failure wrapper');
  assert.equal(initSource.includes('__lovebudLoadingWrappedHandlePublicCanvasLoadFailure'), false, 'source must not keep wrapped global fallback marker');
  assert.equal(/fallback\.handlePublicCanvasLoadFailure\s*=\s*[^=]/.test(initSource), false, 'source must not reassign the global fallback handler');
  assert.ok(initSource.includes('function handlePublicCanvasLoadFailure(error)'), 'source must define a local load failure cleanup helper');
  assert.ok(initSource.includes('}).catch(handlePublicCanvasLoadFailure);'), 'promise rejection must route through the local catch wrapper');

  harness.rejectLoad(new Error('network down'));
  await harness.flush();
  await harness.flush();

  assert.equal(harness.body.classList.contains('public-viewer-loading'), false, 'loading class must clear on reject');
  assert.equal(harness.body.getAttribute('aria-busy'), undefined, 'aria-busy must clear on reject');
  assert.equal(harness.fallbackCalls.length, 1, 'existing error fallback must still handle the failure');
  assert.equal(harness.fallbackCalls[0].loading, false, 'error fallback must observe loading already cleared');
  assert.equal(harness.fallbackCalls[0].busy, undefined, 'error fallback must observe aria-busy cleared');
  assert.equal(harness.fallbackCalls[0].count, '불러오는 중…', 'reject path must not misreport a successful 0-count state');
});

test('F. rejection stays safe even when the shared fallback namespace is unavailable', async () => {
  const harness = createRuntimeHarness({ includeFallback: false });

  harness.rejectLoad(new Error('missing fallback'));
  await harness.flush();
  await harness.flush();

  assert.equal(harness.body.classList.contains('public-viewer-loading'), false, 'loading class must still clear without fallback');
  assert.equal(harness.body.getAttribute('aria-busy'), undefined, 'aria-busy must still clear without fallback');
  assert.equal(harness.fallbackCalls.length, 0, 'no fallback calls should be recorded when namespace is absent');
});
