const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const NODE_HALF = 54;
const TIP_HALF = 18;
const TIP_SIZE = 36;

function loadGrowthAffordanceFactory() {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.createEditorCanvasGrowthAffordance;
}

function createGrowthAffordance({ width, height }) {
  const factory = loadGrowthAffordanceFactory();
  return factory({
    canvas: {
      clientWidth: width,
      clientHeight: height,
      querySelectorAll: () => [],
      classList: { add: () => {}, remove: () => {}, contains: () => false }
    },
    svg: {
      querySelectorAll: () => []
    },
    getMetrics: () => ({ width, height }),
    constants: {
      NODE_HALF,
      AFFORDANCE_CARD_HALF: 108
    }
  });
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function assertAffordanceClearsNode(position, anchorPos) {
  const affordanceRect = {
    left: position.x - TIP_HALF,
    right: position.x + TIP_HALF,
    top: position.y - (TIP_SIZE / 2),
    bottom: position.y + (TIP_SIZE / 2)
  };
  const nodeRect = {
    left: anchorPos.x - NODE_HALF,
    right: anchorPos.x + NODE_HALF,
    top: anchorPos.y - NODE_HALF,
    bottom: anchorPos.y + NODE_HALF
  };

  assert.equal(rectsOverlap(affordanceRect, nodeRect), false);
}

test('growth affordance stays clear of selected node on desktop side placements', () => {
  const growthAffordance = createGrowthAffordance({ width: 720, height: 520 });

  const rightPlacementAnchor = { x: 240, y: 250 };
  const rightPlacement = growthAffordance.getGrowthAffordancePosition(rightPlacementAnchor);
  assert.equal(rightPlacement.side, 'right');
  assertAffordanceClearsNode(rightPlacement, rightPlacementAnchor);

  const leftPlacementAnchor = { x: 610, y: 250 };
  const leftPlacement = growthAffordance.getGrowthAffordancePosition(leftPlacementAnchor);
  assert.equal(leftPlacement.side, 'left');
  assertAffordanceClearsNode(leftPlacement, leftPlacementAnchor);
});

test('growth affordance falls below or above the node on narrow mobile viewports', () => {
  const growthAffordance = createGrowthAffordance({ width: 375, height: 520 });
  const anchor = { x: 188, y: 210 };
  const position = growthAffordance.getGrowthAffordancePosition(anchor);

  assert.match(position.side, /^(below|above)$/);
  assert.ok(position.x - TIP_HALF >= TIP_HALF + 20);
  assert.ok(position.x + TIP_HALF <= 375 - TIP_HALF - 20);
  assertAffordanceClearsNode(position, anchor);
});

test('plus tip contract reflects readable hover bubble', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /TIP_SIZE\s*=\s*36/);
  assert.match(source, /BUBBLE_WIDTH\s*=\s*188/);
  assert.match(source, /BUBBLE_MIN_HEIGHT\s*=\s*60/);
  assert.match(source, /affordance-tooltip-bubble/);
  assert.match(source, /aria-expanded/);
});

test('node hover can move the plus tip before click selection', () => {
  const canvasSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas.js'), 'utf8');

  assert.match(canvasSource, /renderAffordanceForHoveredMemory/);
  assert.match(canvasSource, /addEventListener\('mouseenter'/);
  assert.match(canvasSource, /addEventListener\('focusin'/);
});

test('plus tip and bubble interaction locks node-hover movement', () => {
  const affordanceSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');
  const canvasSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas.js'), 'utf8');

  assert.match(affordanceSource, /affordance-interaction-locked/);
  assert.match(affordanceSource, /function\s+lockMovement\s*\(/);
  assert.match(affordanceSource, /function\s+unlockMovementSoon\s*\(/);
  assert.match(canvasSource, /AFFORDANCE_LOCK_CLASS/);
  assert.match(canvasSource, /canvas\.classList\.contains\(AFFORDANCE_LOCK_CLASS\)/);
});

test('start moment plus tip avoids connector line', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /function\s+isStartMoment\s*\(/);
  assert.match(source, /opts\.isFirstStep\s*===\s*true/);
  assert.match(source, /parentId === null \|\| parentId === undefined \|\| parentId === ''/);
  assert.match(source, /parentId === opts\.canonicalRootId/);
  assert.match(source, /shouldDrawConnector\s*=\s*!isStartMoment\(anchorMem, options\)/);
});

test('root-to-start tree branch line is suppressed', () => {
  const edgesSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-edges.js'), 'utf8');

  assert.match(edgesSource, /if \(parentId === canonicalRootId\)\s*{\s*return;\s*}/);
});

test('expanded bubble keeps plus icon center fixed', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /BUBBLE_PADDING_X\s*=\s*10/);
  assert.match(source, /PLUS_ICON_SIZE\s*=\s*32/);
  assert.match(source, /button\.style\.left = `\$\{tipPos\.x - BUBBLE_PADDING_X - \(PLUS_ICON_SIZE \/ 2\)\}px`/);
  assert.match(source, /button\.style\.top = `\$\{tipPos\.y - \(BUBBLE_MIN_HEIGHT \/ 2\)\}px`/);
  assert.match(source, /button\.style\.left = `\$\{tipPos\.x - TIP_HALF\}px`/);
  assert.match(source, /button\.style\.top = `\$\{tipPos\.y - TIP_HALF\}px`/);
});

test('canvas pan binding excludes add affordance presses', () => {
  const interactionSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-interaction.js'), 'utf8');

  assert.match(interactionSource, /memory-add-affordance/);
});
