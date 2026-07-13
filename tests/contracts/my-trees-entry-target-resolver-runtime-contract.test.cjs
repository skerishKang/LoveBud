/**
 * Runtime + boundary contract for the pure My Trees entry-target resolver.
 * Issue #3492 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads helper in node:vm and exercises behavior.
 * Secondary: SOURCE_STATIC scope guards on helper source text.
 *
 * No browser, navigation, auth provider, network, database, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(ROOT, 'js/my-trees/my-trees-entry-target-resolver.js');
const HELPER_SOURCE = fs.readFileSync(HELPER_PATH, 'utf8');

const TARGET_KEYS = ['available', 'href', 'action', 'interactionMode', 'routeSurface'];
const ROOT_KEYS = ['treeId', 'accessState', 'primary', 'publicView', 'edit'];

function loadApi() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(HELPER_SOURCE, context, { filename: 'my-trees-entry-target-resolver.js' });
  return context.window.LoveBudMyTreesEntryTargetResolver;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hostValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoFunctions(value, pathLabel) {
  if (value === null || value === undefined) return;
  assert.notEqual(typeof value, 'function', `${pathLabel} must not be a function`);
  if (typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoFunctions(item, `${pathLabel}[${i}]`));
    return;
  }
  for (const key of Object.keys(value)) {
    assertNoFunctions(value[key], `${pathLabel}.${key}`);
  }
}

function assertTargetShape(target, label) {
  assert.equal(typeof target, 'object', `${label} must be object`);
  assert.ok(target, `${label} must be non-null`);
  assert.deepEqual(Object.keys(target).sort(), TARGET_KEYS.slice().sort(), `${label} keys`);
  assert.equal(typeof target.available, 'boolean', `${label}.available`);
  assert.ok(
    target.href === null || typeof target.href === 'string',
    `${label}.href must be string or null`
  );
  assert.equal(typeof target.action, 'string', `${label}.action`);
  assert.equal(typeof target.interactionMode, 'string', `${label}.interactionMode`);
  assert.equal(typeof target.routeSurface, 'string', `${label}.routeSurface`);
  if (target.available) {
    assert.equal(typeof target.href, 'string');
    assert.ok(target.href.length > 0);
  } else {
    assert.equal(target.href, null);
  }
}

function assertStableShape(model) {
  assert.equal(typeof model, 'object');
  assert.ok(model);
  assert.deepEqual(Object.keys(model).sort(), ROOT_KEYS.slice().sort());
  assert.ok(model.treeId === null || typeof model.treeId === 'string');
  assert.ok(['public', 'private', 'unknown'].includes(model.accessState));
  assertTargetShape(model.primary, 'primary');
  assertTargetShape(model.publicView, 'publicView');
  assertTargetShape(model.edit, 'edit');

  assert.equal(model.primary.action, 'appreciation');
  assert.equal(model.primary.interactionMode, 'appreciation');
  assert.equal(model.primary.routeSurface, 'editor');

  assert.equal(model.publicView.action, 'public-view');
  assert.equal(model.publicView.interactionMode, 'none');
  assert.equal(model.publicView.routeSurface, 'public-viewer');

  assert.equal(model.edit.action, 'edit');
  assert.equal(model.edit.interactionMode, 'edit');
  assert.equal(model.edit.routeSurface, 'editor');

  assertNoFunctions(model, 'model');
}

function assertAllUnavailable(model) {
  assertStableShape(model);
  assert.equal(model.treeId, null);
  assert.equal(model.primary.available, false);
  assert.equal(model.publicView.available, false);
  assert.equal(model.edit.available, false);
  assert.equal(model.primary.href, null);
  assert.equal(model.publicView.href, null);
  assert.equal(model.edit.href, null);
}

// ── API ──────────────────────────────────────────────────────────────

test('1. namespace LoveBudMyTreesEntryTargetResolver exists', () => {
  const api = loadApi();
  assert.equal(typeof api, 'object');
  assert.ok(api);
});

test('2. public functions resolveMyTreesEntryTargets and normalizeMyTreesAccessState exist', () => {
  const api = loadApi();
  assert.equal(typeof api.resolveMyTreesEntryTargets, 'function');
  assert.equal(typeof api.normalizeMyTreesAccessState, 'function');
});

test('3. stable output shape for valid and invalid inputs', () => {
  const api = loadApi();
  assertStableShape(api.resolveMyTreesEntryTargets({ id: 't1', visibility: 'public' }));
  assertStableShape(api.resolveMyTreesEntryTargets({ id: 't1', visibility: 'private' }));
  assertStableShape(api.resolveMyTreesEntryTargets(null));
  assertStableShape(api.resolveMyTreesEntryTargets({}));
});

// ── Public tree ──────────────────────────────────────────────────────

test('4. valid public tree → appreciation available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.equal(model.primary.available, true);
  assert.ok(model.primary.href);
});

test('5. valid public tree → public-view available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.equal(model.publicView.available, true);
  assert.ok(model.publicView.href);
});

test('6. valid public tree → edit available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.equal(model.edit.available, true);
  assert.ok(model.edit.href);
});

test('7. three target actions are distinct', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  const actions = [model.primary.action, model.publicView.action, model.edit.action];
  assert.deepEqual(actions, ['appreciation', 'public-view', 'edit']);
  assert.equal(new Set(actions).size, 3);
});

test('8. appreciation and edit use editor route surface', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.equal(model.primary.routeSurface, 'editor');
  assert.equal(model.edit.routeSurface, 'editor');
});

test('9. public-view uses public-viewer route surface', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.equal(model.publicView.routeSurface, 'public-viewer');
});

// ── Private tree ─────────────────────────────────────────────────────

test('10. private tree → appreciation available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-private-1', visibility: 'private' });
  assert.equal(model.primary.available, true);
});

test('11. private tree → edit available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-private-1', visibility: 'private' });
  assert.equal(model.edit.available, true);
});

test('12. private tree → public-view unavailable', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-private-1', visibility: 'private' });
  assert.equal(model.publicView.available, false);
});

test('13. private tree → public-view href null', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-private-1', visibility: 'private' });
  assert.equal(model.publicView.href, null);
});

test('14. private is not used as interaction mode', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-private-1', visibility: 'private' });
  assert.equal(model.accessState, 'private');
  assert.notEqual(model.primary.interactionMode, 'private');
  assert.notEqual(model.publicView.interactionMode, 'private');
  assert.notEqual(model.edit.interactionMode, 'private');
  assert.equal(model.primary.interactionMode, 'appreciation');
  assert.equal(model.edit.interactionMode, 'edit');
  assert.equal(model.publicView.interactionMode, 'none');
});

// ── Unknown visibility ───────────────────────────────────────────────

test('15. unknown visibility → appreciation available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-unknown-1' });
  assert.equal(model.accessState, 'unknown');
  assert.equal(model.primary.available, true);
});

test('16. unknown visibility → edit available', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-unknown-1', visibility: 'unlisted' });
  assert.equal(model.accessState, 'unknown');
  assert.equal(model.edit.available, true);
});

test('17. unknown visibility → public-view unavailable', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'tree-unknown-1', visibility: null });
  assert.equal(model.publicView.available, false);
  assert.equal(model.publicView.href, null);
});

test('18. unknown visibility does not fabricate public availability', () => {
  const api = loadApi();
  const cases = [
    { id: 't', visibility: true },
    { id: 't', visibility: 1 },
    { id: 't', visibility: 'yes' },
    { id: 't', visibility: 'Public' },
    { id: 't', visibility: 'PUBLIC' },
    { id: 't', visibility: ' public ' },
  ];
  for (const tree of cases) {
    const model = api.resolveMyTreesEntryTargets(tree);
    assert.equal(model.accessState, 'unknown', JSON.stringify(tree));
    assert.equal(model.publicView.available, false, JSON.stringify(tree));
  }
});

// ── Invalid ID ───────────────────────────────────────────────────────

test('19. missing ID → all unavailable', () => {
  const api = loadApi();
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ visibility: 'public' }));
  assertAllUnavailable(api.resolveMyTreesEntryTargets(null));
  assertAllUnavailable(api.resolveMyTreesEntryTargets(undefined));
});

test('20. blank ID → all unavailable', () => {
  const api = loadApi();
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: '', visibility: 'public' }));
});

test('21. whitespace ID → all unavailable', () => {
  const api = loadApi();
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: '   ', visibility: 'public' }));
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ treeId: '\t\n', visibility: 'public' }));
});

test('22. number/object/array/function ID → all unavailable', () => {
  const api = loadApi();
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: 123, visibility: 'public' }));
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: { nested: 'x' }, visibility: 'public' }));
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: ['a'], visibility: 'public' }));
  assertAllUnavailable(api.resolveMyTreesEntryTargets({ id: function id() {}, visibility: 'public' }));
});

// ── Route conventions ────────────────────────────────────────────────

test('23. appreciation URL follows current editor convention (no mode param)', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'abc-123', visibility: 'private' });
  assert.equal(model.primary.href, 'editor?treeId=abc-123');
  assert.equal(model.primary.href.includes('mode='), false);
  assert.equal(model.primary.href.includes('view.html'), false);
});

test('24. edit URL follows current editor explicit mode=edit convention', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'abc-123', visibility: 'private' });
  assert.equal(model.edit.href, 'editor?treeId=abc-123&mode=edit');
  assert.equal(model.edit.href.includes('view.html'), false);
});

test('25. public-view URL follows current view.html?treeId convention', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'abc-123', visibility: 'public' });
  assert.equal(model.publicView.href, 'view.html?treeId=abc-123');
  assert.equal(model.publicView.href.includes('editor'), false);
  assert.equal(model.publicView.href.includes('mode='), false);
});

test('26. target surfaces do not cross (no edit on viewer, no public-view on editor)', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'abc-123', visibility: 'public' });
  assert.equal(model.primary.routeSurface, 'editor');
  assert.equal(model.edit.routeSurface, 'editor');
  assert.equal(model.publicView.routeSurface, 'public-viewer');
  assert.ok(model.primary.href.startsWith('editor?'));
  assert.ok(model.edit.href.startsWith('editor?'));
  assert.ok(model.publicView.href.startsWith('view.html?'));
  assert.equal(model.edit.href.includes('view.html'), false);
  assert.equal(model.publicView.href.includes('mode=edit'), false);
  assert.equal(model.primary.href.includes('mode=edit'), false);
});

test('27. public is never an interaction mode', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'abc-123', visibility: 'public' });
  assert.equal(model.accessState, 'public');
  assert.notEqual(model.primary.interactionMode, 'public');
  assert.notEqual(model.publicView.interactionMode, 'public');
  assert.notEqual(model.edit.interactionMode, 'public');
  const modes = [
    model.primary.interactionMode,
    model.publicView.interactionMode,
    model.edit.interactionMode,
  ];
  for (const mode of modes) {
    assert.ok(['appreciation', 'edit', 'none'].includes(mode));
  }
});

// ── Encoding ─────────────────────────────────────────────────────────

test('28. ampersand ID is safely encoded', () => {
  const api = loadApi();
  const id = 'a&b=c';
  const model = api.resolveMyTreesEntryTargets({ id, visibility: 'public' });
  const encoded = encodeURIComponent(id);
  assert.equal(model.primary.href, `editor?treeId=${encoded}`);
  assert.equal(model.edit.href, `editor?treeId=${encoded}&mode=edit`);
  assert.equal(model.publicView.href, `view.html?treeId=${encoded}`);
  assert.equal(model.primary.href.includes('treeId=a&b'), false);
});

test('29. query marker ID is safely encoded', () => {
  const api = loadApi();
  const id = 'id?extra=1';
  const model = api.resolveMyTreesEntryTargets({ id, visibility: 'public' });
  const encoded = encodeURIComponent(id);
  assert.ok(model.primary.href.endsWith(`treeId=${encoded}`));
  assert.equal(model.primary.href.includes('?extra='), false);
});

test('30. fragment ID is safely encoded', () => {
  const api = loadApi();
  const id = 'id#frag';
  const model = api.resolveMyTreesEntryTargets({ id, visibility: 'public' });
  const encoded = encodeURIComponent(id);
  assert.ok(model.primary.href.includes(encoded));
  assert.equal(model.primary.href.includes('#frag'), false);
});

test('31. Korean ID is safely encoded', () => {
  const api = loadApi();
  const id = '트리-한글-01';
  const model = api.resolveMyTreesEntryTargets({ id, visibility: 'public' });
  const encoded = encodeURIComponent(id);
  assert.equal(model.primary.href, `editor?treeId=${encoded}`);
  assert.equal(model.publicView.href, `view.html?treeId=${encoded}`);
});

test('32. raw source URL injection is blocked', () => {
  const api = loadApi();
  const tree = {
    id: 'safe-id',
    visibility: 'public',
    url: 'javascript:alert(1)',
    href: 'https://evil.example/phish',
    target: '_blank',
    route: '/pages/editor?treeId=hijack',
    redirect: 'https://evil.example',
    next: 'https://evil.example',
    returnUrl: 'https://evil.example',
  };
  const model = api.resolveMyTreesEntryTargets(tree);
  assert.equal(model.primary.href, 'editor?treeId=safe-id');
  assert.equal(model.edit.href, 'editor?treeId=safe-id&mode=edit');
  assert.equal(model.publicView.href, 'view.html?treeId=safe-id');
  for (const href of [model.primary.href, model.edit.href, model.publicView.href]) {
    assert.equal(href.includes('javascript:'), false);
    assert.equal(href.includes('evil.example'), false);
    assert.equal(href.includes('hijack'), false);
    assert.equal(href.startsWith('data:'), false);
  }
});

// ── Mutation / detached ──────────────────────────────────────────────

test('33. source tree is not mutated', () => {
  const api = loadApi();
  const tree = { id: 't-mut', visibility: 'public', extra: { nested: 1 } };
  const before = deepClone(tree);
  api.resolveMyTreesEntryTargets(tree);
  assert.deepEqual(tree, before);
});

test('34. context is not mutated', () => {
  const api = loadApi();
  const context = { basePath: 'pages/', note: 'keep' };
  const before = deepClone(context);
  api.resolveMyTreesEntryTargets({ id: 't1', visibility: 'public' }, context);
  assert.deepEqual(context, before);
});

test('35. output is detached from source references', () => {
  const api = loadApi();
  const tree = { id: 't-detach', visibility: 'public' };
  const a = api.resolveMyTreesEntryTargets(tree);
  const b = api.resolveMyTreesEntryTargets(tree);
  assert.notEqual(a, b);
  assert.notEqual(a.primary, b.primary);
  a.primary.available = false;
  a.treeId = 'mutated';
  const c = api.resolveMyTreesEntryTargets(tree);
  assert.equal(c.primary.available, true);
  assert.equal(c.treeId, 't-detach');
  assert.notEqual(c, tree);
});

test('36. output contains no functions', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 't1', visibility: 'public' });
  assertNoFunctions(hostValue(model), 'model');
  assertNoFunctions(model, 'model-live');
});

// ── Static boundary (source text) ────────────────────────────────────

test('37. DOM dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /\bdocument\b/);
  assert.doesNotMatch(HELPER_SOURCE, /\bquerySelector\b/);
  assert.doesNotMatch(HELPER_SOURCE, /\bcreateElement\b/);
  assert.doesNotMatch(HELPER_SOURCE, /\binnerHTML\b/);
});

test('38. navigation mutation absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /window\.location/);
  assert.doesNotMatch(HELPER_SOURCE, /location\.href/);
  assert.doesNotMatch(HELPER_SOURCE, /\bhistory\b/);
  assert.doesNotMatch(HELPER_SOURCE, /location\.assign/);
  assert.doesNotMatch(HELPER_SOURCE, /location\.replace/);
});

test('39. Auth dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /Firebase/i);
  assert.doesNotMatch(HELPER_SOURCE, /LoveBudAuth/);
  assert.doesNotMatch(HELPER_SOURCE, /auth-session/);
  assert.doesNotMatch(HELPER_SOURCE, /getIdToken/);
  assert.doesNotMatch(HELPER_SOURCE, /currentUser/);
  assert.doesNotMatch(HELPER_SOURCE, /onAuthStateChanged/);
});

test('40. storage dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /localStorage/);
  assert.doesNotMatch(HELPER_SOURCE, /sessionStorage/);
  assert.doesNotMatch(HELPER_SOURCE, /indexedDB/);
});

test('41. network dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /\bfetch\b/);
  assert.doesNotMatch(HELPER_SOURCE, /XMLHttpRequest/);
  assert.doesNotMatch(HELPER_SOURCE, /WebSocket/);
});

test('42. API client dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /apiClient/);
  assert.doesNotMatch(HELPER_SOURCE, /LoveBudApi/);
});

test('43. Editor runtime import absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /editor-interaction-mode/);
  assert.doesNotMatch(HELPER_SOURCE, /LoveBudEditorInteractionMode/);
  assert.doesNotMatch(HELPER_SOURCE, /editor-startup-context/);
  assert.doesNotMatch(HELPER_SOURCE, /js\/editor\//);
});

test('44. Viewer runtime import absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /public-viewer-/);
  assert.doesNotMatch(HELPER_SOURCE, /public-canvas/);
  assert.doesNotMatch(HELPER_SOURCE, /LoveBudViewerRoute/);
  assert.doesNotMatch(HELPER_SOURCE, /js\/viewer\//);
  assert.doesNotMatch(HELPER_SOURCE, /require\s*\(/);
  assert.doesNotMatch(HELPER_SOURCE, /import\s+/);
});

test('45. DB/Modal dependency absent', () => {
  assert.doesNotMatch(HELPER_SOURCE, /\bModal\b/);
  assert.doesNotMatch(HELPER_SOURCE, /\bNeon\b/);
  assert.doesNotMatch(HELPER_SOURCE, /modal_compute/);
  assert.doesNotMatch(HELPER_SOURCE, /postgres/i);
});

// ── Extra: aliases, normalize, basePath ──────────────────────────────

test('treeId and tree_id aliases resolve when id is absent', () => {
  const api = loadApi();
  const a = api.resolveMyTreesEntryTargets({ treeId: 'alias-a', visibility: 'public' });
  const b = api.resolveMyTreesEntryTargets({ tree_id: 'alias-b', visibility: 'private' });
  assert.equal(a.treeId, 'alias-a');
  assert.equal(a.primary.href, 'editor?treeId=alias-a');
  assert.equal(b.treeId, 'alias-b');
  assert.equal(b.edit.href, 'editor?treeId=alias-b&mode=edit');
});

test('normalizeMyTreesAccessState is case-sensitive canonical only', () => {
  const api = loadApi();
  assert.equal(api.normalizeMyTreesAccessState('public'), 'public');
  assert.equal(api.normalizeMyTreesAccessState('private'), 'private');
  assert.equal(api.normalizeMyTreesAccessState('Public'), 'unknown');
  assert.equal(api.normalizeMyTreesAccessState(true), 'unknown');
  assert.equal(api.normalizeMyTreesAccessState(false), 'unknown');
  assert.equal(api.normalizeMyTreesAccessState(1), 'unknown');
  assert.equal(api.normalizeMyTreesAccessState('yes'), 'unknown');
  assert.equal(api.normalizeMyTreesAccessState(null), 'unknown');
});

test('optional basePath is applied without reading forbidden context fields', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets(
    { id: 't-base', visibility: 'public' },
    {
      basePath: 'pages/',
      url: 'javascript:alert(1)',
      href: 'https://evil.example',
      navigate: () => {},
    }
  );
  assert.equal(model.primary.href, 'pages/editor?treeId=t-base');
  assert.equal(model.edit.href, 'pages/editor?treeId=t-base&mode=edit');
  assert.equal(model.publicView.href, 'pages/view.html?treeId=t-base');
});

test('private tree does not fallback public-view to editor appreciation', () => {
  const api = loadApi();
  const model = api.resolveMyTreesEntryTargets({ id: 'priv-1', visibility: 'private' });
  assert.equal(model.publicView.available, false);
  assert.equal(model.publicView.href, null);
  assert.equal(model.publicView.routeSurface, 'public-viewer');
  assert.notEqual(model.publicView.href, model.primary.href);
});

test('UUID-like and spaced IDs encode correctly', () => {
  const api = loadApi();
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  const spaced = 'id with spaces';
  const m1 = api.resolveMyTreesEntryTargets({ id: uuid, visibility: 'public' });
  const m2 = api.resolveMyTreesEntryTargets({ id: spaced, visibility: 'public' });
  assert.equal(m1.primary.href, `editor?treeId=${uuid}`);
  assert.equal(m2.primary.href, `editor?treeId=${encodeURIComponent(spaced)}`);
});
