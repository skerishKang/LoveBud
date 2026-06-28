const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const VIEWPORT_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport.js');
const VIEWPORT_SCALE_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-scale.js');
const VIEWPORT_PROJECTION_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-projection.js');
const VIEWPORT_TARGETS_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-targets.js');
const VIEWPORT_FEEDBACK_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-feedback.js');
const VIEWPORT_STATE_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-state.js');
const VIEWPORT_FIT_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-fit.js');
const VIEWPORT_INITIAL_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-initial.js');
const VIEWPORT_BRANCHES_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-branches.js');
const VIEWPORT_ACTIONS_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-actions.js');
const VIEWPORT_CONTROLS_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport-controls.js');

/**
 * Creates a fresh instance of the viewport module in a sandboxed context.
 * DOM-dependent and RAF-dependent methods are loaded but not tested.
 */
function createViewport() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(VIEWPORT_PATH, 'utf8'), context);
  // Load helper modules so thin wrappers can delegate to extracted implementations.
  // Load order matches editor.html: viewport → scale → projection → targets → feedback → state → fit → initial → branches → actions → controls
  if (fs.existsSync(VIEWPORT_SCALE_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_SCALE_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_PROJECTION_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_PROJECTION_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_TARGETS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_TARGETS_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_FEEDBACK_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_FEEDBACK_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_STATE_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_STATE_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_FIT_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_FIT_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_INITIAL_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_INITIAL_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_BRANCHES_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_BRANCHES_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_ACTIONS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_ACTIONS_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_CONTROLS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_CONTROLS_PATH, 'utf8'), context);
  }
  return context.window.LoveBudEditorCanvasViewport;
}

/**
 * Creates a fresh instance with access to the sandboxed context.
 * Use this for tests that need to mock globals (requestAnimationFrame, document, etc.).
 */
function createViewportContext() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(VIEWPORT_PATH, 'utf8'), context);
  // Load order matches editor.html: viewport → scale → projection → targets → feedback → state → fit → initial → branches → actions → controls
  if (fs.existsSync(VIEWPORT_SCALE_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_SCALE_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_PROJECTION_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_PROJECTION_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_TARGETS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_TARGETS_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_FEEDBACK_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_FEEDBACK_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_STATE_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_STATE_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_FIT_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_FIT_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_INITIAL_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_INITIAL_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_BRANCHES_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_BRANCHES_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_ACTIONS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_ACTIONS_PATH, 'utf8'), context);
  }
  if (fs.existsSync(VIEWPORT_CONTROLS_PATH)) {
    vm.runInContext(fs.readFileSync(VIEWPORT_CONTROLS_PATH, 'utf8'), context);
  }
  return {
    context,
    viewport: context.window.LoveBudEditorCanvasViewport,
  };
}

// ---------------------------------------------------------------------------
// getNearestZoom
// ---------------------------------------------------------------------------
test('getNearestZoom — invalid / null / negative / zero → 1', () => {
  const vp = createViewport();
  assert.equal(vp.getNearestZoom(null), 1);
  assert.equal(vp.getNearestZoom(undefined), 1);
  assert.equal(vp.getNearestZoom(NaN), 1);
  assert.equal(vp.getNearestZoom('invalid'), 1);
  assert.equal(vp.getNearestZoom(-1), 1);
  assert.equal(vp.getNearestZoom(0), 1);
});

test('getNearestZoom — snaps to nearest preset level', () => {
  const vp = createViewport();
  // 0.34 → 0.35 (closer than 0.2)
  assert.equal(vp.getNearestZoom(0.34), 0.35);
  // 0.36 → 0.35 (still closer than 0.5)
  assert.equal(vp.getNearestZoom(0.36), 0.35);
  // 0.76 → 0.75 (not 1)
  assert.equal(vp.getNearestZoom(0.76), 0.75);
  // 1.4 → 1.25? Let's check: diff(1.25)=0.15, diff(1.5)=0.1 → 1.5
  // |1.4-1.25|=0.15, |1.4-1.5|=0.1 → 1.5
  assert.equal(vp.getNearestZoom(1.4), 1.5);
  // exact zoom level → same
  assert.equal(vp.getNearestZoom(1), 1);
  assert.equal(vp.getNearestZoom(0.5), 0.5);
  assert.equal(vp.getNearestZoom(1.5), 1.5);
});

// ---------------------------------------------------------------------------
// getFitZoom
// ---------------------------------------------------------------------------
test('getFitZoom — invalid / null / negative / zero → 1', () => {
  const vp = createViewport();
  assert.equal(vp.getFitZoom(null), 1);
  assert.equal(vp.getFitZoom(undefined), 1);
  assert.equal(vp.getFitZoom(NaN), 1);
  assert.equal(vp.getFitZoom('x'), 1);
  assert.equal(vp.getFitZoom(-1), 1);
  assert.equal(vp.getFitZoom(0), 1);
});

test('getFitZoom — clamps within [0.2, 1.5] and does not round upward', () => {
  const vp = createViewport();

  // below minScale → clamped to 0.2 → highest preset ≤ 0.2 = 0.2
  assert.equal(vp.getFitZoom(0.1), 0.2);
  assert.equal(vp.getFitZoom(0.2), 0.2);

  // 0.34 → clamped=0.34 → highest preset ≤ 0.34 = 0.2? No, 0.35 > 0.34, so 0.2
  assert.equal(vp.getFitZoom(0.34), 0.2);

  // 0.36 → clamped=0.36 → highest preset ≤ 0.36 = 0.35
  assert.equal(vp.getFitZoom(0.36), 0.35);

  // above maxScale → clamped to 1.5 → highest preset ≤ 1.5 = 1.5
  assert.equal(vp.getFitZoom(2), 1.5);
  assert.equal(vp.getFitZoom(100), 1.5);

  // exact preset → same
  assert.equal(vp.getFitZoom(0.75), 0.75);
  assert.equal(vp.getFitZoom(1), 1);
});

// ---------------------------------------------------------------------------
// getNextZoom
// ---------------------------------------------------------------------------
test('getNextZoom — steps through preset levels', () => {
  const vp = createViewport();

  // 1 → + direction → 1.25
  assert.equal(vp.getNextZoom(1, 1), 1.25);
  // 1 → - direction → 0.75
  assert.equal(vp.getNextZoom(1, -1), 0.75);

  // near maxScale → + direction stays at max
  assert.equal(vp.getNextZoom(1.5, 1), 1.5);
  assert.equal(vp.getNextZoom(1.4, 1), 1.5);
  // near minScale → - direction stays at min
  assert.equal(vp.getNextZoom(0.2, -1), 0.2);
  assert.equal(vp.getNextZoom(0.21, -1), 0.2);
});

// ---------------------------------------------------------------------------
// getScale
// ---------------------------------------------------------------------------
test('getScale — invalid / null / missing / negative → 1', () => {
  const vp = createViewport();
  assert.equal(vp.getScale(null), 1);
  assert.equal(vp.getScale(undefined), 1);
  assert.equal(vp.getScale({}), 1);
  assert.equal(vp.getScale({ scale: NaN }), 1);
  assert.equal(vp.getScale({ scale: -1 }), 1);
  assert.equal(vp.getScale({ scale: 0 }), 1);
});

test('getScale — clamps within [0.2, 1.5]', () => {
  const vp = createViewport();
  assert.equal(vp.getScale({ scale: 0.1 }), 0.2);
  assert.equal(vp.getScale({ scale: 2 }), 1.5);
  assert.equal(vp.getScale({ scale: 0.75 }), 0.75);
});

// ---------------------------------------------------------------------------
// setScale
// ---------------------------------------------------------------------------
test('setScale — mutates viewportState.scale to nearest zoom level', () => {
  const vp = createViewport();
  const state = { scale: 1 };

  // 0.76 → nearest = 0.75
  vp.setScale(state, 0.76);
  assert.equal(state.scale, 0.75);

  vp.setScale(state, 2);
  assert.equal(state.scale, 1.5);

  vp.setScale(state, 0.1);
  assert.equal(state.scale, 0.2);

  // invalid → 1
  vp.setScale(state, null);
  assert.equal(state.scale, 1);
});

// ---------------------------------------------------------------------------
// setFitScale
// ---------------------------------------------------------------------------
test('setFitScale — mutates viewportState.scale via getFitZoom', () => {
  const vp = createViewport();
  const state = { scale: 1 };

  // 0.36 → fit = 0.35
  vp.setFitScale(state, 0.36);
  assert.equal(state.scale, 0.35);

  // too small → 0.2
  vp.setFitScale(state, 0.1);
  assert.equal(state.scale, 0.2);

  // too large → 1.5
  vp.setFitScale(state, 100);
  assert.equal(state.scale, 1.5);
});

