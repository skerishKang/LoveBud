'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECTION_PATH = path.join(ROOT, 'js/memory-atlas/memory-atlas-projection.js');
const projectionSource = fs.readFileSync(PROJECTION_PATH, 'utf8');

function loadProjection() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(projectionSource, sandbox, { filename: 'memory-atlas-projection.js' });
  return sandbox.module.exports;
}

function normalizeProjectionResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function findNode(result, type, label) {
  return result.nodes.find((node) => node.type === type && node.label === label);
}

function findEdge(result, type, from, to) {
  return result.edges.find((edge) => edge.type === type && edge.from === from && edge.to === to);
}

function assertNoPublicEdgePointsToPrivateNode(result) {
  const nodeById = new Map(result.nodes.map((node) => [node.id, node]));
  const inconsistentEdges = result.edges.filter((edge) => {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    return edge.visibility === 'public'
      && ((fromNode && fromNode.visibility !== 'public') || (toNode && toNode.visibility !== 'public'));
  });

  assert.deepEqual(inconsistentEdges, []);
}

test('exports the read-only Memory Atlas projection API and vocabulary', () => {
  const projection = loadProjection();

  assert.equal(typeof projection.projectMemoryAtlas, 'function');
  assert.deepEqual(Array.from(projection.PROJECTED_NODE_TYPES), [
    'memory',
    'tree',
    'pack',
    'video',
    'source',
    'topic',
    'person',
    'place',
    'event',
    'emotion',
    'time',
  ]);

  const edgeTypes = Array.from(projection.PROJECTED_EDGE_TYPES);
  assert.ok(edgeTypes.includes('belongs_to'));
  assert.ok(edgeTypes.includes('source_of'));
  assert.ok(edgeTypes.includes('felt_as'));
  assert.ok(edgeTypes.includes('happened_in'));
});

test('projects explicit memory fields into nodes, edges, and evidence', () => {
  const { projectMemoryAtlas } = loadProjection();
  const result = projectMemoryAtlas([
    {
      id: 'm1',
      title: 'UIUC plan pressure',
      note: 'Thinking about UIUC and DET.',
      treeId: 'tree-study',
      treeTitle: 'Study Tree',
      packId: 'pack-june',
      packTitle: 'June pressure pack',
      source: {
        id: 'source-channel',
        type: 'channel',
        title: 'Example channel',
      },
      video: {
        id: 'video-123',
        title: 'Application video',
      },
      topics: ['UIUC', { id: 'det', label: 'Duolingo English Test' }],
      people: ['Professor'],
      place: 'Home desk',
      event: 'Application deadline',
      emotion: 'pressure',
      timeBucket: '2026-06',
      visibility: 'private',
      createdAt: '2026-06-14T00:00:00Z',
      updatedAt: '2026-06-14T01:00:00Z',
    },
  ]);

  const memoryNode = findNode(result, 'memory', 'UIUC plan pressure');
  assert.ok(memoryNode);
  assert.equal(memoryNode.visibility, 'private');

  const treeNode = findNode(result, 'tree', 'Study Tree');
  const packNode = findNode(result, 'pack', 'June pressure pack');
  const sourceNode = findNode(result, 'source', 'Example channel');
  const videoNode = findNode(result, 'video', 'Application video');
  const topicNode = findNode(result, 'topic', 'UIUC');
  const detNode = findNode(result, 'topic', 'Duolingo English Test');
  const personNode = findNode(result, 'person', 'Professor');
  const placeNode = findNode(result, 'place', 'Home desk');
  const eventNode = findNode(result, 'event', 'Application deadline');
  const emotionNode = findNode(result, 'emotion', 'pressure');
  const timeNode = findNode(result, 'time', '2026-06');

  for (const node of [treeNode, packNode, sourceNode, videoNode, topicNode, detNode, personNode, placeNode, eventNode, emotionNode, timeNode]) {
    assert.ok(node);
    assert.equal(node.visibility, 'private');
    assert.ok(node.evidenceIds.length > 0);
  }

  assert.ok(findEdge(result, 'belongs_to', memoryNode.id, treeNode.id));
  assert.ok(findEdge(result, 'belongs_to', memoryNode.id, packNode.id));
  assert.ok(findEdge(result, 'source_of', sourceNode.id, memoryNode.id));
  assert.ok(findEdge(result, 'source_of', videoNode.id, memoryNode.id));
  assert.ok(findEdge(result, 'about', memoryNode.id, topicNode.id));
  assert.ok(findEdge(result, 'mentions', memoryNode.id, personNode.id));
  assert.ok(findEdge(result, 'happened_at', memoryNode.id, placeNode.id));
  assert.ok(findEdge(result, 'about', memoryNode.id, eventNode.id));
  assert.ok(findEdge(result, 'felt_as', memoryNode.id, emotionNode.id));
  assert.ok(findEdge(result, 'happened_in', memoryNode.id, timeNode.id));

  assert.ok(result.evidence.length >= 10);
  for (const evidence of result.evidence) {
    assert.equal(evidence.memoryId, 'm1');
    assert.equal(evidence.visibility, 'private');
    assert.equal(evidence.confidence, 'explicit');
    assert.equal(evidence.reviewStatus, 'input');
  }
});

