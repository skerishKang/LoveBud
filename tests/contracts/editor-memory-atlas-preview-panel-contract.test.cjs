'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PANEL_PATH = path.join(ROOT, 'js/editor/editor-memory-atlas-preview-panel.js');
const EDITOR_HTML_PATH = path.join(ROOT, 'pages/editor.html');
const DETAIL_TEMPLATE_PATH = path.join(ROOT, 'js/editor/templates/editor-detail-view-mode-template.js');
const DETAIL_UI_PATH = path.join(ROOT, 'js/editor/editor-detail-ui.js');

const panelSource = fs.readFileSync(PANEL_PATH, 'utf8');
const editorHtml = fs.readFileSync(EDITOR_HTML_PATH, 'utf8');
const detailTemplateSource = fs.readFileSync(DETAIL_TEMPLATE_PATH, 'utf8');
const detailUiSource = fs.readFileSync(DETAIL_UI_PATH, 'utf8');

function loadPanel(overrides) {
  const root = Object.assign({
    LoveBudMemoryAtlasProjection: createProjectionStub(),
    LoveBudMemoryAtlasPreview: createPreviewStub(),
  }, overrides || {});
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: root,
  };
  vm.runInNewContext(panelSource, sandbox, { filename: 'editor-memory-atlas-preview-panel.js' });
  return sandbox.module.exports;
}

function createProjectionStub() {
  return {
    projectMemoryAtlas(records) {
      const memory = Array.isArray(records) ? records[0] : {};
      const memoryId = `memory:${memory.id || 'missing'}`;
      const nodes = [
        { id: memoryId, type: 'memory', label: memory.title || 'Untitled', visibility: memory.visibility || 'private' },
      ];
      const edges = [];
      const evidence = [];

      (memory.topics || []).forEach((topic, index) => {
        const topicId = `topic:${String(topic).toLowerCase()}`;
        const edgeId = `edge:topic:${index}`;
        nodes.push({ id: topicId, type: 'topic', label: String(topic), visibility: memory.visibility || 'private', evidenceIds: [`e-topic-${index}`] });
        edges.push({ id: edgeId, from: memoryId, to: topicId, type: 'about', visibility: memory.visibility || 'private', evidenceIds: [`e-topic-${index}`] });
        evidence.push({ id: `e-topic-${index}`, targetId: topicId, visibility: memory.visibility || 'private' });
      });

      (memory.emotions || []).forEach((emotion, index) => {
        const emotionId = `emotion:${String(emotion).toLowerCase()}`;
        const edgeId = `edge:emotion:${index}`;
        nodes.push({ id: emotionId, type: 'emotion', label: String(emotion), visibility: memory.visibility || 'private', evidenceIds: [`e-emotion-${index}`] });
        edges.push({ id: edgeId, from: memoryId, to: emotionId, type: 'felt_as', visibility: memory.visibility || 'private', evidenceIds: [`e-emotion-${index}`] });
        evidence.push({ id: `e-emotion-${index}`, targetId: emotionId, visibility: memory.visibility || 'private' });
      });

      if (memory.source) {
        const sourceId = `source:${memory.source.id}`;
        nodes.push({ id: sourceId, type: 'source', label: memory.source.title, visibility: memory.visibility || 'private', evidenceIds: ['e-source'] });
        edges.push({ id: 'edge:source', from: sourceId, to: memoryId, type: 'source_of', visibility: memory.visibility || 'private', evidenceIds: ['e-source'] });
        evidence.push({ id: 'e-source', targetId: sourceId, visibility: memory.visibility || 'private' });
      }

      return { nodes, edges, evidence };
    },
  };
}