// ---------------------------------------------------------------------------
// projectWorldPosition
// ---------------------------------------------------------------------------
test('projectWorldPosition — applies scale and offset', () => {
  const vp = createViewport();

  const result = vp.projectWorldPosition(
    { x: 100, y: 50 },
    { scale: 0.5, offsetX: 10, offsetY: -5 }
  );
  // x: 100 * 0.5 + 10 = 60
  // y: 50 * 0.5 + (-5) = 20
  assert.equal(result.x, 60);
  assert.equal(result.y, 20);
});

test('projectWorldPosition — uses scale 1 fallback for invalid scale', () => {
  const vp = createViewport();

  // invalid scale → scale 1
  const result = vp.projectWorldPosition(
    { x: 100, y: 50 },
    { scale: 0, offsetX: 10, offsetY: -5 }
  );
  // x: 100 * 1 + 10 = 110
  // y: 50 * 1 + (-5) = 45
  assert.equal(result.x, 110);
  assert.equal(result.y, 45);
});

test('projectWorldPosition — handles negative coordinates', () => {
  const vp = createViewport();

  // scale=2 is clamped to maxScale=1.5 by getScale
  const result = vp.projectWorldPosition(
    { x: -30, y: -20 },
    { scale: 2, offsetX: 100, offsetY: 50 }
  );
  // x: -30 * 1.5 + 100 = 55
  // y: -20 * 1.5 + 50 = 20
  assert.equal(result.x, 55);
  assert.equal(result.y, 20);
});

// ---------------------------------------------------------------------------
// applyViewport
// ---------------------------------------------------------------------------
test('applyViewport — null nextViewport returns false, state unchanged', () => {
  const vp = createViewport();
  const state = { scale: 0.75, offsetX: 10, offsetY: 20 };

  assert.equal(vp.applyViewport(state, null, false), false);
  assert.equal(state.scale, 0.75);
  assert.equal(state.offsetX, 10);
  assert.equal(state.offsetY, 20);
});

test('applyViewport — useFitScale=false uses setScale (nearest zoom)', () => {
  const vp = createViewport();
  const state = { scale: 1, offsetX: 0, offsetY: 0 };

  // 0.76 → clamp [0.2,1.5] → 0.76 → nearest = 0.75
  const result = vp.applyViewport(state, { scale: 0.76, offsetX: 50, offsetY: 100 }, false);
  assert.equal(result, true);
  assert.equal(state.scale, 0.75);
  assert.equal(state.offsetX, 50);
  assert.equal(state.offsetY, 100);
});

test('applyViewport — useFitScale=true uses setFitZoom', () => {
  const vp = createViewport();
  const state = { scale: 1, offsetX: 0, offsetY: 0 };

  // 0.36 → fit = 0.35
  const result = vp.applyViewport(state, { scale: 0.36, offsetX: 50, offsetY: 100 }, true);
  assert.equal(result, true);
  assert.equal(state.scale, 0.35);
  assert.equal(state.offsetX, 50);
  assert.equal(state.offsetY, 100);
});

// ---------------------------------------------------------------------------
// isAlreadyAtFit
// ---------------------------------------------------------------------------
test('isAlreadyAtFit — null fitViewport → false', () => {
  const vp = createViewport();
  assert.equal(vp.isAlreadyAtFit({ scale: 1, offsetX: 0, offsetY: 0 }, null), false);
});

test('isAlreadyAtFit — within tolerances → true', () => {
  const vp = createViewport();
  // scale diff = 0.005 (< 0.01), offset diff = 2 (< 5)
  assert.equal(
    vp.isAlreadyAtFit(
      { scale: 0.995, offsetX: 10, offsetY: 20 },
      { scale: 1, offsetX: 12, offsetY: 22 }
    ),
    true
  );
});

test('isAlreadyAtFit — outside tolerances → false', () => {
  const vp = createViewport();
  // scale diff = 0.02 (>= 0.01)
  assert.equal(
    vp.isAlreadyAtFit(
      { scale: 0.98, offsetX: 10, offsetY: 20 },
      { scale: 1, offsetX: 10, offsetY: 20 }
    ),
    false
  );
  // offsetX diff = 5 (>= 5)
  assert.equal(
    vp.isAlreadyAtFit(
      { scale: 1, offsetX: 10, offsetY: 20 },
      { scale: 1, offsetX: 15, offsetY: 20 }
    ),
    false
  );
  // offsetY diff = 5
  assert.equal(
    vp.isAlreadyAtFit(
      { scale: 1, offsetX: 10, offsetY: 20 },
      { scale: 1, offsetX: 10, offsetY: 25 }
    ),
    false
  );
});

// ---------------------------------------------------------------------------
// getFitViewport (basic — no targets scenario)
// ---------------------------------------------------------------------------
test('getFitViewport — no targets returns fallback viewport', () => {
  const vp = createViewport();

  const result = vp.getFitViewport({
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getTreeMemories: () => [],
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  assert.equal(result.scale, 1);
  assert.equal(result.offsetX, 0);
  assert.equal(result.offsetY, 0);
});

test('getFitViewport — target bounds calculate fit scale and readable offset', () => {
  const vp = createViewport();

  const result = vp.getFitViewport({
    getWorldPosition: (mem) => mem.id === 'A' ? { x: 0, y: 0 } : { x: 420, y: 220 },
    getMetrics: () => ({ width: 1200, height: 800 }),
    getTreeMemories: () => [{ id: 'A' }, { id: 'B' }],
    getCanonicalRootId: () => undefined,
    isRootMemory: () => false,
  });

  // padding = min(160, max(72, round(1200 * 0.10))) = 120
  // nodeBoundsPadding = 180
  // boundsWidth = 420 - 0 + 180 = 600
  // boundsHeight = 220 - 0 + 180 = 400
  // availableWidth = 1200 - 240 = 960
  // availableHeight = 800 - 240 = 560
  // rawFitScale = min(960 / 600, 560 / 400) = min(1.6, 1.4) = 1.4
  // getFitZoom(1.4) = 1.25
  // centerX = 210, centerY = 110
  // offsetX = round(1200 * 0.5 - 210 * 1.25) = 338
  // offsetY = round(800 * 0.42 - 110 * 1.25) = 199
  
  assert.equal(result.scale, 1.25);
  assert.equal(result.offsetX, 338);
  assert.equal(result.offsetY, 199);
});

test('getFitViewport — uses visible non-root nodes before canonical root', () => {
  const vp = createViewport();

  const result = vp.getFitViewport({
    getWorldPosition: (mem) => mem.id === 'root' ? { x: -1000, y: -1000 } : { x: 200, y: 100 },
    getMetrics: () => ({ width: 1000, height: 600 }),
    getTreeMemories: () => [{ id: 'root' }, { id: 'child' }],
    getCanonicalRootId: () => 'root',
    isRootMemory: (mem, canonicalRootId) => mem.id === canonicalRootId,
  });

  // child only
  // padding = min(160, max(72, round(1000 * 0.10))) = 100
  // nodeBoundsPadding = 180
  // boundsWidth = 180, boundsHeight = 180
  // availableWidth = 800, availableHeight = 400
  // rawFitScale = min(800 / 180, 400 / 180) = min(4.444..., 2.222...) = 2.222...
  // getFitZoom(rawFitScale) = 1.5
  // offsetX = round(1000 * 0.5 - 200 * 1.5) = 200
  // offsetY = round(600 * 0.42 - 100 * 1.5) = 102
  
  assert.equal(result.scale, 1.5);
  assert.equal(result.offsetX, 200);
  assert.equal(result.offsetY, 102);
});

test('getFitViewport — falls back to canonical root when no visible nodes exist', () => {
  const vp = createViewport();

  const result = vp.getFitViewport({
    getWorldPosition: (mem) => ({ x: 0, y: 0 }), // root position
    getMetrics: () => ({ width: 1000, height: 600 }),
    getTreeMemories: () => [{ id: 'root' }],
    getCanonicalRootId: () => 'root',
    isRootMemory: (mem, canonicalRootId) => mem.id === canonicalRootId,
  });

  // root only
  // padding = 100, boundsWidth = 180, boundsHeight = 180
  // availableWidth = 800, availableHeight = 400
  // rawFitScale = min(800 / 180, 400 / 180) = min(4.444..., 2.222...) = 2.222...
  // getFitZoom(rawFitScale) = 1.5
  // offsetX = round(1000 * 0.5 - 0 * 1.5) = 500
  // offsetY = round(600 * 0.42 - 0 * 1.5) = 252
  
  assert.equal(result.scale, 1.5);
  assert.equal(result.offsetX, 500);
  assert.equal(result.offsetY, 252);
});

// ---------------------------------------------------------------------------
// getReadableViewportOffset
// ---------------------------------------------------------------------------
test('getReadableViewportOffset — no targets returns null', () => {
  const vp = createViewport();

  const result = vp.getReadableViewportOffset({
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getTreeMemories: () => [],
    getCanonicalRootId: () => undefined,
    isRootMemory: () => false,
  });

  assert.equal(result, null);
});

test('getReadableViewportOffset — snaps preferred scale and centers target bounds', () => {
  const vp = createViewport();

  const result = vp.getReadableViewportOffset({
    getWorldPosition: (mem) => mem.id === 'A' ? { x: 0, y: 0 } : { x: 420, y: 220 },
    getMetrics: () => ({ width: 1200, height: 800 }),
    getTreeMemories: () => [{ id: 'A' }, { id: 'B' }],
    getCanonicalRootId: () => undefined,
    isRootMemory: () => false,
  }, 0.76); // preferredScale = 0.76

  // getNearestZoom(0.76) = 0.75
  // centerX = (0 + 420) / 2 = 210
  // centerY = (0 + 220) / 2 = 110
  // offsetX = round(1200 * 0.5 - 210 * 0.75) = round(600 - 157.5) = 443
  // offsetY = round(800 * 0.42 - 110 * 0.75) = round(336 - 82.5) = 254
  
  assert.equal(result.scale, 0.75);
  assert.equal(result.offsetX, 443);
  assert.equal(result.offsetY, 254);
});

test('getReadableViewportOffset — uses visible non-root nodes before canonical root', () => {
  const vp = createViewport();

  const result = vp.getReadableViewportOffset({
    getWorldPosition: (mem) => mem.id === 'root' ? { x: -1000, y: -1000 } : { x: 200, y: 100 },
    getMetrics: () => ({ width: 1000, height: 600 }),
    getTreeMemories: () => [{ id: 'root' }, { id: 'child' }],
    getCanonicalRootId: () => 'root',
    isRootMemory: (mem, canonicalRootId) => mem.id === canonicalRootId,
  }, 1.4); // preferredScale = 1.4

  // getNearestZoom(1.4) = 1.5
  // child only: centerX = 200, centerY = 100
  // offsetX = round(1000 * 0.5 - 200 * 1.5) = 200
  // offsetY = round(600 * 0.42 - 100 * 1.5) = 102
  
  assert.equal(result.scale, 1.5);
  assert.equal(result.offsetX, 200);
  assert.equal(result.offsetY, 102);
});

// ---------------------------------------------------------------------------
// getViewportTargets
// ---------------------------------------------------------------------------
test('getViewportTargets — empty memories returns empty array', () => {
  const vp = createViewport();

  const result = vp.getViewportTargets({
    getTreeMemories: () => [],
    getCanonicalRootId: () => 'root',
    isRootMemory: () => true,
  });

  assert.deepEqual(Array.from(result), []);
});

test('getViewportTargets — missing root helpers returns all memories', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }, { id: 'child' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  assert.deepEqual(Array.from(result), memories);
});

test('getViewportTargets — returns visible non-root nodes before canonical root', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }, { id: 'child-1' }, { id: 'child-2' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: () => 'root',
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
  });

  assert.deepEqual(Array.from(result), [{ id: 'child-1' }, { id: 'child-2' }]);
});

