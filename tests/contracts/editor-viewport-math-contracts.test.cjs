const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const VIEWPORT_PATH = path.join(ROOT, 'js/editor/editor-canvas-viewport.js');

/**
 * Creates a fresh instance of the viewport module in a sandboxed context.
 * DOM-dependent and RAF-dependent methods are loaded but not tested.
 */
function createViewport() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(VIEWPORT_PATH, 'utf8'), context);
  return context.window.LoveBudEditorCanvasViewport;
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

  assert.deepEqual(result, []);
});

test('getViewportTargets — missing root helpers returns all memories', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }, { id: 'child' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: undefined,
    isRootMemory: undefined,
  });

  assert.deepEqual(result, memories);
});

test('getViewportTargets — returns visible non-root nodes before canonical root', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }, { id: 'child-1' }, { id: 'child-2' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: () => 'root',
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
  });

  assert.deepEqual(result, [{ id: 'child-1' }, { id: 'child-2' }]);
});

test('getViewportTargets — falls back to canonical root when no visible nodes exist', () => {
  const vp = createViewport();
  const memories = [{ id: 'root' }];

  const result = vp.getViewportTargets({
    getTreeMemories: () => memories,
    getCanonicalRootId: () => 'root',
    isRootMemory: (memory, canonicalRootId) => memory.id === canonicalRootId,
  });

  assert.deepEqual(result, [{ id: 'root' }]);
});