function createPreviewStub() {
  return {
    createMemoryAtlasPreview(projection) {
      const memoryNode = projection.nodes.find((node) => node.type === 'memory') || null;
      const groups = ['source', 'topic', 'emotion', 'time', 'video', 'person', 'place', 'event', 'tree', 'pack'].map((type) => ({
        type,
        label: `${type[0].toUpperCase()}${type.slice(1)}`,
        items: projection.nodes
          .filter((node) => node.type === type)
          .map((node) => ({
            id: node.id,
            type: node.type,
            label: node.label,
            visibility: node.visibility,
            edgeTypes: [],
            evidenceCount: Array.isArray(node.evidenceIds) ? node.evidenceIds.length : 0,
            previewOnly: true,
          })),
      }));
      const hasItems = groups.some((group) => group.items.length > 0);
      return {
        title: 'Atlas preview',
        copy: {
          title: 'Atlas preview',
          status: 'Preview only — no relationships are saved.',
          basis: "Based on this memory's existing fields.",
          empty: 'No atlas connections to preview yet.',
        },
        empty: !hasItems,
        emptyMessage: hasItems ? '' : 'No atlas connections to preview yet.',
        memory: memoryNode,
        visibility: memoryNode ? memoryNode.visibility : 'private',
        counts: { groups: groups.filter((group) => group.items.length > 0).length, nodes: projection.nodes.length - 1, edges: projection.edges.length, evidence: projection.evidence.length },
        groups,
      };
    },
  };
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

test('exports deterministic editor Memory Atlas preview panel APIs', () => {
  const panel = loadPanel();

  assert.equal(typeof panel.createEditorMemoryAtlasPreviewPanel, 'function');
  assert.equal(typeof panel.buildEditorMemoryAtlasPreviewModel, 'function');
  assert.equal(typeof panel.renderEditorMemoryAtlasPreview, 'function');
  assert.equal(panel.PANEL_COPY.title, 'Atlas preview');
  assert.equal(panel.PANEL_COPY.status, 'Preview only — these relationships are not saved.');
});

test('renders grouped preview HTML into a supplied container without app bootstrap side effects', () => {
  const panel = loadPanel();
  const renderer = panel.createEditorMemoryAtlasPreviewPanel();
  const container = makeRenderContainer();

  const model = renderer.render(container, {
    id: 'm1',
    title: 'Application memory',
    memo: 'Preparing UIUC documents',
    tags: ['UIUC'],
    emotions: ['hope'],
    sourceUrl: 'https://example.com/video',
    visibility: 'private',
  });

  assert.equal(model.available, true);
  assert.equal(model.empty, false);
  assert.equal(model.visibility, 'private');
  assert.equal(container.hidden, false);
  assert.match(container.innerHTML, /data-memory-atlas-preview="1"/);
  assert.match(container.innerHTML, /Atlas preview/);
  assert.match(container.innerHTML, /Preview only — these relationships are not saved\./);
  assert.match(container.innerHTML, /UIUC/);
  assert.match(container.innerHTML, /hope/);
});

test('renders selected-memory empty state without implying persistence', () => {
  const panel = loadPanel();
  const container = makeRenderContainer();

  const model = panel.renderEditorMemoryAtlasPreview(container, {
    id: 'm2',
    title: 'Plain memory',
    memo: 'No explicit atlas fields yet',
    visibility: 'private',
  }, {
    projectionApi: createProjectionStub(),
    previewApi: createPreviewStub(),
  });

  assert.equal(model.available, true);
  assert.equal(model.empty, true);
  assert.equal(container.hidden, false);
  assert.match(container.innerHTML, /No atlas connections to preview yet\./);
  assert.doesNotMatch(container.innerHTML, /Saved relationship/);
  assert.doesNotMatch(container.innerHTML, /AI found/);
});

test('hides the panel when helpers or selected memory are unavailable', () => {
  const panel = loadPanel({ LoveBudMemoryAtlasProjection: null, LoveBudMemoryAtlasPreview: null });
  const container = makeRenderContainer();
  container.appendChild({ tagName: 'section', textContent: 'old' });

  const renderer = panel.createEditorMemoryAtlasPreviewPanel();
  const model = renderer.render(container, { id: 'm3', title: 'Memory' });

  assert.equal(model.available, false);
  assert.equal(container.innerHTML, '');
  assert.equal(container.hidden, true);
});

test('editor detail template exposes a stable Atlas preview mount', () => {
  assert.match(detailTemplateSource, /id="detailAtlasPreviewMount"/);
  assert.match(detailTemplateSource, /editor-memory-atlas-preview-mount/);
  assert.match(detailTemplateSource, /hidden/);
});

test('editor detail UI wires the Atlas preview renderer only for selected memory context', () => {
  assert.match(detailUiSource, /createEditorMemoryAtlasPreviewPanel/);
  assert.match(detailUiSource, /atlasPreviewPanel\.render\(atlasPreviewMount, data, \{/);
  assert.match(detailUiSource, /treeMemories: treeState\.treeMemories/);
  assert.match(detailUiSource, /atlasPreviewPanel\.render\(atlasPreviewMount, null\)/);
  assert.match(detailUiSource, /detailAtlasPreviewMount/);
});

test('editor page loads Memory Atlas helpers before detail UI', () => {
  const projectionIndex = editorHtml.indexOf('js/memory-atlas/memory-atlas-projection.js');
  const previewIndex = editorHtml.indexOf('js/memory-atlas/memory-atlas-preview.js');
  const panelIndex = editorHtml.indexOf('js/editor/editor-memory-atlas-preview-panel.js');
  const detailUiIndex = editorHtml.indexOf('js/editor/editor-detail-ui.js');

  assert.ok(projectionIndex > 0);
  assert.ok(previewIndex > projectionIndex);
  assert.ok(panelIndex > previewIndex);
  assert.ok(detailUiIndex > panelIndex);
});

test('keeps preview panel integration local, non-persistent, and separate from provider work', () => {
  for (const source of [panelSource, detailUiSource]) {
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /XMLHttpRequest/);
    assert.doesNotMatch(source, /sessionStorage/);
    assert.doesNotMatch(source, /indexedDB/);
    assert.doesNotMatch(source, /Scout/);
    assert.doesNotMatch(source, /provider/i);
    assert.doesNotMatch(source, /saveRelationship/);
    assert.doesNotMatch(source, /Published wiki page/);
    assert.doesNotMatch(source, /Public graph/);
    assert.doesNotMatch(source, /AI found/);
    assert.doesNotMatch(source, /Saved relationship/);
  }
  // Exclude detailUiSource from localStorage checks as it queries for ?atlasPreview=1 or local debug config
  assert.doesNotMatch(panelSource, /localStorage/);
});
