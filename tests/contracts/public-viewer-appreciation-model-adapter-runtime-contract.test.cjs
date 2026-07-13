/**
 * Runtime + boundary contract for the Public Viewer appreciation model adapter.
 * Issue #3491 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads canonical helper + adapter in node:vm.
 * Secondary: SOURCE_STATIC scope guards on adapter source text.
 *
 * No browser, network, auth provider, database, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_PATH = path.join(ROOT, 'js/shared/appreciation-render-model.js');
const ADAPTER_PATH = path.join(
  ROOT,
  'js/viewer/public-viewer-appreciation-model-adapter.js'
);

// Note: do not forbid the bare key "knowledge" — availability.knowledge is
// a legitimate boolean flag on the canonical model.
const FORBIDDEN_OUTPUT_KEYS = [
  'ownerId',
  'owner_id',
  'uid',
  'firebaseUid',
  'firebase_uid',
  'accountId',
  'account_id',
  'email',
  'token',
  'idToken',
  'authorization',
  'cookie',
  'session',
  'credential',
  'password',
  'privateMetadata',
  'draftMetadata',
  'moderation',
  'raw',
  'dbRow',
  'entities',
  'relations',
  'entityLinks',
  'connectedEntities',
  'ownerKnowledge',
  'user',
  'auth',
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

const OWNER_EDITOR_CAPABILITY_KEYS = [
  'canEdit',
  'canContinue',
  'canConnect',
  'canDelete',
  'canSwitchMode',
  'isOwner',
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Project VM-realm values into host JSON so deepEqual is stable. */
function hostValue(value) {
  return JSON.parse(JSON.stringify(value));
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

function assertNoForbiddenKeys(model) {
  const keys = [];
  collectKeys(model, keys, new WeakSet());
  for (const forbidden of FORBIDDEN_OUTPUT_KEYS) {
    assert.ok(
      !keys.includes(forbidden),
      `output must not contain forbidden key: ${forbidden}`
    );
  }
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

function assertCanonicalShape(model) {
  assert.equal(typeof model, 'object');
  assert.ok(model);
  assert.equal(typeof model.moment, 'object');
  assert.equal(typeof model.social, 'object');
  assert.equal(typeof model.availability, 'object');
  assert.equal(typeof model.capabilities, 'object');

  assert.ok('id' in model.moment);
  assert.ok('title' in model.moment);
  assert.ok('sourceUrl' in model.moment);
  assert.ok('thumbnailUrl' in model.moment);
  assert.ok('rememberedAt' in model.moment);
  assert.ok(Array.isArray(model.moment.emotionTags));
  assert.ok('memo' in model.moment);
  assert.ok(Array.isArray(model.moment.knowledgeItems));

  assert.ok('likeCount' in model.social);
  assert.ok('commentCount' in model.social);

  assert.equal(typeof model.availability.knowledge, 'boolean');
  assert.equal(typeof model.availability.likeCount, 'boolean');
  assert.equal(typeof model.availability.commentCount, 'boolean');

  for (const key of CAPABILITY_KEYS) {
    assert.equal(typeof model.capabilities[key], 'boolean');
  }
  assert.deepEqual(
    Object.keys(model.capabilities).sort(),
    CAPABILITY_KEYS.slice().sort()
  );
}

function loadAdapterApi() {
  const canonicalSource = fs.readFileSync(CANONICAL_PATH, 'utf8');
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(canonicalSource, context);
  vm.runInNewContext(adapterSource, context);
  return {
    api: context.window.LoveBudPublicViewerAppreciationModelAdapter,
    window: context.window,
    context,
  };
}

function loadAdapterWithoutCanonical() {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(adapterSource, context);
  return context.window.LoveBudPublicViewerAppreciationModelAdapter;
}

// ── API · dependency ───────────────────────────────────────────────────────

test('global API exists with required functions', () => {
  const { api } = loadAdapterApi();
  assert.ok(api);
  assert.equal(typeof api.createPublicViewerAppreciationModel, 'function');
  assert.equal(
    typeof api.normalizePublicViewerAppreciationCapabilities,
    'function'
  );
});

test('create and normalize functions are present on frozen API', () => {
  const { api, window } = loadAdapterApi();
  assert.equal(
    window.LoveBudPublicViewerAppreciationModelAdapter,
    api
  );
  assert.equal(
    Object.isFrozen(window.LoveBudPublicViewerAppreciationModelAdapter),
    true
  );
});

test('canonical helper missing fails closed with explicit error', () => {
  const api = loadAdapterWithoutCanonical();
  assert.throws(
    () => api.createPublicViewerAppreciationModel({ title: 'x' }, {}),
    (err) => {
      // VM-realm Error is not host `instanceof Error`; check shape + message.
      assert.ok(err && typeof err === 'object');
      assert.equal(typeof err.message, 'string');
      assert.match(
        String(err.message),
        /\[public-viewer-appreciation-model-adapter\]/
      );
      assert.match(String(err.message), /LoveBudAppreciationRenderModel/);
      return true;
    }
  );
});

test('does not fall back to Editor helpers when canonical is missing', () => {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  const context = {
    window: {
      LoveBudEditorAppreciation: {
        createAppreciationRenderModel() {
          return { leaked: true };
        },
      },
      LoveBudEditor: {
        createAppreciationRenderModel() {
          return { leaked: true };
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInNewContext(adapterSource, context);
  const api = context.window.LoveBudPublicViewerAppreciationModelAdapter;
  assert.throws(
    () => api.createPublicViewerAppreciationModel({ title: 'x' }, {}),
    /\[public-viewer-appreciation-model-adapter\]/
  );
});

// ── Public field mapping ───────────────────────────────────────────────────

test('maps camelCase public memory fields', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      id: 'm1',
      title: '  Hello  ',
      sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      rememberedAt: '2024-01-01',
      emotionTags: ['설렘', '응원'],
      memo: '  note  ',
      likeCount: 3,
      commentCount: 2,
    },
    { canReact: true, isPublicRoute: true }
  );
  assertCanonicalShape(model);
  assert.equal(model.moment.id, 'm1');
  assert.equal(model.moment.title, 'Hello');
  assert.equal(
    model.moment.sourceUrl,
    'https://www.youtube.com/watch?v=abcdefghijk'
  );
  assert.equal(
    model.moment.thumbnailUrl,
    'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'
  );
  assert.equal(model.moment.rememberedAt, '2024-01-01');
  assert.deepEqual(hostValue(model.moment.emotionTags), ['설렘', '응원']);
  assert.equal(model.moment.memo, 'note');
  assert.equal(model.social.likeCount, 3);
  assert.equal(model.social.commentCount, 2);
  assert.equal(model.capabilities.canReact, true);
  assert.equal(model.capabilities.isPublicRoute, true);
});

test('maps snake_case public memory fields', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      memory_id: 'm2',
      memory_title: 'Snake',
      source_url: 'https://youtu.be/abcdefghijk',
      thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      timestamp: '2023-05-05',
      emotion_tags: ['감동'],
      emotion_memo: 'memo snake',
      like_count: 0,
      comment_count: 0,
    },
    null
  );
  assert.equal(model.moment.id, 'm2');
  assert.equal(model.moment.title, 'Snake');
  assert.equal(model.moment.sourceUrl, 'https://youtu.be/abcdefghijk');
  assert.equal(
    model.moment.thumbnailUrl,
    'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'
  );
  assert.equal(model.moment.rememberedAt, '2023-05-05');
  assert.deepEqual(hostValue(model.moment.emotionTags), ['감동']);
  assert.equal(model.moment.memo, 'memo snake');
  assert.equal(model.social.likeCount, 0);
  assert.equal(model.social.commentCount, 0);
});

