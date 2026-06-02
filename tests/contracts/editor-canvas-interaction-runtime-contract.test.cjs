const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const INTERACTION_PATH = path.join(ROOT, 'js/editor/editor-canvas-interaction.js');
const interactionSource = fs.readFileSync(INTERACTION_PATH, 'utf8');

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createClassList() {
  const classes = new Set();
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    contains(name) { return classes.has(name); },
    values() { return Array.from(classes); }
  };
}

function createMockElement(options = {}) {
  const listeners = {};
  const classList = createClassList();
  const element = {
    dataset: {},
    style: {},
    classList,
    listeners,
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    dispatch(type, event = {}) {
      (listeners[type] || []).forEach((handler) => handler(event));
    },
    closest(selector) {
      return options.closest && options.closest(selector) ? {} : null;
    }
  };
  return element;
}

function createPointerEvent(overrides = {}) {
  return {
    clientX: 0,
    clientY: 0,
    pointerType: 'mouse',
    button: 0,
    target: createMockElement(),
    preventDefault() {},
    stopPropagation() {},
    ...overrides
  };
}

function createInteractionRuntime() {
  const windowListeners = {};
  const context = {
    window: {
      addEventListener(type, handler) {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(handler);
      }
    },
    cancelAnimationFrame() {}
  };
  vm.createContext(context);
  vm.runInContext(interactionSource, context);
  return {
    context,
    interaction: context.window.LoveBudEditorCanvasInteraction,
    windowListeners
  };
}

function createBindHarness(options = {}) {
  const { interaction, windowListeners } = createInteractionRuntime();
  const canvas = createMockElement();
  const draggedElement = createMockElement();
  const calls = [];
  const viewportState = {
    layoutMode: options.layoutMode || 'free',
    scale: options.scale || 1,
    offsetX: options.offsetX || 0,
    offsetY: options.offsetY || 0,
    startX: 0,
    startY: 0,
    positions: {},
    ...(options.viewportState || {})
  };

  interaction.bind({
    canvas,
    viewportState,
    scheduleRender: () => { calls.push('scheduleRender'); },
    persistStoredPositions: () => { calls.push('persistStoredPositions'); },
    initCanvas: () => { calls.push('initCanvas'); },
    getWorldPosition: (memory) => ({ x: memory.x || 0, y: memory.y || 0 }),
    getDragTargetElement: (id) => {
      calls.push(`getDragTargetElement:${id}`);
      return options.draggedElement === null ? null : draggedElement;
    },
    showMovedToast: () => { calls.push('showMovedToast'); }
  });

  return {
    calls,
    canvas,
    draggedElement,
    interaction,
    viewportState,
    windowListeners
  };
}

function dispatchWindow(harness, type, event = {}) {
  (harness.windowListeners[type] || []).forEach((handler) => handler(event));
}

test('editor canvas interaction runtime — exposes expected API', () => {
  const { interaction } = createInteractionRuntime();

  assert.equal(typeof interaction.bind, 'function');
  assert.equal(typeof interaction.beginNodeDrag, 'function');
});

test('editor canvas interaction runtime — beginNodeDrag guards structured and read-only states', () => {
  const { interaction } = createInteractionRuntime();
  const nodeEl = createMockElement();
  const memory = { id: 'node-1' };
  const getWorldPosition = () => ({ x: 10, y: 20 });

  assert.equal(interaction.beginNodeDrag(
    createPointerEvent(),
    nodeEl,
    memory,
    { layoutMode: 'structured' },
    getWorldPosition,
    true
  ), false);

  assert.equal(interaction.beginNodeDrag(
    createPointerEvent(),
    nodeEl,
    memory,
    { layoutMode: 'free' },
    getWorldPosition,
    false
  ), false);
});

