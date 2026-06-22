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
  assert.match(canvasSource, /bindNodeHoverAffordance/);
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

test('canvas pan binding excludes add affordance presses', () => {
  const interactionSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-interaction.js'), 'utf8');

  assert.match(interactionSource, /memory-add-affordance/);
});

test('start moment detection suppresses connector line', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /function\s+isStartMoment\s*\(/);
  assert.match(source, /anchorMem\.parentId\s*===\s*null/);
  assert.match(source, /anchorMem\.parentId\s*===\s*undefined/);
  assert.match(source, /options\s*&&\s*\(?\s*options\.isStartMoment/);
  assert.match(source, /shouldDrawConnector/);
  assert.match(source, /if\s*\([^)]*shouldDrawConnector[^)]*\)/);
  assert.match(source, /drawConnectorLine\s*\(/);
});

test('growth affordance keeps connector for non-start memories', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /const\s+shouldDrawConnector\s*=\s*!isStartMoment/);
  assert.match(source, /if\s*\([^)]*shouldDrawConnector[^)]*\)/);
  assert.match(source, /drawConnectorLine\s*\(/);
});

test('isStartMoment handles missing options gracefully', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  assert.match(source, /if\s*\([^)]*options\s*&&\s*\([^)]*options\.isStartMoment[^)]*\)/);
});

// ── CSS class-toggle contract (Issue #2806) ──────────────────────────────────
// PR #2818 hypothesis: the bubble expand/collapse must be driven by adding /
// removing a CSS class rather than directly mutating inline style properties.
// Follow-up hypothesis: textWrap must also start as max-width: 0 (not 126px)
// with a transition-delay so the button width transition grows first.

