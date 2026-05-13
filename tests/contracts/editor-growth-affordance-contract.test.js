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
      querySelectorAll: () => []
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

test('plus tip expands into original bubble style on hover and focus', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /TIP_SIZE\s*=\s*36/, 'default visible affordance should remain a compact plus tip');
  assert.match(source, /BUBBLE_WIDTH\s*=\s*190/, 'expanded bubble width should be defined separately from the plus tip');
  assert.match(source, /affordance-tooltip-bubble/, 'hover state should render a bubble-style tooltip element');
  assert.match(source, /linear-gradient\(180deg, rgba\(255,255,255,0\.98\), rgba\(250,246,244,0\.96\)\)/, 'expanded state should use the original light bubble surface');
  assert.match(source, /button\.addEventListener\('mouseenter', showBubble\)/, 'mouse hover should expand the bubble');
  assert.match(source, /button\.addEventListener\('focus', showBubble\)/, 'keyboard focus should expand the bubble');
  assert.match(source, /button\.addEventListener\('touchstart', showBubble/, 'touch should expose the bubble before activation');
  assert.match(source, /aria-expanded', 'true'/, 'expanded bubble state should update aria visibility');
});

test('canvas pan binding excludes add affordance presses', () => {
  const interactionSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-interaction.js'), 'utf8');

  assert.match(interactionSource, /target\.closest\(['"]\.memory-add-affordance['"]\)/);
});
