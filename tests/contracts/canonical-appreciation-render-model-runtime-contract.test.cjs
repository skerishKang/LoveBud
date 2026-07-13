/**
 * Runtime + boundary contract for the pure appreciation render model helper.
 * Issue #3489 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads helper in node:vm and exercises behavior.
 * Secondary: SOURCE_STATIC scope guards on helper source text.
 *
 * No browser, network, auth provider, database, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(ROOT, 'js/shared/appreciation-render-model.js');

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

function loadApi() {
  const source = fs.readFileSync(HELPER_PATH, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(source, context);
  return context.window.LoveBudAppreciationRenderModel;
}

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
  assert.deepEqual(Object.keys(model.capabilities).sort(), CAPABILITY_KEYS.slice().sort());
}

// ── API surface ────────────────────────────────────────────────────────────

test('global API exists with required functions', () => {
  const api = loadApi();
  assert.ok(api);
  assert.equal(typeof api.createAppreciationRenderModel, 'function');
  assert.equal(typeof api.normalizeAppreciationCapabilities, 'function');
});

test('canonical output shape is fixed for empty source', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel({}, {});
  assertCanonicalShape(model);
  assert.equal(model.moment.id, null);
  assert.equal(model.moment.title, '');
  assert.equal(model.social.likeCount, null);
  assert.equal(model.social.commentCount, null);
  assert.equal(model.availability.knowledge, false);
  assert.equal(model.availability.likeCount, false);
  assert.equal(model.availability.commentCount, false);
  for (const key of CAPABILITY_KEYS) {
    assert.equal(model.capabilities[key], false);
  }
});

// ── Field aliases ──────────────────────────────────────────────────────────

test('normalizes current-source camelCase aliases', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
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
    { canReact: true }
  );
  assert.equal(model.moment.id, 'm1');
  assert.equal(model.moment.title, 'Hello');
  assert.equal(model.moment.sourceUrl, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(model.moment.thumbnailUrl, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  assert.equal(model.moment.rememberedAt, '2024-01-01');
  assert.deepEqual(hostValue(model.moment.emotionTags), ['설렘', '응원']);
  assert.equal(model.moment.memo, 'note');
  assert.equal(model.social.likeCount, 3);
  assert.equal(model.social.commentCount, 2);
  assert.equal(model.availability.likeCount, true);
  assert.equal(model.availability.commentCount, true);
  assert.equal(model.capabilities.canReact, true);
});

test('normalizes current-source snake_case aliases', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
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
  assert.equal(model.moment.thumbnailUrl, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  assert.equal(model.moment.rememberedAt, '2023-05-05');
  assert.deepEqual(hostValue(model.moment.emotionTags), ['감동']);
  assert.equal(model.moment.memo, 'memo snake');
  assert.equal(model.social.likeCount, 0);
  assert.equal(model.social.commentCount, 0);
  assert.equal(model.availability.likeCount, true);
  assert.equal(model.availability.commentCount, true);
});

test('accepts memoryId / videoUrl aliases used by detail UI', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      memoryId: 'mid-9',
      videoUrl: 'https://example.com/v',
      thumbnail_url: 'https://example.com/t.jpg',
    },
    {}
  );
  assert.equal(model.moment.id, 'mid-9');
  assert.equal(model.moment.sourceUrl, 'https://example.com/v');
  assert.equal(model.moment.thumbnailUrl, 'https://example.com/t.jpg');
});

// ── Invalid / empty inputs ─────────────────────────────────────────────────

test('null source is safe', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(null, undefined);
  assertCanonicalShape(model);
  assert.equal(model.moment.title, '');
});

test('invalid source types are safe', () => {
  const api = loadApi();
  for (const bad of [undefined, 42, 'x', true, [1, 2], function () {}]) {
    const model = api.createAppreciationRenderModel(bad, {});
    assertCanonicalShape(model);
  }
});

test('missing optional fields stay null/empty without inventing data', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel({ title: 'only-title' }, {});
  assert.equal(model.moment.title, 'only-title');
  assert.equal(model.moment.sourceUrl, null);
  assert.equal(model.moment.memo, null);
  assert.deepEqual(hostValue(model.moment.emotionTags), []);
  assert.equal(model.social.likeCount, null);
});

// ── Counts ─────────────────────────────────────────────────────────────────

test('unknown like count is null; genuine zero is 0', () => {
  const api = loadApi();
  const unknown = api.createAppreciationRenderModel({}, {});
  assert.equal(unknown.social.likeCount, null);
  assert.equal(unknown.availability.likeCount, false);

  const zero = api.createAppreciationRenderModel({ likeCount: 0 }, {});
  assert.equal(zero.social.likeCount, 0);
  assert.equal(zero.availability.likeCount, true);
});

test('unknown comment count is null; genuine zero is 0', () => {
  const api = loadApi();
  const unknown = api.createAppreciationRenderModel({}, {});
  assert.equal(unknown.social.commentCount, null);
  assert.equal(unknown.availability.commentCount, false);

  const zero = api.createAppreciationRenderModel({ commentCount: 0 }, {});
  assert.equal(zero.social.commentCount, 0);
  assert.equal(zero.availability.commentCount, true);
});

test('rejects negative, NaN, Infinity, and string counts', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      likeCount: -1,
      commentCount: NaN,
      like_count: Infinity,
      comment_count: '0',
    },
    {}
  );
  // snake after camel: like_count present only if likeCount not own? pickFirst returns first own key.
  // With both likeCount and like_count, first key wins. Use separate cases.
  assert.equal(api.createAppreciationRenderModel({ likeCount: -1 }, {}).social.likeCount, null);
  assert.equal(api.createAppreciationRenderModel({ likeCount: NaN }, {}).social.likeCount, null);
  assert.equal(api.createAppreciationRenderModel({ likeCount: Infinity }, {}).social.likeCount, null);
  assert.equal(api.createAppreciationRenderModel({ likeCount: '0' }, {}).social.likeCount, null);
  assert.equal(api.createAppreciationRenderModel({ commentCount: '' }, {}).social.commentCount, null);
  assert.equal(api.createAppreciationRenderModel({ commentCount: 1.5 }, {}).social.commentCount, null);
  assert.equal(model.social.likeCount, null);
});

// ── Tags ───────────────────────────────────────────────────────────────────

test('normalizes tag string arrays and drops invalid items', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      emotionTags: ['  a  ', '', 'a', 'b', 3, null, { label: 'x' }, '  b  ', 'c'],
    },
    {}
  );
  assert.deepEqual(hostValue(model.moment.emotionTags), ['a', 'b', 'c']);
});

// ── Knowledge gate ─────────────────────────────────────────────────────────

test('accepts explicit public knowledge projection only', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
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
  assert.equal(Object.prototype.hasOwnProperty.call(model.moment.knowledgeItems[0], 'entityId'), false);
  assertNoForbiddenKeys(model);
});

test('ignores generic private knowledge fields', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      knowledge: [{ label: 'secret' }],
      entities: [{ label: 'entity' }],
      relations: [{ label: 'rel' }],
      entityLinks: [{ label: 'link' }],
    },
    {}
  );
  assert.deepEqual(hostValue(model.moment.knowledgeItems), []);
  assert.equal(model.availability.knowledge, false);
});

test('no valid knowledge → availability false; empty fake items ignored', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      public_knowledge: [{ entityId: 'only-id' }, null, 'x', { label: '  ' }],
    },
    {}
  );
  assert.deepEqual(hostValue(model.moment.knowledgeItems), []);
  assert.equal(model.availability.knowledge, false);
});

// ── Capabilities ───────────────────────────────────────────────────────────

test('missing or null capabilities fail closed to all false', () => {
  const api = loadApi();
  const a = api.normalizeAppreciationCapabilities(undefined);
  const b = api.normalizeAppreciationCapabilities(null);
  const c = api.createAppreciationRenderModel({}, undefined).capabilities;
  for (const key of CAPABILITY_KEYS) {
    assert.equal(a[key], false);
    assert.equal(b[key], false);
    assert.equal(c[key], false);
  }
});

test('only literal true is true; unknown keys dropped; coercion banned', () => {
  const api = loadApi();
  const caps = api.normalizeAppreciationCapabilities({
    canEdit: true,
    canContinue: false,
    canConnect: 1,
    canReact: 'true',
    canComment: {},
    canDelete: function () {},
    canSwitchMode: null,
    isOwner: undefined,
    isPublicRoute: true,
    canNuke: true,
    admin: true,
  });
  assert.equal(caps.canEdit, true);
  assert.equal(caps.canContinue, false);
  assert.equal(caps.canConnect, false);
  assert.equal(caps.canReact, false);
  assert.equal(caps.canComment, false);
  assert.equal(caps.canDelete, false);
  assert.equal(caps.canSwitchMode, false);
  assert.equal(caps.isOwner, false);
  assert.equal(caps.isPublicRoute, true);
  assert.equal(Object.prototype.hasOwnProperty.call(caps, 'canNuke'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(caps, 'admin'), false);
});

test('raw source canEdit true does not inject capability', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      title: 'x',
      canEdit: true,
      isOwner: true,
      canDelete: true,
    },
    { canReact: true }
  );
  assert.equal(model.capabilities.canEdit, false);
  assert.equal(model.capabilities.isOwner, false);
  assert.equal(model.capabilities.canDelete, false);
  assert.equal(model.capabilities.canReact, true);
});

// ── Forbidden fields / sentinels ───────────────────────────────────────────

test('strips ownerId, Firebase UID, email, token, session from output', () => {
  const api = loadApi();
  const sentinel = {
    ownerId: 'OWNER_SENTINEL_AAA',
    owner_id: 'OWNER_SENTINEL_BBB',
    uid: 'UID_SENTINEL_CCC',
    firebaseUid: 'FB_SENTINEL_DDD',
    email: 'email_sentinel@example.com',
    token: 'TOKEN_SENTINEL_EEE',
    idToken: 'IDTOKEN_SENTINEL_FFF',
    authorization: 'AUTH_SENTINEL_GGG',
    cookie: 'COOKIE_SENTINEL_HHH',
    session: 'SESSION_SENTINEL_III',
    credential: 'CRED_SENTINEL_JJJ',
    password: 'PASS_SENTINEL_KKK',
    privateMetadata: { secret: 'PRIV_META_SENTINEL' },
    draftMetadata: { draft: true },
    raw: { full: true },
    dbRow: { id: 1 },
    title: 'public title',
    likeCount: 1,
  };
  const model = api.createAppreciationRenderModel(sentinel, {});
  assertNoForbiddenKeys(model);
  const json = JSON.stringify(model);
  assert.ok(!json.includes('OWNER_SENTINEL'));
  assert.ok(!json.includes('UID_SENTINEL'));
  assert.ok(!json.includes('FB_SENTINEL'));
  assert.ok(!json.includes('email_sentinel'));
  assert.ok(!json.includes('TOKEN_SENTINEL'));
  assert.ok(!json.includes('IDTOKEN_SENTINEL'));
  assert.ok(!json.includes('AUTH_SENTINEL'));
  assert.ok(!json.includes('COOKIE_SENTINEL'));
  assert.ok(!json.includes('SESSION_SENTINEL'));
  assert.ok(!json.includes('CRED_SENTINEL'));
  assert.ok(!json.includes('PASS_SENTINEL'));
  assert.ok(!json.includes('PRIV_META_SENTINEL'));
  assert.equal(model.moment.title, 'public title');
});

// ── Mutation / detachment ──────────────────────────────────────────────────

test('does not mutate source or capabilities inputs; output is detached', () => {
  const api = loadApi();
  const source = {
    id: 'm',
    title: 't',
    emotionTags: ['a', 'b'],
    publicKnowledge: [{ label: 'k', type: 'person' }],
    likeCount: 2,
    ownerId: 'should-not-leak',
  };
  const caps = { canEdit: true, canReact: false };
  const sourceBefore = deepClone(source);
  const capsBefore = deepClone(caps);

  const model = api.createAppreciationRenderModel(source, caps);

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(caps, capsBefore);
  assert.notEqual(model, source);
  assert.notEqual(model.moment, source);
  assert.notEqual(model.moment.emotionTags, source.emotionTags);
  assert.notEqual(model.moment.knowledgeItems, source.publicKnowledge);
  assert.notEqual(model.moment.knowledgeItems[0], source.publicKnowledge[0]);

  model.moment.title = 'mutated';
  model.moment.emotionTags.push('z');
  model.moment.knowledgeItems[0].label = 'mutated-k';
  assert.equal(source.title, 't');
  assert.deepEqual(source.emotionTags, ['a', 'b']);
  assert.equal(source.publicKnowledge[0].label, 'k');

  source.title = 'source-changed';
  source.emotionTags.push('src');
  assert.equal(model.moment.title, 'mutated');
  assert.ok(!model.moment.emotionTags.includes('src'));
});

test('output contains no functions or route mutation handlers', () => {
  const api = loadApi();
  const model = api.createAppreciationRenderModel(
    {
      title: 'x',
      onEdit: function () {},
      save: function () {},
      deleteMoment: function () {},
    },
    { canEdit: true }
  );
  assertNoFunctions(model, 'model');
  assert.equal(Object.prototype.hasOwnProperty.call(model, 'onEdit'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model.moment, 'save'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model, 'deleteMoment'), false);
});

// ── Source-static scope guards (secondary) ─────────────────────────────────

test('helper source has no DOM/network/auth/API client dependencies', () => {
  const src = fs.readFileSync(HELPER_PATH, 'utf8');
  assert.ok(src.includes("window.LoveBudAppreciationRenderModel"));
  assert.ok(src.includes('createAppreciationRenderModel'));
  assert.ok(src.includes('normalizeAppreciationCapabilities'));

  assert.ok(!/\bfetch\s*\(/.test(src));
  assert.ok(!/XMLHttpRequest/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocation\b/.test(src));
  assert.ok(!/localStorage/.test(src));
  assert.ok(!/sessionStorage/.test(src));
  assert.ok(!/LoveTreeAuthPolicy/.test(src));
  assert.ok(!/\bfirebase\b/i.test(src));
  assert.ok(!/getAuth/.test(src));
  assert.ok(!/apiClient/.test(src));
  assert.ok(!/LoveTreeApi/.test(src));
  assert.ok(!/LoveBudEditor/.test(src));
});
