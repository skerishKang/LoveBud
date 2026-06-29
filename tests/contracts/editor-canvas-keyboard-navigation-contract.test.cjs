const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('canvas keyboard navigation reuses current tree order and existing selection handler', () => {
  const source = read('js/editor/editor-canvas.js');

  assert.match(source, /const orderedMemories = getTreeMemories\(\)\.filter\(function \(memory\) \{[\s\S]*!isRootMemory\(memory, canonicalRootId\)/m, 'keyboard navigation must reuse current tree memory order and skip root placeholders');
  assert.match(source, /const currentIndex = orderedMemories\.findIndex\(function \(memory\) \{[\s\S]*memory\.id === mem\.id/m, 'keyboard navigation must resolve the current node inside the existing tree order');
  assert.match(source, /const nextIndex = currentIndex \+ offset;/, 'keyboard navigation must move by deterministic previous/next offsets');
  assert.match(source, /if \(nextIndex < 0 \|\| nextIndex >= orderedMemories\.length\) return;/, 'keyboard navigation must no-op at root-child-leaf boundaries');
  assert.match(source, /const nextNodeEl = selectionUtils\.findMemoryNodeById\(nextMemory\.id\);/, 'keyboard navigation must resolve the next rendered node by memory id');
  assert.match(source, /onNodeClick\(nextNodeEl, nextMemory\);/, 'keyboard navigation must reuse the existing node selection handler');
  assert.match(source, /nextNodeEl\.focus\(\);/, 'keyboard navigation must restore focus to the newly selected node');
});

test('canvas keyboard navigation guards inputs, dialogs, floating toolbar, read-only, and mobile', () => {
  const source = read('js/editor/editor-canvas.js');

  assert.match(source, /if \(canEdit === false\) return false;/, 'read-only mode must not trigger keyboard navigation');
  assert.match(source, /window\.matchMedia && window\.matchMedia\('\(max-width: 768px\)'\)\.matches/, 'mobile mode must not trigger keyboard navigation');
  assert.match(source, /input, textarea, select, \[contenteditable="true"\], \[contenteditable=""\], \[contenteditable\]/, 'inputs and contenteditable surfaces must be excluded');
  assert.match(source, /#addMemoryForm, \.editor-memory-form-modal, \.editor-floating-toolbar, \.editor-ftb-dropdown, \[role="dialog"\], \.detail-panel/, 'dialogs, forms, and floating toolbar surfaces must be excluded');
  assert.match(source, /if \(!target \|\| !target\.closest \|\| !target\.closest\('\.memory-node'\)\) return false;/, 'keyboard navigation must stay inside memory-node ownership');
});

test('node control shortcuts preserve Enter/Space and add Arrow navigation only', () => {
  const source = read('js/editor/editor-canvas-ui-helpers.js');

  assert.match(source, /if \(\s*\(e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowUp' \|\| e\.key === 'ArrowRight' \|\| e\.key === 'ArrowDown'\)/, 'node control shortcuts must listen for arrow navigation keys');
  assert.match(source, /const offset = \(e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowUp'\) \? -1 : 1;/, 'ArrowLeft\/ArrowUp must map to previous and ArrowRight\/ArrowDown to next');
  assert.match(source, /if \(e\.key !== 'Enter' && e\.key !== ' '\) return;/, 'Enter and Space behavior must remain intact');
});

test('memory node focus-visible styling exists for keyboard-selected moments', () => {
  const css = read('css/editor/editor-memory-node.css');

  assert.match(css, /\.memory-node:focus-visible \.node-card\s*\{[\s\S]*outline: 2px solid/m, 'memory nodes must expose a visible keyboard focus treatment');
});