test('preserves seven playback aliases', () => {
  const { api } = loadAdapterApi();
  const cases = [
    ['sourceUrl', 'https://example.com/sourceUrl'],
    ['source_url', 'https://example.com/source_url'],
    ['videoUrl', 'https://example.com/videoUrl'],
    ['video_url', 'https://example.com/video_url'],
    ['url', 'https://example.com/url'],
    ['linkUrl', 'https://example.com/linkUrl'],
    ['link_url', 'https://example.com/link_url'],
  ];
  for (const [key, value] of cases) {
    const model = api.createPublicViewerAppreciationModel({ [key]: value }, {});
    assert.equal(model.moment.sourceUrl, value, `alias ${key}`);
  }
});

test('empty/invalid leading playback alias falls through (canonical semantics)', () => {
  const { api } = loadAdapterApi();
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { sourceUrl: '', videoUrl: 'https://fallback.example/video' },
      {}
    ).moment.sourceUrl,
    'https://fallback.example/video'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { sourceUrl: null, url: 'https://fallback.example/from-url' },
      {}
    ).moment.sourceUrl,
    'https://fallback.example/from-url'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { sourceUrl: 12345, linkUrl: 'https://fallback.example/from-linkUrl' },
      {}
    ).moment.sourceUrl,
    'https://fallback.example/from-linkUrl'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      {
        sourceUrl: 'https://canonical.example/video',
        videoUrl: 'https://fallback.example/video',
      },
      {}
    ).moment.sourceUrl,
    'https://canonical.example/video'
  );
});