test('getViewportTargets — falls back to canonical root when no visible nodes exist', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: () => 'root',
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
  });

  assert.deepEqual(Array.from(result), [{ id: 'root' }]);
});

// ---------------------------------------------------------------------------
// isStoredViewportExtreme
// ---------------------------------------------------------------------------
test('isStoredViewportExtreme — returns false within calculated bounds', () => {
  const vp = createViewport();
  // metrics: { width: 1000, height: 600 }
  // margin = max(200, round(1000 * 0.25)) = 250
  // X 허용: -1250 ~ 1250
  // Y 허용: -850 ~ 850
  assert.equal(vp.isStoredViewportExtreme({
    viewportState: { offsetX: 0, offsetY: 0 },
    getMetrics: () => ({ width: 1000, height: 600 }),
  }), false);
});

test('isStoredViewportExtreme — treats exact boundary values as not extreme', () => {
  const vp = createViewport();
  const opts = {
    getMetrics: () => ({ width: 1000, height: 600 }),
  };
  // margin = 250, X bounds: -1250~1250, Y bounds: -850~850
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: -1250, offsetY: -850 },
  }), false);
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 1250, offsetY: 850 },
  }), false);
});

test('isStoredViewportExtreme — returns true when x offset is outside bounds', () => {
  const vp = createViewport();
  const opts = {
    getMetrics: () => ({ width: 1000, height: 600 }),
  };
  // margin = 250, X bounds: -1250~1250
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: -1251, offsetY: 0 },
  }), true);
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 1251, offsetY: 0 },
  }), true);
});

test('isStoredViewportExtreme — returns true when y offset is outside bounds', () => {
  const vp = createViewport();
  const opts = {
    getMetrics: () => ({ width: 1000, height: 600 }),
  };
  // margin = 250, Y bounds: -850~850
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 0, offsetY: -851 },
  }), true);
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 0, offsetY: 851 },
  }), true);
});

test('isStoredViewportExtreme — uses minimum 200px margin for narrow viewports', () => {
  const vp = createViewport();
  // metrics: { width: 400, height: 300 }
  // width * 0.25 = 100 < 200 → margin = 200
  // X 허용: -600 ~ 600
  // Y 허용: -500 ~ 500
  const opts = {
    getMetrics: () => ({ width: 400, height: 300 }),
  };
  // exact boundary → false
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 600, offsetY: 500 },
  }), false);
  // outside X → true
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 601, offsetY: 0 },
  }), true);
  // outside Y → true
  assert.equal(vp.isStoredViewportExtreme({
    ...opts,
    viewportState: { offsetX: 0, offsetY: 501 },
  }), true);
});

// ---------------------------------------------------------------------------
// zoomBy
// ---------------------------------------------------------------------------
test('zoomBy — zooms in one preset and preserves readable center world point', () => {
  const vp = createViewport();
  let initCalls = 0;
  const viewportState = { scale: 1, offsetX: 100, offsetY: 50 };

  vp.zoomBy({
    factor: 1.2,
    viewportState,
    getMetrics: () => ({ width: 1000, height: 600 }),
    initCanvas: () => { initCalls += 1; },
  });

  // oldScale = 1, nextScale = 1.25
  // centerWorldX = (500 - 100) / 1 = 400
  // centerWorldY = (252 - 50) / 1 = 202
  // offsetX = round(500 - 400 * 1.25) = 0
  // offsetY = round(252 - 202 * 1.25) = 0
  assert.equal(viewportState.scale, 1.25);
  assert.equal(Math.abs(viewportState.offsetX), 0);
  assert.equal(Math.abs(viewportState.offsetY), 0);
  assert.equal(initCalls, 1);
});

test('zoomBy — zooms out one preset and preserves readable center world point', () => {
  const vp = createViewport();
  let initCalls = 0;
  const viewportState = { scale: 1, offsetX: 100, offsetY: 50 };

  vp.zoomBy({
    factor: 0.8,
    viewportState,
    getMetrics: () => ({ width: 1000, height: 600 }),
    initCanvas: () => { initCalls += 1; },
  });

  // oldScale = 1, nextScale = 0.75
  // centerWorldX = (500 - 100) / 1 = 400
  // centerWorldY = (252 - 50) / 1 = 202
  // offsetX = round(500 - 400 * 0.75) = 200
  // offsetY = round(252 - 202 * 0.75) = 101
  assert.equal(viewportState.scale, 0.75);
  assert.equal(viewportState.offsetX, 200);
  assert.equal(viewportState.offsetY, 101);
  assert.equal(initCalls, 1);
});

test('zoomBy — does nothing at maximum zoom when zooming in', () => {
  const vp = createViewport();
  let initCalls = 0;
  const viewportState = { scale: 1.5, offsetX: 100, offsetY: 50 };

  vp.zoomBy({
    factor: 1.2,
    viewportState,
    getMetrics: () => ({ width: 1000, height: 600 }),
    initCanvas: () => { initCalls += 1; },
  });

  assert.equal(viewportState.scale, 1.5);
  assert.equal(viewportState.offsetX, 100);
  assert.equal(viewportState.offsetY, 50);
  assert.equal(initCalls, 0);
});

