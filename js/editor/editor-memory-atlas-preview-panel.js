(function attachEditorMemoryAtlasPreviewPanel(root, factory) {
  const api = factory(root || {});

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.createEditorMemoryAtlasPreviewPanel = api.createEditorMemoryAtlasPreviewPanel;
    root.LoveBudEditorMemoryAtlasPreviewPanel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createEditorMemoryAtlasPreviewPanelApi(root) {
  'use strict';

  const PANEL_COPY = Object.freeze({
    title: 'Atlas preview',
    status: 'Preview only — no relationships are saved.',
    basis: "Based on this memory's existing fields.",
    empty: 'No atlas connections to preview yet.',
    visibilityLabel: 'Visibility',
  });

  function createEditorMemoryAtlasPreviewPanel(deps) {
    const settings = isPlainObject(deps) ? deps : {};
    const projectionApi = settings.projectionApi || root.LoveBudMemoryAtlasProjection || null;
    const previewApi = settings.previewApi || root.LoveBudMemoryAtlasPreview || null;

    return {
      buildModel(memory) {
        return buildEditorMemoryAtlasPreviewModel(memory, { projectionApi, previewApi });
      },
      render(container, memory) {
        return renderEditorMemoryAtlasPreview(container, memory, { projectionApi, previewApi });
      },
    };
  }

  function renderEditorMemoryAtlasPreview(container, memory, options) {
    if (!container) return null;
    const model = buildEditorMemoryAtlasPreviewModel(memory, options);
    if (!model.available || !model.memory) {
      clearElement(container);
      container.hidden = true;
      return model;
    }

    container.hidden = false;
    clearElement(container);
    renderEditorMemoryAtlasPreviewDom(container, model);
    return model;
  }

  function buildEditorMemoryAtlasPreviewModel(memory, options) {
    const settings = isPlainObject(options) ? options : {};
    const projectionApi = settings.projectionApi || root.LoveBudMemoryAtlasProjection || null;
    const previewApi = settings.previewApi || root.LoveBudMemoryAtlasPreview || null;

    if (!projectionApi || typeof projectionApi.projectMemoryAtlas !== 'function') {
      return createUnavailableModel(memory);
    }
    if (!previewApi || typeof previewApi.createMemoryAtlasPreview !== 'function') {
      return createUnavailableModel(memory);
    }
    if (!isPlainObject(memory) || !memory.id) {
      return createUnavailableModel(memory);
    }

    const atlasInput = normalizeMemoryForAtlasPreview(memory);
    const projection = projectionApi.projectMemoryAtlas([atlasInput]);
    const preview = previewApi.createMemoryAtlasPreview(projection);
    const visibleGroups = Array.isArray(preview.groups)
      ? preview.groups.filter((group) => Array.isArray(group.items) && group.items.length > 0)
      : [];

    return {
      available: true,
      previewOnly: true,
      copy: PANEL_COPY,
      memory: preview.memory || {
        id: String(memory.id),
        label: safeText(memory.title || memory.name || memory.id),
        visibility: normalizeVisibility(memory.visibility || memory.visibilityScope),
      },
      visibility: normalizeVisibility(preview.visibility),
      empty: !!preview.empty,
      emptyMessage: preview.emptyMessage || PANEL_COPY.empty,
      counts: preview.counts || { groups: 0, nodes: 0, edges: 0, evidence: 0 },
      groups: visibleGroups,
    };
  }

  function createUnavailableModel(memory) {
    return {
      available: false,
      previewOnly: true,
      copy: PANEL_COPY,
      memory: isPlainObject(memory) && memory.id ? {
        id: String(memory.id),
        label: safeText(memory.title || memory.name || memory.id),
        visibility: normalizeVisibility(memory.visibility || memory.visibilityScope),
      } : null,
      visibility: 'private',
      empty: true,
      emptyMessage: PANEL_COPY.empty,
      counts: { groups: 0, nodes: 0, edges: 0, evidence: 0 },
      groups: [],
    };
  }

  function normalizeMemoryForAtlasPreview(memory) {
    const sourceUrl = firstString(memory.sourceUrl, memory.source_url, memory.videoUrl, memory.video_url, memory.url, memory.linkUrl, memory.link_url);
    const sourceTitle = firstString(memory.sourceTitle, memory.source_title, memory.videoTitle, memory.video_title, memory.title, sourceUrl);
    const timeValue = firstString(memory.timeBucket, memory.time_bucket, memory.timestamp, memory.createdAt, memory.created_at, memory.date);
    const tags = collectList(memory.topics, memory.topic, memory.tags, memory.explicitTopics);
    const emotions = collectList(memory.emotions, memory.emotion, memory.mood, memory.explicitEmotions);

    const atlasInput = {
      id: String(memory.id),
      title: firstString(memory.title, memory.name, memory.label, memory.id),
      memo: firstString(memory.memo, memory.note, memory.text, memory.description),
      visibility: normalizeVisibility(memory.visibility || memory.visibilityScope || (memory.isPublic || memory.public ? 'public' : 'private')),
      topics: tags,
      emotions,
      time: timeValue ? [timeValue] : [],
    };

    if (sourceUrl) {
      atlasInput.source = {
        id: sourceUrl,
        title: sourceTitle || sourceUrl,
        url: sourceUrl,
        type: 'memory-source',
      };
    }

    return atlasInput;
  }

  function renderEditorMemoryAtlasPreviewDom(container, model) {
    const section = createPanelElement(container, 'section', 'editor-memory-atlas-preview-card');
    section.setAttribute('data-memory-atlas-preview', '1');
    section.setAttribute('aria-label', 'Atlas preview');

    const head = createPanelElement(section, 'div', 'editor-memory-atlas-preview-head');
    const copyWrap = createPanelElement(head, 'div');
    createPanelElement(copyWrap, 'div', 'editor-section-eyebrow', PANEL_COPY.title);
    createPanelElement(copyWrap, 'p', 'editor-memory-atlas-preview-status', PANEL_COPY.status);

    const visibility = createPanelElement(head, 'span', 'editor-memory-atlas-preview-visibility');
    visibility.setAttribute('data-visibility', model.visibility);
    visibility.textContent = model.visibility;

    createPanelElement(section, 'p', 'editor-memory-atlas-preview-basis', PANEL_COPY.basis);

    if (model.empty) {
      createPanelElement(section, 'p', 'editor-memory-atlas-preview-empty', model.emptyMessage || PANEL_COPY.empty);
      return;
    }

    model.groups.forEach((group) => {
      const items = Array.isArray(group.items) ? group.items : [];
      if (items.length === 0) return;

      const groupEl = createPanelElement(section, 'div', 'editor-memory-atlas-preview-group');
      groupEl.setAttribute('data-atlas-group', group.type || '');
      createPanelElement(groupEl, 'div', 'editor-memory-atlas-preview-group-label', group.label || group.type || '');
      const chips = createPanelElement(groupEl, 'div', 'editor-memory-atlas-preview-chips');
      items.forEach((item) => {
        const chip = createPanelElement(chips, 'span', 'editor-memory-atlas-preview-chip');
        chip.setAttribute('data-atlas-item-type', item.type || '');
        chip.setAttribute('data-visibility', normalizeVisibility(item.visibility));
        chip.textContent = item.label || item.id || 'Untitled';
      });
    });
  }

  function createPanelElement(parent, tagName, className, text) {
    const element = typeof document !== 'undefined' && typeof document.createElement === 'function'
      ? document.createElement(tagName)
      : createPlainElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    if (typeof parent.appendChild === 'function') parent.appendChild(element);
    return element;
  }

  function createPlainElement(tagName) {
    return {
      tagName,
      className: '',
      textContent: '',
      style: {},
      dataset: {},
      children: [],
      attributes: {},
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
    };
  }

  function clearElement(container) {
    if (typeof container.replaceChildren === 'function') {
      container.replaceChildren();
      return;
    }
    container.textContent = '';
  }

  function renderEditorMemoryAtlasPreviewHtml(model) {
    const groupHtml = model.empty
      ? '<p class="editor-memory-atlas-preview-empty">' + escapeHtml(model.emptyMessage || PANEL_COPY.empty) + '</p>'
      : model.groups.map(renderGroupHtml).join('');

    return [
      '<section class="editor-memory-atlas-preview-card" data-memory-atlas-preview="1" aria-label="Atlas preview">',
      '<div class="editor-memory-atlas-preview-head">',
      '<div>',
      '<div class="editor-section-eyebrow">' + escapeHtml(PANEL_COPY.title) + '</div>',
      '<p class="editor-memory-atlas-preview-status">' + escapeHtml(PANEL_COPY.status) + '</p>',
      '</div>',
      '<span class="editor-memory-atlas-preview-visibility" data-visibility="' + escapeHtml(model.visibility) + '">' + escapeHtml(model.visibility) + '</span>',
      '</div>',
      '<p class="editor-memory-atlas-preview-basis">' + escapeHtml(PANEL_COPY.basis) + '</p>',
      groupHtml,
      '</section>',
    ].join('');
  }

  function renderGroupHtml(group) {
    const items = Array.isArray(group.items) ? group.items : [];
    if (items.length === 0) return '';

    return [
      '<div class="editor-memory-atlas-preview-group" data-atlas-group="' + escapeHtml(group.type || '') + '">',
      '<div class="editor-memory-atlas-preview-group-label">' + escapeHtml(group.label || group.type || '') + '</div>',
      '<div class="editor-memory-atlas-preview-chips">',
      items.map(renderItemHtml).join(''),
      '</div>',
      '</div>',
    ].join('');
  }

  function renderItemHtml(item) {
    return [
      '<span class="editor-memory-atlas-preview-chip" data-atlas-item-type="' + escapeHtml(item.type || '') + '" data-visibility="' + escapeHtml(normalizeVisibility(item.visibility)) + '">',
      escapeHtml(item.label || item.id || 'Untitled'),
      '</span>',
    ].join('');
  }

  function collectList() {
    const values = [];
    Array.from(arguments).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          const normalized = normalizeListValue(item);
          if (normalized) values.push(normalized);
        });
        return;
      }
      const normalized = normalizeListValue(value);
      if (normalized) values.push(normalized);
    });
    return values;
  }

  function normalizeListValue(value) {
    if (value === undefined || value === null || value === '') return '';
    if (isPlainObject(value)) {
      return firstString(value.label, value.name, value.title, value.value, value.id, value.url);
    }
    return String(value).trim();
  }

  function firstString() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  function safeText(value) {
    return firstString(value, 'Untitled');
  }

  function normalizeVisibility(value) {
    return value === 'public' ? 'public' : 'private';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    PANEL_COPY,
    buildEditorMemoryAtlasPreviewModel,
    renderEditorMemoryAtlasPreview,
    createEditorMemoryAtlasPreviewPanel,
  };
});
