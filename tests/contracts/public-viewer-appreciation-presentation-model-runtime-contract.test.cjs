/**
 * Runtime + boundary contract for Public Viewer appreciation presentation slots.
 * Issue #3495 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads presentation helper in node:vm.
 * Secondary: SOURCE_STATIC scope guards on helper source text.
 *
 * Consumes canonical appreciation-model shape only (no raw API re-projection).
 * No browser, network, auth provider, database, or Production.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(
  ROOT,
  'js/viewer/public-viewer-appreciation-presentation-model.js'
);
const CANONICAL_PATH = path.join(ROOT, 'js/shared/appreciation-render-model.js');

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

function loadApi() {
  const source = fs.readFileSync(HELPER_PATH, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(source, context);
  return context.window.LoveBudPublicViewerAppreciationPresentationModel;
}

function loadWithCanonical() {
  const canonicalSource = fs.readFileSync(CANONICAL_PATH, 'utf8');
  const presentationSource = fs.readFileSync(HELPER_PATH, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInNewContext(canonicalSource, context);
  vm.runInNewContext(presentationSource, context);
  return {
    presentation: context.window.LoveBudPublicViewerAppreciationPresentationModel,
    canonical: context.window.LoveBudAppreciationRenderModel,
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

function assertSlotOrder(presentation) {
  assert.ok(Array.isArray(presentation.slots));
  assert.equal(presentation.slots.length, 7);
  // Project VM-realm arrays into host JSON before deepEqual.
  assert.deepEqual(
    hostValue(presentation.slots.map((s) => s.key)),
    EXPECTED_SLOT_ORDER
  );
}

function slotByKey(presentation, key) {
  return presentation.slots.find((s) => s.key === key);
}

function completeCanonicalModel() {
  return {
    moment: {
      id: 'm1',
      title: 'Hello',
      sourceUrl: 'https://example.com/video',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      rememberedAt: '2024-01-01',
      emotionTags: ['설렘', '응원'],
      memo: 'a note',
      knowledgeItems: [
        { label: 'Group A', type: 'team', sourceLabel: 'public context' },
      ],
    },
    social: {
      likeCount: 3,
      commentCount: 2,
    },
    availability: {
      knowledge: true,
      likeCount: true,
      commentCount: true,
    },
    capabilities: {
      canEdit: true,
      canContinue: true,
      canConnect: true,
      canReact: true,
      canComment: true,
      canDelete: true,
      canSwitchMode: true,
      isOwner: true,
      isPublicRoute: true,
    },
  };
}

// ── API surface ────────────────────────────────────────────────────────────

test('global API exists with required functions', () => {
  const api = loadApi();
  assert.ok(api);
  assert.equal(
    typeof api.createPublicViewerAppreciationPresentationModel,
    'function'
  );
  assert.equal(typeof api.getPresentationSlotOrder, 'function');
  assert.deepEqual(
    hostValue(api.getPresentationSlotOrder()),
    EXPECTED_SLOT_ORDER
  );
  assert.deepEqual(hostValue([...api.SLOT_KEYS]), EXPECTED_SLOT_ORDER);
});

// ── Exact slot order ───────────────────────────────────────────────────────

test('exact canonical slot order is always fixed length 7', () => {
  const api = loadApi();
  const full = api.createPublicViewerAppreciationPresentationModel(
    completeCanonicalModel()
  );
  const empty = api.createPublicViewerAppreciationPresentationModel({});
  const bad = api.createPublicViewerAppreciationPresentationModel(null);
  assertSlotOrder(full);
  assertSlotOrder(empty);
  assertSlotOrder(bad);
});

// ── Complete model ─────────────────────────────────────────────────────────

test('complete canonical model marks all content slots available', () => {
  const api = loadApi();
  const model = completeCanonicalModel();
  const presentation = api.createPublicViewerAppreciationPresentationModel(model);
  assertSlotOrder(presentation);

  const identity = slotByKey(presentation, 'identity');
  assert.equal(identity.available, true);
  assert.deepEqual(hostValue(identity.value), { id: 'm1', title: 'Hello' });

  const media = slotByKey(presentation, 'media');
  assert.equal(media.available, true);
  assert.equal(media.value.sourceUrl, 'https://example.com/video');
  assert.equal(media.value.thumbnailUrl, 'https://example.com/thumb.jpg');

  const date = slotByKey(presentation, 'rememberedDate');
  assert.equal(date.available, true);
  assert.equal(date.value, '2024-01-01');

  const tags = slotByKey(presentation, 'emotionTags');
  assert.equal(tags.available, true);
  assert.deepEqual(hostValue(tags.items), ['설렘', '응원']);

  const knowledge = slotByKey(presentation, 'connectedKnowledge');
  assert.equal(knowledge.available, true);
  assert.equal(knowledge.readOnly, true);
  assert.deepEqual(hostValue(knowledge.items), [
    { label: 'Group A', type: 'team', sourceLabel: 'public context' },
  ]);

  const memo = slotByKey(presentation, 'emotionMemo');
  assert.equal(memo.available, true);
  assert.equal(memo.value, 'a note');

  const social = slotByKey(presentation, 'socialSummary');
  assert.equal(social.available, true);
  assert.equal(social.readOnly, true);
  assert.equal(social.value.likeCount, 3);
  assert.equal(social.value.commentCount, 2);
  assert.equal(social.value.likeCountAvailable, true);
  assert.equal(social.value.commentCountAvailable, true);
  assert.equal(social.value.canReact, true);
  assert.equal(social.value.canComment, true);
});

// ── Partial model ──────────────────────────────────────────────────────────

test('partial model keeps order and marks missing sections unavailable', () => {
  const api = loadApi();
  const presentation = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'only-id',
      title: '',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: null, commentCount: null },
    availability: {
      knowledge: false,
      likeCount: false,
      commentCount: false,
    },
    capabilities: {
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canReact: false,
      canComment: false,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: false,
    },
  });

  assertSlotOrder(presentation);
  assert.equal(slotByKey(presentation, 'identity').available, true);
  assert.equal(slotByKey(presentation, 'media').available, false);
  assert.equal(slotByKey(presentation, 'rememberedDate').available, false);
  assert.equal(slotByKey(presentation, 'emotionTags').available, false);
  assert.equal(slotByKey(presentation, 'connectedKnowledge').available, false);
  assert.equal(slotByKey(presentation, 'emotionMemo').available, false);
  assert.equal(slotByKey(presentation, 'socialSummary').available, false);
});

// ── Malformed input ────────────────────────────────────────────────────────

test('malformed/non-object input fails closed', () => {
  const api = loadApi();
  for (const bad of [null, undefined, 42, 'x', true, [1, 2], function () {}]) {
    const presentation = api.createPublicViewerAppreciationPresentationModel(bad);
    assertSlotOrder(presentation);
    for (const slot of presentation.slots) {
      assert.equal(slot.available, false, `${slot.key} unavailable for ${String(bad)}`);
    }
    for (const key of CAPABILITY_KEYS) {
      assert.equal(presentation.capabilities[key], false);
    }
  }
});

// ── Social counts: zero vs unknown ─────────────────────────────────────────

test('genuine zero social counts are preserved and available', () => {
  const api = loadApi();
  const presentation = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: 0, commentCount: 0 },
    availability: {
      knowledge: false,
      likeCount: true,
      commentCount: true,
    },
    capabilities: {
      canReact: false,
      canComment: false,
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: true,
    },
  });

  const social = slotByKey(presentation, 'socialSummary');
  assert.equal(social.available, true);
  assert.equal(social.value.likeCount, 0);
  assert.equal(social.value.commentCount, 0);
  assert.equal(social.value.likeCountAvailable, true);
  assert.equal(social.value.commentCountAvailable, true);
});

test('unknown social metrics stay unavailable and are not fabricated as 0', () => {
  const api = loadApi();
  const presentation = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: null, commentCount: null },
    availability: {
      knowledge: false,
      likeCount: false,
      commentCount: false,
    },
    capabilities: {
      canReact: false,
      canComment: false,
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: false,
    },
  });

  const social = slotByKey(presentation, 'socialSummary');
  assert.equal(social.value.likeCount, null);
  assert.equal(social.value.commentCount, null);
  assert.equal(social.value.likeCountAvailable, false);
  assert.equal(social.value.commentCountAvailable, false);
  // Slot itself unavailable when neither counts nor action capabilities exist.
  assert.equal(social.available, false);
});

// ── Tags and knowledge ─────────────────────────────────────────────────────

test('tags and knowledge retain safe detached values only', () => {
  const api = loadApi();
  const tags = ['a', 'b'];
  const knowledgeItems = [
    {
      label: 'Public',
      type: 'person',
      sourceLabel: 'ctx',
      entityId: 'SHOULD-NOT-APPEAR',
      ownerId: 'OWNER',
    },
  ];
  const presentation = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: tags,
      memo: null,
      knowledgeItems,
    },
    social: { likeCount: null, commentCount: null },
    availability: { knowledge: true, likeCount: false, commentCount: false },
    capabilities: {},
  });

  const tagSlot = slotByKey(presentation, 'emotionTags');
  const knowledgeSlot = slotByKey(presentation, 'connectedKnowledge');
  assert.notEqual(tagSlot.items, tags);
  assert.notEqual(knowledgeSlot.items, knowledgeItems);
  assert.notEqual(knowledgeSlot.items[0], knowledgeItems[0]);
  assert.deepEqual(hostValue(tagSlot.items), ['a', 'b']);
  assert.deepEqual(hostValue(knowledgeSlot.items[0]), {
    label: 'Public',
    type: 'person',
    sourceLabel: 'ctx',
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(knowledgeSlot.items[0], 'entityId'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(knowledgeSlot.items[0], 'ownerId'),
    false
  );
});

// ── Capabilities ───────────────────────────────────────────────────────────

test('owner/editor capabilities are forced false/unavailable', () => {
  const api = loadApi();
  const presentation = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: null, commentCount: null },
    availability: { knowledge: false, likeCount: false, commentCount: false },
    capabilities: {
      canEdit: true,
      canContinue: true,
      canConnect: true,
      canDelete: true,
      canSwitchMode: true,
      isOwner: true,
      canReact: false,
      canComment: false,
      isPublicRoute: false,
    },
  });

  assert.equal(presentation.capabilities.canEdit, false);
  assert.equal(presentation.capabilities.canContinue, false);
  assert.equal(presentation.capabilities.canConnect, false);
  assert.equal(presentation.capabilities.canDelete, false);
  assert.equal(presentation.capabilities.canSwitchMode, false);
  assert.equal(presentation.capabilities.isOwner, false);
});

test('public reaction/comment capabilities require literal true only', () => {
  const api = loadApi();
  const rejected = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: null, commentCount: null },
    availability: { knowledge: false, likeCount: false, commentCount: false },
    capabilities: {
      canReact: 'true',
      canComment: 1,
      isPublicRoute: {},
    },
  });
  assert.equal(rejected.capabilities.canReact, false);
  assert.equal(rejected.capabilities.canComment, false);
  assert.equal(rejected.capabilities.isPublicRoute, false);
  assert.equal(slotByKey(rejected, 'socialSummary').value.canReact, false);
  assert.equal(slotByKey(rejected, 'socialSummary').value.canComment, false);

  const accepted = api.createPublicViewerAppreciationPresentationModel({
    moment: {
      id: 'm',
      title: 't',
      sourceUrl: null,
      thumbnailUrl: null,
      rememberedAt: null,
      emotionTags: [],
      memo: null,
      knowledgeItems: [],
    },
    social: { likeCount: null, commentCount: null },
    availability: { knowledge: false, likeCount: false, commentCount: false },
    capabilities: {
      canReact: true,
      canComment: true,
      isPublicRoute: true,
    },
  });
  assert.equal(accepted.capabilities.canReact, true);
  assert.equal(accepted.capabilities.canComment, true);
  assert.equal(accepted.capabilities.isPublicRoute, true);
  const social = slotByKey(accepted, 'socialSummary');
  assert.equal(social.available, true);
  assert.equal(social.value.canReact, true);
  assert.equal(social.value.canComment, true);
});

// ── Mutation / detachment ──────────────────────────────────────────────────

test('does not mutate input; output is detached', () => {
  const api = loadApi();
  const model = completeCanonicalModel();
  const before = deepClone(model);
  const presentation = api.createPublicViewerAppreciationPresentationModel(model);

  assert.deepEqual(model, before);
  assert.notEqual(presentation, model);
  assert.notEqual(presentation.slots, model);
  assert.notEqual(
    slotByKey(presentation, 'emotionTags').items,
    model.moment.emotionTags
  );
  assert.notEqual(
    slotByKey(presentation, 'connectedKnowledge').items,
    model.moment.knowledgeItems
  );
  assert.notEqual(
    slotByKey(presentation, 'connectedKnowledge').items[0],
    model.moment.knowledgeItems[0]
  );

  presentation.slots[0].value.title = 'mutated';
  slotByKey(presentation, 'emotionTags').items.push('z');
  slotByKey(presentation, 'connectedKnowledge').items[0].label = 'mutated-k';
  assert.equal(model.moment.title, 'Hello');
  assert.deepEqual(model.moment.emotionTags, ['설렘', '응원']);
  assert.equal(model.moment.knowledgeItems[0].label, 'Group A');

  model.moment.title = 'source-changed';
  model.moment.emotionTags.push('src');
  assert.equal(presentation.slots[0].value.title, 'mutated');
  assert.ok(!slotByKey(presentation, 'emotionTags').items.includes('src'));
});

test('output contains no functions or DOM-like nodes', () => {
  const api = loadApi();
  const presentation = api.createPublicViewerAppreciationPresentationModel(
    completeCanonicalModel()
  );
  assertNoFunctions(presentation, 'presentation');
});

// ── Integration with real canonical helper (behavior preservation) ─────────

test('consumes real canonical helper output without re-projecting raw private fields', () => {
  const { presentation, canonical } = loadWithCanonical();
  const canonicalModel = canonical.createAppreciationRenderModel(
    {
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
          entityId: 'PRIVATE',
          ownerId: 'OWNER',
        },
      ],
      ownerId: 'ROOT-OWNER',
      token: 'TOKEN',
    },
    { canReact: true, canEdit: true, isOwner: true }
  );

  const view = presentation.createPublicViewerAppreciationPresentationModel(
    canonicalModel
  );
  assertSlotOrder(view);
  assert.equal(slotByKey(view, 'identity').value.id, 'm9');
  assert.equal(slotByKey(view, 'socialSummary').value.likeCount, 0);
  assert.equal(slotByKey(view, 'socialSummary').value.commentCount, null);
  assert.equal(slotByKey(view, 'socialSummary').value.likeCountAvailable, true);
  assert.equal(
    slotByKey(view, 'socialSummary').value.commentCountAvailable,
    false
  );
  assert.equal(view.capabilities.canEdit, false);
  assert.equal(view.capabilities.isOwner, false);
  assert.equal(view.capabilities.canReact, true);
  assert.equal(slotByKey(view, 'connectedKnowledge').available, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      slotByKey(view, 'connectedKnowledge').items[0],
      'entityId'
    ),
    false
  );
  const json = JSON.stringify(hostValue(view));
  assert.ok(!json.includes('ROOT-OWNER'));
  assert.ok(!json.includes('TOKEN'));
  assert.ok(!json.includes('PRIVATE'));
});

// ── Source-static scope guards ─────────────────────────────────────────────

test('helper source has no DOM/Auth/network/storage/DB/Editor/MyTrees deps', () => {
  const src = fs.readFileSync(HELPER_PATH, 'utf8');
  assert.ok(
    src.includes('window.LoveBudPublicViewerAppreciationPresentationModel')
  );
  assert.ok(src.includes('createPublicViewerAppreciationPresentationModel'));
  assert.ok(src.includes('identity'));
  assert.ok(src.includes('socialSummary'));

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
  assert.ok(!/\.sql\b/.test(src));
  assert.ok(!/migration/.test(src));
  assert.ok(!/pages\/view\.html/.test(src));
  // Must not re-implement raw public-safe adapter projection surface.
  assert.ok(!/memory_id/.test(src));
  assert.ok(!/owner_id/.test(src));
  assert.ok(!/projectPublicSafeSource/.test(src));
});