test('zoomBy — does nothing at minimum zoom when zooming out', () => {
  const vp = createViewport();
  let initCalls = 0;
  const viewportState = { scale: 0.2, offsetX: 100, offsetY: 50 };

  vp.zoomBy({
    factor: 0.8,
    viewportState,
    getMetrics: () => ({ width: 1000, height: 600 }),
    initCanvas: () => { initCalls += 1; },
  });

  assert.equal(viewportState.scale, 0.2);
  assert.equal(viewportState.offsetX, 100);
  assert.equal(viewportState.offsetY, 50);
  assert.equal(initCalls, 0);
});

test('zoomBy — snaps non-preset scale before stepping', () => {
  const vp = createViewport();
  let initCalls = 0;
  // 0.76 → getNearestZoom = 0.75
  const viewportState = { scale: 0.76, offsetX: 100, offsetY: 50 };

  vp.zoomBy({
    factor: 1.2,
    viewportState,
    getMetrics: () => ({ width: 1000, height: 600 }),
    initCanvas: () => { initCalls += 1; },
  });

  // oldScale = 0.75, nextScale = 1
  // centerWorldX = (500 - 100) / 0.75 = 533.333...
  // centerWorldY = (252 - 50) / 0.75 = 269.333...
  // offsetX = round(500 - 533.333... * 1) = -33
  // offsetY = round(252 - 269.333... * 1) = -17
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, -33);
  assert.equal(viewportState.offsetY, -17);
  assert.equal(initCalls, 1);
});

// ---------------------------------------------------------------------------
// prepareInitialViewport
// ---------------------------------------------------------------------------
test('prepareInitialViewport — applies fallback fit viewport on first load with empty tree', () => {
  const vp = createViewport();
  const viewportState = { scale: 0.76, offsetX: 999, offsetY: -999 };

  vp.prepareInitialViewport({
    viewportState,
    getTreeMemories: () => [],
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  // empty tree → fallback { scale: 1, offsetX: 0, offsetY: 0 }
  // applyViewport(..., true) → setFitScale(1) → getFitZoom(1) = 1
  assert.equal(viewportState.initialViewportApplied, true);
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 0);
  assert.equal(viewportState.offsetY, 0);
});

test('prepareInitialViewport — skips fit viewport after initial viewport was already applied', () => {
  const vp = createViewport();
  const viewportState = {
    scale: 0.76,
    offsetX: 12,
    offsetY: 34,
    initialViewportApplied: true,
  };

  // getFitViewport/getWorldPosition/getMetrics should NOT be called
  vp.prepareInitialViewport({
    viewportState,
    getTreeMemories: () => { throw new Error('should not be called'); },
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
  });

  // setScale(0.76) → nearest zoom = 0.75
  assert.equal(viewportState.scale, 0.75);
  assert.equal(viewportState.offsetX, 12);
  assert.equal(viewportState.offsetY, 34);
  assert.equal(viewportState.initialViewportApplied, true);
});

test('prepareInitialViewport — marks initial viewport as applied before computing fit viewport', () => {
  const vp = createViewport();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let fitViewportCalled = false;

  vp.getFitViewport = (options) => {
    // initialViewportApplied must already be true when getFitViewport is called
    assert.equal(options.viewportState.initialViewportApplied, true);
    fitViewportCalled = true;
    return { scale: 1, offsetX: 10, offsetY: 20 };
  };

  vp.prepareInitialViewport({
    viewportState,
    getTreeMemories: () => [],
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  assert.equal(viewportState.initialViewportApplied, true);
  assert.equal(viewportState.offsetX, 10);
  assert.equal(viewportState.offsetY, 20);
  assert.equal(fitViewportCalled, true);
});

test('prepareInitialViewport — applies fit viewport with fit-scale snapping', () => {
  const vp = createViewport();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };

  vp.getFitViewport = () => ({ scale: 0.36, offsetX: 50, offsetY: 60 });

  vp.prepareInitialViewport({
    viewportState,
    getTreeMemories: () => [],
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  // applyViewport(..., true) → setFitScale(0.36) → getFitZoom(0.36) = 0.35
  assert.equal(viewportState.scale, 0.35);
  assert.equal(viewportState.offsetX, 50);
  assert.equal(viewportState.offsetY, 60);
  assert.equal(viewportState.initialViewportApplied, true);
});

test('prepareInitialViewport — defaults invalid or missing stored scale before first fit', () => {
  const vp = createViewport();
  // scale missing → setScale(..., undefined || 1) → setScale(..., 1)
  const viewportState = { offsetX: 5, offsetY: 6 };

  vp.getFitViewport = () => ({ scale: 1.4, offsetX: 70, offsetY: 80 });

  vp.prepareInitialViewport({
    viewportState,
    getTreeMemories: () => [],
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  // setScale(..., 1) → scale = 1
  // applyViewport(..., true): setFitScale(1.4) → getFitZoom(1.4) = 1.25
  assert.equal(viewportState.scale, 1.25);
  assert.equal(viewportState.offsetX, 70);
  assert.equal(viewportState.offsetY, 80);
  assert.equal(viewportState.initialViewportApplied, true);
});

// ---------------------------------------------------------------------------
// recenterViewport
// ---------------------------------------------------------------------------
test('recenterViewport — resets viewport and initializes canvas for empty tree', () => {
  const vp = createViewport();
  const viewportState = { scale: 0.76, offsetX: 99, offsetY: -88 };
  let initCalls = 0;

  vp.recenterViewport({
    getTreeMemories: () => [],
    viewportState,
    initCanvas: () => { initCalls += 1; },
  });

  // empty tree → reset to origin
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 0);
  assert.equal(viewportState.offsetY, 0);
  assert.equal(initCalls, 1);
});

test('recenterViewport — shows feedback and skips init when already at fit', () => {
  const vp = createViewport();
  const viewportState = { scale: 1, offsetX: 10, offsetY: 20 };
  let initCalls = 0;
  let feedbackCalls = 0;

  vp.getFitViewport = () => ({ scale: 1, offsetX: 10, offsetY: 20 });
  vp.showAlreadyAtFitFeedback = () => { feedbackCalls += 1; };

  vp.recenterViewport({
    getTreeMemories: () => [{ id: 'root' }],
    viewportState,
    initCanvas: () => { initCalls += 1; },
  });

  assert.equal(feedbackCalls, 1);
  assert.equal(initCalls, 0);
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 10);
  assert.equal(viewportState.offsetY, 20);
});

test('recenterViewport — applies fit viewport and initializes canvas when not already at fit', () => {
  const vp = createViewport();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let initCalls = 0;

  vp.getFitViewport = () => ({ scale: 0.36, offsetX: 50, offsetY: 60 });
  vp.showAlreadyAtFitFeedback = () => { throw new Error('should not be called'); };

  vp.recenterViewport({
    getTreeMemories: () => [{ id: 'child' }],
    viewportState,
    initCanvas: () => { initCalls += 1; },
  });

  // applyViewport(..., true) → setFitScale(0.36) → getFitZoom(0.36) = 0.35
  assert.equal(viewportState.scale, 0.35);
  assert.equal(viewportState.offsetX, 50);
  assert.equal(viewportState.offsetY, 60);
  assert.equal(initCalls, 1);
});

test('recenterViewport — treats near-fit viewport as already at fit via tolerance', () => {
  const vp = createViewport();
  const viewportState = { scale: 0.995, offsetX: 12, offsetY: 22 };
  let initCalls = 0;
  let feedbackCalls = 0;

  vp.getFitViewport = () => ({ scale: 1, offsetX: 10, offsetY: 20 });
  vp.showAlreadyAtFitFeedback = () => { feedbackCalls += 1; };

  vp.recenterViewport({
    getTreeMemories: () => [{ id: 'root' }],
    viewportState,
    initCanvas: () => { initCalls += 1; },
  });

  // scale diff = 0.005 < 0.01, offset diff = 2 < 5 → already at fit
  assert.equal(feedbackCalls, 1);
  assert.equal(initCalls, 0);
  assert.equal(viewportState.scale, 0.995);
  assert.equal(viewportState.offsetX, 12);
  assert.equal(viewportState.offsetY, 22);
});

test('recenterViewport — re-applies fit viewport when offset tolerance is exceeded', () => {
  const vp = createViewport();
  const viewportState = { scale: 1, offsetX: 15, offsetY: 20 };
  let initCalls = 0;

  vp.getFitViewport = () => ({ scale: 1, offsetX: 10, offsetY: 20 });
  vp.showAlreadyAtFitFeedback = () => { throw new Error('should not be called'); };

  vp.recenterViewport({
    getTreeMemories: () => [{ id: 'child' }],
    viewportState,
    initCanvas: () => { initCalls += 1; },
  });

  // offsetX diff = 5 so tolerance (offsetDiffX < 5) is not satisfied
  // scale = 1, getFitZoom(1) = 1
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 10);
  assert.equal(viewportState.offsetY, 20);
  assert.equal(initCalls, 1);
});

// ---------------------------------------------------------------------------
// focusNodeById
// ---------------------------------------------------------------------------
test('focusNodeById — returns without side effects when nodeId is missing', () => {
  const { viewport: vp } = createViewportContext();
  const viewportState = { scale: 1, offsetX: 100, offsetY: 200 };
  let sideEffectCalls = 0;

  vp.focusNodeById({
    nodeId: '',
    getTreeMemories: () => { sideEffectCalls += 1; return []; },
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    viewportState,
    initCanvas: () => { sideEffectCalls += 1; },
    reapplySelection: () => { sideEffectCalls += 1; },
  });

  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 100);
  assert.equal(viewportState.offsetY, 200);
  assert.equal(sideEffectCalls, 0);
});

test('focusNodeById — returns without side effects when target node is missing', () => {
  const { viewport: vp } = createViewportContext();
  const viewportState = { scale: 1, offsetX: 100, offsetY: 200 };
  let sideEffectCalls = 0;

  vp.focusNodeById({
    nodeId: 'missing',
    getTreeMemories: () => [{ id: 'root' }],
    getWorldPosition: () => { throw new Error('should not be called'); },
    getMetrics: () => { throw new Error('should not be called'); },
    viewportState,
    initCanvas: () => { sideEffectCalls += 1; },
    reapplySelection: () => { sideEffectCalls += 1; },
  });

  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 100);
  assert.equal(viewportState.offsetY, 200);
  assert.equal(sideEffectCalls, 0);
});

test('focusNodeById — centers target at readable center and reapplies selection', () => {
  const { context, viewport: vp } = createViewportContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let initCalls = 0;
  let reapplyCalls = 0;
  let lastReapplyNodeId = '';
  let rafCalls = 0;

  context.requestAnimationFrame = (cb) => { rafCalls += 1; cb(); };
  context.findMemoryNodeById = () => null;

  vp.focusNodeById({
    nodeId: 'child',
    getTreeMemories: () => [{ id: 'root' }, { id: 'child' }],
    getWorldPosition: (target) => target.id === 'child' ? { x: 200, y: 100 } : { x: 0, y: 0 },
    getMetrics: () => ({ width: 1000, height: 600 }),
    viewportState,
    initCanvas: () => { initCalls += 1; },
    reapplySelection: (nodeId) => { reapplyCalls += 1; lastReapplyNodeId = nodeId; },
    findMemoryNodeById: () => null,
  });

  // readable center: x=500, y=252
  // offsetX = round(500 - 200 * 1) = 300
  // offsetY = round(252 - 100 * 1) = 152
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 300);
  assert.equal(viewportState.offsetY, 152);
  assert.equal(initCalls, 1);
  assert.equal(reapplyCalls, 1);
  assert.equal(lastReapplyNodeId, 'child');
  assert.equal(rafCalls, 1);
});

