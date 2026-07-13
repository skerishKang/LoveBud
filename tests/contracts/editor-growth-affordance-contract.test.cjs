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

test('textWrap is always in its final visible state (#2806 stable render)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  const tipRule = (cssSource.match(/\.affordance-tip-text\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(tipRule.length > 0, '.affordance-tip-text rule must exist');
  assert.match(tipRule, /max-width\s*:\s*126px/,
    'textWrap must have its final max-width from the start');
  assert.match(tipRule, /opacity\s*:\s*1/,
    'textWrap must be fully visible from the start');
  assert.match(tipRule, /visibility\s*:\s*visible/,
    'textWrap must be visible from the start');
});

test('textWrap does not depend on affordance-expanded for visibility (#2806 stable render)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  // TextWrap is always visible; there is no collapsed/expanded split.
  const tipRule = (cssSource.match(/\.affordance-tip-text\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(tipRule.length > 0, '.affordance-tip-text rule must exist');
  assert.match(tipRule, /opacity\s*:\s*1/,
    'textWrap must be fully visible regardless of affordance-expanded');
  assert.match(tipRule, /max-width\s*:\s*126px/,
    'textWrap must have final max-width regardless of affordance-expanded');

  // The CTA button itself changes transform/box-shadow on hover (no size change).
  const buttonRule = (cssSource.match(/\.memory-add-affordance\.affordance-expanded\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(buttonRule.length > 0, '.memory-add-affordance.affordance-expanded rule must exist');
  assert.match(buttonRule, /transform/,
    'affordance-expanded must set transform for hover feedback');
  assert.doesNotMatch(buttonRule, /width\s*:/,
    'affordance-expanded must not change width');
  assert.doesNotMatch(buttonRule, /height\s*:/,
    'affordance-expanded must not change height');
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

// ── Left rail summary typography contract (Commit C) ────────────────────────
// Tree title is rendered by #sidebarTreeTitle in 1.42rem. The summary line
// below it must NOT duplicate a heading-style title — it should be small
// prose, with only count / timeRange emphasised.

const I18N_EDITOR_FILE = path.join(ROOT, 'js/i18n/i18n-editor.js');
const SIDEBAR_BOUNDARY_FILE = path.join(ROOT, 'js/editor/editor-detail-sidebar-status-boundary.js');
const I18N_REFRESH_FILE = path.join(ROOT, 'js/editor/editor-i18n-refresh.js');
const STATUS_CARD_CSS_FILE = path.join(ROOT, 'css/editor/editor-status-settings/status-card.css');

function extractSummaryKey(source, key) {
  const pattern = new RegExp(
    "'" + key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') +
    "':\\{ko:'((?:[^'\\\\]|\\\\.)*)',en:'((?:[^'\\\\]|\\\\.)*)'\\}"
  );
  const m = source.match(pattern);
  if (!m) return null;
  return { ko: m[1], en: m[2] };
}

test('i18n key sidebar_flow_summary_connected mirrors My Trees hub summary verbatim', () => {
  // Source of truth: js/my-trees/my-trees-preview-state.js patchSummaryWithTimeRange
  // and js/my-trees/my-trees-preview-hub.js els.summary.innerHTML pattern.
  const source = fs.readFileSync(I18N_EDITOR_FILE, 'utf8');
  const key = extractSummaryKey(source, 'sidebar_flow_summary_connected');
  assert.ok(key, 'i18n key sidebar_flow_summary_connected must exist');
  assert.match(key.ko, /<p\s+class="preview-summary-line">/,
    'ko template must wrap summary in <p class="preview-summary-line"> (My Trees hub pattern); got: ' + key.ko);
  assert.match(key.en, /<p\s+class="preview-summary-line">/,
    'en template must wrap summary in <p class="preview-summary-line"> (My Trees hub pattern); got: ' + key.en);
  // <strong> around {title}, {count}, and (for the with_range variant) {timeRange}.
  assert.match(key.ko, /<strong>\s*\{title\}\s*<\/strong>/,
    'ko template must wrap {title} in <strong> (matches hub pattern); got: ' + key.ko);
  assert.match(key.en, /<strong>\s*\{title\}\s*<\/strong>/,
    'en template must wrap {title} in <strong> (matches hub pattern); got: ' + key.en);
  assert.match(key.ko, /<strong>\s*\{count\}개의\s*순간\s*<\/strong>/,
    'ko template must wrap {count}개의 순간 in <strong>');
  assert.match(key.en, /<strong>\s*\{count\}\s*moments\s*<\/strong>/,
    'en template must wrap {count} moments in <strong>');
});

test('i18n key sidebar_flow_summary_connected_with_range mirrors My Trees hub summary verbatim', () => {
  const source = fs.readFileSync(I18N_EDITOR_FILE, 'utf8');
  const key = extractSummaryKey(source, 'sidebar_flow_summary_connected_with_range');
  assert.ok(key, 'i18n key sidebar_flow_summary_connected_with_range must exist');
  assert.match(key.ko, /<p\s+class="preview-summary-line">/,
    'ko template must wrap summary in <p class="preview-summary-line"> (My Trees hub pattern); got: ' + key.ko);
  assert.match(key.en, /<p\s+class="preview-summary-line">/,
    'en template must wrap summary in <p class="preview-summary-line"> (My Trees hub pattern); got: ' + key.en);
  assert.match(key.ko, /<strong>\s*\{title\}\s*<\/strong>/);
  assert.match(key.en, /<strong>\s*\{title\}\s*<\/strong>/);
  assert.match(key.ko, /<strong>\s*\{count\}개의\s*순간\s*<\/strong>/);
  assert.match(key.ko, /<strong>\s*\{timeRange\}\s*<\/strong>/,
    'ko template must wrap {timeRange} in <strong>');
  assert.match(key.en, /<strong>\s*\{count\}\s*moments\s*<\/strong>/);
  assert.match(key.en, /<strong>\s*\{timeRange\}\s*<\/strong>/,
    'en template must wrap {timeRange} in <strong>');
});

test('editor-detail-sidebar-status-boundary.js summary uses the shared preview-summary-line pattern without duplicating the tree title', () => {
  const source = fs.readFileSync(SIDEBAR_BOUNDARY_FILE, 'utf8');
  assert.match(source, /<p\s+class="preview-summary-line">/,
    'fallback template must wrap summary in <p class="preview-summary-line"> (My Trees hub pattern)');
  // The editor renders the tree title separately in #sidebarTreeTitle, so the
  // summary intentionally leads with the title-less "이 트리에 담긴" copy instead
  // of duplicating the heading-style title (main ec4d7a03c).
  assert.match(source, /이 트리에 담긴/,
    'fallback template must lead with the title-less "이 트리에 담긴" summary copy');
  assert.doesNotMatch(source, /<strong>\s*\{title\}\s*<\/strong>/,
    'summary must NOT duplicate the heading-style tree title (rendered separately in #sidebarTreeTitle)');
  assert.match(source, /<strong>\s*\{count\}개의\s*순간\s*<\/strong>/);
  assert.match(source, /<strong>\s*\{timeRange\}\s*<\/strong>/);
});

test('editor-i18n-refresh.js must NOT carry summary renderer (#2970)', () => {
  const source = fs.readFileSync(I18N_REFRESH_FILE, 'utf8');
  assert.doesNotMatch(source, /sidebarFlowSummary/,
    'editor-i18n-refresh.js must not reference sidebarFlowSummary directly');
  assert.doesNotMatch(source, /<p\s+class="preview-summary-line">/,
    'editor-i18n-refresh.js must not contain summary HTML template');
});

test('editor summary shares the My Trees hub count/timeRange emphasis while leading with a title-less summary', () => {
  // The editor summary shares the My Trees hub count→timeRange emphasis
  // structure, but intentionally leads with the title-less "이 트리에 담긴"
  // copy because the tree title is rendered separately in #sidebarTreeTitle
  // (main ec4d7a03c). The head is therefore no longer a verbatim hub mirror.
  const hubSource = fs.readFileSync(
    path.join(ROOT, 'js/my-trees/my-trees-preview-state.js'), 'utf8'
  );
  // My Trees template uses string concatenation. Extract the static
  // segments before / after the runtime values (title, count, timeRange).
  const hubMatch = hubSource.match(
    /summaryEl\.innerHTML\s*=\s*'([^']+)'\s*\+\s*escapeHtml\(summaryTitle\)\s*\+\s*'([^']+)'\s*\+\s*memoryCount\s*\+\s*'([^']+)'\s*\+\s*escapeHtml\(timeRange\)\s*\+\s*'([^']+)'/
  );
  assert.ok(hubMatch, 'My Trees patchSummaryWithTimeRange template must exist');
  const hubMid2 = hubMatch[3]; // "개의 순간</strong>이 <strong>" — count → timeRange emphasis
  const hubTail = hubMatch[4]; // "</strong>에 걸쳐 이어졌어요.</p>" — closing prose

  const editorBoundary = fs.readFileSync(SIDEBAR_BOUNDARY_FILE, 'utf8');
  assert.ok(
    editorBoundary.indexOf(hubMid2) !== -1,
    'editor must share the My Trees hub count→timeRange emphasis; hubMid2=' + hubMid2
  );
  assert.ok(
    editorBoundary.indexOf(hubTail) !== -1,
    'editor must share the My Trees hub closing prose; hubTail=' + hubTail
  );
  assert.match(
    editorBoundary,
    /<p class="preview-summary-line">이 트리에 담긴 <strong>/,
    'editor summary must lead with the title-less "이 트리에 담긴" copy'
  );
});

test('.editor-flow-summary rule sets explicit small-prose font-size (not title-sized)', () => {
  const source = fs.readFileSync(STATUS_CARD_CSS_FILE, 'utf8');
  const block = (source.match(/\.editor-flow-summary\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(block.length > 0, '.editor-flow-summary rule must exist');
  assert.match(block, /font-size\s*:\s*13\.5px/,
    '.editor-flow-summary must be 13.5px (small prose) — must NOT inherit the 1.42rem title size from .editor-status-card strong');
  assert.match(block, /line-height\s*:\s*1\.55/,
    '.editor-flow-summary line-height must be 1.55 (prose rhythm)');
  assert.match(block, /color\s*:\s*var\(--on-surface-variant\)/);
});

test('.editor-flow-summary strong overrides .editor-status-card strong (1.42rem) with prose sizing', () => {
  const source = fs.readFileSync(STATUS_CARD_CSS_FILE, 'utf8');
  const block = (source.match(/\.editor-flow-summary\s+strong\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(block.length > 0, '.editor-flow-summary strong rule must exist');
  assert.match(block, /font-size\s*:\s*13\.5px/,
    '.editor-flow-summary strong must be 13.5px — must NOT inherit 1.42rem from .editor-status-card strong');
  assert.match(block, /display\s*:\s*inline/,
    '.editor-flow-summary strong must be inline — parent .editor-status-card strong sets display:block which would break the summary sentence');
  assert.match(block, /font-weight\s*:\s*700/,
    'count / timeRange emphasis should be 700 weight');
  assert.doesNotMatch(block, /font-size\s*:\s*1\.\d+rem/,
    '.editor-flow-summary strong must not use rem-based title sizing');
});

// ── #2856: bubbles-off compact CTA contract ──────────────────────────────────

test('bubbles-off selector does not hide the entire CTA (no display:none on .affordance-tooltip-bubble)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  // The selector body.editor-view-hide-bubbles .memory-add-affordance.affordance-tooltip-bubble
  // must NOT set display: none on the CTA button itself.
  const hideBubblesRule = (
    cssSource.match(
      /body\.editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\s*\{([^}]*)\}/
    ) || ['', '']
  )[1];

  assert.ok(hideBubblesRule.length > 0,
    'bubbles-off override rule for .affordance-tooltip-bubble must exist');
  assert.doesNotMatch(hideBubblesRule, /display\s*:\s*none/,
    'bubbles-off must NOT hide the entire CTA with display:none');
  assert.doesNotMatch(hideBubblesRule, /pointer-events\s*:\s*none/,
    'bubbles-off must NOT disable pointer-events on the CTA');
});

test('bubbles-off selector preserves compact circle dimensions (36px)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  const hideBubblesRule = (
    cssSource.match(
      /body\.editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\s*\{([^}]*)\}/
    ) || ['', '']
  )[1];

  assert.match(hideBubblesRule, /width\s*:\s*36px/,
    'bubbles-off must enforce width: 36px on the CTA');
  assert.match(hideBubblesRule, /min-width\s*:\s*36px/,
    'bubbles-off must enforce min-width: 36px on the CTA');
  assert.match(hideBubblesRule, /height\s*:\s*36px/,
    'bubbles-off must enforce height: 36px on the CTA');
  assert.match(hideBubblesRule, /min-height\s*:\s*36px/,
    'bubbles-off must enforce min-height: 36px on the CTA');
});

test('bubbles-off selector preserves circle appearance (border-radius 50%, padding 0, justify-content center)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  const hideBubblesRule = (
    cssSource.match(
      /body\.editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\s*\{([^}]*)\}/
    ) || ['', '']
  )[1];

  assert.match(hideBubblesRule, /border-radius\s*:\s*50%/,
    'bubbles-off must enforce border-radius: 50% for circular CTA');
  assert.match(hideBubblesRule, /padding\s*:\s*0/,
    'bubbles-off must enforce padding: 0 on the CTA');
  assert.match(hideBubblesRule, /justify-content\s*:\s*center/,
    'bubbles-off must enforce justify-content: center to center the + icon');
});

test('bubbles-off hides only .affordance-tip-text via display:none', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  const textHideRule = (
    cssSource.match(
      /body\.editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\s+\.affordance-tip-text\s*\{([^}]*)\}/
    ) || ['', '']
  )[1];

  assert.ok(textHideRule.length > 0,
    'bubbles-off rule for .affordance-tip-text must exist');
  assert.match(textHideRule, /display\s*:\s*none/,
    'bubbles-off must hide .affordance-tip-text with display:none');
});

