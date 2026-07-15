/**
 * Runtime + boundary contract for Public Viewer appreciation composer.
 * Issue #3499 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads helpers in node:vm and proves orchestration.
 * Secondary: SOURCE_STATIC scope guards on composer source text.
 *
 * Composer is pure orchestration only:
 *   source+capabilities → adapter → presentation → result
 * No browser, network, auth provider, database, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPOSER_PATH = path.join(
  ROOT,
  'js/viewer/public-viewer-appreciation-composer.js'
);
const CANONICAL_PATH = path.join(ROOT, 'js/shared/appreciation-render-model.js');
const ADAPTER_PATH = path.join(
  ROOT,
  'js/viewer/public-viewer-appreciation-model-adapter.js'
);
const PRESENTATION_PATH = path.join(
  ROOT,
  'js/viewer/public-viewer-appreciation-presentation-model.js'
);
const SHARED_SLOTS_PATH = path.join(
  ROOT,
  'js/shared/appreciation-presentation-slots.js'
);

const EXPECTED_SLOT_ORDER = [
  'identity',
  'media',
  'rememberedDate',
  'emotionTags',
  'connectedKnowledge',
  'emotionMemo',
  'socialSummary',
];

const CAPABILITY_KEYS = [
  'canEdit',
  'canContinue',
  'canConnect',
  'canReact',
  'canComment',
  'canDelete',
  'canSwitchMode',
  'isOwner',
  'isPublicRoute',
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hostValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadComposerSource(windowBag) {
  const source = fs.readFileSync(COMPOSER_PATH, 'utf8');
  const context = { window: windowBag || {} };
  vm.createContext(context);
  vm.runInNewContext(source, context);
  return {
    api: context.window.LoveBudPublicViewerAppreciationComposer,
    window: context.window,
    context,
  };
}

function loadFullChain() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(fs.readFileSync(CANONICAL_PATH, 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(ADAPTER_PATH, 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(SHARED_SLOTS_PATH, 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(PRESENTATION_PATH, 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(COMPOSER_PATH, 'utf8'), context);
  return {
    composer: context.window.LoveBudPublicViewerAppreciationComposer,
    adapter: context.window.LoveBudPublicViewerAppreciationModelAdapter,
    presentation: context.window.LoveBudPublicViewerAppreciationPresentationModel,
    canonical: context.window.LoveBudAppreciationRenderModel,
    window: context.window,
  };
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

function collectKeys(value, out, seen) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out, seen);
    return;
  }
  for (const key of Object.keys(value)) {
    out.push(key);
    collectKeys(value[key], out, seen);
  }
}

function createSpyPair() {
  const calls = [];
  const adapterResult = Object.freeze({
    __adapterResult: true,
    moment: { id: 'spy-id', title: 'spy' },
  });
  const presentationResult = Object.freeze({
    __presentationResult: true,
    slots: [{ key: 'identity', available: true }],
  });

  const windowBag = {
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel(source, capabilities) {
        calls.push({
          kind: 'adapter',
          source,
          capabilities,
          args: [source, capabilities],
        });
        return adapterResult;
      },
    },
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel(model) {
        calls.push({
          kind: 'presentation',
          model,
          args: [model],
        });
        return presentationResult;
      },
    },
  };

  return { windowBag, calls, adapterResult, presentationResult };
}

// ── API surface ────────────────────────────────────────────────────────────

test('global API exists with required function', () => {
  const { windowBag } = createSpyPair();
  const { api } = loadComposerSource(windowBag);
  assert.ok(api);
  assert.equal(typeof api.composePublicViewerAppreciationPresentation, 'function');
  assert.equal(Object.isFrozen(api), true);
});

// ── Call order / counts / references ───────────────────────────────────────

test('adapter → presentation exact call order and counts', () => {
  const { windowBag, calls, adapterResult, presentationResult } =
    createSpyPair();
  const { api } = loadComposerSource(windowBag);
  const source = { id: 'm1', title: 't' };
  const capabilities = { canReact: true };

  const result = api.composePublicViewerAppreciationPresentation(
    source,
    capabilities
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, 'adapter');
  assert.equal(calls[1].kind, 'presentation');
  assert.equal(
    calls.filter((c) => c.kind === 'adapter').length,
    1,
    'adapter exactly once'
  );
  assert.equal(
    calls.filter((c) => c.kind === 'presentation').length,
    1,
    'presentation exactly once'
  );

  // Original object references passed to adapter.
  assert.equal(calls[0].source, source);
  assert.equal(calls[0].capabilities, capabilities);

  // Presentation receives exact adapter result only.
  assert.equal(calls[1].model, adapterResult);
  assert.notEqual(calls[1].model, source);
  assert.notEqual(calls[1].args[0], source);
  assert.notEqual(calls[1].args[0], capabilities);

  // Exact presentation result returned (no wrapper).
  assert.equal(result, presentationResult);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'presentation'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'model'), false);
});

test('raw source and capabilities are never directly passed to presentation', () => {
  const { windowBag, calls } = createSpyPair();
  const { api } = loadComposerSource(windowBag);
  const source = { id: 'raw-source' };
  const capabilities = { canComment: true };

  api.composePublicViewerAppreciationPresentation(source, capabilities);

  assert.equal(calls[1].kind, 'presentation');
  assert.notEqual(calls[1].model, source);
  assert.notEqual(calls[1].model, capabilities);
  assert.equal(calls[1].args.length, 1);
});

// ── Dependency fail-closed ─────────────────────────────────────────────────

test('missing adapter dependency throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel() {
        return {};
      },
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.ok(err && typeof err.message === 'string');
      assert.match(err.message, /\[public-viewer-appreciation-composer\]/);
      assert.match(err.message, /adapter is required/i);
      return true;
    }
  );
});

test('malformed adapter object throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: 'not-an-object',
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel() {
        return {};
      },
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.match(String(err.message), /\[public-viewer-appreciation-composer\]/);
      assert.match(String(err.message), /adapter is required/i);
      return true;
    }
  );
});

test('adapter method non-function throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel: 'nope',
    },
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel() {
        return {};
      },
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.match(String(err.message), /\[public-viewer-appreciation-composer\]/);
      assert.match(
        String(err.message),
        /createPublicViewerAppreciationModel is required/
      );
      return true;
    }
  );
});

test('missing presentation dependency throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel() {
        return { ok: true };
      },
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.match(String(err.message), /\[public-viewer-appreciation-composer\]/);
      assert.match(err.message, /presentation model is required/i);
      return true;
    }
  );
});

test('malformed presentation object throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel() {
        return { ok: true };
      },
    },
    LoveBudPublicViewerAppreciationPresentationModel: 42,
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.match(String(err.message), /\[public-viewer-appreciation-composer\]/);
      assert.match(String(err.message), /presentation model is required/i);
      return true;
    }
  );
});

test('presentation method non-function throws stable error', () => {
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel() {
        return { ok: true };
      },
    },
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel: null,
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    (err) => {
      assert.match(String(err.message), /\[public-viewer-appreciation-composer\]/);
      assert.match(
        String(err.message),
        /createPublicViewerAppreciationPresentationModel is required/
      );
      return true;
    }
  );
});

test('no adapter bypass fallback to canonical or raw', () => {
  let presentationCalled = false;
  const { api } = loadComposerSource({
    LoveBudAppreciationRenderModel: {
      createAppreciationRenderModel() {
        return { leaked: 'canonical-bypass' };
      },
    },
    LoveBudPublicViewerAppreciationPresentationModel: {
      createPublicViewerAppreciationPresentationModel(model) {
        presentationCalled = true;
        return model;
      },
    },
  });
  assert.throws(
    () =>
      api.composePublicViewerAppreciationPresentation(
        { title: 'raw' },
        { canReact: true }
      ),
    /\[public-viewer-appreciation-composer\]/
  );
  assert.equal(presentationCalled, false);
});

test('no partial-result fallback when presentation is missing', () => {
  let adapterCalled = false;
  const adapterResult = { partial: true };
  const { api } = loadComposerSource({
    LoveBudPublicViewerAppreciationModelAdapter: {
      createPublicViewerAppreciationModel() {
        adapterCalled = true;
        return adapterResult;
      },
    },
  });
  assert.throws(
    () => api.composePublicViewerAppreciationPresentation({}, {}),
    /\[public-viewer-appreciation-composer\]/
  );
  // Dependencies are validated before any orchestration call; no partial return.
  assert.equal(adapterCalled, false);
});

// ── Mutation ───────────────────────────────────────────────────────────────

test('composer does not mutate source or capabilities', () => {
  const { windowBag } = createSpyPair();
  const { api } = loadComposerSource(windowBag);
  const source = {
    id: 'm',
    title: 't',
    emotionTags: ['a'],
    ownerId: 'OWNER',
  };
  const capabilities = { canReact: true, canEdit: true, canNuke: true };
  const sourceBefore = deepClone(source);
  const capsBefore = deepClone(capabilities);

  api.composePublicViewerAppreciationPresentation(source, capabilities);

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(capabilities, capsBefore);
});

// ── Full chain ─────────────────────────────────────────────────────────────

test('actual full chain private sentinel exclusion and fixed 7-slot order', () => {
  const { composer } = loadFullChain();
  const source = {
    id: 'm9',
    title: 'From raw',
    sourceUrl: 'https://example.com/v',
    rememberedAt: '2024-02-02',
    emotionTags: ['calm'],
    memo: 'memo',
    likeCount: 0,
    commentCount: null,
    publicKnowledgeItems: [
      {
        label: 'K',
        type: 'person',
        entityId: 'ENTITY-PRIVATE',
        ownerId: 'OWNER-PRIVATE',
        privateNote: 'NOTE-PRIVATE',
        nested: { token: 'NESTED-TOKEN-PRIVATE' },
      },
    ],
    ownerId: 'ROOT-OWNER',
    owner_id: 'ROOT-OWNER-SNAKE',
    uid: 'ROOT-UID',
    email: 'root@example.com',
    token: 'ROOT-TOKEN',
    auth: { session: 'SESSION-PRIVATE' },
    raw: { full: true },
    dbRow: { id: 1 },
    privateMetadata: { secret: 'META-PRIVATE' },
  };
  const capabilities = {
    canReact: true,
    canComment: false,
    isPublicRoute: true,
    canEdit: true,
    isOwner: true,
    canDelete: true,
  };

  const view = composer.composePublicViewerAppreciationPresentation(
    source,
    capabilities
  );

  assert.ok(Array.isArray(view.slots));
  assert.equal(view.slots.length, 7);
  assert.deepEqual(
    hostValue(view.slots.map((s) => s.key)),
    EXPECTED_SLOT_ORDER
  );

  const social = view.slots.find((s) => s.key === 'socialSummary');
  assert.equal(social.value.likeCount, 0);
  assert.equal(social.value.likeCountAvailable, true);
  assert.equal(social.value.commentCount, null);
  assert.equal(social.value.commentCountAvailable, false);
  assert.equal(social.contentReadOnly, true);
  assert.equal(Object.prototype.hasOwnProperty.call(social, 'readOnly'), false);
  assert.equal(social.value.canReact, true);
  assert.equal(social.value.canComment, false);

  for (const key of [
    'canEdit',
    'canContinue',
    'canConnect',
    'canDelete',
    'canSwitchMode',
    'isOwner',
  ]) {
    assert.equal(view.capabilities[key], false, key);
  }
  assert.equal(view.capabilities.canReact, true);
  assert.equal(view.capabilities.canComment, false);
  assert.equal(view.capabilities.isPublicRoute, true);

  const keys = [];
  collectKeys(view, keys, new WeakSet());
  for (const forbidden of [
    'ownerId',
    'owner_id',
    'uid',
    'email',
    'token',
    'auth',
    'raw',
    'dbRow',
    'entityId',
    'privateNote',
    'privateMetadata',
    'nested',
  ]) {
    assert.ok(!keys.includes(forbidden), `must not contain ${forbidden}`);
  }

  const json = JSON.stringify(hostValue(view));
  for (const sentinel of [
    'ROOT-OWNER',
    'ROOT-OWNER-SNAKE',
    'ROOT-UID',
    'ROOT-TOKEN',
    'ENTITY-PRIVATE',
    'OWNER-PRIVATE',
    'NOTE-PRIVATE',
    'NESTED-TOKEN-PRIVATE',
    'META-PRIVATE',
    'SESSION-PRIVATE',
  ]) {
    assert.ok(!json.includes(sentinel), `must not contain ${sentinel}`);
  }

  assertNoFunctions(view, 'view');
});

test('actual full chain unknown count preservation', () => {
  const { composer } = loadFullChain();
  const view = composer.composePublicViewerAppreciationPresentation(
    {
      id: 'm',
      title: 't',
      likeCount: null,
      commentCount: null,
    },
    { canReact: false, canComment: false }
  );
  const social = view.slots.find((s) => s.key === 'socialSummary');
  assert.equal(social.value.likeCount, null);
  assert.equal(social.value.commentCount, null);
  assert.equal(social.value.likeCountAvailable, false);
  assert.equal(social.value.commentCountAvailable, false);
  assert.notEqual(social.value.likeCount, 0);
});

test('actual full chain genuine zero preservation', () => {
  const { composer } = loadFullChain();
  const view = composer.composePublicViewerAppreciationPresentation(
    {
      id: 'm',
      title: 't',
      likeCount: 0,
      commentCount: 0,
    },
    {}
  );
  const social = view.slots.find((s) => s.key === 'socialSummary');
  assert.equal(social.value.likeCount, 0);
  assert.equal(social.value.commentCount, 0);
  assert.equal(social.value.likeCountAvailable, true);
  assert.equal(social.value.commentCountAvailable, true);
});

test('actual full chain public literal-true capabilities only', () => {
  const { composer } = loadFullChain();
  const rejected = composer.composePublicViewerAppreciationPresentation(
    { id: 'm', title: 't' },
    { canReact: 'true', canComment: 1, isPublicRoute: {} }
  );
  assert.equal(rejected.capabilities.canReact, false);
  assert.equal(rejected.capabilities.canComment, false);
  assert.equal(rejected.capabilities.isPublicRoute, false);

  const accepted = composer.composePublicViewerAppreciationPresentation(
    { id: 'm', title: 't' },
    { canReact: true, canComment: true, isPublicRoute: true }
  );
  assert.equal(accepted.capabilities.canReact, true);
  assert.equal(accepted.capabilities.canComment, true);
  assert.equal(accepted.capabilities.isPublicRoute, true);
  const social = accepted.slots.find((s) => s.key === 'socialSummary');
  assert.equal(social.contentReadOnly, true);
  assert.equal(social.value.canReact, true);
  assert.equal(social.value.canComment, true);
});

test('full chain does not mutate source or capabilities', () => {
  const { composer } = loadFullChain();
  const source = {
    id: 'm',
    title: 't',
    emotionTags: ['a'],
    likeCount: 1,
    ownerId: 'OWNER',
  };
  const capabilities = { canReact: true, canEdit: true };
  const sourceBefore = deepClone(source);
  const capsBefore = deepClone(capabilities);

  composer.composePublicViewerAppreciationPresentation(source, capabilities);

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(capabilities, capsBefore);
});

// ── Source-static scope guards ─────────────────────────────────────────────

test('composer source has no DOM/Auth/network/storage/DB/Scout/Editor deps and no raw field inspection', () => {
  const src = fs.readFileSync(COMPOSER_PATH, 'utf8');
  assert.ok(src.includes('window.LoveBudPublicViewerAppreciationComposer'));
  assert.ok(src.includes('composePublicViewerAppreciationPresentation'));
  assert.ok(src.includes('LoveBudPublicViewerAppreciationModelAdapter'));
  assert.ok(
    src.includes('LoveBudPublicViewerAppreciationPresentationModel')
  );

  // Must not inspect raw payload fields / aliases.
  assert.ok(!/memory_id/.test(src));
  assert.ok(!/owner_id/.test(src));
  assert.ok(!/like_count/.test(src));
  assert.ok(!/comment_count/.test(src));
  assert.ok(!/source_url/.test(src));
  assert.ok(!/video_url/.test(src));
  assert.ok(!/emotion_tags/.test(src));
  assert.ok(!/public_knowledge_items/.test(src));
  assert.ok(!/Object\.keys\s*\(\s*source/.test(src));
  assert.ok(!/for\s*\(\s*(?:const|var|let)\s+\w+\s+in\s+source/.test(src));
  assert.ok(!/JSON\.parse\s*\(\s*JSON\.stringify\s*\(\s*source/.test(src));
  assert.ok(!/\.\.\.\s*source/.test(src));
  assert.ok(!/source\.id/.test(src));
  assert.ok(!/source\.ownerId/.test(src));
  assert.ok(!/source\.likeCount/.test(src));

  // No normalization helpers / bypass paths.
  assert.ok(!/createAppreciationRenderModel/.test(src));
  assert.ok(!/projectPublicSafeSource/.test(src));
  assert.ok(!/normalizeTitle/.test(src));

  assert.ok(!/\bfetch\s*\(/.test(src));
  assert.ok(!/XMLHttpRequest/.test(src));
  assert.ok(!/WebSocket/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/querySelector/.test(src));
  assert.ok(!/innerHTML/.test(src));
  assert.ok(!/\blocation\b/.test(src));
  assert.ok(!/\bhistory\b/.test(src));
  assert.ok(!/localStorage/.test(src));
  assert.ok(!/sessionStorage/.test(src));
  assert.ok(!/\bfirebase\b/i.test(src));
  assert.ok(!/getAuth/.test(src));
  assert.ok(!/apiClient/.test(src));
  assert.ok(!/LoveTreeApi/.test(src));
  assert.ok(!/LoveBudEditor/.test(src));
  assert.ok(!/LoveTreeEditor/.test(src));
  assert.ok(!/my-trees/.test(src));
  assert.ok(!/LoveBudMyTrees/.test(src));
  assert.ok(!/scout/i.test(src));
  assert.ok(!/\.sql\b/.test(src));
  assert.ok(!/migration/.test(src));
  assert.ok(!/pages\/view\.html/.test(src));
});