test('focusNodeById — normalizes scale to 1 before centering', () => {
  const { context, viewport: vp } = createViewportContext();
  const viewportState = { scale: 0.76, offsetX: 999, offsetY: -999 };
  let initCalls = 0;
  let reapplyCalls = 0;
  let rafCalls = 0;

  context.requestAnimationFrame = (cb) => { rafCalls += 1; cb(); };
  context.findMemoryNodeById = () => null;

  vp.focusNodeById({
    nodeId: 'child',
    getTreeMemories: () => [{ id: 'child' }],
    getWorldPosition: () => ({ x: 400, y: 200 }),
    getMetrics: () => ({ width: 1000, height: 600 }),
    viewportState,
    initCanvas: () => { initCalls += 1; },
    reapplySelection: () => { reapplyCalls += 1; },
    findMemoryNodeById: () => null,
  });

  // setScale(..., 1) → nearest = 1
  // offsetX = round(500 - 400 * 1) = 100
  // offsetY = round(252 - 200 * 1) = 52
  assert.equal(viewportState.scale, 1);
  assert.equal(viewportState.offsetX, 100);
  assert.equal(viewportState.offsetY, 52);
  assert.equal(initCalls, 1);
  assert.equal(reapplyCalls, 1);
  assert.equal(rafCalls, 1);
});

test('focusNodeById — toggles focus animation class when node element exists', () => {
  const { context, viewport: vp } = createViewportContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let rafCalls = 0;
  let removeCalls = 0;
  let addCalls = 0;
  let offsetWidthReads = 0;

  const fakeNodeEl = {
    classList: {
      remove: (className) => {
        if (className === 'focus-animate') removeCalls += 1;
      },
      add: (className) => {
        if (className === 'focus-animate') addCalls += 1;
      },
    },
    get offsetWidth() {
      offsetWidthReads += 1;
      return 100;
    },
  };

  context.requestAnimationFrame = (callback) => {
    rafCalls += 1;
    callback();
  };

  vp.focusNodeById({
    nodeId: 'child',
    getTreeMemories: () => [{ id: 'child' }],
    getWorldPosition: () => ({ x: 200, y: 100 }),
    getMetrics: () => ({ width: 1000, height: 600 }),
    viewportState,
    initCanvas: () => {},
    reapplySelection: () => {},
    findMemoryNodeById: () => fakeNodeEl,
  });

  assert.equal(removeCalls, 1);
  assert.equal(offsetWidthReads, 1);
  assert.equal(addCalls, 1);
  assert.equal(rafCalls, 1);
});

test('focusNodeById — skips animation class toggle when node element is missing', () => {
  const { context, viewport: vp } = createViewportContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let rafCalls = 0;
  let removeCalls = 0;
  let addCalls = 0;

  context.requestAnimationFrame = (callback) => {
    rafCalls += 1;
    callback();
  };

  vp.focusNodeById({
    nodeId: 'child',
    getTreeMemories: () => [{ id: 'child' }],
    getWorldPosition: () => ({ x: 200, y: 100 }),
    getMetrics: () => ({ width: 1000, height: 600 }),
    viewportState,
    initCanvas: () => {},
    reapplySelection: () => {},
    findMemoryNodeById: () => null,
  });

  assert.equal(removeCalls, 0);
  assert.equal(addCalls, 0);
  assert.equal(rafCalls, 1);
});

// ---------------------------------------------------------------------------
// bindControls - helpers
// ---------------------------------------------------------------------------

function createMockElement(id) {
  const el = {
    id: id || '',
    classList: {
      _classes: new Set(),
      add(cls) { this._classes.add(cls); },
      remove(cls) { this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); },
    },
    dataset: {},
    textContent: '',
    _listeners: {},
    addEventListener(type, handler) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(handler);
    },
    click() {
      if (this._listeners.click) this._listeners.click.forEach(function (fn) { fn(); });
    },
    get offsetWidth() { return 100; },
  };
  return el;
}

function setupBindControlsContext(options) {
  const { context } = createViewportContext();
  const vp = context.window.LoveBudEditorCanvasViewport;
  const els = {};
  const counters = { rafCalls: 0, timeoutCalls: 0 };

  context.requestAnimationFrame = (cb) => { counters.rafCalls += 1; cb(); };
  context.setTimeout = (cb, ms) => { counters.timeoutCalls += 1; return 1; };
  context.document = {
    getElementById: (id) => els[id] || null,
    querySelector: (sel) => null,
  };

  return { vp, context, els, counters };
}

// ---------------------------------------------------------------------------
// bindControls
// ---------------------------------------------------------------------------
test('bindControls — binds controls once and schedules initial zoom indicator update', () => {
  const { vp, context, els, counters } = setupBindControlsContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };

  const focusBtn = createMockElement('focusSelectedBtn');
  const recenterBtn = createMockElement('recenterCanvasBtn');
  const zoomInBtn = createMockElement('zoomInCanvasBtn');
  const zoomOutBtn = createMockElement('zoomOutCanvasBtn');
  const canvasArea = createMockElement('canvasArea');
  const indicator = createMockElement('zoomIndicator');
  els.focusSelectedBtn = focusBtn;
  els.recenterCanvasBtn = recenterBtn;
  els.zoomInCanvasBtn = zoomInBtn;
  els.zoomOutCanvasBtn = zoomOutBtn;
  els.canvasArea = canvasArea;
  els.zoomIndicator = indicator;

  let focusCalls = 0;
  let recenterCalls = 0;
  let zoomCalls = 0;

  vp.bindControls({
    viewportState,
    focusNodeById: () => { focusCalls += 1; },
    recenterViewport: () => { recenterCalls += 1; },
    zoomBy: () => { zoomCalls += 1; },
  });

  assert.equal(viewportState.controlsBound, true);
  assert.equal(counters.rafCalls, 1);
  assert.equal(indicator.textContent, '100%');
  assert.equal(indicator.classList.contains('is-hidden'), false);
  assert.equal(focusCalls, 0);
  assert.equal(recenterCalls, 0);
  assert.equal(zoomCalls, 0);
});