test('bubbles-off preserves compact CTA on hover (affordance-expanded does not expand)', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  const hoverRule = (
    cssSource.match(
      /body\.editor-view-hide-bubbles\s+\.memory-add-affordance\.affordance-tooltip-bubble\.affordance-expanded\s*\{([^}]*)\}/
    ) || ['', '']
  )[1];

  assert.ok(hoverRule.length > 0,
    'bubbles-off hover override for .affordance-expanded must exist');
  // Dimensions must stay compact on hover
  assert.match(hoverRule, /width\s*:\s*36px/,
    'bubbles-off hover must keep width: 36px');
  assert.match(hoverRule, /height\s*:\s*36px/,
    'bubbles-off hover must keep height: 36px');
  assert.match(hoverRule, /border-radius\s*:\s*50%/,
    'bubbles-off hover must keep border-radius: 50%');
  // Only transform/shadow feedback allowed
  assert.match(hoverRule, /transform/,
    'bubbles-off hover must use transform for feedback');
  assert.doesNotMatch(hoverRule, /width\s*:\s*188px/,
    'bubbles-off hover must NOT expand to bubble width');
  assert.doesNotMatch(hoverRule, /height\s*:\s*60px/,
    'bubbles-off hover must NOT expand to bubble height');
  assert.doesNotMatch(hoverRule, /padding\s*:\s*10px/,
    'bubbles-off hover must NOT restore bubble padding');
});

