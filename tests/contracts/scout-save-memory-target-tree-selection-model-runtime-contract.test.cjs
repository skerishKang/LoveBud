/**
 * Runtime + boundary contract for pure Scout target-tree selection model.
 * Issue #3496 / parent #1882
 *
 * Primary: EXECUTED_FAKE — loads helper in node:vm and exercises behavior.
 * Secondary: SOURCE_STATIC scope guards + save-memory persistence:gated pin.
 *
 * No browser, navigation, auth provider, network, storage, DB, provider, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(
  ROOT,
  'js/scout/scout-save-memory-target-tree-selection-model.js'
);
const HELPER_SOURCE = fs.readFileSync(HELPER_PATH, 'utf8');
const SAVE_MEMORY_SOURCE = fs.readFileSync(
  path.join(ROOT, 'functions/api/scout/save-memory.js'),
  'utf8'
);

const MODEL_KEYS = [
  'options',
  'selectedTreeId',
  'selectionValid',
  'canProceed',
  'status',
  'empty',
  'retryAvailable',
].sort();

const OPTION_KEYS = ['treeId', 'label', 'visibility'].sort();

function loadApi() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(HELPER_SOURCE, context, {
    filename: 'scout-save-memory-target-tree-selection-model.js',
  });
  return context.window.LoveBudScoutSaveMemoryTargetTreeSelectionModel;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoFunctions(value, label) {
  if (value === null || value === undefined) return;
  assert.notEqual(typeof value, 'function', `${label} must not be a function`);
  if (typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoFunctions(item, `${label}[${i}]`));
    return;
  }
  for (const key of Object.keys(value)) {
    assertNoFunctions(value[key], `${label}.${key}`);
  }
}

function assertModelShape(model) {
  assert.equal(typeof model, 'object');
  assert.ok(model);
  assert.deepEqual(Object.keys(model).sort(), MODEL_KEYS);
  assert.ok(Array.isArray(model.options));
  for (const opt of model.options) {
    assert.deepEqual(Object.keys(opt).sort(), OPTION_KEYS);
    assert.equal(typeof opt.treeId, 'string');
    assert.equal(typeof opt.label, 'string');
    assert.ok(['public', 'private', 'unknown'].includes(opt.visibility));
  }
  assert.ok(model.selectedTreeId === null || typeof model.selectedTreeId === 'string');
  assert.equal(typeof model.selectionValid, 'boolean');
  assert.equal(typeof model.canProceed, 'boolean');
  assert.equal(typeof model.status, 'string');
  assert.equal(typeof model.empty, 'boolean');
  assert.equal(typeof model.retryAvailable, 'boolean');
  assertNoFunctions(model, 'model');
}

// ── API ──────────────────────────────────────────────────────────────

test('namespace and public API exist', () => {
  const api = loadApi();
  assert.equal(typeof api, 'object');
  assert.equal(typeof api.buildTargetTreeSelectionModel, 'function');
});

// ── Valid selection ──────────────────────────────────────────────────

test('valid candidates + exact explicit selection → canProceed', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'tree-b',
    candidates: [
      { id: 'tree-a', title: 'Alpha', visibility: 'public' },
      { id: 'tree-b', title: 'Beta', visibility: 'private' },
    ],
  });
  assertModelShape(model);
  assert.equal(model.selectionValid, true);
  assert.equal(model.canProceed, true);
  assert.equal(model.selectedTreeId, 'tree-b');
  assert.equal(model.status, 'ready');
  assert.equal(model.empty, false);
  assert.equal(model.retryAvailable, false);
  assert.equal(model.options.length, 2);
  assert.equal(model.options[1].label, 'Beta');
  assert.equal(model.options[1].visibility, 'private');
});

// ── Missing / no auto-selection ──────────────────────────────────────

test('missing selection does not auto-select', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    candidates: [
      { id: 'only-one', title: 'Solo', visibility: 'public' },
      { id: 'two', title: 'Two', visibility: 'private' },
    ],
  });
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.selectionValid, false);
  assert.equal(model.canProceed, false);
  assert.equal(model.status, 'missing_selection');
  assert.equal(model.options.length, 2);
});

test('single candidate without selection still does not auto-select', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    candidates: [{ id: 'only-one', title: 'Only', visibility: 'public' }],
  });
  assert.equal(model.options.length, 1);
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.canProceed, false);
  assert.equal(model.status, 'missing_selection');
});

test('public visibility does not imply selection or ownership', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    candidates: [
      { id: 'pub', title: 'Public tree', visibility: 'public' },
      { id: 'priv', title: 'Private tree', visibility: 'private' },
    ],
  });
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.canProceed, false);
  assert.equal(model.options[0].visibility, 'public');
  assert.equal(model.options[1].visibility, 'private');
  // visibility is display-only; selection still missing
  assert.equal(model.status, 'missing_selection');
});

// ── Empty / unavailable / error ──────────────────────────────────────

test('empty candidate list', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'anything',
    candidates: [],
  });
  assert.equal(model.empty, true);
  assert.equal(model.canProceed, false);
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.status, 'empty');
  assert.equal(model.options.length, 0);
});

test('explicit listStatus empty clears selection', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'empty',
    selectedTreeId: 'stale',
    candidates: [{ id: 'tree-a', title: 'A' }],
  });
  assert.equal(model.empty, true);
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.canProceed, false);
  assert.equal(model.options.length, 0);
  assert.equal(model.retryAvailable, false);
});

test('list unavailable does not reuse selection', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'unavailable',
    selectedTreeId: 'tree-a',
    candidates: [{ id: 'tree-a', title: 'A' }],
  });
  assert.equal(model.status, 'list_unavailable');
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.selectionValid, false);
  assert.equal(model.canProceed, false);
  assert.equal(model.retryAvailable, true);
  assert.equal(model.options.length, 0);
});

test('list error does not reuse selection', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'error',
    selectedTreeId: 'tree-a',
    candidates: [{ id: 'tree-a', title: 'A' }],
  });
  assert.equal(model.status, 'list_error');
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.canProceed, false);
  assert.equal(model.retryAvailable, true);
});

// ── Invalid IDs ──────────────────────────────────────────────────────

test('blank and non-string candidate IDs are discarded', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    candidates: [
      { id: '', title: 'blank' },
      { id: '   ', title: 'ws' },
      { id: 123, title: 'number' },
      { id: null, title: 'null' },
      { id: { x: 1 }, title: 'obj' },
      { id: ['a'], title: 'arr' },
      { id: 'good', title: 'Good' },
    ],
  });
  assert.equal(model.options.length, 1);
  assert.equal(model.options[0].treeId, 'good');
});

test('blank/non-string selectedTreeId is invalid and not auto-filled', () => {
  const api = loadApi();
  const cases = ['', '  ', 1, {}, [], true, false];
  for (const selectedTreeId of cases) {
    const model = api.buildTargetTreeSelectionModel({
      listStatus: 'ready',
      selectedTreeId,
      candidates: [{ id: 'only', title: 'Only' }],
    });
    assert.equal(model.selectedTreeId, null, String(selectedTreeId));
    assert.equal(model.canProceed, false, String(selectedTreeId));
    assert.equal(model.status, 'invalid_selection', String(selectedTreeId));
  }
});

// ── Stale selection ──────────────────────────────────────────────────

test('stale selected ID is rejected', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'gone-tree',
    candidates: [
      { id: 'tree-a', title: 'A' },
      { id: 'tree-b', title: 'B' },
    ],
  });
  assert.equal(model.selectedTreeId, null);
  assert.equal(model.selectionValid, false);
  assert.equal(model.canProceed, false);
  assert.equal(model.status, 'stale_selection');
  assert.equal(model.options.length, 2);
});

// ── Duplicates + prototype safety ────────────────────────────────────

test('duplicate IDs keep first occurrence deterministically', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'dup',
    candidates: [
      { id: 'dup', title: 'First', visibility: 'private' },
      { id: 'dup', title: 'Second', visibility: 'public' },
      { treeId: 'dup', title: 'Third' },
    ],
  });
  assert.equal(model.options.length, 1);
  assert.equal(model.options[0].label, 'First');
  assert.equal(model.options[0].visibility, 'private');
  assert.equal(model.selectedTreeId, 'dup');
  assert.equal(model.canProceed, true);
});

test('prototype-key tree IDs are handled safely', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'toString',
    candidates: [
      { id: 'toString', title: 'Proto A' },
      { id: 'valueOf', title: 'Proto B' },
      { id: 'hasOwnProperty', title: 'Proto C' },
      { id: 'toString', title: 'Proto A dup' },
    ],
  });
  assert.equal(model.options.length, 3);
  assert.equal(model.options[0].treeId, 'toString');
  assert.equal(model.options[0].label, 'Proto A');
  assert.equal(model.selectedTreeId, 'toString');
  assert.equal(model.canProceed, true);
});

// ── Labels / aliases ─────────────────────────────────────────────────

test('safe label fallback across aliases without private fields', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 't2',
    candidates: [
      {
        id: 't1',
        displayLabel: 'Display One',
        owner_id: 'owner-secret',
        user_id: 'user-secret',
        token: 'tok',
      },
      { treeId: 't2', label: 'Label Two' },
      { tree_id: 't3', name: 'Name Three' },
      { id: 't4' },
    ],
  });
  assert.equal(model.options[0].label, 'Display One');
  assert.equal(model.options[1].label, 'Label Two');
  assert.equal(model.options[2].label, 'Name Three');
  assert.equal(model.options[3].label, '');
  const json = JSON.stringify(model);
  assert.equal(json.includes('owner_id'), false);
  assert.equal(json.includes('user_id'), false);
  assert.equal(json.includes('token'), false);
  assert.equal(json.includes('owner-secret'), false);
});

test('treeId alias used when id is null', () => {
  const api = loadApi();
  const model = api.buildTargetTreeSelectionModel({
    listStatus: 'ready',
    selectedTreeId: 'alias-id',
    candidates: [{ id: null, treeId: 'alias-id', title: 'Aliased' }],
  });
  assert.equal(model.options[0].treeId, 'alias-id');
  assert.equal(model.canProceed, true);
});

// ── Mutation / detached ──────────────────────────────────────────────

test('input is not mutated', () => {
  const api = loadApi();
  const input = {
    listStatus: 'ready',
    selectedTreeId: 't1',
    candidates: [{ id: 't1', title: 'One', extra: { nested: true } }],
  };
  const before = deepClone(input);
  api.buildTargetTreeSelectionModel(input);
  assert.deepEqual(input, before);
});

test('output is detached and function-free', () => {
  const api = loadApi();
  const input = {
    listStatus: 'ready',
    selectedTreeId: 't1',
    candidates: [{ id: 't1', title: 'One' }],
  };
  const a = api.buildTargetTreeSelectionModel(input);
  const b = api.buildTargetTreeSelectionModel(input);
  assert.notEqual(a, b);
  assert.notEqual(a.options, b.options);
  a.options[0].label = 'mutated';
  a.selectedTreeId = 'hacked';
  const c = api.buildTargetTreeSelectionModel(input);
  assert.equal(c.options[0].label, 'One');
  assert.equal(c.selectedTreeId, 't1');
  assertNoFunctions(a, 'a');
  assertNoFunctions(c, 'c');
});

// ── Forbidden dependency / gated persistence ─────────────────────────

test('save-memory persistence remains gated', () => {
  assert.match(SAVE_MEMORY_SOURCE, /persistence:\s*['"]gated['"]/);
  assert.doesNotMatch(HELPER_SOURCE, /persistence:\s*['"]active['"]/);
  assert.doesNotMatch(HELPER_SOURCE, /createMemory/);
  assert.doesNotMatch(HELPER_SOURCE, /INSERT\s+INTO/i);
});

test('helper has no DOM/navigation/Auth/network/storage/DB/provider deps', () => {
  assert.doesNotMatch(HELPER_SOURCE, /\bdocument\b/);
  assert.doesNotMatch(HELPER_SOURCE, /window\.location/);
  assert.doesNotMatch(HELPER_SOURCE, /\bhistory\b/);
  assert.doesNotMatch(HELPER_SOURCE, /localStorage/);
  assert.doesNotMatch(HELPER_SOURCE, /sessionStorage/);
  assert.doesNotMatch(HELPER_SOURCE, /\bfetch\b/);
  assert.doesNotMatch(HELPER_SOURCE, /XMLHttpRequest/);
  assert.doesNotMatch(HELPER_SOURCE, /Firebase/i);
  assert.doesNotMatch(HELPER_SOURCE, /getIdToken/);
  assert.doesNotMatch(HELPER_SOURCE, /apiClient/);
  assert.doesNotMatch(HELPER_SOURCE, /\bModal\b/);
  assert.doesNotMatch(HELPER_SOURCE, /postgres/i);
  assert.doesNotMatch(HELPER_SOURCE, /openai/i);
  assert.doesNotMatch(HELPER_SOURCE, /scraper/i);
  assert.doesNotMatch(HELPER_SOURCE, /crawler/i);
  assert.doesNotMatch(HELPER_SOURCE, /require\s*\(/);
  assert.doesNotMatch(HELPER_SOURCE, /import\s+/);
  assert.doesNotMatch(HELPER_SOURCE, /js\/viewer\//);
  assert.doesNotMatch(HELPER_SOURCE, /js\/editor\//);
  assert.doesNotMatch(HELPER_SOURCE, /js\/my-trees\//);
});

test('null/undefined input fails closed', () => {
  const api = loadApi();
  const a = api.buildTargetTreeSelectionModel(null);
  const b = api.buildTargetTreeSelectionModel(undefined);
  assertModelShape(a);
  assertModelShape(b);
  assert.equal(a.canProceed, false);
  assert.equal(b.canProceed, false);
  assert.equal(a.selectedTreeId, null);
});
