'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PREVIEW_PATH = path.join(ROOT, 'js/memory-atlas/memory-atlas-preview.js');
const previewSource = fs.readFileSync(PREVIEW_PATH, 'utf8');

function loadPreview() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(previewSource, sandbox, { filename: 'memory-atlas-preview.js' });
  return sandbox.module.exports;
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function groupByType(preview, type) {
  return preview.groups.find((group) => group.type === type);
}

test('exports non-persistent Memory Atlas preview API and copy', () => {
  const preview = loadPreview();

  assert.equal(typeof preview.createMemoryAtlasPreview, 'function');
  assert.deepEqual(Array.from(preview.PREVIEW_GROUP_TYPES), [
    'source',
    'video',
    'topic',
    'person',
    'place',
    'event',
    'emotion',
    'time',
    'tree',
    'pack',
  ]);
  assert.equal(preview.PREVIEW_COPY.title, 'Atlas preview');
  assert.equal(preview.PREVIEW_COPY.status, 'Preview only — no relationships are saved.');
  assert.equal(preview.PREVIEW_COPY.basis, "Based on this memory's existing fields.");
  assert.equal(preview.PREVIEW_COPY.review, 'Review before saving any future relationship.');
});

test('returns a safe empty preview state for missing or empty projection input', () => {
  const { createMemoryAtlasPreview } = loadPreview();
  const emptyPreview = normalize(createMemoryAtlasPreview(null));

  assert.equal(emptyPreview.empty, true);
  assert.equal(emptyPreview.emptyMessage, 'No atlas connections to preview yet.');
  assert.equal(emptyPreview.memory, null);
  assert.equal(emptyPreview.visibility, 'private');
  assert.deepEqual(emptyPreview.counts, { groups: 0, nodes: 0, edges: 0, evidence: 0 });
  assert.equal(emptyPreview.groups.length, 10);
  assert.ok(emptyPreview.groups.every((group) => Array.isArray(group.items) && group.items.length === 0));

  assert.deepEqual(normalize(createMemoryAtlasPreview({ nodes: [], edges: [], evidence: [] })).counts, emptyPreview.counts);
});

test('summarizes memory-connected atlas nodes by preview groups', () => {
  const { createMemoryAtlasPreview } = loadPreview();
  const result = normalize(createMemoryAtlasPreview({
    nodes: [
      { id: 'memory:m1', type: 'memory', label: 'My memory', visibility: 'private' },
      { id: 'topic:uiuc', type: 'topic', label: 'UIUC', visibility: 'private', evidenceIds: ['e1'] },
      { id: 'emotion:hope', type: 'emotion', label: 'hope', visibility: 'private', evidenceIds: ['e2'] },
      { id: 'source:youtube', type: 'source', label: 'YouTube source', visibility: 'private', evidenceIds: ['e3'] },
      { id: 'time:2026-06', type: 'time', label: '2026-06', visibility: 'private', evidenceIds: ['e4'] },
      { id: 'topic:unrelated', type: 'topic', label: 'Unrelated', visibility: 'private', evidenceIds: ['e5'] },
    ],
    edges: [
      { id: 'edge:1', from: 'memory:m1', to: 'topic:uiuc', type: 'about', visibility: 'private', evidenceIds: ['e1'] },
      { id: 'edge:2', from: 'memory:m1', to: 'emotion:hope', type: 'felt_as', visibility: 'private', evidenceIds: ['e2'] },
      { id: 'edge:3', from: 'source:youtube', to: 'memory:m1', type: 'source_of', visibility: 'private', evidenceIds: ['e3'] },
      { id: 'edge:4', from: 'memory:m1', to: 'time:2026-06', type: 'happened_in', visibility: 'private', evidenceIds: ['e4'] },
    ],
    evidence: [
      { id: 'e1', targetId: 'topic:uiuc', visibility: 'private' },
      { id: 'e2', targetId: 'emotion:hope', visibility: 'private' },
      { id: 'e3', targetId: 'source:youtube', visibility: 'private' },
      { id: 'e4', targetId: 'time:2026-06', visibility: 'private' },
      { id: 'e5', targetId: 'topic:unrelated', visibility: 'private' },
    ],
  }));

  assert.equal(result.empty, false);
  assert.equal(result.memory.label, 'My memory');
  assert.equal(result.visibility, 'private');
  assert.equal(result.counts.nodes, 4);
  assert.equal(result.counts.edges, 4);
  assert.equal(result.counts.groups, 4);

  assert.deepEqual(groupByType(result, 'topic').items.map((item) => item.label), ['UIUC']);
  assert.deepEqual(groupByType(result, 'emotion').items.map((item) => item.label), ['hope']);
  assert.deepEqual(groupByType(result, 'source').items.map((item) => item.label), ['YouTube source']);
  assert.deepEqual(groupByType(result, 'time').items.map((item) => item.label), ['2026-06']);
  assert.equal(groupByType(result, 'topic').items[0].previewOnly, true);
  assert.deepEqual(groupByType(result, 'topic').items[0].edgeTypes, ['about']);
});