test('final pill default state and opacity/transform-only transition contract maintained', () => {
  const cssSource = fs.readFileSync(
    path.join(ROOT, 'css/editor/editor-canvas-affordance.css'), 'utf8'
  );

  // Base button rule (final pill form)
  const baseRule = (cssSource.match(/\.memory-add-affordance\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(baseRule.length > 0, '.memory-add-affordance base rule must exist');
  assert.match(baseRule, /width\s*:\s*var\(--affordance-bubble-width/,
    'base CTA must use final bubble width from CSS variable');
  assert.match(baseRule, /height\s*:\s*var\(--affordance-bubble-min-height/,
    'base CTA must use final bubble height from CSS variable');
  assert.match(baseRule, /border-radius\s*:\s*999px/,
    'base CTA must have pill border-radius');
  assert.match(baseRule, /transition\s*:[^;]*\bopacity\b/,
    'base CTA must transition opacity');
  assert.match(baseRule, /transition\s*:[^;]*\btransform\b/,
    'base CTA must transition transform');
  // Transition must NOT include width/height/padding/min-width/min-height
  const transitionDecl = baseRule.match(/transition\s*:\s*([^;]+)/);
  assert.ok(transitionDecl, 'transition declaration must exist');
  const transitionValue = transitionDecl[1];
  assert.doesNotMatch(transitionValue, /\bwidth\b/,
    'transition must not include width');
  assert.doesNotMatch(transitionValue, /\bheight\b/,
    'transition must not include height');
  assert.doesNotMatch(transitionValue, /\bpadding\b/,
    'transition must not include padding');
  assert.doesNotMatch(transitionValue, /\bmin-width\b/,
    'transition must not include min-width');
  assert.doesNotMatch(transitionValue, /\bmin-height\b/,
    'transition must not include min-height');
});