test('bindControls — does not bind again when controlsBound is already true', () => {
  const { context } = createViewportContext();
  const vp = context.window.LoveBudEditorCanvasViewport;
  const viewportState = { scale: 1, controlsBound: true };

  // If bindControls tries to access DOM, it should throw because we didn't set up mocks
  vp.bindControls({
    viewportState,
    focusNodeById: () => { throw new Error('should not be called'); },
    recenterViewport: () => { throw new Error('should not be called'); },
    zoomBy: () => { throw new Error('should not be called'); },
  });

  // controlsBound stays true, no side effects
  assert.equal(viewportState.controlsBound, true);
});

test('bindControls — focus button calls focusNodeById for selected node', () => {
  const { vp, context, els } = setupBindControlsContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };

  const focusBtn = createMockElement('focusSelectedBtn');
  const canvasArea = createMockElement('canvasArea');
  els.focusSelectedBtn = focusBtn;
  els.canvasArea = canvasArea;

  // mock .memory-node.selected
  const selectedNode = { dataset: { memoryId: 'node-42' } };
  context.document.querySelector = (sel) => {
    if (sel === '.memory-node.selected') return selectedNode;
    return null;
  };

  let focusNodeId = '';

  vp.bindControls({
    viewportState,
    focusNodeById: (id) => { focusNodeId = id; },
    recenterViewport: () => {},
    zoomBy: () => {},
  });

  focusBtn.click();

  assert.equal(focusNodeId, 'node-42');
  assert.ok(canvasArea.classList.contains('focus-flash'));
  assert.ok(focusBtn.classList.contains('flash-feedback'));
});

test('bindControls — focus button skips focus when no selected node exists', () => {
  const { vp, context, els } = setupBindControlsContext();
  const viewportState = { scale: 1 };
  let focusCalls = 0;

  const focusBtn = createMockElement('focusSelectedBtn');
  els.focusSelectedBtn = focusBtn;

  // querySelector returns null for .memory-node.selected
  context.document.querySelector = () => null;

  vp.bindControls({
    viewportState,
    focusNodeById: () => { focusCalls += 1; },
    recenterViewport: () => {},
    zoomBy: () => {},
  });

  focusBtn.click();

  assert.equal(focusCalls, 0);
});

test('bindControls — recenter button calls recenterViewport and flashes canvas', () => {
  const { vp, context, els } = setupBindControlsContext();
  const viewportState = { scale: 1 };
  let recenterCalls = 0;

  const recenterBtn = createMockElement('recenterCanvasBtn');
  const canvasArea = createMockElement('canvasArea');
  els.recenterCanvasBtn = recenterBtn;
  els.canvasArea = canvasArea;

  vp.bindControls({
    viewportState,
    focusNodeById: () => {},
    recenterViewport: () => { recenterCalls += 1; },
    zoomBy: () => {},
  });

  recenterBtn.click();

  assert.equal(recenterCalls, 1);
  assert.ok(canvasArea.classList.contains('recenter-flash'));
  assert.ok(recenterBtn.classList.contains('flash-feedback'));
});

test('bindControls — zoom buttons call zoomBy and update indicator', () => {
  const { vp, context, els, counters } = setupBindControlsContext();
  const viewportState = { scale: 1, offsetX: 0, offsetY: 0 };
  let zoomFactors = [];

  const zoomInBtn = createMockElement('zoomInCanvasBtn');
  const zoomOutBtn = createMockElement('zoomOutCanvasBtn');
  const canvasArea = createMockElement('canvasArea');
  const indicator = createMockElement('zoomIndicator');
  els.zoomInCanvasBtn = zoomInBtn;
  els.zoomOutCanvasBtn = zoomOutBtn;
  els.canvasArea = canvasArea;
  els.zoomIndicator = indicator;

  vp.bindControls({
    viewportState,
    focusNodeById: () => {},
    recenterViewport: () => {},
    zoomBy: (factor) => { zoomFactors.push(factor); },
  });

  // indicator initialized to 100% from initial RAF
  assert.equal(indicator.textContent, '100%');

  zoomInBtn.click();
  assert.deepEqual(zoomFactors, [1.01]);
  assert.equal(indicator.textContent, '100%'); // scale=1, nearest=1
  assert.ok(canvasArea.classList.contains('zoom-pulse'));

  zoomOutBtn.click();
  assert.deepEqual(zoomFactors, [1.01, 0.99]);
  assert.ok(canvasArea.classList.contains('zoom-pulse'));
});

// ---------------------------------------------------------------------------
// bindControls — stopPropagation
// ---------------------------------------------------------------------------
test('bindControls — stopPropagation handlers prevent mouse event bubbling', () => {
  const { vp, els } = setupBindControlsContext();
  const viewportState = { scale: 1 };

  const focusBtn = createMockElement('focusSelectedBtn');
  const recenterBtn = createMockElement('recenterCanvasBtn');
  const zoomInBtn = createMockElement('zoomInCanvasBtn');
  const zoomOutBtn = createMockElement('zoomOutCanvasBtn');
  els.focusSelectedBtn = focusBtn;
  els.recenterCanvasBtn = recenterBtn;
  els.zoomInCanvasBtn = zoomInBtn;
  els.zoomOutCanvasBtn = zoomOutBtn;

  vp.bindControls({
    viewportState,
    focusNodeById: () => { throw new Error('should not be called'); },
    recenterViewport: () => { throw new Error('should not be called'); },
    zoomBy: () => { throw new Error('should not be called'); },
  });

  const buttons = [focusBtn, recenterBtn, zoomInBtn, zoomOutBtn];
  let stopCalls = 0;
  const event = { stopPropagation: () => { stopCalls += 1; } };

  buttons.forEach((btn) => {
    assert.ok(btn._listeners.mousedown, `mousedown listener missing on ${btn.id}`);
    assert.equal(btn._listeners.mousedown.length, 1);
    btn._listeners.mousedown[0](event);
  });

  assert.equal(stopCalls, 4);
});

test('bindControls — stopPropagation handlers prevent touch event bubbling', () => {
  const { vp, els } = setupBindControlsContext();
  const viewportState = { scale: 1 };

  const focusBtn = createMockElement('focusSelectedBtn');
  const recenterBtn = createMockElement('recenterCanvasBtn');
  const zoomInBtn = createMockElement('zoomInCanvasBtn');
  const zoomOutBtn = createMockElement('zoomOutCanvasBtn');
  els.focusSelectedBtn = focusBtn;
  els.recenterCanvasBtn = recenterBtn;
  els.zoomInCanvasBtn = zoomInBtn;
  els.zoomOutCanvasBtn = zoomOutBtn;

  vp.bindControls({
    viewportState,
    focusNodeById: () => { throw new Error('should not be called'); },
    recenterViewport: () => { throw new Error('should not be called'); },
    zoomBy: () => { throw new Error('should not be called'); },
  });

  const buttons = [focusBtn, recenterBtn, zoomInBtn, zoomOutBtn];
  let stopCalls = 0;
  const event = { stopPropagation: () => { stopCalls += 1; } };

  buttons.forEach((btn) => {
    assert.ok(btn._listeners.touchstart, `touchstart listener missing on ${btn.id}`);
    assert.equal(btn._listeners.touchstart.length, 1);
    btn._listeners.touchstart[0](event);
  });

  assert.equal(stopCalls, 4);
});

// ---------------------------------------------------------------------------
// viewport controls helper — namespace check
// ---------------------------------------------------------------------------
test('viewport controls helper — exposes LoveBudEditorCanvasViewportControls.bindControls', () => {
  const { context } = createViewportContext();
  assert.ok(context.window.LoveBudEditorCanvasViewportControls, 'namespace must exist');
  assert.equal(
    typeof context.window.LoveBudEditorCanvasViewportControls.bindControls,
    'function'
  );
  assert.equal(
    context.window.LoveBudEditorCanvasViewportControls.bindControls.length,
    2, // (viewportApi, options)
  );
});

// ---------------------------------------------------------------------------
// viewport actions helper — namespace check
// ---------------------------------------------------------------------------
test('viewport actions helper — exposes LoveBudEditorCanvasViewportActions methods', () => {
  const { context } = createViewportContext();
  const actions = context.window.LoveBudEditorCanvasViewportActions;
  assert.ok(actions, 'namespace must exist');
  assert.equal(typeof actions.focusNodeById, 'function');
  assert.equal(typeof actions.recenterViewport, 'function');
  assert.equal(typeof actions.zoomBy, 'function');
  assert.equal(actions.focusNodeById.length, 2); // (viewportApi, options)
  assert.equal(actions.recenterViewport.length, 2);
  assert.equal(actions.zoomBy.length, 2);
});

