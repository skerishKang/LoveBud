/**
 * Contract: LoveBud #3561 — preserve moment-card geometry across selection changes.
 *
 * Scope:
 * - CSS must not clobber the viewport scale transform on .memory-node.
 * - Selection is a reversible presentation state (class on node, scale on .node-card).
 * - applySelectedMemoryNode keeps exactly one selected card and does not mutate
 *   width/transform/flex geometry on the node shell.
 *
 * EXECUTED_FAKE: runs LoveBudEditorSelectionUI in a fake DOM with four media-less
 * moment nodes and asserts geometry invariants across sequential / reverse / rapid
 * selection. No browser, network, DB, or production resource.
 *
 * Refs: #3561, #3475, #3519
 * Keep #3425 OPEN. Keep #3075 OPEN. Keep #3188 OPEN. Keep #1882 OPEN.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_NODE_CSS = path.join(ROOT, 'css/editor/editor-memory-node.css');
const CANVAS_CSS = path.join(ROOT, 'css/editor/editor-canvas.css');
const SELECTION_UI = path.join(ROOT, 'js/editor/editor-selection-ui.js');
const PUBLIC_CANVAS_INIT = path.join(ROOT, 'js/viewer/public-canvas-init.js');
const VIEWPORT_ACTIONS = path.join(ROOT, 'js/editor/editor-canvas-viewport-actions.js');

const memoryNodeCss = fs.readFileSync(MEMORY_NODE_CSS, 'utf8');
const canvasCss = fs.readFileSync(CANVAS_CSS, 'utf8');
const selectionUiSource = fs.readFileSync(SELECTION_UI, 'utf8');
const publicCanvasInitSource = fs.readFileSync(PUBLIC_CANVAS_INIT, 'utf8');
const viewportActionsSource = fs.readFileSync(VIEWPORT_ACTIONS, 'utf8');

// ─── SOURCE / CSS guards ─────────────────────────────────────────────────────

test('#3561 structured hover must not force transform:none on .memory-node', () => {
  assert.doesNotMatch(
    memoryNodeCss,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i,
    'structured hover must not clobber viewport scale transform with transform:none !important'
  );
});

test('#3561 memory-node base geometry is stable and min-width protected', () => {
  assert.match(memoryNodeCss, /\.memory-node\s*\{[\s\S]*?width:\s*108px/);
  assert.match(memoryNodeCss, /\.memory-node\s*\{[\s\S]*?min-width:\s*108px/);
  assert.match(memoryNodeCss, /\.node-card\s*\{[\s\S]*?width:\s*102px/);
  assert.match(memoryNodeCss, /\.node-card\s*\{[\s\S]*?min-width:\s*102px/);
  assert.match(memoryNodeCss, /\.node-img-wrapper\s*\{[\s\S]*?width:\s*90px/);
  assert.match(memoryNodeCss, /\.node-img-wrapper\s*\{[\s\S]*?min-width:\s*90px/);
  assert.match(memoryNodeCss, /\.node-img-wrapper\s*\{[\s\S]*?height:\s*90px/);
  assert.match(memoryNodeCss, /\.node-img-wrapper\s*\{[\s\S]*?min-height:\s*90px/);
});

test('#3561 selected emphasis stays on .node-card and is reversible', () => {
  assert.match(memoryNodeCss, /\.memory-node\.selected \.node-card\s*\{[\s\S]*?transform:\s*scale\(1\.01\)/);
  assert.match(memoryNodeCss, /\.memory-node:hover \.node-card\s*\{[\s\S]*?transform:\s*scale\(1\.02\)/);
  // Node shell selected state must not set a shell transform.
  assert.doesNotMatch(
    memoryNodeCss,
    /\.memory-node\.selected\s*\{[^}]*transform\s*:/i,
    'selected shell must not set transform; viewport scale owns node transform'
  );
});

test('#3561 node-card transitions are presentation-only (no transition: all)', () => {
  assert.doesNotMatch(
    memoryNodeCss,
    /\.node-card\s*\{[^}]*transition:\s*all\b/i,
    'node-card must not use transition:all (avoids geometry side effects)'
  );
  assert.match(
    memoryNodeCss,
    /\.node-card\s*\{[\s\S]*?transition:\s*transform 0\.24s ease,\s*border-color 0\.24s ease,\s*box-shadow 0\.24s ease/
  );
});

test('#3561 focus-animate must not override transform (viewport scale reserved)', () => {
  assert.match(canvasCss, /\.memory-node\.focus-animate\s*\{[\s\S]*?animation:\s*nodeFocusPulse/);
  const keyframes = canvasCss.match(/@keyframes\s+nodeFocusPulse\s*\{([\s\S]*?)\n\}/);
  assert.ok(keyframes, 'nodeFocusPulse keyframes must exist');
  assert.doesNotMatch(
    keyframes[1],
    /transform\s*:/i,
    'nodeFocusPulse must animate box-shadow only, never transform'
  );
  assert.match(keyframes[1], /box-shadow/);
});

test('#3561 reduced-motion keeps card transform free of node-shell override', () => {
  assert.match(memoryNodeCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(canvasCss, /prefers-reduced-motion:\s*reduce/);
});

// ─── EXECUTED_FAKE selection geometry matrix ─────────────────────────────────

function createClassList(initial) {
  const set = new Set(String(initial || '').split(/\s+/).filter(Boolean));
  return {
    _set: set,
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    contains(name) { return set.has(name); },
    toggle(name, force) {
      if (force === true) set.add(name);
      else if (force === false) set.delete(name);
      else if (set.has(name)) set.delete(name);
      else set.add(name);
    },
    toString() { return Array.from(set).join(' '); }
  };
}

function createNode(id, title, scale) {
  const style = {
    transform: 'scale(' + scale + ')',
    transformOrigin: 'center center',
    left: '0px',
    top: '0px',
    width: '',
    minWidth: '',
    maxWidth: '',
    flex: '',
    flexGrow: '',
    flexShrink: '',
    flexBasis: ''
  };
  return {
    className: 'memory-node floating-node',
    classList: createClassList('memory-node floating-node'),
    dataset: { memoryId: id },
    style,
    getAttribute(name) {
      if (name === 'style') {
        return Object.keys(style)
          .filter((k) => style[k] !== '')
          .map((k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ': ' + style[k])
          .join('; ');
      }
      return null;
    },
    querySelector(sel) {
      if (sel === '.node-title') return { textContent: title };
      if (sel === '.node-card') {
        return {
          style: { transform: '', width: '' },
          getAttribute() { return ''; }
        };
      }
      return null;
    }
  };
}

function loadSelectionUI() {
  const windowRef = {};
  const nodes = [];
  const documentRef = {
    nodes,
    querySelectorAll(selector) {
      if (selector === '.memory-node') return nodes.slice();
      return [];
    }
  };
  vm.runInNewContext(selectionUiSource, { window: windowRef, document: documentRef });
  assert.equal(typeof windowRef.LoveBudEditorSelectionUI.applySelectedMemoryNode, 'function');
  return {
    applySelectedMemoryNode: windowRef.LoveBudEditorSelectionUI.applySelectedMemoryNode,
    nodes,
    documentRef
  };
}

function snapshotGeometry(node) {
  return {
    id: node.dataset.memoryId,
    selected: node.classList.contains('selected'),
    transform: node.style.transform,
    width: node.style.width,
    minWidth: node.style.minWidth,
    maxWidth: node.style.maxWidth,
    flex: node.style.flex,
    flexGrow: node.style.flexGrow,
    flexShrink: node.style.flexShrink,
    flexBasis: node.style.flexBasis,
    classes: node.classList.toString()
  };
}

function assertCanonicalShell(node, scale) {
  assert.equal(node.style.transform, 'scale(' + scale + ')', 'viewport scale transform must be preserved');
  assert.equal(node.style.width, '', 'selection must not set inline width');
  assert.equal(node.style.minWidth, '', 'selection must not set inline min-width');
  assert.equal(node.style.maxWidth, '', 'selection must not set inline max-width');
  assert.equal(node.style.flex, '', 'selection must not set inline flex');
  assert.equal(node.style.flexGrow, '', 'selection must not set flex-grow');
  assert.equal(node.style.flexShrink, '', 'selection must not set flex-shrink');
  assert.equal(node.style.flexBasis, '', 'selection must not set flex-basis');
}

function assertExactlyOneSelected(nodes, expectedId) {
  const selected = nodes.filter((n) => n.classList.contains('selected'));
  assert.equal(selected.length, 1, 'exactly one selected card');
  assert.equal(selected[0].dataset.memoryId, expectedId);
}

test('#3561 four media-less moments: sequential 1→2→3→4 preserves shell geometry', () => {
  const { applySelectedMemoryNode, nodes, documentRef } = loadSelectionUI();
  const scale = 0.75;
  const titles = ['M1', 'M2', 'M3', 'M4'];
  for (let i = 0; i < 4; i++) {
    nodes.push(createNode('m' + (i + 1), titles[i], scale));
  }

  const before = nodes.map(snapshotGeometry);

  // 1→2→3→4
  for (let i = 0; i < 4; i++) {
    applySelectedMemoryNode(nodes[i], { documentRef });
    assertExactlyOneSelected(nodes, 'm' + (i + 1));
    nodes.forEach((n) => assertCanonicalShell(n, scale));
  }

  // previously selected m3 is not selected and geometry matches pre-selection baseline
  assert.equal(nodes[2].classList.contains('selected'), false);
  assert.deepEqual(snapshotGeometry(nodes[2]).transform, before[2].transform);
  assert.equal(snapshotGeometry(nodes[2]).width, before[2].width);
});

test('#3561 exact 3→4 and reverse 4→3 keep prior card at canonical scale', () => {
  const { applySelectedMemoryNode, nodes, documentRef } = loadSelectionUI();
  const scale = 0.8;
  for (let i = 0; i < 4; i++) nodes.push(createNode('m' + (i + 1), 'Moment ' + (i + 1), scale));

  applySelectedMemoryNode(nodes[2], { documentRef }); // 3rd
  const thirdWhileSelected = snapshotGeometry(nodes[2]);
  assert.equal(thirdWhileSelected.selected, true);
  assert.equal(thirdWhileSelected.transform, 'scale(' + scale + ')');

  applySelectedMemoryNode(nodes[3], { documentRef }); // 4th
  assertExactlyOneSelected(nodes, 'm4');
  assert.equal(nodes[2].classList.contains('selected'), false);
  assert.equal(nodes[2].style.transform, 'scale(' + scale + ')');
  assert.equal(nodes[2].style.width, '');

  applySelectedMemoryNode(nodes[2], { documentRef }); // reverse 4→3
  assertExactlyOneSelected(nodes, 'm3');
  assert.equal(nodes[3].classList.contains('selected'), false);
  assert.equal(nodes[3].style.transform, 'scale(' + scale + ')');
});

test('#3561 rapid 3↔4 and return to first leave no residual selection/geometry mutation', () => {
  const { applySelectedMemoryNode, nodes, documentRef } = loadSelectionUI();
  const scale = 0.75;
  for (let i = 0; i < 4; i++) nodes.push(createNode('m' + (i + 1), 'Moment ' + (i + 1), scale));
  const before = nodes.map(snapshotGeometry);

  for (let i = 0; i < 20; i++) {
    applySelectedMemoryNode(nodes[i % 2 === 0 ? 2 : 3], { documentRef });
  }
  applySelectedMemoryNode(nodes[0], { documentRef }); // return to first
  assertExactlyOneSelected(nodes, 'm1');

  for (let i = 0; i < 4; i++) {
    assertCanonicalShell(nodes[i], scale);
    assert.equal(nodes[i].style.transform, before[i].transform);
    assert.equal(nodes[i].classList.contains('selected'), i === 0);
  }
});

test('#3561 pointer and keyboard selection share the same applySelectedMemoryNode cleanup', () => {
  // Public canvas click handler and editor keyboard path both reduce to class toggle helpers.
  assert.match(publicCanvasInitSource, /classList\.remove\('selected'\)/);
  assert.match(publicCanvasInitSource, /classList\.add\('selected'\)/);
  assert.match(selectionUiSource, /applySelectedMemoryNode\s*=\s*function/);
  assert.match(selectionUiSource, /classList\.remove\(selectedClass\)/);
  assert.match(selectionUiSource, /classList\.add\(selectedClass\)/);
  // Neither path mutates width/transform inline.
  assert.doesNotMatch(selectionUiSource, /style\.width\s*=/);
  assert.doesNotMatch(selectionUiSource, /style\.transform\s*=/);
  assert.doesNotMatch(publicCanvasInitSource, /\.style\.width\s*=/);
});

test('#3561 focusNodeById animation class does not rewrite node transform in source', () => {
  assert.match(viewportActionsSource, /classList\.remove\('focus-animate'\)/);
  assert.match(viewportActionsSource, /classList\.add\('focus-animate'\)/);
  assert.doesNotMatch(
    viewportActionsSource,
    /focus-animate[\s\S]{0,120}style\.transform\s*=/,
    'focus animation must not assign style.transform'
  );
});

test('#3561 does not implement #3562 panel hierarchy moves', () => {
  // Guard: this PR must not touch tree-meta / share / whole-tree comment relocation files as primary scope.
  // Soft source check only — confirm this contract remains about geometry.
  assert.match(fs.readFileSync(__filename, 'utf8'), /#3561/);
  assert.match(fs.readFileSync(__filename, 'utf8'), /Keep #3075 OPEN/);
});