test('selects an explicit memory node when a projection contains multiple memories', () => {
  const { createMemoryAtlasPreview } = loadPreview();
  const result = normalize(createMemoryAtlasPreview({
    nodes: [
      { id: 'memory:first', type: 'memory', label: 'First memory', visibility: 'public' },
      { id: 'memory:second', type: 'memory', label: 'Second memory', visibility: 'private' },
      { id: 'topic:first', type: 'topic', label: 'First topic', visibility: 'public' },
      { id: 'topic:second', type: 'topic', label: 'Second topic', visibility: 'private' },
    ],
    edges: [
      { id: 'edge:first', from: 'memory:first', to: 'topic:first', type: 'about', visibility: 'public' },
      { id: 'edge:second', from: 'memory:second', to: 'topic:second', type: 'about', visibility: 'private' },
    ],
    evidence: [],
  }, { memoryNodeId: 'memory:second' }));

  assert.equal(result.memory.label, 'Second memory');
  assert.equal(result.visibility, 'private');
  assert.deepEqual(groupByType(result, 'topic').items.map((item) => item.label), ['Second topic']);
});

test('preserves public visibility only when connected preview evidence is public', () => {
  const { createMemoryAtlasPreview } = loadPreview();
  const result = normalize(createMemoryAtlasPreview({
    nodes: [
      { id: 'memory:m1', type: 'memory', label: 'Public memory', visibility: 'public' },
      { id: 'topic:public', type: 'topic', label: 'Public topic', visibility: 'public' },
    ],
    edges: [
      { id: 'edge:public', from: 'memory:m1', to: 'topic:public', type: 'about', visibility: 'public' },
    ],
    evidence: [
      { id: 'e1', targetId: 'topic:public', visibility: 'public' },
    ],
  }));

  assert.equal(result.visibility, 'public');
  assert.equal(groupByType(result, 'topic').items[0].visibility, 'public');
});

test('ignores unrelated private evidence when previewing a public selected memory', () => {
  const { createMemoryAtlasPreview } = loadPreview();
  const result = normalize(createMemoryAtlasPreview({
    nodes: [
      { id: 'memory:public', type: 'memory', label: 'Public memory', visibility: 'public' },
      { id: 'memory:private', type: 'memory', label: 'Private memory', visibility: 'private' },
      { id: 'topic:public', type: 'topic', label: 'Public topic', visibility: 'public' },
      { id: 'topic:private', type: 'topic', label: 'Private topic', visibility: 'private' },
    ],
    edges: [
      { id: 'edge:public', from: 'memory:public', to: 'topic:public', type: 'about', visibility: 'public' },
      { id: 'edge:private', from: 'memory:private', to: 'topic:private', type: 'about', visibility: 'private' },
    ],
    evidence: [
      { id: 'e-public', targetId: 'topic:public', visibility: 'public' },
      { id: 'e-private-node', targetId: 'topic:private', visibility: 'private' },
      { id: 'e-private-edge', targetId: 'edge:private', visibility: 'private' },
    ],
  }, { memoryNodeId: 'memory:public' }));

  assert.equal(result.visibility, 'public');
  assert.deepEqual(groupByType(result, 'topic').items.map((item) => item.label), ['Public topic']);
});

test('does not include forbidden persisted, AI, publication, or public graph copy', () => {
  const source = previewSource;

  assert.doesNotMatch(source, /Saved relationship/);
  assert.doesNotMatch(source, /AI found/);
  assert.doesNotMatch(source, /Published wiki page/);
  assert.doesNotMatch(source, /Public graph/);
});

test('keeps the preview helper pure, local, and non-persistent', () => {
  assert.match(previewSource, /createMemoryAtlasPreview/);
  assert.match(previewSource, /Preview only/);
  assert.match(previewSource, /collectPreviewTargetIds/);
  assert.doesNotMatch(previewSource, /fetch\s*\(/);
  assert.doesNotMatch(previewSource, /XMLHttpRequest/);
  assert.doesNotMatch(previewSource, /localStorage/);
  assert.doesNotMatch(previewSource, /sessionStorage/);
  assert.doesNotMatch(previewSource, /indexedDB/);
  assert.doesNotMatch(previewSource, /document\./);
  assert.doesNotMatch(previewSource, /apiClient/);
  assert.doesNotMatch(previewSource, /Scout/);
  assert.doesNotMatch(previewSource, /provider/i);
  assert.doesNotMatch(previewSource, /saveRelationship/);
  assert.doesNotMatch(previewSource, /createMemory\s*\(/);
});
