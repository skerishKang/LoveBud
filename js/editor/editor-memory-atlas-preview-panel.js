(function attachEditorMemoryAtlasPreviewPanel(root, factory) {
  const exports = factory(root || {});

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.createEditorMemoryAtlasPreviewPanel = exports.createEditorMemoryAtlasPreviewPanel;
    root.LoveBudEditorMemoryAtlasPreviewPanel = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createEditorMemoryAtlasPreviewPanelModule(root) {
  'use strict';

  const PANEL_COPY = Object.freeze({
    title: 'Atlas preview',
    status: 'Preview only — these relationships are not saved.',
    basis: 'Based on existing memory evidence.',
    review: 'Review before saving any future relationship.',
    empty: 'No atlas connections to preview yet.',
    visibilityLabel: 'Visibility',
  });

  const SUGGESTION_COPY = Object.freeze({
    title: 'Suggested connections',
    status: 'Preview only — these relationships are not saved.',
    basis: 'Based on existing memory evidence.',
    review: 'Review before saving any future relationship.',
    empty: 'No suggested connections to preview yet.',
    label: 'Suggested connection',
  });

  const SUGGESTION_TYPE_BY_TARGET_TYPE = Object.freeze({
    topic: 'topic_match',
    source: 'source_match',
    video: 'source_match',
    emotion: 'emotion_match',
    time: 'time_match',
    tree: 'tree_context',
    pack: 'tree_context',
  });

  const SUGGESTION_TYPE_BY_EDGE_TYPE = Object.freeze({
    about: 'topic_match',
    felt_as: 'emotion_match',
    happened_in: 'time_match',
    belongs_to: 'tree_context',
    source_of: 'source_match',
    follows_from: 'follows_from_candidate',
    contrasts_with: 'contrasts_with_candidate',
  });

  function createEditorMemoryAtlasPreviewPanel(deps) {
    const settings = isPlainObject(deps) ? deps : {};
    const projectionAdapter = settings.projectionAdapter || root.LoveBudMemoryAtlasProjection || null;
    const previewAdapter = settings.previewAdapter || root.LoveBudMemoryAtlasPreview || null;
    const suggestionAdapter = settings.suggestionAdapter || root.LoveBudMemoryAtlasRelationshipSuggestions || null;

    return {
      buildModel(memory, options) {
        return buildEditorMemoryAtlasPreviewModel(memory, Object.assign({}, options || {}, { projectionAdapter, previewAdapter }));
      },
      buildSuggestionModel(memory, projection, options) {
        return buildEditorMemoryAtlasSuggestionPreviewModel(memory, Object.assign({}, options || {}, { projection, projectionAdapter, previewAdapter }));
      },
      render(container, memory, options) {
        return renderEditorMemoryAtlasPreview(container, memory, Object.assign({}, options || {}, { projectionAdapter, previewAdapter }));
      },
      renderSuggestions(container, memory, projection, options) {
        return renderEditorMemoryAtlasSuggestionPreview(container, memory, projection, Object.assign({}, options || {}, { suggestionAdapter, projectionAdapter, previewAdapter }));
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

  function renderEditorMemoryAtlasSuggestionPreview(container, memory, projection, options) {
    if (!container) return null;
    const model = buildEditorMemoryAtlasSuggestionPreviewModel(memory, Object.assign({}, options || {}, { projection }));
    if (!model.available || model.empty) {
      clearElement(container);
      container.hidden = true;
      return model;
    }

    container.hidden = false;
    clearElement(container);
    renderEditorMemoryAtlasSuggestionPreviewDom(container, model);
    return model;
  }

  function buildEditorMemoryAtlasPreviewModel(memory, options) {
    const settings = isPlainObject(options) ? options : {};
    const projectionAdapter = settings.projectionAdapter || root.LoveBudMemoryAtlasProjection || null;
    const previewAdapter = settings.previewAdapter || root.LoveBudMemoryAtlasPreview || null;
    const suggestionAdapter = settings.suggestionAdapter || root.LoveBudMemoryAtlasRelationshipSuggestions || null;

    if (!projectionAdapter || typeof projectionAdapter.projectMemoryAtlas !== 'function') {
      return createUnavailableModel(memory);
    }
    if (!previewAdapter || typeof previewAdapter.createMemoryAtlasPreview !== 'function') {
      return createUnavailableModel(memory);
    }
    if (!isPlainObject(memory) || !memory.id) {
      return createUnavailableModel(memory);
    }

    const atlasInput = normalizeMemoryForAtlasPreview(memory);
    const previewProjection = projectionAdapter.projectMemoryAtlas([atlasInput]);
    const preview = previewAdapter.createMemoryAtlasPreview(previewProjection);
    const visibleGroups = Array.isArray(preview.groups)
      ? preview.groups.filter((group) => Array.isArray(group.items) && group.items.length > 0)
      : [];
    const suggestionProjection = buildSuggestionProjectionInput(memory, {
      projection: previewProjection,
      projectionAdapter,
      treeMemories: settings.treeMemories,
    });
    const suggestions = buildEditorMemoryAtlasSuggestionPreviewModel(memory, {
      projection: suggestionProjection,
      projectionAdapter,
      previewAdapter,
      suggestionAdapter,
      treeMemories: settings.treeMemories,
      viewerVisibility: normalizeVisibility(memory.visibility || memory.visibilityScope || (memory.isPublic || memory.public ? 'public' : 'private')),
    });

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
      counts: Object.assign({ groups: 0, nodes: 0, edges: 0, evidence: 0 }, preview.counts || {}, suggestions.counts || {}),
      groups: visibleGroups,
      suggestions: suggestions.suggestions || [],
    };
  }

  function buildEditorMemoryAtlasSuggestionPreviewModel(memory, options) {
    const settings = isPlainObject(options) ? options : {};
    const projection = isPlainObject(settings.projection) ? settings.projection : null;
    const projectionAdapter = settings.projectionAdapter || root.LoveBudMemoryAtlasProjection || null;
    const suggestionAdapter = settings.suggestionAdapter || root.LoveBudMemoryAtlasRelationshipSuggestions || null;
    const selectedMemoryId = normalizeMemoryId(isPlainObject(memory) ? memory.id : null);
    const viewerVisibility = normalizeVisibility(settings.viewerVisibility || (isPlainObject(memory) && (memory.visibility || memory.visibilityScope || (memory.isPublic || memory.public ? 'public' : 'private'))));

    if (!selectedMemoryId || !projectionAdapter || typeof projectionAdapter.projectMemoryAtlas !== 'function') {
      return createUnavailableSuggestionModel();
    }
    if (!suggestionAdapter || typeof suggestionAdapter.createMemoryAtlasRelationshipSuggestions !== 'function') {
      return createUnavailableSuggestionModel();
    }

    const projectionInput = Array.isArray(settings.projection) ? settings.projection : buildSuggestionProjectionInput(memory, settings);
    const safeProjection = adaptProjectionForSuggestions(projection || projectionAdapter.projectMemoryAtlas(projectionInput));
    const evidenceRecords = Array.isArray(safeProjection.evidence) ? safeProjection.evidence : [];
    const hasSelectedMemoryEvidence = evidenceRecords.some((evidence) => normalizeMemoryId(evidence.memoryId || evidence.sourceMemoryId || evidence.memoryNodeId || evidence.memory) === selectedMemoryId);
    if (!hasSelectedMemoryEvidence) {
      return {
        available: true,
        previewOnly: true,
        copy: SUGGESTION_COPY,
        selectedMemoryId,
        suggestions: [],
        counts: { suggestions: 0 },
        empty: true,
        emptyMessage: SUGGESTION_COPY.empty,
      };
    }

    const generatedSuggestions = suggestionAdapter.createMemoryAtlasRelationshipSuggestions(safeProjection, {
      selectedMemoryId,
      defaultState: 'previewed',
      viewerVisibility,
    });
    const suggestions = Array.isArray(generatedSuggestions) ? generatedSuggestions : [];
    const visibleSuggestions = suggestions.filter((suggestion) => isPreviewOnlySuggestion(suggestion, selectedMemoryId));

    return {
      available: true,
      previewOnly: true,
      copy: SUGGESTION_COPY,
      selectedMemoryId,
      suggestions: visibleSuggestions,
      counts: { suggestions: visibleSuggestions.length },
      empty: visibleSuggestions.length === 0,
      emptyMessage: SUGGESTION_COPY.empty,
    };
  }

  function createUnavailableSuggestionModel() {
    return {
      available: false,
      previewOnly: true,
      copy: SUGGESTION_COPY,
      selectedMemoryId: '',
      suggestions: [],
      counts: { suggestions: 0 },
      empty: true,
      emptyMessage: SUGGESTION_COPY.empty,
    };
  }

  function buildSuggestionProjectionInput(selectedMemory, options) {
    const settings = isPlainObject(options) ? options : {};
    const selectedInput = normalizeMemoryForAtlasPreview(selectedMemory);
    const candidates = collectCandidateMemories(selectedMemory, settings.treeMemories).map(normalizeMemoryForAtlasPreview);
    const inputs = [selectedInput].concat(candidates);
    return inputs;
  }

  function collectCandidateMemories(selectedMemory, treeMemories) {
    const selectedId = normalizeMemoryId(isPlainObject(selectedMemory) ? selectedMemory.id : null);
    const selectedTreeId = normalizeMemoryId(isPlainObject(selectedMemory) ? selectedMemory.treeId : null);
    const seen = new Set([selectedId]);
    const candidates = [];

    if (!Array.isArray(treeMemories)) return candidates;
    treeMemories.forEach((memory) => {
      if (!isPlainObject(memory)) return;
      const memoryId = normalizeMemoryId(memory.id || memory.memoryId || memory.momentId);
      if (!memoryId || seen.has(memoryId)) return;
      if (memory.isNewTree || memory.isNew) return;
      if (selectedTreeId && normalizeMemoryId(memory.treeId) && normalizeMemoryId(memory.treeId) !== selectedTreeId) return;
      seen.add(memoryId);
      candidates.push(memory);
    });
    return candidates;
  }

  function adaptProjectionForSuggestions(projection) {
    if (!isPlainObject(projection)) return { nodes: [], edges: [], evidence: [] };
    const nodeTypesById = new Map();
    (Array.isArray(projection.nodes) ? projection.nodes : []).forEach((node) => {
      if (isPlainObject(node) && node.id) nodeTypesById.set(String(node.id), String(node.type || ''));
    });
    const adaptedEvidence = (Array.isArray(projection.evidence) ? projection.evidence : [])
      .map((evidence) => adaptProjectionEvidenceForSuggestions(evidence, nodeTypesById))
      .filter(Boolean);
    return {
      nodes: Array.isArray(projection.nodes) ? projection.nodes.map(clonePlainObject).filter(Boolean) : [],
      edges: Array.isArray(projection.edges) ? projection.edges.map(adaptProjectionEdgeForSuggestions).filter(Boolean) : [],
      evidence: filterShareableSuggestionEvidence(adaptedEvidence),
    };
  }

  function filterShareableSuggestionEvidence(evidenceRecords) {
    const memoryIdsByGroup = new Map();
    evidenceRecords.forEach((evidence) => {
      const key = `${evidence.sourceType}::${evidence.targetId}`;
      if (!memoryIdsByGroup.has(key)) memoryIdsByGroup.set(key, new Set());
      memoryIdsByGroup.get(key).add(String(evidence.memoryId));
    });
    return evidenceRecords.filter((evidence) => {
      const key = `${evidence.sourceType}::${evidence.targetId}`;
      return (memoryIdsByGroup.get(key) || new Set()).size > 1;
    });
  }

  function adaptProjectionEvidenceForSuggestions(evidence, nodeTypesById) {
    if (!isPlainObject(evidence)) return null;
    const edgeType = normalizeType(evidence.edgeType || evidence.type || inferEdgeTypeFromTargetId(evidence.targetId));
    if (normalizeType(evidence.targetType) === 'edge' && edgeType !== 'follows_from' && edgeType !== 'contrasts_with') return null;
    const sourceType = normalizeSuggestionSourceType(evidence, nodeTypesById);
    if (!sourceType) return null;
    return Object.assign({}, clonePlainObject(evidence), {
      sourceType,
      targetType: String(evidence.targetType || ''),
    });
  }

  function adaptProjectionEdgeForSuggestions(edge) {
    if (!isPlainObject(edge)) return null;
    const suggestionType = normalizeType(edge.type || edge.suggestionType);
    if (!suggestionType) return clonePlainObject(edge);
    return Object.assign({}, clonePlainObject(edge), {
      suggestionType,
      type: suggestionType,
    });
  }

  function normalizeSuggestionSourceType(evidence, nodeTypesById) {
    const direct = normalizeType(evidence.sourceType);
    if (direct && direct !== 'memory-source') return direct;
    const targetType = normalizeType(evidence.targetType);
    if (targetType && targetType !== 'node' && targetType !== 'edge') return SUGGESTION_TYPE_BY_TARGET_TYPE[targetType] || targetType;
    const targetNodeType = normalizeType(nodeTypesById && nodeTypesById.get(String(evidence.targetId || '')));
    if (targetNodeType) return SUGGESTION_TYPE_BY_TARGET_TYPE[targetNodeType] || targetNodeType;
    const edgeType = normalizeType(evidence.edgeType || evidence.type || inferEdgeTypeFromTargetId(evidence.targetId));
    return SUGGESTION_TYPE_BY_EDGE_TYPE[edgeType] || '';
  }

  function inferEdgeTypeFromTargetId(targetId) {
    const text = normalizeType(targetId);
    if (text.indexOf('edge:') !== 0) return '';
    const parts = text.split(':');
    return parts[2] || '';
  }

  function normalizeType(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    return text || '';
  }

  function clonePlainObject(value) {
    if (!isPlainObject(value)) return null;
    return JSON.parse(JSON.stringify(value));
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

  function isPreviewOnlySuggestion(suggestion, selectedMemoryId) {
    if (!isPlainObject(suggestion)) return false;
    if (suggestion.previewOnly === false) return false;
    if (suggestion.state === 'saved') return false;
    if (!Array.isArray(suggestion.evidenceRefs) || suggestion.evidenceRefs.length === 0) return false;
    if (selectedMemoryId && suggestion.sourceMemoryId !== selectedMemoryId && suggestion.targetMemoryId !== selectedMemoryId) return false;
    return true;
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
    createPanelElement(section, 'p', 'editor-memory-atlas-preview-review', PANEL_COPY.review);

    if (model.empty && (!Array.isArray(model.suggestions) || model.suggestions.length === 0)) {
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

    renderEditorMemoryAtlasSuggestionPreviewDom(section, model);
  }

  function renderEditorMemoryAtlasSuggestionPreviewDom(parent, model) {
    const suggestions = Array.isArray(model.suggestions) ? model.suggestions : [];
    if (suggestions.length === 0) return;

    const section = createPanelElement(parent, 'div', 'editor-memory-atlas-suggestion-section');
    section.setAttribute('data-memory-atlas-suggestion-preview', '1');
    section.setAttribute('aria-label', 'Suggested connections');

    const head = createPanelElement(section, 'div', 'editor-memory-atlas-suggestion-head');
    createPanelElement(head, 'div', 'editor-section-eyebrow', SUGGESTION_COPY.title);
    createPanelElement(head, 'p', 'editor-memory-atlas-suggestion-status', SUGGESTION_COPY.status);
    createPanelElement(section, 'p', 'editor-memory-atlas-suggestion-basis', SUGGESTION_COPY.basis);
    createPanelElement(section, 'p', 'editor-memory-atlas-suggestion-review', SUGGESTION_COPY.review);

    const list = createPanelElement(section, 'div', 'editor-memory-atlas-suggestion-list');
    suggestions.forEach((suggestion) => {
      const item = createPanelElement(list, 'div', 'editor-memory-atlas-suggestion-item');
      item.setAttribute('data-suggestion-id', suggestion.id || '');
      item.setAttribute('data-suggestion-type', suggestion.type || '');
      item.setAttribute('data-visibility', normalizeVisibility(suggestion.visibility));
      item.setAttribute('data-preview-only', 'true');
      item.setAttribute('data-evidence-count', String(Array.isArray(suggestion.evidenceRefs) ? suggestion.evidenceRefs.length : 0));
      createPanelElement(item, 'span', 'editor-memory-atlas-suggestion-label', SUGGESTION_COPY.label);
      createPanelElement(item, 'span', 'editor-memory-atlas-suggestion-reason', suggestion.reasonCode || suggestion.type || '');
      createPanelElement(item, 'span', 'editor-memory-atlas-suggestion-visibility', normalizeVisibility(suggestion.visibility));
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
    const suggestionHtml = renderSuggestionPreviewHtml(model.suggestions || []);

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
      '<p class="editor-memory-atlas-preview-review">' + escapeHtml(PANEL_COPY.review) + '</p>',
      groupHtml,
      suggestionHtml,
      '</section>',
    ].join('');
  }

  function renderSuggestionPreviewHtml(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) return '';

    return [
      '<div class="editor-memory-atlas-suggestion-section" data-memory-atlas-suggestion-preview="1" aria-label="Suggested connections">',
      '<div class="editor-memory-atlas-suggestion-head">',
      '<div class="editor-section-eyebrow">' + escapeHtml(SUGGESTION_COPY.title) + '</div>',
      '<p class="editor-memory-atlas-suggestion-status">' + escapeHtml(SUGGESTION_COPY.status) + '</p>',
      '</div>',
      '<p class="editor-memory-atlas-suggestion-basis">' + escapeHtml(SUGGESTION_COPY.basis) + '</p>',
      '<p class="editor-memory-atlas-suggestion-review">' + escapeHtml(SUGGESTION_COPY.review) + '</p>',
      '<div class="editor-memory-atlas-suggestion-list">',
      suggestions.map(renderSuggestionItemHtml).join(''),
      '</div>',
      '</div>',
    ].join('');
  }

  function renderSuggestionItemHtml(suggestion) {
    const evidenceCount = Array.isArray(suggestion.evidenceRefs) ? suggestion.evidenceRefs.length : 0;
    return [
      '<div class="editor-memory-atlas-suggestion-item" data-suggestion-id="' + escapeHtml(suggestion.id || '') + '" data-suggestion-type="' + escapeHtml(suggestion.type || '') + '" data-visibility="' + escapeHtml(normalizeVisibility(suggestion.visibility)) + '" data-preview-only="true" data-evidence-count="' + evidenceCount + '">',
      '<span class="editor-memory-atlas-suggestion-label">' + escapeHtml(SUGGESTION_COPY.label) + '</span>',
      '<span class="editor-memory-atlas-suggestion-reason">' + escapeHtml(suggestion.reasonCode || suggestion.type || '') + '</span>',
      '<span class="editor-memory-atlas-suggestion-visibility">' + escapeHtml(normalizeVisibility(suggestion.visibility)) + '</span>',
      '</div>',
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

  function normalizeMemoryId(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    return text || '';
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
    SUGGESTION_COPY,
    buildEditorMemoryAtlasPreviewModel,
    buildEditorMemoryAtlasSuggestionPreviewModel,
    renderEditorMemoryAtlasPreview,
    renderEditorMemoryAtlasSuggestionPreview,
    createEditorMemoryAtlasPreviewPanel,
  };
});
