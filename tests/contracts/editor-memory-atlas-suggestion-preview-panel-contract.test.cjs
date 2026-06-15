'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PANEL_PATH = path.join(ROOT, 'js/editor/editor-memory-atlas-preview-panel.js');
const SUGGESTIONS_PATH = path.join(ROOT, 'js/memory-atlas/memory-atlas-suggestions.js');
const PROJECTION_PATH = path.join(ROOT, 'js/memory-atlas/memory-atlas-projection.js');
const EDITOR_DETAIL_UI_PATH = path.join(ROOT, 'js/editor/editor-detail-ui.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');

const panelSource = fs.readFileSync(PANEL_PATH, 'utf8');
const suggestionSource = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
const projectionSource = fs.readFileSync(PROJECTION_PATH, 'utf8');
const editorDetailUISource = fs.readFileSync(EDITOR_DETAIL_UI_PATH, 'utf8');
const editorHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');

function loadPanel(overrides) {
  const root = Object.assign({
    LoveBudMemoryAtlasProjection: createProjectionStub(),
    LoveBudMemoryAtlasPreview: createPreviewStub(),
    LoveBudMemoryAtlasRelationshipSuggestions: loadSuggestionHelper(),
  }, overrides || {});
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: root,
  };
  vm.runInNewContext(panelSource, sandbox, { filename: 'editor-memory-atlas-preview-panel.js' });
  return sandbox.module.exports;
}

function loadSuggestionHelper() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(suggestionSource, sandbox, { filename: 'memory-atlas-suggestions.js' });
  return sandbox.module.exports;
}

function loadProjectionHelper() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(projectionSource, sandbox, { filename: 'memory-atlas-projection.js' });
  return sandbox.module.exports;
}

function makeRenderContainer() {
  const children = [];
  const container = {
    hidden: true,
    children,
    appendChild(child) {
      child.parentElement = this;
      children.push(child);
      return child;
    },
    replaceChildren() {
      children.length = 0;
      this.textContent = '';
    },
    set textContent(value) {
      this._textContent = value;
      if (value === '') children.length = 0;
    },
    get textContent() {
      return children.map((child) => child.textContent || '').join('');
    },
    get innerHTML() {
      return children.map((child) => serializeElement(child)).join('');
    },
  };
  return container;
}