test('does not infer topics or emotions from free text without explicit fields', () => {
  const { projectMemoryAtlas } = loadProjection();
  const result = projectMemoryAtlas({
    id: 'm2',
    title: 'UIUC DET pressure text only',
    note: 'This text mentions UIUC, DET, pressure, and home, but no explicit fields were provided.',
    visibility: 'private',
  });

  assert.equal(result.nodes.filter((node) => node.type === 'memory').length, 1);
  assert.equal(result.nodes.filter((node) => node.type === 'topic').length, 0);
  assert.equal(result.nodes.filter((node) => node.type === 'emotion').length, 0);
  assert.equal(result.nodes.filter((node) => node.type === 'place').length, 0);
  assert.equal(result.edges.length, 0);
  assert.equal(result.evidence.length, 0);
});

test('deduplicates stable node ids and edge ids while preserving evidence', () => {
  const { projectMemoryAtlas } = loadProjection();
  const result = projectMemoryAtlas([
    {
      id: 'm3',
      title: 'First',
      topics: ['UIUC', 'UIUC'],
      emotion: ['pressure', 'pressure'],
      visibility: 'private',
    },
    {
      id: 'm4',
      title: 'Second',
      topics: ['UIUC'],
      emotion: ['pressure'],
      visibility: 'public',
    },
  ]);

  assert.equal(result.nodes.filter((node) => node.type === 'topic' && node.label === 'UIUC').length, 1);
  assert.equal(result.nodes.filter((node) => node.type === 'emotion' && node.label === 'pressure').length, 1);

  assert.ok(findNode(result, 'topic', 'UIUC').evidenceIds.length >= 2);
  assert.ok(findNode(result, 'emotion', 'pressure').evidenceIds.length >= 2);

  const edgeIds = result.edges.map((edge) => edge.id);
  assert.equal(new Set(edgeIds).size, edgeIds.length);
});

test('downgrades shared derived nodes and incident edges to strictest visibility', () => {
  const { projectMemoryAtlas } = loadProjection();
  const result = projectMemoryAtlas([
    {
      id: 'public-memory',
      title: 'Public memory',
      topics: ['Shared topic'],
      emotion: ['Shared emotion'],
      source: { id: 'shared-source', title: 'Shared source' },
      visibility: 'public',
    },
    {
      id: 'private-memory',
      title: 'Private memory',
      topics: ['Shared topic'],
      emotion: ['Shared emotion'],
      source: { id: 'shared-source', title: 'Shared source' },
      visibility: 'private',
    },
  ]);

  const sharedTopicNode = findNode(result, 'topic', 'Shared topic');
  const sharedEmotionNode = findNode(result, 'emotion', 'Shared emotion');
  const sharedSourceNode = findNode(result, 'source', 'Shared source');

  assert.equal(sharedTopicNode.visibility, 'private');
  assert.equal(sharedEmotionNode.visibility, 'private');
  assert.equal(sharedSourceNode.visibility, 'private');

  for (const edge of result.edges.filter((item) => [sharedTopicNode.id, sharedEmotionNode.id, sharedSourceNode.id].includes(item.from) || [sharedTopicNode.id, sharedEmotionNode.id, sharedSourceNode.id].includes(item.to))) {
    assert.equal(edge.visibility, 'private');
  }

  assertNoPublicEdgePointsToPrivateNode(result);
});

test('returns empty projection for empty or invalid input without throwing', () => {
  const { projectMemoryAtlas } = loadProjection();
  const emptyProjection = { nodes: [], edges: [], evidence: [] };

  assert.deepEqual(normalizeProjectionResult(projectMemoryAtlas(null)), emptyProjection);
  assert.deepEqual(normalizeProjectionResult(projectMemoryAtlas(undefined)), emptyProjection);
  assert.deepEqual(normalizeProjectionResult(projectMemoryAtlas('not input')), emptyProjection);
  assert.deepEqual(normalizeProjectionResult(projectMemoryAtlas({ memories: null })), emptyProjection);
  assert.deepEqual(normalizeProjectionResult(projectMemoryAtlas({ memories: [null, 'bad', 12] })), emptyProjection);
});

test('keeps the helper local, read-only, and separate from Scout/provider code', () => {
  assert.match(projectionSource, /projectMemoryAtlas/);
  assert.match(projectionSource, /PROJECTED_NODE_TYPES/);
  assert.match(projectionSource, /PROJECTED_EDGE_TYPES/);
  assert.match(projectionSource, /getStrictestVisibility/);
  assert.match(projectionSource, /downgradeIncidentEdgesForNode/);
  assert.doesNotMatch(projectionSource, /fetch\s*\(/);
  assert.doesNotMatch(projectionSource, /XMLHttpRequest/);
  assert.doesNotMatch(projectionSource, /localStorage/);
  assert.doesNotMatch(projectionSource, /sessionStorage/);
  assert.doesNotMatch(projectionSource, /indexedDB/);
  assert.doesNotMatch(projectionSource, /document\./);
  assert.doesNotMatch(projectionSource, /apiClient/);
  assert.doesNotMatch(projectionSource, /Scout/);
  assert.doesNotMatch(projectionSource, /provider/i);
  assert.doesNotMatch(projectionSource, /createMemory\s*\(/);
  assert.doesNotMatch(projectionSource, /saveRelationship/);
});
