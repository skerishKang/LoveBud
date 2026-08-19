'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECTION_PATH = path.join(ROOT, 'js', 'playback', 'public-tree-embed-projection.js');
const CORE_PATH = path.join(ROOT, 'js', 'playback', 'tree-play-mode-core.js');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const SELF_PATH = 'tests/contracts/public-tree-embed-projection-contract.test.cjs';

const Projection = require(PROJECTION_PATH);
const TreePlayModeCore = require(CORE_PATH);

function publicTree(overrides = {}) {
  return {
    id: 'tree-public-4098',
    title: 'Public Tree',
    visibility: 'public',
    memoryCount: 3,
    ...overrides,
  };
}

function publicMoment(title, sourceUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', overrides = {}) {
  return {
    visibility: 'public',
    title,
    sourceUrl,
    ...overrides,
  };
}

function project(moments, tree = publicTree()) {
  return Projection.projectPublicTreeEmbed(tree, moments);
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value)) {
    output.add(key);
    collectKeys(child, output);
  }
  return output;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const TREE_REQUIRED_KEYS = ['id', 'memoryCount', 'title'];
const MOMENT_REQUIRED_KEYS = [
  'endSeconds',
  'mediaId',
  'playable',
  'provider',
  'sourceIndex',
  'sourceUrl',
  'startSeconds',
  'title',
  'unavailableReason',
];

const FORBIDDEN_KEYS = [
  'ownerId',
  'owner_id',
  'membership',
  'viewerCanEdit',
  'account',
  'user',
  'groupName',
  'keywords',
  'memo',
  'payload',
  'auth',
  'session',
  'moderation',
  'analytics',
  'providerSubject',
  'provider_subject',
  'id',
  'treeId',
  'parentId',
  'clientKey',
  'rawError',
  'rawProviderError',
  'occurrenceKey',
];

test('PUBLIC_TREE_REQUIRED_FIELDS_ONLY', () => {
  const result = project([publicMoment('A')], publicTree({
    ownerId: 'owner-secret',
    owner_id: 'owner-secret-legacy',
    membership: ['secret-member'],
    viewerCanEdit: true,
    account: { uid: 'secret-account' },
    user: { email: 'secret@example.invalid' },
    groupName: 'private-group',
    keywords: ['private-keyword'],
    memo: 'private tree memo',
    payload: { secret: true },
    auth: { token: 'secret-token' },
    session: { id: 'secret-session' },
    moderation: { state: 'internal-review' },
    analytics: { internalViews: 99 },
    providerSubject: 'provider-subject-secret',
  }));

  assert.ok(result);
  assert.deepEqual(sortedKeys(result.tree), TREE_REQUIRED_KEYS);
  assert.deepEqual(result.tree, {
    id: 'tree-public-4098',
    title: 'Public Tree',
    memoryCount: 3,
  });
});

test('PUBLIC_TREE_REQUIRED_FIELDS_ONLY omits invalid optional memoryCount', () => {
  const result = project([], publicTree({ memoryCount: -1 }));
  assert.ok(result);
  assert.deepEqual(sortedKeys(result.tree), ['id', 'title']);
});