test('editor canvas interaction runtime — beginNodeDrag guards non-left mouse and button targets', () => {
  const { interaction } = createInteractionRuntime();
  const nodeEl = createMockElement();
  const memory = { id: 'node-1' };
  const viewportState = { layoutMode: 'free' };
  const getWorldPosition = () => ({ x: 10, y: 20 });

  assert.equal(interaction.beginNodeDrag(
    createPointerEvent({ button: 2 }),
    nodeEl,
    memory,
    viewportState,
    getWorldPosition,
    true
  ), false);

  assert.equal(interaction.beginNodeDrag(
    createPointerEvent({ target: createMockElement({ closest: (selector) => selector === 'button' }) }),
    nodeEl,
    memory,
    viewportState,
    getWorldPosition,
    true
  ), false);
});

test('editor canvas interaction runtime — beginNodeDrag initializes drag state for valid drag', () => {
  const { interaction } = createInteractionRuntime();
  const nodeEl = createMockElement();
  const memory = { id: 'node-42' };
  const viewportState = { layoutMode: 'free' };
  let preventCalls = 0;
  let stopCalls = 0;

  const result = interaction.beginNodeDrag(
    createPointerEvent({
      clientX: 100,
      clientY: 120,
      preventDefault: () => { preventCalls += 1; },
      stopPropagation: () => { stopCalls += 1; }
    }),
    nodeEl,
    memory,
    viewportState,
    () => ({ x: 25, y: 35 }),
    true
  );

  assert.equal(result, true);
  assert.equal(preventCalls, 1);
  assert.equal(stopCalls, 1);
  assert.equal(viewportState.isDraggingNode, true);
  assert.equal(viewportState.dragNodeId, 'node-42');
  assert.equal(viewportState.dragStartClientX, 100);
  assert.equal(viewportState.dragStartClientY, 120);
  assert.equal(viewportState.dragStartWorldX, 25);
  assert.equal(viewportState.dragStartWorldY, 35);
  assert.equal(viewportState.dragMoved, false);
  assert.equal(nodeEl.style.cursor, 'grabbing');
});

test('editor canvas interaction runtime — bind respects globalsBound guard', () => {
  const { interaction } = createInteractionRuntime();
  const canvas = createMockElement();
  const viewportState = { globalsBound: true, layoutMode: 'free', positions: {} };

  interaction.bind({
    canvas,
    viewportState,
    scheduleRender: () => { throw new Error('should not be called'); },
    persistStoredPositions: () => { throw new Error('should not be called'); },
    initCanvas: () => { throw new Error('should not be called'); },
    getWorldPosition: () => ({ x: 0, y: 0 }),
    getDragTargetElement: () => null,
    showMovedToast: () => {}
  });

  assert.equal(canvas.listeners.pointerdown, undefined);
  assert.equal(viewportState.globalsBound, true);
});

test('editor canvas interaction runtime — pointerdown starts panning only in free mode and outside excluded targets', () => {
  const freeHarness = createBindHarness({ layoutMode: 'free' });
  freeHarness.canvas.dispatch('pointerdown', createPointerEvent({ clientX: 10, clientY: 20 }));

  assert.equal(freeHarness.viewportState.isPanning, true);
  assert.equal(freeHarness.viewportState.startX, 10);
  assert.equal(freeHarness.viewportState.startY, 20);
  assert.equal(freeHarness.canvas.classList.contains('panning'), true);
  assert.equal(freeHarness.canvas.style.cursor, 'grabbing');

  const structuredHarness = createBindHarness({ layoutMode: 'structured' });
  structuredHarness.canvas.dispatch('pointerdown', createPointerEvent({ clientX: 10, clientY: 20 }));
  assert.equal(structuredHarness.viewportState.isPanning, undefined);

  const excludedHarness = createBindHarness({ layoutMode: 'free' });
  excludedHarness.canvas.dispatch('pointerdown', createPointerEvent({
    target: createMockElement({ closest: (selector) => selector === '.memory-node' })
  }));
  assert.equal(excludedHarness.viewportState.isPanning, undefined);
});

