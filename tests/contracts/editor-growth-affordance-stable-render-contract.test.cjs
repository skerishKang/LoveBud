const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(ROOT, 'js/editor/editor-canvas-growth-affordance.js');
const CSS_PATH = path.join(ROOT, 'css/editor/editor-canvas-affordance.css');

const source = fs.readFileSync(SOURCE_PATH, 'utf8');
const cssSource = fs.readFileSync(CSS_PATH, 'utf8');

function loadGrowthAffordanceFactory() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.createEditorCanvasGrowthAffordance;
}

function makeMockDocument() {
  const elements = [];
  return {
    createElement: (tag) => {
      const el = {
        className: '',
        setAttribute: () => {},
        style: {},
        appendChild: (child) => { elements.push(child); },
        addEventListener: () => {},
        dataset: {}
      };
      elements.push(el);
      return el;
    },
    createElementNS: () => ({
      setAttribute: () => {},
      appendChild: () => {}
    })
  };
}

function makeMockCanvas() {
  const appended = [];
  return {
    appendChild: (el) => { appended.push(el); return el; },
    querySelectorAll: () => [],
    clientWidth: 720,
    clientHeight: 520,
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    get appendedElements() { return appended; }
  };
}

test('growth affordance creates final CTA DOM directly without intermediate image placeholder', () => {
  const factory = loadGrowthAffordanceFactory();
  const mockDocument = makeMockDocument();
  const mockCanvas = makeMockCanvas();
  const mockSvg = { appendChild: () => {}, querySelectorAll: () => [] };

  const affordance = factory({
    canvas: mockCanvas,
    svg: mockSvg,
    documentRef: mockDocument,
    getMetrics: () => ({ width: 720, height: 520 }),
    calcPosition: () => ({ x: 300, y: 250 }),
    openAddMoment: () => {},
    i18n: (key) => key,
    constants: { NODE_HALF: 54 },
    canEdit: true
  });

  const anchorMem = { id: 'm1', parentId: null };
  affordance.renderGrowthAffordance(anchorMem, {
    isFirstStep: true,
    isStartMoment: true
  });

  const buttonEl = mockCanvas.appendedElements.find(
    (el) => el && el.className && String(el.className).includes('memory-add-affordance')
  );
  assert.ok(buttonEl, 'memory-add-affordance button should be appended to canvas directly as final CTA DOM');
});

test('intermediate image or media placeholder is not created', () => {
  assert.doesNotMatch(source, /<img/i);
  assert.doesNotMatch(source, /createElement\s*\(\s*['"]img['"]\s*\)/);
  assert.doesNotMatch(source, /\.src\s*=/);
  assert.doesNotMatch(source, /placeholder|spinner|loading/i);
});

test('final CTA wrapper/button has stable sizing guard', () => {
  assert.match(cssSource, /\.memory-add-affordance\s*\{[^}]*box-sizing\s*:\s*border-box/);
  assert.match(cssSource, /\.memory-add-affordance\s*\{[^}]*min-width\s*:\s*var\(--affordance-bubble-width/);
  assert.match(cssSource, /\.memory-add-affordance\s*\{[^}]*min-height\s*:\s*var\(--affordance-bubble-min-height/);
});

test('CTA reveal transition uses only opacity and transform', () => {
  const buttonRule = (cssSource.match(/\.memory-add-affordance\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(buttonRule.length > 0, 'memory-add-affordance rule must exist');
  assert.match(buttonRule, /transition\s*:/, 'transition property must exist');

  const transitionValue = (buttonRule.match(/transition\s*:\s*([^;]+)/) || ['', ''])[1];
  assert.ok(transitionValue.length > 0, 'transition value must be non-empty');

  assert.match(transitionValue, /\bopacity\b/, 'transition must include opacity');
  assert.match(transitionValue, /\btransform\b/, 'transition must include transform');
  assert.doesNotMatch(transitionValue, /\bwidth\b/, 'transition must not include width');
  assert.doesNotMatch(transitionValue, /\bheight\b/, 'transition must not include height');
  assert.doesNotMatch(transitionValue, /\bmin-width\b/, 'transition must not include min-width');
  assert.doesNotMatch(transitionValue, /\bmin-height\b/, 'transition must not include min-height');
  assert.doesNotMatch(transitionValue, /\bpadding\b/, 'transition must not include padding');
});

test('no width/height/aspect-ratio/padding transition on CTA', () => {
  const allTransitions = cssSource.match(/transition\s*:[^;]*/g) || [];
  for (const t of allTransitions) {
    assert.doesNotMatch(t, /\bwidth\b/);
    assert.doesNotMatch(t, /\bheight\b/);
    assert.doesNotMatch(t, /\baspect-ratio\b/);
    assert.doesNotMatch(t, /\bpadding\b/);
  }
});

test('existing + click flow to open new moment is preserved', () => {
  assert.match(source, /openAddMomentFromCanvas/);
  assert.match(source, /openAddMoment\s*\(/);
  assert.match(source, /addMemoryBtn/);
});

test('canEdit === false guard is preserved in renderGrowthAffordance', () => {
  assert.match(source, /canEdit\s*===\s*false/);
  assert.match(source, /function\s+renderGrowthAffordance/);
});

test('no Browse/My Trees/Scout/API/Firebase/localStorage references added', () => {
  assert.doesNotMatch(source, /\bbrowse\b/i);
  assert.doesNotMatch(source, /\bmy-trees\b/i);
  assert.doesNotMatch(source, /\bscout\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/i);
  assert.doesNotMatch(source, /\bapiClient\b/i);
  assert.doesNotMatch(source, /\bFirebase\b/i);
  assert.doesNotMatch(source, /\blocalStorage\b/i);
  assert.doesNotMatch(source, /\bindexedDB\b/i);
});

test('editor-canvas-renderer.js is not modified', () => {
  const rendererSource = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-renderer.js'), 'utf8');
  assert.ok(rendererSource.includes('renderGrowthAffordance'), 'renderer should still call renderGrowthAffordance');
  assert.ok(!rendererSource.includes('affordance-expanded'), 'renderer should not reference affordance-expanded');
});

test('CTA is stable: no intermediate image or stretch state', () => {
  const factory = loadGrowthAffordanceFactory();
  const mockDocument = makeMockDocument();
  const mockCanvas = makeMockCanvas();
  const mockSvg = { appendChild: () => {}, querySelectorAll: () => [] };

  const affordance = factory({
    canvas: mockCanvas,
    svg: mockSvg,
    documentRef: mockDocument,
    getMetrics: () => ({ width: 720, height: 520 }),
    calcPosition: () => ({ x: 300, y: 250 }),
    openAddMoment: () => {},
    i18n: (key) => key,
    constants: { NODE_HALF: 54 },
    canEdit: true
  });

  affordance.renderGrowthAffordance({ id: 'm1', parentId: null }, {
    isFirstStep: true,
    isStartMoment: true
  });

  const buttonEl = mockCanvas.appendedElements.find(
    (el) => el && el.className && String(el.className).includes('memory-add-affordance')
  );
  assert.ok(buttonEl, 'CTA button should be appended in stable final form');
});