function serializeElement(element) {
  const tag = element.tagName || 'div';
  const className = element.className ? ` class="${element.className}"` : '';
  const attrs = Object.entries(element.attributes || {})
    .filter(([name]) => name !== 'className')
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  const children = Array.isArray(element.children) ? element.children.map(serializeElement).join('') : '';
  const text = element.textContent && !children ? escapeText(element.textContent) : '';
  return `<${tag}${className}${attrs}>${text}${children}</${tag}>`;
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createProjectionStub() {
  return {
    projectMemoryAtlas(records) {
      const memory = Array.isArray(records) ? records[0] : {};
      const memoryId = String(memory.id || 'm1');
      return {
        nodes: [
          { id: `memory:${memoryId}`, type: 'memory', memoryId, label: memory.title || 'Untitled', visibility: memory.visibility || 'private' },
        ],
        edges: [],
        evidence: [],
      };
    },
  };
}

function createPreviewStub() {
  return {
    createMemoryAtlasPreview(projection) {
      const memoryNode = projection.nodes.find((node) => node.type === 'memory') || { id: 'memory:m1', label: 'Memory', visibility: 'private' };
      return {
        empty: false,
        emptyMessage: '',
        memory: { id: memoryNode.id, label: memoryNode.label, visibility: memoryNode.visibility || 'private' },
        visibility: memoryNode.visibility || 'private',
        counts: { groups: 0, nodes: 0, edges: 0, evidence: 0 },
        groups: [{ type: 'topic', label: 'Topics', items: [] }],
      };
    },
  };
}

function createSuggestionProjection() {
  return {
    nodes: [
      { id: 'memory:m1', type: 'memory', memoryId: 'm1', label: 'Memory 1', visibility: 'private' },
      { id: 'memory:m2', type: 'memory', memoryId: 'm2', label: 'Memory 2', visibility: 'private' },
      { id: 'topic:uiuc', type: 'topic', label: 'UIUC', visibility: 'private' },
    ],
    edges: [],
    evidence: [
      { id: 'e-m1-topic', memoryId: 'm1', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
      { id: 'e-m2-topic', memoryId: 'm2', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
    ],
  };
}

function createEmptySuggestionProjection() {
  return {
    nodes: [
      { id: 'memory:m1', type: 'memory', memoryId: 'm1', label: 'Memory 1', visibility: 'private' },
    ],
    edges: [],
    evidence: [],
  };
}

function createUnrelatedSuggestionProjection() {
  return {
    nodes: [
      { id: 'memory:m1', type: 'memory', memoryId: 'm1', label: 'Memory 1', visibility: 'private' },
      { id: 'memory:m2', type: 'memory', memoryId: 'm2', label: 'Memory 2', visibility: 'private' },
      { id: 'memory:m3', type: 'memory', memoryId: 'm3', label: 'Memory 3', visibility: 'private' },
      { id: 'topic:uiuc', type: 'topic', label: 'UIUC', visibility: 'private' },
    ],
    edges: [],
    evidence: [
      { id: 'e-m1-topic', memoryId: 'm1', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
      { id: 'e-m2-topic', memoryId: 'm2', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
      { id: 'e-m3-topic', memoryId: 'm3', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
    ],
  };
}

function createProjectionFromRawMemories(records) {
  return loadProjectionHelper().projectMemoryAtlas(records);
}

test('exports deterministic editor Memory Atlas suggestion preview APIs', () => {
  const panel = loadPanel();

  assert.equal(typeof panel.createEditorMemoryAtlasPreviewPanel, 'function');
  assert.equal(typeof panel.buildEditorMemoryAtlasSuggestionPreviewModel, 'function');
  assert.equal(typeof panel.renderEditorMemoryAtlasSuggestionPreview, 'function');
  assert.equal(panel.SUGGESTION_COPY.title, 'Suggested connections');
  assert.equal(panel.SUGGESTION_COPY.status, 'Preview only — these relationships are not saved.');
  assert.equal(panel.SUGGESTION_COPY.basis, 'Based on existing memory evidence.');
  assert.equal(panel.SUGGESTION_COPY.review, 'Review before saving any future relationship.');
});

test('renders preview-only suggestion section for selected memory context', () => {
  const panel = loadPanel({
    LoveBudMemoryAtlasProjection: { projectMemoryAtlas: () => createSuggestionProjection() },
    LoveBudMemoryAtlasPreview: {
      createMemoryAtlasPreview: () => ({
        empty: false,
        emptyMessage: '',
        memory: { id: 'memory:m1', label: 'Memory 1', visibility: 'private' },
        visibility: 'private',
        counts: { groups: 0, nodes: 0, edges: 0, evidence: 0 },
        groups: [],
      }),
    },
  });
  const renderer = panel.createEditorMemoryAtlasPreviewPanel();
  const container = makeRenderContainer();

  const model = renderer.render(container, {
    id: 'm1',
    title: 'Memory 1',
    visibility: 'private',
  });

  assert.equal(model.available, true);
  assert.equal(model.suggestions.length, 1);
  assert.equal(model.suggestions[0].sourceMemoryId, 'm1');
  assert.equal(model.suggestions[0].state, 'previewed');
  assert.equal(model.suggestions[0].previewOnly, true);
  assert.equal(container.hidden, false);
  assert.match(container.innerHTML, /data-memory-atlas-suggestion-preview="1"/);
  assert.match(container.innerHTML, /Suggested connections/);
  assert.match(container.innerHTML, /Preview only — these relationships are not saved\./);
  assert.match(container.innerHTML, /Based on existing memory evidence\./);
  assert.match(container.innerHTML, /Review before saving any future relationship\./);
  assert.match(container.innerHTML, /data-preview-only="true"/);
  assert.match(container.innerHTML, /data-suggestion-type="topic_match"/);
  assert.match(container.innerHTML, /data-visibility="private"/);
  assert.doesNotMatch(container.innerHTML, /<button/i);
  assert.doesNotMatch(container.innerHTML, /accept/i);
  assert.doesNotMatch(container.innerHTML, /dismiss/i);
});

test('editor detail UI passes tree memories into atlas preview renderer', () => {
  assert.match(editorDetailUISource, /atlasPreviewPanel\.render\(atlasPreviewMount, data, \{/);
  assert.match(editorDetailUISource, /treeMemories: treeState\.treeMemories/);
  assert.match(editorDetailUISource, /const treeState = getTreeState\(\);/);
});

test('hides saved-looking suggestions when evidence is absent', () => {
  const panel = loadPanel();
  const model = panel.buildEditorMemoryAtlasSuggestionPreviewModel({ id: 'm1' }, {
    projection: createEmptySuggestionProjection(),
    projectionApi: { projectMemoryAtlas: () => createEmptySuggestionProjection() },
    suggestionsApi: {
      createMemoryAtlasRelationshipSuggestions() {
        return [{
          id: 'atlas-suggestion:saved-without-evidence',
          state: 'saved',
          sourceMemoryId: 'm1',
          targetMemoryId: 'm2',
          evidenceRefs: [],
          previewOnly: false,
          visibility: 'private',
          reasonCode: 'topic_match',
        }];
      },
    },
  });

  assert.equal(model.available, true);
  assert.equal(model.empty, true);
  assert.equal(model.suggestions.length, 0);
});

test('uses selectedMemoryId scoping and does not mix unrelated memories', () => {
  const panel = loadPanel();
  let capturedOptions = null;
  const model = panel.buildEditorMemoryAtlasSuggestionPreviewModel({ id: 'm1' }, {
    projection: createUnrelatedSuggestionProjection(),
    projectionAdapter: { projectMemoryAtlas: () => createUnrelatedSuggestionProjection() },
    suggestionAdapter: {
      createMemoryAtlasRelationshipSuggestions(projection, options) {
        capturedOptions = options;
        return loadSuggestionHelper().createMemoryAtlasRelationshipSuggestions(projection, options);
      },
    },
  });

  assert.equal(capturedOptions.selectedMemoryId, 'm1');
  assert.equal(capturedOptions.defaultState, 'previewed');
  assert.equal(model.selectedMemoryId, 'm1');
  assert.equal(model.suggestions.length, 2);
  assert.ok(model.suggestions.every((suggestion) => suggestion.sourceMemoryId === 'm1'));
  assert.ok(model.suggestions.every((suggestion) => suggestion.targetMemoryId !== 'm1'));
});

test('uses same-tree candidate memories and adapted projection evidence for real suggestions', () => {
  const projectionApi = loadProjectionHelper();
  const calls = [];
  const selected = {
    id: 'm1',
    title: 'Memory 1',
    visibility: 'private',
    treeId: 'tree-a',
    topics: ['UIUC'],
    emotions: ['hopeful'],
    sourceUrl: 'https://youtube.com/watch?v=abc',
    sourceTitle: 'Video A',
  };
  const treeMemories = [
    selected,
    { id: 'm2', title: 'Memory 2', visibility: 'private', treeId: 'tree-a', topics: ['UIUC'], emotions: ['calm'], sourceUrl: 'https://youtube.com/watch?v=abc', sourceTitle: 'Video A' },
    { id: 'm3', title: 'Memory 3', visibility: 'private', treeId: 'tree-a', topics: ['Seoul'], emotions: ['hopeful'] },
    { id: 'global-1', title: 'Global', treeId: 'tree-b', topics: ['UIUC'] },
    { id: 'new-1', title: 'New', treeId: 'tree-a', isNewTree: true, topics: ['UIUC'] },
    { id: 'm2', title: 'Duplicate', treeId: 'tree-a', topics: ['UIUC'] },
  ];
  const panel = loadPanel({
    LoveBudMemoryAtlasProjection: {
      projectMemoryAtlas(records) {
        calls.push(records.map((record) => record.id));
        return projectionApi.projectMemoryAtlas(records);
      },
    },
  });
  const renderer = panel.createEditorMemoryAtlasPreviewPanel();
  const container = makeRenderContainer();

  const model = renderer.render(container, selected, { treeMemories });
  const suggestionCall = calls.find((recordIds) => recordIds.includes('m2') && recordIds.includes('m3'));

  assert.ok(calls.some((recordIds) => recordIds.length === 1 && recordIds[0] === 'm1'));
  assert.ok(suggestionCall);
  assert.equal(JSON.stringify(suggestionCall), JSON.stringify(['m1', 'm2', 'm3']));
  assert.equal(model.suggestions.length, 3);
  assert.ok(model.suggestions.some((suggestion) => suggestion.type === 'topic_match' && suggestion.targetMemoryId === 'm2'));
  assert.ok(model.suggestions.some((suggestion) => suggestion.type === 'source_match' && suggestion.targetMemoryId === 'm2'));
  assert.ok(model.suggestions.some((suggestion) => suggestion.type === 'emotion_match' && suggestion.targetMemoryId === 'm3'));
  assert.ok(model.suggestions.every((suggestion) => suggestion.sourceMemoryId === 'm1'));
  assert.ok(model.suggestions.every((suggestion) => Array.isArray(suggestion.evidenceRefs) && suggestion.evidenceRefs.length > 0));
  assert.match(container.innerHTML, /data-memory-atlas-suggestion-preview="1"/);
  assert.match(container.innerHTML, /data-suggestion-type="topic_match"/);
  assert.match(container.innerHTML, /data-suggestion-type="source_match"/);
  assert.match(container.innerHTML, /data-suggestion-type="emotion_match"/);
});

test('emotionTags-only memories still produce emotion_match suggestions', () => {
  const projectionApi = loadProjectionHelper();
  const calls = [];
  const selected = {
    id: 'm1',
    title: 'Memory 1',
    visibility: 'private',
    treeId: 'tree-a',
    topics: ['Seoul'],
    emotionTags: ['hopeful'],
    sourceUrl: 'https://youtube.com/watch?v=abc',
    sourceTitle: 'Video A',
  };
  const treeMemories = [
    selected,
    { id: 'm2', title: 'Memory 2', visibility: 'private', treeId: 'tree-a', topics: ['London'], emotionTags: ['hopeful'] },
    { id: 'm3', title: 'Memory 3', visibility: 'private', treeId: 'tree-a', topics: ['Seoul'], emotions: ['hopeful'] },
  ];
  const panel = loadPanel({
    LoveBudMemoryAtlasProjection: {
      projectMemoryAtlas(records) {
        calls.push(records.map((record) => record.id));
        return projectionApi.projectMemoryAtlas(records);
      },
    },
  });
  const renderer = panel.createEditorMemoryAtlasPreviewPanel();
  const container = makeRenderContainer();
  const model = renderer.render(container, selected, { treeMemories });

  assert.ok(model.suggestions.some((s) => s.type === 'emotion_match' && s.targetMemoryId === 'm2'), 'emotion_match via emotionTags only');
  assert.ok(model.suggestions.some((s) => s.type === 'emotion_match' && s.targetMemoryId === 'm3'), 'emotion_match via emotions + emotionTags');
  assert.ok(model.suggestions.every((s) => s.sourceMemoryId === 'm1'));
  assert.ok(model.suggestions.every((s) => Array.isArray(s.evidenceRefs) && s.evidenceRefs.length > 0));
  assert.match(container.innerHTML, /data-suggestion-type="emotion_match"/);
});

test('editor page loads memory-atlas-suggestions before the consuming preview panel', () => {
  const suggestionsIndex = editorHtml.indexOf('js/memory-atlas/memory-atlas-suggestions.js');
  const panelIndex = editorHtml.indexOf('js/editor/editor-memory-atlas-preview-panel.js');
  const detailUiIndex = editorHtml.indexOf('js/editor/editor-detail-ui.js');

  assert.ok(suggestionsIndex > 0);
  assert.ok(panelIndex > suggestionsIndex);
  assert.ok(detailUiIndex > panelIndex);
});

test('keeps suggestion preview copy preview-only and forbids saved/publication language', () => {
  assert.doesNotMatch(panelSource, /Saved relationship/);
  assert.doesNotMatch(panelSource, /Saved connection/);
  assert.doesNotMatch(panelSource, /Published graph/);
  assert.doesNotMatch(panelSource, /Public wiki link/);
  assert.doesNotMatch(panelSource, /Auto-saved connection/);
  assert.match(panelSource, /Suggested connections/);
  assert.match(panelSource, /Preview only — these relationships are not saved\./);
  assert.match(panelSource, /Based on existing memory evidence\./);
  assert.match(panelSource, /Review before saving any future relationship\./);
});

test('keeps suggestion preview panel local, non-persistent, and provider-free', () => {
  assert.doesNotMatch(panelSource, /fetch\s*\(/);
  assert.doesNotMatch(panelSource, /XMLHttpRequest/);
  assert.doesNotMatch(panelSource, /WebSocket/);
  assert.doesNotMatch(panelSource, /localStorage/);
  assert.doesNotMatch(panelSource, /sessionStorage/);
  assert.doesNotMatch(panelSource, /indexedDB/);
  assert.doesNotMatch(panelSource, /Scout/);
  assert.doesNotMatch(panelSource, /provider/i);
  assert.doesNotMatch(panelSource, /api/i);
  assert.doesNotMatch(panelSource, /schema/);
  assert.doesNotMatch(panelSource, /\bDB\b/);
  assert.doesNotMatch(panelSource, /saveRelationship/);
  assert.doesNotMatch(panelSource, /Browse/);
  assert.doesNotMatch(panelSource, /Search/);
  assert.doesNotMatch(panelSource, /redesign/i);
  assert.doesNotMatch(panelSource, /#2418|#1882|closed|completed/i);
});