test('PUBLIC_MOMENT_REQUIRED_FIELDS_ONLY', () => {
  const result = project([publicMoment('Moment A', undefined, {
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    sourceAttribution: 'Public Creator',
    startSeconds: 7,
    id: 'memory-secret-id',
    treeId: 'tree-secret-id',
    parentId: 'parent-secret-id',
    clientKey: 'client-secret-key',
    ownerId: 'owner-secret',
    owner_id: 'owner-secret-legacy',
    user: { uid: 'secret-user' },
    membership: ['secret-member'],
    providerSubject: 'provider-subject-secret',
    memo: 'private note',
    payload: { private: true },
    auth: { token: 'secret' },
    session: { token: 'secret-session' },
    moderation: { reason: 'internal' },
    rawError: { code: 150 },
    rawProviderError: 'do not expose',
  })]);

  const occurrence = result.occurrences[0];
  assert.deepEqual(sortedKeys(occurrence), [
    ...MOMENT_REQUIRED_KEYS,
    'sourceAttribution',
    'thumbnail',
  ].sort());
  assert.equal(occurrence.sourceAttribution, 'Public Creator');
  assert.equal(occurrence.thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

test('PRIVATE_TREE_FAIL_CLOSED', () => {
  for (const visibility of ['private', 'unlisted', '', null, undefined, 'PUBLIC']) {
    const result = project([publicMoment('A')], publicTree({ visibility }));
    assert.equal(result, null, `visibility=${String(visibility)} must fail closed`);
  }
  assert.equal(Projection.projectPublicTreeEmbed(null, [publicMoment('A')]), null);
  assert.equal(Projection.projectPublicTreeEmbed([], [publicMoment('A')]), null);
});

test('PRIVATE_MOMENT_EXCLUDED', () => {
  const result = project([
    publicMoment('A'),
    publicMoment('private secret', undefined, { visibility: 'private' }),
    publicMoment('B'),
  ]);
  assert.deepEqual(result.occurrences.map((item) => item.title), ['A', 'B']);
  assert.deepEqual(result.occurrences.map((item) => item.sourceIndex), [0, 1]);
});

test('NO_PRIVATE_EXISTENCE_SIGNAL', () => {
  const publicOnly = project([publicMoment('A'), publicMoment('B')]);
  const withPrivateNoise = project([
    publicMoment('A'),
    publicMoment('secret-1', undefined, { visibility: 'private', id: 'secret-id-1' }),
    publicMoment('secret-2', undefined, { visibility: null, id: 'secret-id-2' }),
    publicMoment('secret-3', undefined, { visibility: 'unlisted', id: 'secret-id-3' }),
    publicMoment('B'),
  ]);
  assert.deepEqual(withPrivateNoise, publicOnly);
  assert.doesNotMatch(JSON.stringify(withPrivateNoise), /secret|private|unlisted/i);
});

test('TREE_OWNER_FIELDS_STRIPPED', () => {
  const result = project([], publicTree({
    ownerId: 'owner-a',
    owner_id: 'owner-b',
    viewerCanEdit: true,
    membership: ['member-a'],
    providerSubject: 'provider-subject',
  }));
  const keys = collectKeys(result.tree);
  for (const key of ['ownerId', 'owner_id', 'viewerCanEdit', 'membership', 'providerSubject']) {
    assert.equal(keys.has(key), false, `${key} must be stripped`);
  }
});

test('MOMENT_INTERNAL_IDS_STRIPPED', () => {
  const result = project([publicMoment('A', undefined, {
    id: 'memory-id-secret',
    treeId: 'tree-id-secret',
    parentId: 'parent-id-secret',
    occurrenceKey: 'caller-occurrence-key',
  })]);
  const occurrence = result.occurrences[0];
  for (const key of ['id', 'treeId', 'parentId', 'occurrenceKey']) {
    assert.equal(Object.hasOwn(occurrence, key), false, `${key} must be stripped`);
  }
});

test('CLIENTKEY_STRIPPED', () => {
  const occurrence = project([publicMoment('A', undefined, { clientKey: 'secret-client-key' })]).occurrences[0];
  assert.equal(Object.hasOwn(occurrence, 'clientKey'), false);
  assert.doesNotMatch(JSON.stringify(occurrence), /secret-client-key/);
});

test('AUTH_FIELDS_STRIPPED', () => {
  const result = project([publicMoment('A', undefined, {
    auth: { token: 'raw-token' },
    session: { id: 'raw-session' },
    user: { email: 'private@example.invalid' },
  })], publicTree({ auth: { token: 'tree-token' }, session: { id: 'tree-session' } }));
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /raw-token|raw-session|private@example|tree-token|tree-session/);
  const keys = collectKeys(result);
  for (const key of ['auth', 'session', 'user']) assert.equal(keys.has(key), false);
});

test('MODERATION_FIELDS_STRIPPED', () => {
  const result = project([publicMoment('A', undefined, {
    moderation: { state: 'shadow-review' },
    rawError: { code: 150 },
    rawProviderError: 'provider-private-error',
    unavailableReason: 'RAW_PROVIDER_150',
  })], publicTree({ moderation: { state: 'tree-review' }, analytics: { score: 12 } }));
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /shadow-review|provider-private-error|RAW_PROVIDER_150|tree-review/);
  const keys = collectKeys(result);
  for (const key of ['moderation', 'rawError', 'rawProviderError', 'analytics']) {
    assert.equal(keys.has(key), false, `${key} must be stripped`);
  }
});

test('TRUSTED_YOUTUBE_SOURCE_ACCEPTED', () => {
  const sources = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
  ];
  const result = project(sources.map((source, index) => publicMoment(`M${index}`, source)));
  assert.equal(result.occurrences.length, sources.length);
  for (const occurrence of result.occurrences) {
    assert.equal(occurrence.provider, 'youtube');
    assert.equal(occurrence.mediaId, 'dQw4w9WgXcQ');
    assert.equal(occurrence.sourceUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    assert.equal(occurrence.playable, true);
    assert.equal(occurrence.unavailableReason, null);
  }
});

test('UNSAFE_PROTOCOL_REJECTED', () => {
  const unsafeSources = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
  ];
  const result = project(unsafeSources.map((source, index) => publicMoment(`unsafe-${index}`, source)));
  for (const occurrence of result.occurrences) {
    assert.equal(occurrence.playable, false);
    assert.equal(occurrence.provider, null);
    assert.equal(occurrence.mediaId, null);
    assert.equal(occurrence.sourceUrl, '');
    assert.equal(occurrence.unavailableReason, Projection.UNAVAILABLE_REASONS.UNAVAILABLE);
  }
});

