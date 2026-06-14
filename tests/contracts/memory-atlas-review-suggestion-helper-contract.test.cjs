const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const HELPER_PATH = 'js/memory-atlas/memory-atlas-suggestions.js';

const ALLOWED_TYPES = Object.freeze([
  'topic_match',
  'source_match',
  'emotion_match',
  'time_match',
  'tree_context',
  'manual_link_candidate',
  'contrasts_with_candidate',
  'follows_from_candidate',
]);
const FORBIDDEN_HELPER_STRINGS = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'Scout',
  'provider',
  'AI',
  'DB',
  'API',
  'public graph',
  'wiki',
  'pages/editor.html',
  'editor-detail-ui.js',
  '<script',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadHelper() {
  const context = {};
  vm.runInNewContext(read(HELPER_PATH), context);
  return context.LoveBudMemoryAtlasRelationshipSuggestions;
}

function memoryNode(id, visibility = 'public') {
  return { id: `memory:${id}`, memoryId: id, type: 'memory', visibility };
}

function sharedNode(id, type, visibility = 'public') {
  return { id: `${type}:${id}`, type, visibility };
}

function evidence(id, memoryId, targetId, targetType, sourceType = targetType, visibility = 'public') {
  return {
    id,
    memoryId,
    memoryNodeId: `memory:${memoryId}`,
    targetId,
    targetType,
    sourceType,
    visibility,
    confidence: 'explicit',
    reviewStatus: 'input',
  };
}

function projectionForTypes(types, visibility = 'public') {
  const nodes = [memoryNode('a', visibility), memoryNode('b', visibility)];
  const evidenceRecords = [];
  types.forEach((type, index) => {
    const targetId = `${type}:${index}`;
    nodes.push(sharedNode(targetId, targetTypeFor(type), visibility));
    evidenceRecords.push(evidence(`e-${type}-a`, 'a', targetId, targetTypeFor(type), type, visibility));
    evidenceRecords.push(evidence(`e-${type}-b`, 'b', targetId, targetTypeFor(type), type, visibility));
  });
  return { nodes, edges: [], evidence: evidenceRecords };
}

function targetTypeFor(type) {
  if (type === 'source_match') return 'source';
  if (type === 'emotion_match') return 'emotion';
  if (type === 'time_match') return 'time';
  if (type === 'tree_context') return 'tree';
  return 'topic';
}

function sortedTypes(suggestions) {
  return suggestions.map((suggestion) => suggestion.type).sort();
}

test('Helper file exists and exports createMemoryAtlasRelationshipSuggestions', () => {
  assert.ok(fs.existsSync(path.join(ROOT, HELPER_PATH)));
  const helper = loadHelper();
  assert.equal(typeof helper.createMemoryAtlasRelationshipSuggestions, 'function');
  assert.deepEqual([...helper.SUGGESTION_TYPES], ALLOWED_TYPES);
  assert.deepEqual([...helper.SUGGESTION_STATES], ['candidate', 'previewed']);
});

test('Empty input returns empty suggestions', () => {
  const helper = loadHelper();
  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions(null)], []);
  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions({})], []);
  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions({ nodes: [], edges: [], evidence: [] })], []);
});

test('Topic/source/emotion/time/tree evidence can create candidate suggestions', () => {
  const helper = loadHelper();
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(
    projectionForTypes(['topic_match', 'source_match', 'emotion_match', 'time_match', 'tree_context']),
    { selectedMemoryId: 'a' },
  );

  assert.deepEqual([...sortedTypes(suggestions)], [
    'emotion_match',
    'source_match',
    'time_match',
    'topic_match',
    'tree_context',
  ]);
  suggestions.forEach((suggestion) => {
    assert.equal(suggestion.state, 'candidate');
    assert.equal(suggestion.sourceMemoryId, 'a');
    assert.equal(suggestion.targetMemoryId, 'b');
    assert.match(suggestion.id, /^atlas-suggestion:/);
    assert.equal(suggestion.previewOnly, true);
  });
});

test('Manual/contrast/follows evidence can create candidate suggestions', () => {
  const helper = loadHelper();
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(
    projectionForTypes(['manual_link_candidate', 'contrasts_with_candidate', 'follows_from_candidate']),
    { selectedMemoryId: 'a' },
  );

  assert.deepEqual([...sortedTypes(suggestions)], [
    'contrasts_with_candidate',
    'follows_from_candidate',
    'manual_link_candidate',
  ]);
});

test('Every suggestion has evidenceRefs and no evidence means no suggestion', () => {
  const helper = loadHelper();
  const withEvidence = helper.createMemoryAtlasRelationshipSuggestions(projectionForTypes(['topic_match']), {
    selectedMemoryId: 'a',
  });
  assert.equal(withEvidence.length, 1);
  assert.ok(Array.isArray(withEvidence[0].evidenceRefs));
  assert.deepEqual([...withEvidence[0].evidenceRefs.map((ref) => ref.id).sort()], ['e-topic_match-a', 'e-topic_match-b']);

  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions({
    nodes: [memoryNode('a'), memoryNode('b')],
    edges: [],
    evidence: [],
  })], []);
  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions({
    nodes: [memoryNode('a'), memoryNode('b')],
    edges: [{ id: 'edge-1', from: 'a', to: 'b', type: 'topic_match', evidenceIds: [] }],
    evidence: [],
  })], []);
});

