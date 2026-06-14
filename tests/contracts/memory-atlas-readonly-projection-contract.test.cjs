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

function findNode(result, type, label) {
  return result.nodes.find((node) => node.type === type && node.label === label);
}

function findEdge(result, type, from, to) {
  return result.edges.find((edge) => edge.type === type && edge.from === from && edge.to === to);
}

test('exports the read-only Memory Atlas projection API and vocabulary', () => {
  const projection = loadProjection();

  assert.equal(typeof projection.projectMemoryAtlas, 'function');
  assert.deepEqual(projection.PROJECTED_NODE_TYPES, [
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
  assert.ok(projection.PROJECTED_EDGE_TYPES.includes('belongs_to'));
  assert.ok(projection.PROJECTED_EDGE_TYPES.includes('source_of'));
  assert.ok(projection.PROJECTED_EDGE_TYPES.includes('felt_as'));
  assert.ok(projection.PROJECTED_EDGE_TYPES.includes('happened_in'));
});

test('projects memory records into explicit nodes, edges, and evidence references', () => {
  const { projectMemoryAtlas } = loadProjection();
  const result = projectMemoryAtlas([
    {
      id: 'm1',
      title: 'UIUC plan pressure',
      note: 'I was thinking about UIUC and DET.',
      treeId: 'tree-study',
      treeTitle: 'Study Tree',
      packId: 'pack-june',
      packTitle: 'June pressure pack',
      source: {
        id: 'source-youtube-channel',
        type: 'youtube-channel',
        url: 'https://www.youtube.com/@example',
        title: 'Example channel',
      },
      video: {
        id: 'video-123',
        url: 'https://youtu.be/video-123',
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
  assert.ok(memoryNode, 'memory node should be created');
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
    assert.ok(node, 'derived node should exist');
    assert.equal(node.visibility, 'private');
    assert.ok(node.evidenceIds.length > 0, 'derived node should include evidence references');
  }

  assert.ok(findEdge(result, 'belongs_to', memoryNode.id, treeNode.id), 'memory should belong to tree');
  assert.ok(findEdge(result, 'belongs_to', memoryNode.id, packNode.id), 'memory should belong to pack');
  assert.ok(findEdge(result, 'source_of', sourceNode.id, memoryNode.id), 'source should be source_of memory');
  assert.ok(findEdge(result, 'source_of', videoNode.id, memoryNode.id), 'video should be source_of memory');
  assert.ok(findEdge(result, 'about', memoryNode.id, topicNode.id), 'memory should be about topic');
  assert.ok(findEdge(result, 'mentions', memoryNode.id, personNode.id), 'memory should mention person');
  assert.ok(findEdge(result, 'happened_at', memoryNode.id, placeNode.id), 'memory should have place edge');
  assert.ok(findEdge(result, 'about', memoryNode.id, eventNode.id), 'memory should be about event');
  assert.ok(findEdge(result, 'felt_as', memoryNode.id, emotionNode.id), 'memory should have emotion edge');
  assert.ok(findEdge(result, 'happened_in', memoryNode.id, timeNode.id), 'memory should have time edge');

  assert.ok(result.evidence.length >= 10, 'derived nodes and edges should have evidence');
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

test('deduplicates stable node ids and edge ids while preserving evidence references', () => {
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

  const uiucNode = findNode(result, 'topic', 'UIUC');
  const pressureNode = findNode(result, 'emotion', 'pressure');

  assert.ok(uiucNode.evidenceIds.length >= 2, 'shared topic node should retain evidence from multiple memories');
  assert.ok(pressureNode.evidenceIds.length >= 2, 'shared emotion node should retain evidence from multiple memories');

  const edgeIds = result.edges.map((edge) => edge.id);
  assert.equal(new Set(edgeIds).size, edgeIds.length, 'edge ids should be deduplicated');
});

test('returns empty projection for empty or invalid input without throwing', () => {
  const { projectMemoryAtlas } = loadProjection();

  assert.deepEqual(projectMemoryAtlas(null), { nodes: [], edges: [], evidence: [] });
  assert.deepEqual(projectMemoryAtlas(undefined), { nodes: [], edges: [], evidence: [] });
  assert.deepEqual(projectMemoryAtlas('not input'), { nodes: [], edges: [], evidence: [] });
  assert.deepEqual(projectMemoryAtlas({ memories: null }), { nodes: [], edges: [], evidence: [] });
  assert.deepEqual(projectMemoryAtlas({ memories: [null, 'bad', 12] }), { nodes: [], edges: [], evidence: [] });
});

test('preserves safe defaults and has no persistence, DOM, provider, or network behavior', () => {
  assert.match(projectionSource, /projectMemoryAtlas/);
  assert.match(projectionSource, /PROJECTED_NODE_TYPES/);
  assert.match(projectionSource, /PROJECTED_EDGE_TYPES/);
  assert.doesNotMatch(projectionSource, /fetch\s*\(/);
  assert.doesNotMatch(projectionSource, /XMLHttpRequest/);
  assert.doesNotMatch(projectionSource, /localStorage/);
  assert.doesNotMatch(projectionSource, /sessionStorage/);
  assert.doesNotMatch(projectionSource, /indexedDB/);
  assert.doesNotMatch(projectionSource, /document\./);
  assert.doesNotMatch(projectionSource, /apiClient/);
  assert.doesNotMatch(projectionSource, /firebase/i);
  assert.doesNotMatch(projectionSource, /Scout/);
  assert.doesNotMatch(projectionSource, /provider/i);
  assert.doesNotMatch(projectionSource, /createMemory\s*\(/);
  assert.doesNotMatch(projectionSource, /saveRelationship/);
});