test('MALFORMED_MEDIA_BOUNDED_UNAVAILABLE', () => {
  const malformedSources = [
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQextra',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    '',
    null,
  ];
  const result = project(malformedSources.map((source, index) => publicMoment(`bad-${index}`, source)));
  for (const occurrence of result.occurrences) {
    assert.deepEqual(
      {
        provider: occurrence.provider,
        mediaId: occurrence.mediaId,
        sourceUrl: occurrence.sourceUrl,
        playable: occurrence.playable,
        unavailableReason: occurrence.unavailableReason,
      },
      {
        provider: null,
        mediaId: null,
        sourceUrl: '',
        playable: false,
        unavailableReason: 'UNAVAILABLE',
      }
    );
  }
});

test('DUPLICATE_MEDIA_OCCURRENCES_PRESERVED', () => {
  const result = project([
    publicMoment('first duplicate', 'https://youtu.be/dQw4w9WgXcQ'),
    publicMoment('second duplicate', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ]);
  assert.equal(result.occurrences.length, 2);
  assert.deepEqual(result.occurrences.map((item) => item.mediaId), ['dQw4w9WgXcQ', 'dQw4w9WgXcQ']);
  assert.deepEqual(result.occurrences.map((item) => item.title), ['first duplicate', 'second duplicate']);
});

test('DENSE_SOURCE_INDEX ignores caller-injected sourceIndex and private gaps', () => {
  const result = project([
    publicMoment('A', undefined, { sourceIndex: 400 }),
    publicMoment('private', undefined, { visibility: 'private', sourceIndex: 401 }),
    publicMoment('B', undefined, { sourceIndex: -1 }),
  ]);
  assert.deepEqual(result.occurrences.map((item) => item.sourceIndex), [0, 1]);
});

test('CALLER_ORDER_PRESERVED', () => {
  const result = project([
    publicMoment('newest-looking', undefined, { createdAt: '2099-01-01T00:00:00Z' }),
    publicMoment('oldest-looking', undefined, { createdAt: '1900-01-01T00:00:00Z' }),
    publicMoment('middle-looking', undefined, { createdAt: '2026-01-01T00:00:00Z' }),
  ]);
  assert.deepEqual(result.occurrences.map((item) => item.title), [
    'newest-looking',
    'oldest-looking',
    'middle-looking',
  ]);
});

test('NO_SORT_AUTHORITY', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /\.sort\s*\(/);
  assert.doesNotMatch(source, /createdAt|created_at|timestamp|tree_appreciation_orders/);
});

test('START_SECONDS_OPTIONAL_BOUNDED', () => {
  const validCases = [
    { input: undefined, expected: null },
    { input: null, expected: null },
    { input: '', expected: null },
    { input: 0, expected: 0 },
    { input: 7, expected: 7 },
    { input: Projection.MAX_START_SECONDS, expected: Projection.MAX_START_SECONDS },
  ];
  for (const { input, expected } of validCases) {
    const occurrence = project([publicMoment('valid-start', undefined, { startSeconds: input })]).occurrences[0];
    assert.equal(occurrence.startSeconds, expected);
    assert.equal(occurrence.playable, true);
    assert.equal(occurrence.unavailableReason, null);
  }

  const invalidCases = [-1, Projection.MAX_START_SECONDS + 1, NaN, Infinity, 1.5, '7', {}, []];
  for (const input of invalidCases) {
    const occurrence = project([publicMoment('invalid-start', undefined, { startSeconds: input })]).occurrences[0];
    assert.equal(occurrence.startSeconds, null);
    assert.equal(occurrence.playable, false);
    assert.equal(occurrence.unavailableReason, Projection.UNAVAILABLE_REASONS.INVALID_SEGMENT);
  }
});

test('END_SECONDS_NEVER_FABRICATED', () => {
  for (const injected of [undefined, null, 0, 10, 999999, '15', { raw: 20 }]) {
    const occurrence = project([publicMoment('A', undefined, { endSeconds: injected })]).occurrences[0];
    assert.equal(occurrence.endSeconds, null);
  }
});

