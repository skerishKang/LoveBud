const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const NODE_HALF = 54;

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
    left: position.x - position.cardHalf,
    right: position.x + position.cardHalf,
    top: position.y - (position.height / 2),
    bottom: position.y + (position.height / 2)
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
  assert.ok(position.x - position.cardHalf >= 28);
  assert.ok(position.x + position.cardHalf <= 375 - 28);
  assertAffordanceClearsNode(position, anchor);
});

test('canvas pan binding excludes add affordance presses', () => {
  const interactionSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-interaction.js'), 'utf8');

  assert.match(interactionSource, /target\.closest\(['"]\.memory-add-affordance['"]\)/);
});