test('preserves thumbnail aliases', () => {
  const { api } = loadAdapterApi();
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { thumbnailUrl: 'https://example.com/a.jpg' },
      {}
    ).moment.thumbnailUrl,
    'https://example.com/a.jpg'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { thumbnail_url: 'https://example.com/b.jpg' },
      {}
    ).moment.thumbnailUrl,
    'https://example.com/b.jpg'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { thumbnailUrl: '', thumbnail: 'https://example.com/c.jpg' },
      {}
    ).moment.thumbnailUrl,
    'https://example.com/c.jpg'
  );
});

test('preserves timestamp/date aliases', () => {
  const { api } = loadAdapterApi();
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { rememberedAt: '2024-02-02' },
      {}
    ).moment.rememberedAt,
    '2024-02-02'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { remembered_at: '2024-03-03' },
      {}
    ).moment.rememberedAt,
    '2024-03-03'
  );
  assert.equal(
    api.createPublicViewerAppreciationModel(
      { timestamp: '2024-04-04' },
      {}
    ).moment.rememberedAt,
    '2024-04-04'
  );
});

test('preserves tags and memo', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      emotionTags: ['  a  ', 'a', 'b'],
      memo: '  hello  ',
    },
    {}
  );
  assert.deepEqual(hostValue(model.moment.emotionTags), ['a', 'b']);
  assert.equal(model.moment.memo, 'hello');

  const snake = api.createPublicViewerAppreciationModel(
    {
      emotion_tags: ['x'],
      emotion_memo: 'snake memo',
    },
    {}
  );
  assert.deepEqual(hostValue(snake.moment.emotionTags), ['x']);
  assert.equal(snake.moment.memo, 'snake memo');
});

test('preserves explicit public knowledge projection', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      publicKnowledgeItems: [
        {
          label: '  Group A  ',
          type: 'team',
          sourceLabel: 'public context',
          entityId: 'PRIVATE-ENTITY',
          ownerId: 'OWNER-SECRET',
        },
      ],
    },
    {}
  );
  assert.equal(model.availability.knowledge, true);
  assert.equal(model.moment.knowledgeItems.length, 1);
  assert.deepEqual(hostValue(model.moment.knowledgeItems[0]), {
    label: 'Group A',
    type: 'team',
    sourceLabel: 'public context',
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      model.moment.knowledgeItems[0],
      'entityId'
    ),
    false
  );
  assertNoForbiddenKeys(model);
});

test('ignores generic private knowledge fields', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      knowledge: [{ label: 'secret' }],
      entities: [{ label: 'entity' }],
      relations: [{ label: 'rel' }],
      entityLinks: [{ label: 'link' }],
      connectedEntities: [{ label: 'conn' }],
      ownerKnowledge: [{ label: 'owner-k' }],
      title: 'public title',
    },
    {}
  );
  assert.deepEqual(hostValue(model.moment.knowledgeItems), []);
  assert.equal(model.availability.knowledge, false);
  assert.equal(model.moment.title, 'public title');
});

// ── Social counts ──────────────────────────────────────────────────────────

test('missing like count → null', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel({}, {});
  assert.equal(model.social.likeCount, null);
  assert.equal(model.availability.likeCount, false);
});

test('numeric like zero → 0', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel({ likeCount: 0 }, {});
  assert.equal(model.social.likeCount, 0);
  assert.equal(model.availability.likeCount, true);
});