test('caller-injected occurrence authority is ignored', () => {
  const occurrence = project([publicMoment('A', undefined, {
    sourceIndex: 999,
    occurrenceKey: 'occ-secret',
    playable: false,
    unavailableReason: 'RAW_PROVIDER_150',
  })]).occurrences[0];
  assert.equal(occurrence.sourceIndex, 0);
  assert.equal(Object.hasOwn(occurrence, 'occurrenceKey'), false);
  assert.equal(occurrence.playable, true);
  assert.equal(occurrence.unavailableReason, null);
  assert.doesNotMatch(JSON.stringify(occurrence), /occ-secret|RAW_PROVIDER_150/);
});

test('INPUT_OBJECT_NOT_MUTATED', () => {
  const tree = publicTree({ ownerId: 'private-owner' });
  const moments = [
    publicMoment('A', undefined, { sourceIndex: 44, clientKey: 'secret' }),
    publicMoment('B', undefined, { visibility: 'private', id: 'private-id' }),
  ];
  const beforeTree = cloneJson(tree);
  const beforeMoments = cloneJson(moments);
  const result = Projection.projectPublicTreeEmbed(tree, moments);
  assert.deepEqual(tree, beforeTree);
  assert.deepEqual(moments, beforeMoments);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.tree));
  assert.ok(Object.isFrozen(result.occurrences));
  assert.ok(result.occurrences.every(Object.isFrozen));
});

test('#4064 compatibility preserves projected occurrence identity and duplicates', () => {
  const projected = project([
    publicMoment('A', 'https://youtu.be/dQw4w9WgXcQ'),
    publicMoment('B', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ]);
  const core = TreePlayModeCore.createTreePlayModeCore();
  const load = core.load(projected.occurrences, { autoStart: false });
  assert.equal(load.ok, true);
  assert.equal(load.currentIndex, 0);
  const queue = core.getQueue();
  assert.equal(queue.length, 2);
  assert.deepEqual(queue.map((item) => item.sourceIndex), [0, 1]);
  assert.deepEqual(queue.map((item) => item.occurrenceKey), ['occ-0', 'occ-1']);
  assert.deepEqual(queue.map((item) => item.mediaId), ['dQw4w9WgXcQ', 'dQw4w9WgXcQ']);
});

test('NO_FETCH / NO_PROVIDER_CALL', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b|\bWebSocket\b|iframe_api|\bYT\s*\./);
  assert.doesNotMatch(source, /youtube\.googleapis\.com|googleapis\.com\/youtube/);
});

test('NO_DOM', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|\.innerHTML\b|\.createElement\s*\(/);
});

test('NO_FIREBASE', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /firebase|firestore|idToken|getIdToken/i);
});

test('NO_DB', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /DATABASE_URL|NEON_|psycopg|postgres|require\s*\(\s*['"]pg['"]\s*\)|SELECT\s|INSERT\s|UPDATE\s|DELETE\s/i);
});

test('NO_STORAGE', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|\bcaches\s*\.|CacheStorage/);
});

test('all forbidden injected keys remain absent from occurrence projection', () => {
  const injected = {
    ownerId: 'owner-secret',
    owner_id: 'owner-secret-legacy',
    membership: ['member-secret'],
    viewerCanEdit: true,
    account: { id: 'account-secret' },
    user: { id: 'user-secret' },
    groupName: 'secret-group',
    keywords: ['secret-keyword'],
    memo: 'secret-memo',
    payload: { secret: true },
    auth: { token: 'secret-token' },
    session: { id: 'secret-session' },
    moderation: { state: 'secret-moderation' },
    analytics: { score: 1 },
    providerSubject: 'secret-provider-subject',
    provider_subject: 'secret-provider-subject-legacy',
    id: 'memory-secret-id',
    treeId: 'tree-secret-id',
    parentId: 'parent-secret-id',
    clientKey: 'client-secret-key',
    rawError: { code: 101 },
    rawProviderError: 'provider-secret-error',
    occurrenceKey: 'caller-occurrence',
  };
  const result = project([publicMoment('A', undefined, injected)]);
  const occurrence = result.occurrences[0];
  const keys = collectKeys(occurrence);
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(keys.has(key), false, `${key} must not cross the public occurrence boundary`);
  }
  assert.doesNotMatch(JSON.stringify(occurrence), /secret|caller-occurrence/i);
});

test('classification registers this contract as EXECUTED_FAKE with no capabilities', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const matches = classification.entries.filter((entry) => entry.path === SELF_PATH);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].layer, 'EXECUTED_FAKE');
  assert.deepEqual(matches[0].capabilities, []);
  assert.match(matches[0].rationale, /#4098/);
});