test('showBubble adds affordance-expanded class instead of mutating inline styles', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  // showBubble must use classList.add
  assert.match(source, /classList\.add\s*\(\s*['"]affordance-expanded['"]\s*\)/);
  // showBubble must NOT set inline width/borderRadius/background on expand
  const showBubbleSectionMatch = source.match(/function\s+showBubble\s*\(\s*\)([\s\S]*?)function\s+hideBubble/);
  assert.ok(showBubbleSectionMatch, 'showBubble function must exist before hideBubble');
  const showBubbleBody = showBubbleSectionMatch[1];
  assert.doesNotMatch(showBubbleBody, /button\.style\.width\s*=/);
  assert.doesNotMatch(showBubbleBody, /button\.style\.borderRadius\s*=/);
  assert.doesNotMatch(showBubbleBody, /button\.style\.background\s*=/);
});

test('hideBubble removes affordance-expanded class instead of mutating inline styles', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  // hideBubble must use classList.remove
  assert.match(source, /classList\.remove\s*\(\s*['"]affordance-expanded['"]\s*\)/);
  // hideBubble must NOT reset inline width/background/borderRadius on collapse
  const hideBubbleSectionMatch = source.match(/function\s+hideBubble\s*\(\s*\)([\s\S]*?)button\.addEventListener\s*\(\s*['"]mouseenter['"]/);
  assert.ok(hideBubbleSectionMatch, 'hideBubble function must exist before event listeners');
  const hideBubbleBody = hideBubbleSectionMatch[1];
  assert.doesNotMatch(hideBubbleBody, /button\.style\.width\s*=/);
  assert.doesNotMatch(hideBubbleBody, /button\.style\.background\s*=/);
});

test('textWrap visibility is not driven by display:none in JS', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  // The affordance-tip-text span must NOT have display toggled via JS.
  // Visibility is now handled by CSS (opacity + visibility + max-width transition).
  assert.doesNotMatch(source, /textWrap\.style\.display\s*=/);
});

test('affordance-expanded CSS class is defined in editor-canvas-affordance.css', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  assert.match(cssSource, /\.affordance-expanded/);
  assert.match(cssSource, /\.memory-add-affordance/);
  assert.match(cssSource, /\.affordance-tip-text/);
  // Visibility must be managed via opacity/visibility, not display
  assert.match(cssSource, /opacity\s*:/);
  assert.match(cssSource, /visibility\s*:/);
  assert.doesNotMatch(cssSource, /\.affordance-expanded\s+\.affordance-tip-text\s*\{[^}]*display\s*:\s*flex/);
});

test('editor.css imports editor-canvas-affordance.css', () => {
  const editorCss = fs.readFileSync(path.join(ROOT, 'css/editor.css'), 'utf8');

  assert.match(editorCss, /editor-canvas-affordance\.css/);
});

// ── #2806 follow-up: textWrap collapsed state + transition-delay ────────────

test('textWrap collapsed state is max-width 0, opacity 0, visibility hidden (#2806 follow-up)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  // Extract the .affordance-tip-text rule (collapsed default state).
  const tipRule = (cssSource.match(/\.affordance-tip-text\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(tipRule.length > 0, '.affordance-tip-text rule must exist');
  assert.match(tipRule, /max-width\s*:\s*0/,
    'collapsed textWrap must start at max-width: 0 (NOT 126px) so it does not force a 126x~64 vertical-rectangle intermediate state during button growth');
  assert.match(tipRule, /opacity\s*:\s*0/,
    'collapsed textWrap must start at opacity: 0');
  assert.match(tipRule, /visibility\s*:\s*hidden/,
    'collapsed textWrap must start at visibility: hidden');
});

test('textWrap expanded state uses max-width 126px with a transition-delay (#2806 follow-up)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  // Extract the .memory-add-affordance.affordance-expanded .affordance-tip-text rule.
  const expandedTipRule = (cssSource.match(/\.memory-add-affordance\.affordance-expanded\s+\.affordance-tip-text\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(expandedTipRule.length > 0, 'expanded textWrap rule must exist');
  assert.match(expandedTipRule, /max-width\s*:\s*126px/,
    'expanded textWrap must be 126px wide');
  assert.match(expandedTipRule, /opacity\s*:\s*1/,
    'expanded textWrap must be fully visible');
  assert.match(expandedTipRule, /visibility\s*:\s*visible/);

  // transition must include a delay (button width grows first)
  const collapsedTipRule = (cssSource.match(/\.affordance-tip-text\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.match(collapsedTipRule, /transition[^{}]*var\(--affordance-text-delay\)/,
    'textWrap transition must use --affordance-text-delay so the text fades in after the button width transition starts');
});

test('editor-i18n-refresh.js no longer carries the inline !important bubble rules (#2806 follow-up)', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'js/editor/editor-i18n-refresh.js'), 'utf8'
  );

  // The inline !important forced-collapsed rules are now owned by the
  // editor-canvas-affordance.css file under
  // body.editor-view-hide-bubbles .memory-add-affordance.affordance-tooltip-bubble.
  // Verify the inline string is gone from the JS so the cascade order is stable.
  assert.doesNotMatch(source, /editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\s*\{[^}]*width\s*:\s*36px\s*!important/,
    'inline !important forced-collapsed rules must be removed from editor-i18n-refresh.js');
});

test('is-interacting class is toggled in lockMovement and unlockMovementSoon (#2806 follow-up)', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js'), 'utf8');

  // Check classList calls directly on the source string. Avoid regex-parsing
  // function bodies (nested setTimeout callbacks break simple capture groups).
  assert.match(source, /classList\.add\s*\(\s*INTERACTING_CLASS\s*\)/,
    'lockMovement must add INTERACTING_CLASS');
  assert.match(source, /classList\.remove\s*\(\s*INTERACTING_CLASS\s*\)/,
    'unlockMovementSoon must remove INTERACTING_CLASS');
  assert.match(source, /classList\.add\s*\(\s*LOCK_CLASS\s*\)/,
    'lockMovement must also add the canvas-level LOCK_CLASS');
  assert.match(source, /classList\.remove\s*\(\s*LOCK_CLASS\s*\)/,
    'unlockMovementSoon must also remove the canvas-level LOCK_CLASS');

  // And the CSS must style it.
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );
  assert.match(cssSource, /\.memory-add-affordance\.is-interacting/,
    'is-interacting rule must be present in the affordance CSS');
});