test('missing comment count → null', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel({}, {});
  assert.equal(model.social.commentCount, null);
  assert.equal(model.availability.commentCount, false);
});

test('numeric comment zero → 0', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    { commentCount: 0 },
    {}
  );
  assert.equal(model.social.commentCount, 0);
  assert.equal(model.availability.commentCount, true);
});

test('invalid/string/negative counts → null', () => {
  const { api } = loadAdapterApi();
  assert.equal(
    api.createPublicViewerAppreciationModel({ likeCount: -1 }, {}).social
      .likeCount,
    null
  );
  assert.equal(
    api.createPublicViewerAppreciationModel({ likeCount: '0' }, {}).social
      .likeCount,
    null
  );
  assert.equal(
    api.createPublicViewerAppreciationModel({ likeCount: NaN }, {}).social
      .likeCount,
    null
  );
  assert.equal(
    api.createPublicViewerAppreciationModel({ commentCount: 1.5 }, {}).social
      .commentCount,
    null
  );
  assert.equal(
    api.createPublicViewerAppreciationModel({ commentCount: Infinity }, {})
      .social.commentCount,
    null
  );
});

// ── Capabilities ───────────────────────────────────────────────────────────

test('missing capabilities → all false', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities(undefined);
  const modelCaps = api.createPublicViewerAppreciationModel({}, undefined)
    .capabilities;
  for (const key of CAPABILITY_KEYS) {
    assert.equal(caps[key], false);
    assert.equal(modelCaps[key], false);
  }
});

test('null capabilities → all false', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities(null);
  for (const key of CAPABILITY_KEYS) {
    assert.equal(caps[key], false);
  }
});

test('canReact: true only is true', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    canReact: true,
  });
  assert.equal(caps.canReact, true);
  for (const key of CAPABILITY_KEYS) {
    if (key === 'canReact') continue;
    assert.equal(caps[key], false);
  }
});

test('canComment: true only is true', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    canComment: true,
  });
  assert.equal(caps.canComment, true);
  for (const key of CAPABILITY_KEYS) {
    if (key === 'canComment') continue;
    assert.equal(caps[key], false);
  }
});

test('isPublicRoute: true only is true', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    isPublicRoute: true,
  });
  assert.equal(caps.isPublicRoute, true);
  for (const key of CAPABILITY_KEYS) {
    if (key === 'isPublicRoute') continue;
    assert.equal(caps[key], false);
  }
});

test('string/numeric truthy capability values are rejected', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    canReact: 'true',
    canComment: 1,
    isPublicRoute: {},
  });
  assert.equal(caps.canReact, false);
  assert.equal(caps.canComment, false);
  assert.equal(caps.isPublicRoute, false);

  const model = api.createPublicViewerAppreciationModel(
    { title: 'x' },
    {
      canReact: 'true',
      canComment: 1,
      isPublicRoute: function () {
        return true;
      },
    }
  );
  assert.equal(model.capabilities.canReact, false);
  assert.equal(model.capabilities.canComment, false);
  assert.equal(model.capabilities.isPublicRoute, false);
});

test('owner/editor capability inputs are forced false', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    canEdit: true,
    canContinue: true,
    canConnect: true,
    canDelete: true,
    canSwitchMode: true,
    isOwner: true,
    canReact: true,
  });
  for (const key of OWNER_EDITOR_CAPABILITY_KEYS) {
    assert.equal(caps[key], false, key);
  }
  assert.equal(caps.canReact, true);

  const model = api.createPublicViewerAppreciationModel(
    { title: 'x' },
    {
      canEdit: true,
      isOwner: true,
      canDelete: true,
      canContinue: true,
      canConnect: true,
      canSwitchMode: true,
      canComment: true,
    }
  );
  for (const key of OWNER_EDITOR_CAPABILITY_KEYS) {
    assert.equal(model.capabilities[key], false, key);
  }
  assert.equal(model.capabilities.canComment, true);
});

test('raw source capability injection is blocked', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'x',
      canEdit: true,
      isOwner: true,
      canDelete: true,
      canContinue: true,
      canConnect: true,
      canSwitchMode: true,
      canReact: true,
      canComment: true,
      isPublicRoute: true,
    },
    { canReact: true }
  );
  for (const key of OWNER_EDITOR_CAPABILITY_KEYS) {
    assert.equal(model.capabilities[key], false, key);
  }
  // Explicit second-arg capability only; source injection must not enable extras.
  assert.equal(model.capabilities.canReact, true);
  assert.equal(model.capabilities.canComment, false);
  assert.equal(model.capabilities.isPublicRoute, false);
});