test('viewport actions helper — wrappers on LoveBudEditorCanvasViewport are preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.focusNodeById, 'function');
  assert.equal(typeof vp.recenterViewport, 'function');
  assert.equal(typeof vp.zoomBy, 'function');
});

// ---------------------------------------------------------------------------
// viewport branches helper — namespace check
// ---------------------------------------------------------------------------
test('viewport branches helper — exposes LoveBudEditorCanvasViewportBranches.drawBranch', () => {
  const { context } = createViewportContext();
  const branches = context.window.LoveBudEditorCanvasViewportBranches;
  assert.ok(branches, 'namespace must exist');
  assert.equal(typeof branches.drawBranch, 'function');
  assert.equal(branches.drawBranch.length, 3); // (svg, startPos, endPos)
});

test('viewport branches helper — wrapper on LoveBudEditorCanvasViewport.drawBranch is preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.drawBranch, 'function');
  assert.equal(vp.drawBranch.length, 3); // (svg, startPos, endPos)
});

// ---------------------------------------------------------------------------
// viewport fit helper — namespace check
// ---------------------------------------------------------------------------
test('viewport fit helper — exposes LoveBudEditorCanvasViewportFit methods', () => {
  const { context } = createViewportContext();
  const fit = context.window.LoveBudEditorCanvasViewportFit;
  assert.ok(fit, 'namespace must exist');
  assert.equal(typeof fit.getReadableViewportOffset, 'function');
  assert.equal(typeof fit.getFitViewport, 'function');
  assert.equal(fit.getReadableViewportOffset.length, 3); // (viewportApi, options, preferredScale)
  assert.equal(fit.getFitViewport.length, 2); // (viewportApi, options)
});

test('viewport fit helper — wrappers on LoveBudEditorCanvasViewport are preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.getReadableViewportOffset, 'function');
  assert.equal(vp.getReadableViewportOffset.length, 1); // (options) — preferredScale has default, not counted by Function.length
  assert.equal(typeof vp.getFitViewport, 'function');
  assert.equal(vp.getFitViewport.length, 1); // (options)
});

// ---------------------------------------------------------------------------
// viewport state helper — namespace check
// ---------------------------------------------------------------------------
test('viewport state helper — exposes LoveBudEditorCanvasViewportState methods', () => {
  const { context } = createViewportContext();
  const state = context.window.LoveBudEditorCanvasViewportState;
  assert.ok(state, 'namespace must exist');
  assert.equal(typeof state.isStoredViewportExtreme, 'function');
  assert.equal(typeof state.applyViewport, 'function');
  assert.equal(typeof state.isAlreadyAtFit, 'function');
  assert.equal(state.isStoredViewportExtreme.length, 2); // (viewportApi, options)
  assert.equal(state.applyViewport.length, 4); // (viewportApi, viewportState, nextViewport, useFitScale)
  assert.equal(state.isAlreadyAtFit.length, 3); // (viewportApi, viewportState, fitViewport)
});

test('viewport state helper — wrappers on LoveBudEditorCanvasViewport are preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.isStoredViewportExtreme, 'function');
  assert.equal(vp.isStoredViewportExtreme.length, 1); // (options)
  assert.equal(typeof vp.applyViewport, 'function');
  assert.equal(vp.applyViewport.length, 2); // (viewportState, nextViewport) — useFitScale has default
  assert.equal(typeof vp.isAlreadyAtFit, 'function');
  assert.equal(vp.isAlreadyAtFit.length, 2); // (viewportState, fitViewport)
});

// ---------------------------------------------------------------------------
// viewport feedback helper — namespace check
// ---------------------------------------------------------------------------
test('viewport feedback helper — exposes LoveBudEditorCanvasViewportFeedback.showAlreadyAtFitFeedback', () => {
  const { context } = createViewportContext();
  const feedback = context.window.LoveBudEditorCanvasViewportFeedback;
  assert.ok(feedback, 'namespace must exist');
  assert.equal(typeof feedback.showAlreadyAtFitFeedback, 'function');
  assert.equal(feedback.showAlreadyAtFitFeedback.length, 0);
});

test('viewport feedback helper — wrapper on LoveBudEditorCanvasViewport.showAlreadyAtFitFeedback is preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.showAlreadyAtFitFeedback, 'function');
  assert.equal(vp.showAlreadyAtFitFeedback.length, 0);
});

test('viewport feedback helper — original Korean string is preserved in source', () => {
  const source = fs.readFileSync(VIEWPORT_FEEDBACK_PATH, 'utf8');
  assert.match(source, /이미 전체 트리가 보이고 있습니다/, 'Korean toast must be literal, not unicode-escaped');
  assert.match(source, /'info'/, 'toast type must be info');
  assert.match(source, /2000/, 'toast duration must be 2000');
});

// ---------------------------------------------------------------------------
// viewport initial helper — namespace check
// ---------------------------------------------------------------------------
test('viewport initial helper — exposes LoveBudEditorCanvasViewportInitial.prepareInitialViewport', () => {
  const { context } = createViewportContext();
  const initial = context.window.LoveBudEditorCanvasViewportInitial;
  assert.ok(initial, 'namespace must exist');
  assert.equal(typeof initial.prepareInitialViewport, 'function');
  assert.equal(initial.prepareInitialViewport.length, 2); // (viewportApi, options)
});

test('viewport initial helper — wrapper on LoveBudEditorCanvasViewport.prepareInitialViewport is preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.prepareInitialViewport, 'function');
  assert.equal(vp.prepareInitialViewport.length, 1); // (options)
});

// ---------------------------------------------------------------------------
// viewport scale helper — namespace check
// ---------------------------------------------------------------------------
test('viewport scale helper — exposes LoveBudEditorCanvasViewportScale methods', () => {
  const { context } = createViewportContext();
  const scale = context.window.LoveBudEditorCanvasViewportScale;
  assert.ok(scale, 'namespace must exist');
  assert.equal(typeof scale.getNearestZoom, 'function');
  assert.equal(typeof scale.getFitZoom, 'function');
  assert.equal(typeof scale.getNextZoom, 'function');
  assert.equal(typeof scale.getScale, 'function');
  assert.equal(typeof scale.setScale, 'function');
  assert.equal(typeof scale.setFitScale, 'function');
  assert.equal(scale.getNearestZoom.length, 2); // (viewportApi, scale)
  assert.equal(scale.getFitZoom.length, 2); // (viewportApi, scale)
  assert.equal(scale.getNextZoom.length, 3); // (viewportApi, scale, direction)
  assert.equal(scale.getScale.length, 2); // (viewportApi, viewportState)
  assert.equal(scale.setScale.length, 3); // (viewportApi, viewportState, nextScale)
  assert.equal(scale.setFitScale.length, 3); // (viewportApi, viewportState, nextScale)
});

test('viewport scale helper — wrappers on LoveBudEditorCanvasViewport are preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.getNearestZoom, 'function');
  assert.equal(typeof vp.getFitZoom, 'function');
  assert.equal(typeof vp.getNextZoom, 'function');
  assert.equal(typeof vp.getScale, 'function');
  assert.equal(typeof vp.setScale, 'function');
  assert.equal(typeof vp.setFitScale, 'function');
  assert.equal(vp.getNearestZoom.length, 1);
  assert.equal(vp.getFitZoom.length, 1);
  assert.equal(vp.getNextZoom.length, 2);
  assert.equal(vp.getScale.length, 1);
  assert.equal(vp.setScale.length, 2);
  assert.equal(vp.setFitScale.length, 2);
});

// ---------------------------------------------------------------------------
// viewport projection helper — namespace check
// ---------------------------------------------------------------------------
test('viewport projection helper — exposes LoveBudEditorCanvasViewportProjection.projectWorldPosition', () => {
  const { context } = createViewportContext();
  const proj = context.window.LoveBudEditorCanvasViewportProjection;
  assert.ok(proj, 'namespace must exist');
  assert.equal(typeof proj.projectWorldPosition, 'function');
  assert.equal(proj.projectWorldPosition.length, 3); // (viewportApi, world, viewportState)
});

test('viewport projection helper — wrapper on LoveBudEditorCanvasViewport.projectWorldPosition is preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.projectWorldPosition, 'function');
  assert.equal(vp.projectWorldPosition.length, 2); // (world, viewportState)
});

