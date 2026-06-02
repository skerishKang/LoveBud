const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const TRANSITION_PATH = path.join(ROOT, 'js/editor/editor-canvas-layout-transition.js');
const transitionSource = fs.readFileSync(TRANSITION_PATH, 'utf8');

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createTransitionRuntime() {
  const classCalls = [];
  const context = {
    window: {},
    document: {
      body: {
        classList: {
          add(name) { classCalls.push(`class:add:${name}`); },
          remove(name) { classCalls.push(`class:remove:${name}`); }
        }
      },
      getElementById() { return null; }
    }
  };
  vm.createContext(context);
  vm.runInContext(transitionSource, context);
  return {
    transition: context.window.LoveBudEditorCanvasLayoutTransition,
    classCalls
  };
}

function createSwitcherHarness(options = {}) {
  const { transition, classCalls } = createTransitionRuntime();
  const calls = [];
  let savedFreePositions = options.savedFreePositions || null;
  let storedFreePositions = options.storedFreePositions || null;
  const viewportState = {
    layoutMode: options.layoutMode || 'structured',
    initialViewportApplied: true,
    positions: { ...(options.positions || {}) }
  };

  const switcher = transition.createLayoutModeSwitcher({
    viewportState,
    loadStoredLayout: () => {
      calls.push('loadStoredLayout');
      return options.loadedLayout || { positions: {} };
    },
    persistLayoutMode: (mode) => { calls.push(`persistLayoutMode:${mode}`); },
    persistStoredPositions: () => { calls.push('persistStoredPositions'); },
    fitViewportToTree: () => { calls.push('fitViewportToTree'); },
    initCanvas: () => { calls.push('initCanvas'); },
    updateLayoutToggleUI: () => { calls.push('updateLayoutToggleUI'); },
    getSavedFreePositions: () => {
      calls.push('getSavedFreePositions');
      return savedFreePositions;
    },
    setSavedFreePositions: (value) => {
      calls.push(value === null ? 'setSavedFreePositions:null' : 'setSavedFreePositions:positions');
      savedFreePositions = value;
    },
    getStoredFreePositions: () => {
      calls.push('getStoredFreePositions');
      return storedFreePositions;
    },
    setStoredFreePositions: (value) => {
      calls.push('setStoredFreePositions');
      storedFreePositions = value;
    }
  });

  return {
    calls,
    classCalls,
    switcher,
    transition,
    viewportState,
    getSavedFreePositions: () => savedFreePositions,
    getStoredFreePositions: () => storedFreePositions
  };
}

test('canvas layout transition runtime — createLayoutModeSwitcher returns expected API', () => {
  const { switcher, transition } = createSwitcherHarness();

  assert.equal(typeof transition.createLayoutModeSwitcher, 'function');
  assert.equal(typeof switcher.switchToFreeMode, 'function');
  assert.equal(typeof switcher.switchToStructuredMode, 'function');
  assert.equal(typeof switcher.setLayoutMode, 'function');
  assert.equal(typeof switcher.toggleLayoutMode, 'function');
});

test('canvas layout transition runtime — switchToFreeMode preserves order and restores saved positions', () => {
  const harness = createSwitcherHarness({
    positions: { current: { x: 1, y: 2 } },
    savedFreePositions: { saved: { x: 11, y: 22 } }
  });

  harness.switcher.switchToFreeMode();

  assert.equal(harness.viewportState.layoutMode, 'free');
  assert.equal(harness.viewportState.initialViewportApplied, false);
  assert.deepEqual(toPlain(harness.viewportState.positions), { saved: { x: 11, y: 22 } });
  assert.equal(harness.getSavedFreePositions(), null);
  assert.deepEqual(harness.calls, [
    'persistLayoutMode:free',
    'getSavedFreePositions',
    'setSavedFreePositions:null',
    'getStoredFreePositions',
    'fitViewportToTree',
    'updateLayoutToggleUI',
    'initCanvas',
    'persistStoredPositions'
  ]);
  assert.deepEqual(harness.classCalls, [
    'class:remove:layout-structured',
    'class:add:layout-free'
  ]);
});

test('canvas layout transition runtime — switchToFreeMode falls back to stored then loaded positions', () => {
  const storedHarness = createSwitcherHarness({
    positions: {},
    storedFreePositions: { stored: { x: 3, y: 4 } }
  });

  storedHarness.switcher.switchToFreeMode();

  assert.deepEqual(toPlain(storedHarness.viewportState.positions), { stored: { x: 3, y: 4 } });
  assert.doesNotMatch(storedHarness.calls.join('|'), /loadStoredLayout/);

  const loadedHarness = createSwitcherHarness({
    positions: {},
    loadedLayout: { positions: { loaded: { x: 5, y: 6 } } }
  });

  loadedHarness.switcher.switchToFreeMode();

  assert.deepEqual(toPlain(loadedHarness.viewportState.positions), { loaded: { x: 5, y: 6 } });
  assert.match(loadedHarness.calls.join('|'), /loadStoredLayout/);
});

test('canvas layout transition runtime — switchToStructuredMode preserves order and saves free positions', () => {
  const harness = createSwitcherHarness({
    layoutMode: 'free',
    positions: { free: { x: 7, y: 8 } }
  });

  harness.switcher.switchToStructuredMode();

  assert.equal(harness.viewportState.layoutMode, 'structured');
  assert.equal(harness.viewportState.initialViewportApplied, false);
  assert.deepEqual(toPlain(harness.getSavedFreePositions()), { free: { x: 7, y: 8 } });
  assert.deepEqual(harness.calls, [
    'setSavedFreePositions:positions',
    'persistLayoutMode:structured',
    'fitViewportToTree',
    'updateLayoutToggleUI',
    'initCanvas'
  ]);
  assert.deepEqual(harness.classCalls, [
    'class:remove:layout-free',
    'class:add:layout-structured'
  ]);
});

test('canvas layout transition runtime — setLayoutMode and toggleLayoutMode route correctly', () => {
  const setStructuredHarness = createSwitcherHarness({ layoutMode: 'free' });
  setStructuredHarness.switcher.setLayoutMode('structured');
  assert.equal(setStructuredHarness.viewportState.layoutMode, 'structured');
  assert.match(setStructuredHarness.calls.join('|'), /persistLayoutMode:structured/);

  const setFreeHarness = createSwitcherHarness({ layoutMode: 'structured' });
  setFreeHarness.switcher.setLayoutMode('free');
  assert.equal(setFreeHarness.viewportState.layoutMode, 'free');
  assert.match(setFreeHarness.calls.join('|'), /persistLayoutMode:free/);

  const toggleToFreeHarness = createSwitcherHarness({ layoutMode: 'structured' });
  toggleToFreeHarness.switcher.toggleLayoutMode();
  assert.equal(toggleToFreeHarness.viewportState.layoutMode, 'free');

  const toggleToStructuredHarness = createSwitcherHarness({ layoutMode: 'free' });
  toggleToStructuredHarness.switcher.toggleLayoutMode();
  assert.equal(toggleToStructuredHarness.viewportState.layoutMode, 'structured');
});
