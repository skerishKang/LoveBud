const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Editor Canvas Selected Flow Emphasis Contract', async (t) => {
  const edgesJs = read('js/editor/editor-canvas-edges.js');
  const canvasJs = read('js/editor/editor-canvas.js');
  const shellCanvasUiJs = read('js/editor/editor-shell-canvas-ui.js');
  const css = read('css/editor/editor-canvas.css');

  // 1. drawBranchForMemory sets both parent and child metadata
  await t.test('drawBranchForMemory sets data-edge-parent-id and data-edge-child-id', () => {
    assert.ok(edgesJs.includes("data-edge-parent-id', String(parent.id)"),
      'drawBranchForMemory must set data-edge-parent-id metadata');
    assert.ok(edgesJs.includes("data-edge-child-id', String(node.id)"),
      'drawBranchForMemory must set data-edge-child-id metadata');
  });

  // 2. highlightSelectedFlow cleans up before applying
  await t.test('highlightSelectedFlow removes flow classes first', () => {
    assert.ok(edgesJs.includes("classList.remove('is-flow-related', 'is-flow-outbound', 'is-flow-inbound')"),
      'highlightSelectedFlow must remove flow classes before applying');
  });

  // 3. highlightSelectedFlow identifies inbound/outbound edges
  await t.test('highlightSelectedFlow distinguishes inbound and outbound edges', () => {
    assert.ok(edgesJs.includes("classList.add('is-flow-related')"),
      'highlightSelectedFlow must add is-flow-related class');
    assert.ok(edgesJs.includes("classList.add('is-flow-outbound')"),
      'highlightSelectedFlow must add is-flow-outbound class');
    assert.ok(edgesJs.includes("classList.add('is-flow-inbound')"),
      'highlightSelectedFlow must add is-flow-inbound class');
  });

  // 4. Preview edges are NOT targeted by flow emphasis
  await t.test('highlightSelectedFlow targets .branch-line only, not preview edges', () => {
    // The method queries .branch-line specifically (not a broad selector)
    const highlightCall = edgesJs.match(/function highlightSelectedFlow[\s\S]*?(?=function|$)/);
    assert.ok(highlightCall, 'highlightSelectedFlow function must exist');
    const fnBody = highlightCall[0];
    // It queries .branch-line (not .branch-line-preview)
    assert.ok(fnBody.includes("svg.querySelectorAll('.branch-line')"),
      'highlightSelectedFlow must query .branch-line only');
    // .branch-line-preview edges should not get flow classes - they have no parent/child metadata
    assert.ok(!fnBody.includes('branch-line-preview'),
      'highlightSelectedFlow must not reference .branch-line-preview');
  });

  // 5. Public API exposes highlightSelectedFlow
  await t.test('editor-canvas-edges.js exposes highlightSelectedFlow in return API', () => {
    assert.ok(edgesJs.includes('highlightSelectedFlow'),
      'edges module must expose highlightSelectedFlow');
  });

  await t.test('editor-canvas.js exposes highlightSelectedFlow in return API', () => {
    assert.ok(canvasJs.includes('highlightSelectedFlow'),
      'editor-canvas.js must expose highlightSelectedFlow in return object');
  });

  // 6. Initial render applies flow highlight
  await t.test('initCanvas calls highlightSelectedFlow after reapplySelection', () => {
    assert.ok(canvasJs.includes('highlightSelectedFlow(selectedMem.id)'),
      'initCanvas must call highlightSelectedFlow with selected memory id');
  });

  // 7. createEditorSelectNodeHandler calls highlightSelectedFlow
  await t.test('createEditorSelectNodeHandler calls highlightSelectedFlow when available', () => {
    assert.ok(shellCanvasUiJs.includes('editorCanvas.highlightSelectedFlow'),
      'selectNode handler must call highlightSelectedFlow');
    assert.ok(shellCanvasUiJs.includes("editorCanvas.highlightSelectedFlow(data.id)"),
      'highlightSelectedFlow must be called with data.id');
  });

  // 8. CSS baseline / flow / selected hierarchy exists
  await t.test('CSS defines baseline .branch-line', () => {
    assert.ok(css.includes('.branch-line'),
      'CSS must define .branch-line');
    assert.ok(css.includes('transition'),
      'CSS .branch-line must have transition');
  });

  await t.test('CSS defines .branch-line.is-flow-related', () => {
    assert.ok(css.includes('.branch-line.is-flow-related'),
      'CSS must define .branch-line.is-flow-related');
    assert.ok(css.includes('stroke: var(--primary)'),
      'CSS is-flow-related must use primary color');
    assert.ok(css.includes('opacity: 0.8'),
      'CSS is-flow-related must have higher opacity');
  });

  await t.test('CSS defines is-flow-inbound and is-flow-outbound hook classes', () => {
    assert.ok(css.includes('.branch-line.is-flow-inbound'),
      'CSS must define .branch-line.is-flow-inbound');
    assert.ok(css.includes('.branch-line.is-flow-outbound'),
      'CSS must define .branch-line.is-flow-outbound');
  });

  await t.test('CSS .branch-line.is-selected has strongest visual weight', () => {
    assert.ok(css.includes('.branch-line.is-selected'),
      'CSS must define .branch-line.is-selected');
    assert.ok(css.includes('stroke-width: 3.5'),
      'CSS is-selected must have widest stroke');
    assert.ok(css.includes('opacity: 0.85'),
      'CSS is-selected must have highest opacity');
  });

  // 9. No persistence, graph route, API, DB, or auth changes
  await t.test('No persistence, graph route, API, DB, or auth changes', () => {
    const forbidden = ['localStorage', 'fetch(', 'api/', 'firebase', 'postgres'];
    const allFiles = [edgesJs, canvasJs, shellCanvasUiJs];
    for (const file of allFiles) {
      for (const pattern of forbidden) {
        assert.ok(!file.toLowerCase().includes(pattern),
          `File must not contain "${pattern}"`);
      }
    }
  });
});