test('unknown capability keys are removed', () => {
  const { api } = loadAdapterApi();
  const caps = api.normalizePublicViewerAppreciationCapabilities({
    canReact: true,
    canNuke: true,
    admin: true,
    isModerator: true,
  });
  assert.equal(caps.canReact, true);
  assert.equal(Object.prototype.hasOwnProperty.call(caps, 'canNuke'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(caps, 'admin'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(caps, 'isModerator'),
    false
  );
  assert.deepEqual(Object.keys(caps).sort(), CAPABILITY_KEYS.slice().sort());
});

// ── Privacy · authority ────────────────────────────────────────────────────

test('strips ownerId / owner_id', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'public',
      ownerId: 'OWNER_SENTINEL_AAA',
      owner_id: 'OWNER_SENTINEL_BBB',
    },
    {}
  );
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('OWNER_SENTINEL'));
  assert.equal(model.moment.title, 'public');
});

test('strips UID / account / email', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'public',
      uid: 'UID_SENTINEL_CCC',
      firebaseUid: 'FB_SENTINEL_DDD',
      accountId: 'ACCT_SENTINEL',
      email: 'email_sentinel@example.com',
    },
    {}
  );
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('UID_SENTINEL'));
  assert.ok(!json.includes('FB_SENTINEL'));
  assert.ok(!json.includes('ACCT_SENTINEL'));
  assert.ok(!json.includes('email_sentinel'));
});

test('strips token / session / cookie / credential', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'public',
      token: 'TOKEN_SENTINEL_EEE',
      session: 'SESSION_SENTINEL_III',
      cookie: 'COOKIE_SENTINEL_HHH',
      credential: 'CRED_SENTINEL_JJJ',
    },
    {}
  );
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('TOKEN_SENTINEL'));
  assert.ok(!json.includes('SESSION_SENTINEL'));
  assert.ok(!json.includes('COOKIE_SENTINEL'));
  assert.ok(!json.includes('CRED_SENTINEL'));
});

test('strips private / draft / moderation metadata', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'public',
      privateMetadata: { secret: 'PRIV_META_SENTINEL' },
      draftMetadata: { draft: true },
      moderation: { flag: 'MOD_SENTINEL' },
    },
    {}
  );
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('PRIV_META_SENTINEL'));
  assert.ok(!json.includes('MOD_SENTINEL'));
});

test('strips functions and mutation handlers', () => {
  const { api } = loadAdapterApi();
  const model = api.createPublicViewerAppreciationModel(
    {
      title: 'x',
      onEdit: function () {},
      save: function () {},
      deleteMoment: function () {},
      mutate: function () {},
    },
    { canEdit: true }
  );
  assertNoFunctions(model, 'model');
  assert.equal(Object.prototype.hasOwnProperty.call(model, 'onEdit'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model.moment, 'save'), false);
});

test('does not preserve unfiltered raw object reference', () => {
  const { api } = loadAdapterApi();
  const nestedPrivate = { secret: 'NESTED_SECRET', ownerId: 'OWNER_X' };
  const source = {
    title: 'public',
    ownerId: 'OWNER_Y',
    privateBag: nestedPrivate,
    raw: nestedPrivate,
    dbRow: { id: 99 },
  };
  const model = api.createPublicViewerAppreciationModel(source, {});
  assert.notEqual(model, source);
  assert.notEqual(model.moment, source);
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('NESTED_SECRET'));
  assert.ok(!json.includes('OWNER_'));
});

test('removes generic private knowledge / entity / relation graphs', () => {
  const { api } = loadAdapterApi();
  const cycle = { label: 'cycle' };
  cycle.self = cycle;
  const source = {
    title: 'ok',
    knowledge: cycle,
    entities: [cycle],
    relations: cycle,
    entityLinks: cycle,
    connectedEntities: cycle,
    ownerKnowledge: cycle,
  };
  // Must not hang on circular private graphs (allowlist-only reads).
  const model = api.createPublicViewerAppreciationModel(source, {});
  assert.deepEqual(hostValue(model.moment.knowledgeItems), []);
  assert.equal(model.moment.title, 'ok');
});