test('Default state may be candidate or previewed, but saved is never emitted', () => {
  const helper = loadHelper();
  const candidateSuggestions = helper.createMemoryAtlasRelationshipSuggestions(projectionForTypes(['topic_match']), {
    selectedMemoryId: 'a',
  });
  const previewedSuggestions = helper.createMemoryAtlasRelationshipSuggestions(projectionForTypes(['topic_match']), {
    selectedMemoryId: 'a',
    defaultState: 'previewed',
  });

  assert.equal(candidateSuggestions[0].state, 'candidate');
  assert.equal(previewedSuggestions[0].state, 'previewed');
  assert.equal(helper.createMemoryAtlasRelationshipSuggestions(projectionForTypes(['topic_match']), {
    selectedMemoryId: 'a',
    defaultState: 'saved',
  })[0].state, 'candidate');

  [...candidateSuggestions, ...previewedSuggestions].forEach((suggestion) => {
    assert.notEqual(suggestion.state, 'saved');
    assert.equal(Object.prototype.hasOwnProperty.call(suggestion, 'saved'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(suggestion, 'isSaved'), false);
  });
});

test('Suggestion types are suggestion types, not persisted edge types', () => {
  const helper = loadHelper();
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(
    projectionForTypes(ALLOWED_TYPES),
    { selectedMemoryId: 'a' },
  );

  assert.deepEqual([...sortedTypes(suggestions)], [...ALLOWED_TYPES].sort());
  suggestions.forEach((suggestion) => {
    assert.ok(ALLOWED_TYPES.includes(suggestion.type));
    assert.notEqual(suggestion.type, 'about');
    assert.notEqual(suggestion.type, 'mentions');
    assert.notEqual(suggestion.type, 'felt_as');
    assert.notEqual(suggestion.type, 'happened_at');
    assert.notEqual(suggestion.type, 'happened_in');
    assert.notEqual(suggestion.type, 'belongs_to');
    assert.notEqual(suggestion.type, 'source_of');
    assert.notEqual(suggestion.type, 'related_to');
  });
});

test('Strictest visibility inheritance: private evidence makes private suggestion', () => {
  const helper = loadHelper();
  const projection = projectionForTypes(['topic_match'], 'private');
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(projection, { selectedMemoryId: 'a' });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].visibility, 'private');
  assert.ok(suggestions[0].evidenceRefs.every((ref) => ref.visibility === 'private'));
});

test('Public suggestion is public only when every supporting evidence item is public', () => {
  const helper = loadHelper();
  const projection = {
    nodes: [memoryNode('a', 'public'), memoryNode('b', 'public'), sharedNode('public', 'topic', 'public')],
    edges: [],
    evidence: [
      evidence('public-a', 'a', 'topic:public', 'topic', 'topic_match', 'public'),
      evidence('public-b', 'b', 'topic:public', 'topic', 'topic_match', 'public'),
    ],
  };
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(projection, { selectedMemoryId: 'a' });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].visibility, 'public');
});

test('Public viewer cannot receive private-evidence suggestion', () => {
  const helper = loadHelper();
  const projection = projectionForTypes(['topic_match'], 'private');

  assert.deepEqual([...helper.createMemoryAtlasRelationshipSuggestions(projection, {
    selectedMemoryId: 'a',
    viewerVisibility: 'public',
  })], []);
});

test('selectedMemoryId scoping prevents unrelated suggestions', () => {
  const helper = loadHelper();
  const projection = {
    nodes: [memoryNode('a'), memoryNode('b'), memoryNode('c'), memoryNode('d'), sharedNode('topic:scoped', 'topic')],
    edges: [],
    evidence: [
      evidence('a-topic', 'a', 'topic:scoped', 'topic', 'topic_match'),
      evidence('b-topic', 'b', 'topic:scoped', 'topic', 'topic_match'),
      evidence('c-topic', 'c', 'topic:scoped', 'topic', 'topic_match'),
      evidence('d-topic', 'd', 'topic:scoped', 'topic', 'topic_match'),
    ],
  };

  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(projection, { selectedMemoryId: 'a' });
  assert.ok(suggestions.length > 0);
  suggestions.forEach((suggestion) => {
    assert.equal(suggestion.sourceMemoryId, 'a');
    assert.notEqual(suggestion.targetMemoryId, 'a');
  });
});

test('No persistence, network, provider, editor UI, or page script strings in helper', () => {
  const helperSource = read(HELPER_PATH);

  FORBIDDEN_HELPER_STRINGS.forEach((value) => {
    assert.doesNotMatch(helperSource, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('No public graph/wiki publication copy in helper', () => {
  const helperSource = read(HELPER_PATH);

  ['Published graph', 'Public wiki link', 'public graph feature', 'wiki publication'].forEach((value) => {
    assert.doesNotMatch(helperSource, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('Copy and labels stay preview-oriented, not saved-relationship oriented', () => {
  const helper = loadHelper();
  const suggestions = helper.createMemoryAtlasRelationshipSuggestions(projectionForTypes(['topic_match']), {
    selectedMemoryId: 'a',
  });

  assert.equal(suggestions[0].copy.label, 'Suggested connection');
  assert.match(suggestions[0].copy.status, /Preview only/);
  assert.doesNotMatch(suggestions[0].copy.status, /Saved relationship/);
  assert.doesNotMatch(suggestions[0].copy.status, /Auto-saved/);
});
