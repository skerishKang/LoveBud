(function attachMemoryAtlasProjection(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.LoveBudMemoryAtlasProjection = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMemoryAtlasProjectionApi() {
  'use strict';

  const PROJECTED_NODE_TYPES = Object.freeze([
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

  const PROJECTED_EDGE_TYPES = Object.freeze([
    'about',
    'mentions',
    'felt_as',
    'happened_at',
    'happened_in',
    'belongs_to',
    'source_of',
    'related_to',
    'same_topic_as',
    'same_source_as',
    'follows_from',
    'contrasts_with',
  ]);

  function projectMemoryAtlas(input) {
    const records = normalizeInputRecords(input);
    const state = {
      nodes: [],
      edges: [],
      evidence: [],
      nodeIds: new Set(),
      edgeIds: new Set(),
      evidenceIds: new Set(),
    };

    records.forEach((record, index) => {
      if (!isPlainObject(record)) return;
      projectMemoryRecord(state, record, index);
    });

    return {
      nodes: state.nodes,
      edges: state.edges,
      evidence: state.evidence,
    };
  }

  function normalizeInputRecords(input) {
    if (Array.isArray(input)) return input;
    if (isPlainObject(input) && Array.isArray(input.memories)) return input.memories;
    if (isPlainObject(input) && (input.id || input.memoryId || input.title || input.note || input.text)) return [input];
    return [];
  }

  function projectMemoryRecord(state, record, index) {
    const rawMemoryId = firstValue(record, ['id', 'memoryId', 'momentId', 'slug']) || `input-${index + 1}`;
    const memoryNodeId = makeNodeId('memory', rawMemoryId);
    const visibility = normalizeVisibility(record);
    const userTitle = firstValue(record, ['title', 'name', 'label']) || `Memory ${index + 1}`;
    const userNote = firstValue(record, ['note', 'memo', 'text', 'description']) || '';

    addNode(state, {
      id: memoryNodeId,
      type: 'memory',
      label: String(userTitle),
      visibility,
      sourceMemoryId: String(rawMemoryId),
    });

    const evidenceContext = {
      memoryNodeId,
      rawMemoryId: String(rawMemoryId),
      userTitle: String(userTitle),
      userNote: String(userNote),
      visibility,
      sourceType: firstValue(record, ['sourceType', 'source.type']) || '',
      sourceUrl: firstValue(record, ['sourceUrl', 'source.url', 'url']) || '',
      createdAt: firstValue(record, ['createdAt', 'created_at']) || '',
      updatedAt: firstValue(record, ['updatedAt', 'updated_at']) || '',
    };

    addTreeOrPackProjection(state, record, memoryNodeId, visibility, evidenceContext, 'tree', ['tree.id', 'treeId', 'loveTreeId'], ['tree.title', 'treeTitle', 'loveTreeTitle']);
    addTreeOrPackProjection(state, record, memoryNodeId, visibility, evidenceContext, 'pack', ['pack.id', 'packId'], ['pack.title', 'packTitle']);

    addSourceProjection(state, record, memoryNodeId, visibility, evidenceContext);
    addVideoProjection(state, record, memoryNodeId, visibility, evidenceContext);

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'topic',
      edgeType: 'about',
      keys: ['topics', 'topic', 'tags', 'explicitTopics'],
    });

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'person',
      edgeType: 'mentions',
      keys: ['people', 'persons', 'person', 'explicitPeople'],
    });

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'place',
      edgeType: 'happened_at',
      keys: ['places', 'place', 'locations', 'location', 'explicitPlaces'],
    });

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'event',
      edgeType: 'about',
      keys: ['events', 'event', 'explicitEvents'],
    });

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'emotion',
      edgeType: 'felt_as',
      keys: ['emotions', 'emotion', 'mood', 'explicitEmotions'],
    });

    addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, {
      nodeType: 'time',
      edgeType: 'happened_in',
      keys: ['times', 'time', 'timeBucket', 'period', 'date', 'explicitTimes'],
    });
  }

  function addTreeOrPackProjection(state, record, memoryNodeId, visibility, evidenceContext, nodeType, idKeys, labelKeys) {
    const key = firstValue(record, idKeys);
    if (!key) return;

    const nodeId = makeNodeId(nodeType, key);
    const label = firstValue(record, labelKeys) || key;
    addDerivedNode(state, {
      id: nodeId,
      type: nodeType,
      label: String(label),
      visibility,
    }, evidenceContext);

    addDerivedEdge(state, {
      from: memoryNodeId,
      to: nodeId,
      type: 'belongs_to',
      visibility,
    }, evidenceContext);
  }

  function addSourceProjection(state, record, memoryNodeId, visibility, evidenceContext) {
    const key = firstValue(record, ['source.id', 'sourceId', 'source.url', 'sourceUrl', 'url']);
    if (!key) return;

    const nodeId = makeNodeId('source', key);
    const label = firstValue(record, ['source.title', 'source.label', 'sourceTitle']) || key;
    const sourceUrl = firstValue(record, ['source.url', 'sourceUrl', 'url']) || '';

    addDerivedNode(state, {
      id: nodeId,
      type: 'source',
      label: String(label),
      visibility,
      sourceType: firstValue(record, ['source.type', 'sourceType']) || 'source',
      url: sourceUrl ? String(sourceUrl) : '',
    }, evidenceContext);

    addDerivedEdge(state, {
      from: nodeId,
      to: memoryNodeId,
      type: 'source_of',
      visibility,
    }, evidenceContext);
  }

  function addVideoProjection(state, record, memoryNodeId, visibility, evidenceContext) {
    const key = firstValue(record, ['video.id', 'videoId', 'youtubeVideoId', 'video.url', 'videoUrl', 'youtubeUrl']);
    if (!key) return;

    const nodeId = makeNodeId('video', key);
    const label = firstValue(record, ['video.title', 'video.label', 'videoTitle']) || key;
    const videoUrl = firstValue(record, ['video.url', 'videoUrl', 'youtubeUrl']) || '';

    addDerivedNode(state, {
      id: nodeId,
      type: 'video',
      label: String(label),
      visibility,
      url: videoUrl ? String(videoUrl) : '',
    }, evidenceContext);

    addDerivedEdge(state, {
      from: nodeId,
      to: memoryNodeId,
      type: 'source_of',
      visibility,
    }, evidenceContext);
  }

  function addExplicitListProjection(state, record, memoryNodeId, visibility, evidenceContext, config) {
    const values = collectValues(record, config.keys);
    values.forEach((value) => {
      const item = normalizeValueRecord(value);
      if (!item.key) return;

      const nodeId = makeNodeId(config.nodeType, item.key);
      addDerivedNode(state, {
        id: nodeId,
        type: config.nodeType,
        label: item.label,
        visibility,
      }, evidenceContext);

      addDerivedEdge(state, {
        from: memoryNodeId,
        to: nodeId,
        type: config.edgeType,
        visibility,
      }, evidenceContext);
    });
  }

  function addNode(state, node) {
    if (!node || !node.id || state.nodeIds.has(node.id)) return;
    state.nodeIds.add(node.id);
    state.nodes.push(Object.assign({ evidenceIds: [] }, node));
  }

  function addDerivedNode(state, node, evidenceContext) {
    addNode(state, node);
    const evidence = addEvidence(state, evidenceContext, 'node', node.id);
    const existingNode = state.nodes.find((item) => item.id === node.id);
    if (existingNode && evidence && !existingNode.evidenceIds.includes(evidence.id)) {
      existingNode.evidenceIds.push(evidence.id);
    }
  }

  function addDerivedEdge(state, edge, evidenceContext) {
    if (!edge || !edge.from || !edge.to || !edge.type) return;
    const edgeId = edge.id || makeEdgeId(edge.from, edge.type, edge.to);
    const evidence = addEvidence(state, evidenceContext, 'edge', edgeId);

    if (state.edgeIds.has(edgeId)) {
      const existingEdge = state.edges.find((item) => item.id === edgeId);
      if (existingEdge && evidence && !existingEdge.evidenceIds.includes(evidence.id)) {
        existingEdge.evidenceIds.push(evidence.id);
      }
      return;
    }

    state.edgeIds.add(edgeId);
    state.edges.push(Object.assign({ id: edgeId, evidenceIds: evidence ? [evidence.id] : [] }, edge));
  }

  function addEvidence(state, context, targetType, targetId) {
    if (!context || !targetType || !targetId) return null;

    const evidenceId = makeEvidenceId(context.memoryNodeId, targetType, targetId);
    if (state.evidenceIds.has(evidenceId)) {
      return state.evidence.find((item) => item.id === evidenceId) || null;
    }

    const evidence = {
      id: evidenceId,
      targetType,
      targetId,
      memoryNodeId: context.memoryNodeId,
      memoryId: context.rawMemoryId,
      sourceType: context.sourceType,
      sourceUrl: context.sourceUrl,
      userTitle: context.userTitle,
      userNote: context.userNote,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      visibility: context.visibility,
      confidence: 'explicit',
      reviewStatus: 'input',
    };

    state.evidenceIds.add(evidenceId);
    state.evidence.push(evidence);
    return evidence;
  }

  function collectValues(record, keys) {
    const values = [];
    keys.forEach((key) => {
      const value = getPath(record, key);
      if (Array.isArray(value)) values.push(...value);
      else if (value !== undefined && value !== null && value !== '') values.push(value);
    });
    return values;
  }

  function normalizeValueRecord(value) {
    if (isPlainObject(value)) {
      const key = firstValue(value, ['id', 'value', 'name', 'title', 'label', 'url']);
      const label = firstValue(value, ['label', 'name', 'title', 'value', 'id', 'url']);
      return {
        key: key ? String(key) : '',
        label: label ? String(label) : '',
      };
    }

    const text = value === undefined || value === null ? '' : String(value).trim();
    return {
      key: text,
      label: text,
    };
  }

  function firstValue(source, paths) {
    for (const path of paths) {
      const value = getPath(source, path);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function getPath(source, path) {
    if (!source || !path) return undefined;
    return String(path).split('.').reduce((current, part) => {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) return current[part];
      return undefined;
    }, source);
  }

  function normalizeVisibility(record) {
    const explicit = firstValue(record, ['visibilityScope', 'visibility']);
    if (explicit) return String(explicit);
    if (record && record.isPublic === true) return 'public';
    if (record && record.public === true) return 'public';
    return 'private';
  }

  function makeNodeId(type, key) {
    return `${type}:${normalizeIdPart(key || type)}`;
  }

  function makeEdgeId(from, type, to) {
    return `edge:${normalizeIdPart(from)}:${normalizeIdPart(type)}:${normalizeIdPart(to)}`;
  }

  function makeEvidenceId(memoryNodeId, targetType, targetId) {
    return `evidence:${normalizeIdPart(memoryNodeId)}:${normalizeIdPart(targetType)}:${normalizeIdPart(targetId)}`;
  }

  function normalizeIdPart(value) {
    return encodeURIComponent(String(value).trim().toLowerCase()).replace(/%20/g, '-');
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    PROJECTED_NODE_TYPES,
    PROJECTED_EDGE_TYPES,
    projectMemoryAtlas,
  };
});