test('viewport projection helper — check calculations and API delegation in source code', () => {
  const source = fs.readFileSync(VIEWPORT_PROJECTION_PATH, 'utf8');
  assert.match(source, /world\.x\s*\*\s*scale\s*\+\s*viewportState\.offsetX/, 'x projection calculation must match formula');
  assert.match(source, /world\.y\s*\*\s*scale\s*\+\s*viewportState\.offsetY/, 'y projection calculation must match formula');
  assert.match(source, /viewportApi\.getScale\(viewportState\)/, 'projection helper must call scale API');
});

// ---------------------------------------------------------------------------
// viewport targets helper — namespace check
// ---------------------------------------------------------------------------
test('viewport targets helper — exposes LoveBudEditorCanvasViewportTargets.getViewportTargets', () => {
  const { context } = createViewportContext();
  const targets = context.window.LoveBudEditorCanvasViewportTargets;
  assert.ok(targets, 'namespace must exist');
  assert.equal(typeof targets.getViewportTargets, 'function');
  assert.equal(targets.getViewportTargets.length, 2); // (viewportApi, options)
});

test('viewport targets helper — wrapper on LoveBudEditorCanvasViewport.getViewportTargets is preserved', () => {
  const { viewport: vp } = createViewportContext();
  assert.equal(typeof vp.getViewportTargets, 'function');
  assert.equal(vp.getViewportTargets.length, 1); // (options)
});

test('viewport targets helper — check delegation and guards in source code', () => {
  const source = fs.readFileSync(VIEWPORT_TARGETS_PATH, 'utf8');
  assert.match(source, /getTreeMemories\(\)/, 'targets helper must retrieve memories');
  assert.match(source, /typeof getCanonicalRootId\s*!==\s*['"]function['"]\s*\|\|\s*typeof isRootMemory\s*!==\s*['"]function['"]/, 'targets helper must guard root check functions');
  assert.match(source, /visibleNodes\.length/, 'targets helper must prioritize visible nodes');
});

// ---------------------------------------------------------------------------
// Stage 45 — Viewport Wrapper Contract Reinforcement
// ---------------------------------------------------------------------------

test('viewport constants contract — zoomLevels and boundaries', () => {
  const vp = createViewport();
  assert.equal(vp.minScale, 0.2, 'minScale must be 0.2');
  assert.equal(vp.maxScale, 1.5, 'maxScale must be 1.5');
  assert.equal(JSON.stringify(vp.zoomLevels), JSON.stringify([0.2, 0.35, 0.5, 0.75, 1, 1.25, 1.5]), 'zoomLevels must preserve exact preset array');
});

test('viewport constants contract — readableCenter configuration', () => {
  const vp = createViewport();
  assert.ok(vp.readableCenter, 'readableCenter must exist on viewport');
  assert.equal(vp.readableCenter.x, 0.5, 'readableCenter.x must be 0.5');
  assert.equal(vp.readableCenter.y, 0.42, 'readableCenter.y must be 0.42');
});

test('viewport wrapper fallback contract — missing namespaces fallbacks', () => {
  // Test fallback behavior by creating a context that ONLY loads editor-canvas-viewport.js
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(VIEWPORT_PATH, 'utf8'), context);
  const vp = context.window.LoveBudEditorCanvasViewport;

  // 1. Scale fallback
  assert.equal(vp.getNearestZoom(0.5), 1, 'getNearestZoom fallback must return 1');
  assert.equal(vp.getFitZoom(0.5), 1, 'getFitZoom fallback must return 1');
  assert.equal(vp.getNextZoom(0.5, 1), 1, 'getNextZoom fallback must delegate to fallback getNearestZoom → 1');
  assert.equal(vp.getScale({}), 1, 'getScale fallback must return 1');
  
  const dummyState1 = { scale: 0.5 };
  vp.setScale(dummyState1, 1.2);
  assert.equal(dummyState1.scale, 1, 'setScale fallback must reset scale to 1');

  const dummyState2 = { scale: 0.5 };
  vp.setFitScale(dummyState2, 1.2);
  assert.equal(dummyState2.scale, 1, 'setFitScale fallback must reset scale to 1');

  // 2. Projection fallback
  const world = { x: 100, y: 200 };
  const viewportState = { scale: 0.5, offsetX: 50, offsetY: 60 };
  // projectWorldPosition fallback formula: world.x * scale + offsetX
  // In the fallback context, getScale(viewportState) returns 1 (fallback value).
  // x: 100 * 1 + 50 = 150
  // y: 200 * 1 + 60 = 260
  const proj = vp.projectWorldPosition(world, viewportState);
  assert.equal(proj.x, 150, 'projectWorldPosition fallback must calculate x using inline formula');
  assert.equal(proj.y, 260, 'projectWorldPosition fallback must calculate y using inline formula');

  // 3. Targets fallback
  const options = {
    getTreeMemories: () => [{ id: 'm1' }, { id: 'm2' }]
  };
  const targets = vp.getViewportTargets(options);
  assert.equal(targets.length, 2, 'getViewportTargets fallback must return memories array length');
  assert.equal(targets[0].id, 'm1');
  assert.equal(targets[1].id, 'm2');

  // Other namespace missing checks do not crash and return false/empty
  assert.equal(vp.isStoredViewportExtreme({}), false);
  assert.equal(vp.applyViewport({}, {}), false);
  assert.equal(vp.isAlreadyAtFit({}, {}), false);
  assert.equal(vp.getReadableViewportOffset({}), null);
  
  const fit = vp.getFitViewport({});
  assert.equal(fit.scale, 1);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.offsetY, 0);
});

test('viewport wrapper arity contract — check signatures', () => {
  const vp = createViewport();
  assert.equal(vp.getNearestZoom.length, 1, 'getNearestZoom(scale)');
  assert.equal(vp.getFitZoom.length, 1, 'getFitZoom(scale)');
  assert.equal(vp.getNextZoom.length, 2, 'getNextZoom(scale, direction)');
  assert.equal(vp.getScale.length, 1, 'getScale(viewportState)');
  assert.equal(vp.setScale.length, 2, 'setScale(viewportState, nextScale)');
  assert.equal(vp.setFitScale.length, 2, 'setFitScale(viewportState, nextScale)');
  assert.equal(vp.projectWorldPosition.length, 2, 'projectWorldPosition(world, viewportState)');
  assert.equal(vp.getViewportTargets.length, 1, 'getViewportTargets(options)');
  assert.equal(vp.isStoredViewportExtreme.length, 1, 'isStoredViewportExtreme(options)');
  assert.equal(vp.applyViewport.length, 2, 'applyViewport(viewportState, nextViewport, useFitScale = false) has arity 2 due to default parameter');
  assert.equal(vp.isAlreadyAtFit.length, 2, 'isAlreadyAtFit(viewportState, fitViewport)');
  assert.equal(vp.getReadableViewportOffset.length, 1, 'getReadableViewportOffset(options, preferredScale = 1) has arity 1 due to default parameter');
  assert.equal(vp.getFitViewport.length, 1, 'getFitViewport(options)');
  assert.equal(vp.showAlreadyAtFitFeedback.length, 0, 'showAlreadyAtFitFeedback()');
  assert.equal(vp.prepareInitialViewport.length, 1, 'prepareInitialViewport(options)');
  assert.equal(vp.drawBranch.length, 3, 'drawBranch(svg, startPos, endPos)');
  assert.equal(vp.focusNodeById.length, 1, 'focusNodeById(options)');
  assert.equal(vp.recenterViewport.length, 1, 'recenterViewport(options)');
  assert.equal(vp.zoomBy.length, 1, 'zoomBy(options)');
  assert.equal(vp.bindControls.length, 1, 'bindControls(options)');
});

test('script order integrity contract — pages/editor.html script load order', () => {
  const editorHtmlPath = path.join(ROOT, 'pages/editor.html');
  const htmlContent = fs.readFileSync(editorHtmlPath, 'utf8');

  // Extract all editor-canvas-viewport scripts in order
  const matches = [...htmlContent.matchAll(/editor-canvas-(?:viewport|edges)[^"?]*/g)]
    .map(match => match[0])
    .filter(Boolean);

  const expectedOrder = [
    'editor-canvas-viewport.js',
    'editor-canvas-viewport-scale.js',
    'editor-canvas-viewport-projection.js',
    'editor-canvas-viewport-targets.js',
    'editor-canvas-viewport-feedback.js',
    'editor-canvas-viewport-state.js',
    'editor-canvas-viewport-fit.js',
    'editor-canvas-viewport-initial.js',
    'editor-canvas-viewport-branches.js',
    'editor-canvas-viewport-actions.js',
    'editor-canvas-viewport-controls.js',
    'editor-canvas-edges.js'
  ];

  assert.deepEqual(matches, expectedOrder, 'editor.html script order must match exactly');
});