test('editor canvas interaction runtime — pointermove below drag threshold does not move or schedule render', () => {
  const harness = createBindHarness({
    viewportState: {
      isDraggingNode: true,
      dragNodeId: 'node-1',
      dragStartClientX: 100,
      dragStartClientY: 100,
      dragStartWorldX: 20,
      dragStartWorldY: 30,
      dragMoved: false,
      positions: {}
    }
  });

  dispatchWindow(harness, 'pointermove', createPointerEvent({ clientX: 105, clientY: 105 }));

  assert.equal(harness.viewportState.dragMoved, false);
  assert.deepEqual(toPlain(harness.viewportState.positions), {});
  assert.deepEqual(harness.calls, []);
});

test('editor canvas interaction runtime — pointermove above drag threshold updates position and schedules render', () => {
  const harness = createBindHarness({
    scale: 2,
    viewportState: {
      isDraggingNode: true,
      dragNodeId: 'node-1',
      dragStartClientX: 100,
      dragStartClientY: 100,
      dragStartWorldX: 20,
      dragStartWorldY: 30,
      dragMoved: false,
      positions: {}
    }
  });

  dispatchWindow(harness, 'pointermove', createPointerEvent({ clientX: 114, clientY: 110 }));

  assert.equal(harness.viewportState.dragMoved, true);
  assert.deepEqual(toPlain(harness.viewportState.positions['node-1']), { x: 27, y: 35 });
  assert.deepEqual(harness.calls, ['scheduleRender']);
});

test('editor canvas interaction runtime — pointermove pans viewport and schedules render', () => {
  const harness = createBindHarness({
    viewportState: {
      isPanning: true,
      startX: 10,
      startY: 20,
      offsetX: 100,
      offsetY: 200,
      positions: {}
    }
  });

  dispatchWindow(harness, 'pointermove', createPointerEvent({ clientX: 15, clientY: 30 }));

  assert.equal(harness.viewportState.startX, 15);
  assert.equal(harness.viewportState.startY, 30);
  assert.equal(harness.viewportState.offsetX, 105);
  assert.equal(harness.viewportState.offsetY, 210);
  assert.equal(harness.canvas.style.backgroundPosition, '105px 210px');
  assert.deepEqual(harness.calls, ['scheduleRender']);
});

test('editor canvas interaction runtime — pointerup finalizes moved drag and persists once', () => {
  const harness = createBindHarness({
    viewportState: {
      isDraggingNode: true,
      dragNodeId: 'node-1',
      dragMoved: true,
      positions: {},
      rafFrame: 7,
      rafScheduled: true
    }
  });

  dispatchWindow(harness, 'pointerup');

  assert.equal(harness.viewportState.isDraggingNode, false);
  assert.equal(harness.viewportState.dragNodeId, null);
  assert.equal(harness.viewportState.dragMoved, false);
  assert.equal(harness.viewportState.rafFrame, null);
  assert.equal(harness.viewportState.rafScheduled, false);
  assert.equal(harness.draggedElement.dataset.suppressClick, '1');
  assert.equal(harness.draggedElement.style.cursor, 'grab');
  assert.deepEqual(harness.calls, [
    'getDragTargetElement:node-1',
    'showMovedToast',
    'persistStoredPositions',
    'initCanvas'
  ]);
});

test('editor canvas interaction runtime — pointerup finalizes panning and persists once', () => {
  const harness = createBindHarness({
    viewportState: {
      isPanning: true,
      positions: {}
    }
  });

  harness.canvas.classList.add('panning');
  dispatchWindow(harness, 'pointerup');

  assert.equal(harness.viewportState.isPanning, false);
  assert.equal(harness.canvas.classList.contains('panning'), false);
  assert.equal(harness.canvas.style.cursor, 'grab');
  assert.deepEqual(harness.calls, [
    'persistStoredPositions',
    'initCanvas'
  ]);
});

