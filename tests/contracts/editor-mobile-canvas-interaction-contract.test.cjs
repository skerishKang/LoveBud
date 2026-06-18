const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// ─── 1. structured mode pan block is documented and locatable ───────────────
test('editor-canvas-interaction structured mode pan block is present and locatable', () => {
  const src = read('js/editor/editor-canvas-interaction.js');
  assert.match(
    src,
    /layoutMode.*===.*'structured'.*return/s,
    'Structured mode pan block must remain locatable until the mobile pan fix PR removes or conditionalizes it'
  );
});

// ─── 2. panzoom module exposes zoom math helpers but no pinch gesture binding ─
test('editor-canvas-panzoom exposes zoom math helpers', () => {
  const src = read('js/editor/editor-canvas-panzoom.js');
  assert.match(src, /calculateZoomScale/, 'calculateZoomScale must be exported');
  assert.match(src, /zoomByFallback/, 'zoomByFallback must be exported');
  assert.doesNotMatch(
    src,
    /touchstart.*pinch|pinch.*touchstart|gesturechange|pinchStartDistance/s,
    'No pinch gesture handler exists yet in panzoom module — this gap is intentional until the fix PR'
  );
});

test('editor-canvas-interaction does not bind multi-touch pinch gesture yet', () => {
  const src = read('js/editor/editor-canvas-interaction.js');
  assert.doesNotMatch(
    src,
    /pinchStartDistance|touches\[0\].*touches\[1\]|gesturechange/s,
    'Pinch zoom is not implemented in interaction module yet — contract marks the gap for the fix PR'
  );
});

// ─── 3. touchAction:none is set on canvas (blocks native gestures) ────────────
test('editor-canvas-interaction sets touchAction none on canvas element', () => {
  const src = read('js/editor/editor-canvas-interaction.js');
  assert.match(
    src,
    /touchAction.*none|touch-action.*none/,
    'Canvas touch-action must be set to none — this disables native gestures and requires custom gesture handlers'
  );
});

// ─── 4. node selection binds both click and touchend ─────────────────────────
test('node pointer selection binds both click and touchend activation paths', () => {
  const src = read('js/editor/editor-canvas-ui-helpers.js');
  assert.match(src, /addEventListener\('click'/, 'node selection must bind click');
  assert.match(src, /addEventListener\('touchend'/, 'node selection must bind touchend');
  assert.match(
    src,
    /skipNextClick/,
    'touch selection must suppress duplicate synthesized click after touchend'
  );
});

// ─── 5. mobile bottom bar reads DOM class (not state event) ──────────────────
test('editor-mobile-bottom-bar state depends on .memory-node.selected class presence', () => {
  const src = read('js/editor/editor-mobile-bottom-bar.js');
  assert.match(
    src,
    /\.memory-node\.selected/,
    'Bottom bar must read .memory-node.selected to determine state — this DOM-class coupling is the documented gap'
  );
  assert.doesNotMatch(
    src,
    /selectedMemoryId|selectionState\.get|onSelectionChanged/,
    'Bottom bar does not yet use a state event source — this is the coupling gap to fix in a follow-up PR'
  );
});

// ─── 6. geometry fallback uses center column (overlap risk documented) ────────
test('structured layout fallback centers unresolved nodes at same x (overlap risk)', () => {
  const src = read('js/editor/editor-canvas-geometry.js');
  assert.match(
    src,
    /Math\.round\(metrics\.width \/ 2\)/,
    'Fallback position uses center x — multiple unresolved nodes share this column'
  );
  assert.doesNotMatch(
    src,
    /spreadUnresolvedSiblings|unresolvedOffset|deduplicateFallback/,
    'No spread guard exists yet — overlap risk is the documented gap for the fix PR'
  );
});

// ─── 7. viewport controls bind click only (no explicit touchend activation) ──
test('editor-canvas-viewport-controls binds click but not explicit touchend for zoom buttons', () => {
  const src = read('js/editor/editor-canvas-viewport-controls.js');
  assert.match(
    src,
    /addEventListener\('click'/,
    'viewport controls must bind click'
  );
  assert.doesNotMatch(
    src,
    /addEventListener\('touchend'.*zoomIn|addEventListener\('touchend'.*zoomOut/s,
    'viewport controls do not yet add explicit touchend for zoom buttons — relies on synthesized click'
  );
});

// ─── 8. audit doc exists ─────────────────────────────────────────────────────
test('mobile canvas editor viewer interaction audit document exists', () => {
  const auditPath = path.join(ROOT, 'docs/product/mobile-canvas-editor-viewer-interaction-audit.md');
  assert.ok(
    fs.existsSync(auditPath),
    'Audit document must exist at docs/product/mobile-canvas-editor-viewer-interaction-audit.md'
  );
  const content = fs.readFileSync(auditPath, 'utf8');
  assert.match(content, /structured mode/, 'Audit must document structured mode pan block');
  assert.match(content, /pinch/, 'Audit must document pinch zoom gap');
  assert.match(content, /back\/exit|back\/나가기|뒤로가기/, 'Audit must document back/exit gap');
  assert.match(content, /view.mode|view_mode/, 'Audit must document view mode UX model');
  assert.match(content, /edit.mode|edit_mode/, 'Audit must document edit mode UX model');
});