// ── Mutation ───────────────────────────────────────────────────────────────

test('does not mutate source input', () => {
  const { api } = loadAdapterApi();
  const source = {
    id: 'm',
    title: 't',
    emotionTags: ['a', 'b'],
    publicKnowledge: [{ label: 'k', type: 'person' }],
    likeCount: 2,
    ownerId: 'should-not-leak',
    canEdit: true,
  };
  const sourceBefore = deepClone(source);
  api.createPublicViewerAppreciationModel(source, { canReact: true });
  assert.deepEqual(source, sourceBefore);
});

test('does not mutate capabilities input', () => {
  const { api } = loadAdapterApi();
  const caps = {
    canEdit: true,
    canReact: true,
    canNuke: true,
    isOwner: true,
  };
  const capsBefore = deepClone(caps);
  api.createPublicViewerAppreciationModel({ title: 'x' }, caps);
  api.normalizePublicViewerAppreciationCapabilities(caps);
  assert.deepEqual(caps, capsBefore);
});

test('output is detached from source', () => {
  const { api } = loadAdapterApi();
  const source = {
    id: 'm',
    title: 't',
    emotionTags: ['a', 'b'],
    publicKnowledge: [{ label: 'k', type: 'person' }],
  };
  const model = api.createPublicViewerAppreciationModel(source, {});
  assert.notEqual(model, source);
  assert.notEqual(model.moment, source);

  model.moment.title = 'mutated';
  assert.equal(source.title, 't');

  source.title = 'source-changed';
  assert.equal(model.moment.title, 'mutated');
});

test('tag array is detached', () => {
  const { api } = loadAdapterApi();
  const tags = ['a', 'b'];
  const source = { emotionTags: tags };
  const model = api.createPublicViewerAppreciationModel(source, {});
  assert.notEqual(model.moment.emotionTags, tags);
  model.moment.emotionTags.push('z');
  assert.deepEqual(tags, ['a', 'b']);
  tags.push('src');
  assert.ok(!model.moment.emotionTags.includes('src'));
});

test('public knowledge array and items are detached', () => {
  const { api } = loadAdapterApi();
  const item = { label: 'k', type: 'person' };
  const list = [item];
  const source = { publicKnowledge: list };
  const model = api.createPublicViewerAppreciationModel(source, {});
  assert.notEqual(model.moment.knowledgeItems, list);
  assert.notEqual(model.moment.knowledgeItems[0], item);
  model.moment.knowledgeItems[0].label = 'mutated-k';
  assert.equal(item.label, 'k');
  item.label = 'source-changed';
  assert.equal(model.moment.knowledgeItems[0].label, 'mutated-k');
});

// ── Source-static scope guards (secondary) ─────────────────────────────────

test('adapter source has no DOM/network/auth/storage/editor/route deps', () => {
  const src = fs.readFileSync(ADAPTER_PATH, 'utf8');
  assert.ok(src.includes('window.LoveBudPublicViewerAppreciationModelAdapter'));
  assert.ok(src.includes('createPublicViewerAppreciationModel'));
  assert.ok(src.includes('normalizePublicViewerAppreciationCapabilities'));
  assert.ok(src.includes('LoveBudAppreciationRenderModel'));

  assert.ok(!/\bfetch\s*\(/.test(src));
  assert.ok(!/XMLHttpRequest/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocation\b/.test(src));
  assert.ok(!/\bhistory\b/.test(src));
  assert.ok(!/localStorage/.test(src));
  assert.ok(!/sessionStorage/.test(src));
  assert.ok(!/LoveTreeAuthPolicy/.test(src));
  assert.ok(!/\bfirebase\b/i.test(src));
  assert.ok(!/getAuth/.test(src));
  assert.ok(!/apiClient/.test(src));
  assert.ok(!/LoveTreeApi/.test(src));
  assert.ok(!/LoveBudEditor/.test(src));
  assert.ok(!/LoveTreeEditor/.test(src));
  assert.ok(!/pages\/view\.html/.test(src));
  assert.ok(!/pages\/editor\.html/.test(src));
});
