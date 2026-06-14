(function attachMemoryAtlasSuggestions(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.LoveBudMemoryAtlasRelationshipSuggestions = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMemoryAtlasSuggestionsApi() {
  'use strict';

  const SUGGESTION_STATES = Object.freeze(['candidate', 'previewed']);
  const SUGGESTION_TYPES = Object.freeze([
    'topic_match',
    'source_match',
    'emotion_match',
    'time_match',
    'tree_context',
    'manual_link_candidate',
    'contrasts_with_candidate',
    'follows_from_candidate',
  ]);
  const TYPE_BY_SOURCE = Object.freeze({
    topic: 'topic_match',
    source: 'source_match',
    video: 'source_match',
    emotion: 'emotion_match',
    time: 'time_match',
    tree: 'tree_context',
    pack: 'tree_context',
    manual_link_candidate: 'manual_link_candidate',
    follows_from: 'follows_from_candidate',
    follows_from_candidate: 'follows_from_candidate',
    contrasts_with: 'contrasts_with_candidate',
    contrasts_with_candidate: 'contrasts_with_candidate',
  });
  const COPY = Object.freeze({
    label: 'Suggested connection',
    status: 'Preview only — review before future confirmation.',
    basis: 'Based on existing memory fields.',
  });

  function createMemoryAtlasRelationshipSuggestions(input, options) {
    const projection = normalizeProjection(input);
    const settings = isPlainObject(options) ? options : {};
    const selectedMemoryId = normalizeMemoryId(settings.selectedMemoryId);
    const defaultState = normalizeState(settings.defaultState || settings.state);
    const suggestions = [];
    const emitted = new Set();
    const evidenceRecords = projection.evidence.map(normalizeEvidence).filter(Boolean);
    const nodes = projection.nodes.map(normalizeNode).filter(Boolean);
    const edges = projection.edges.map(normalizeEdge).filter(Boolean);
    const evidenceByGroup = groupEvidenceBySuggestionType(evidenceRecords);

    evidenceByGroup.forEach((records, key) => {
      const type = key.split('::')[0];
      if (!SUGGESTION_TYPES.includes(type)) return;
      const byMemory = groupEvidenceByMemory(records);
      const memoryIds = Array.from(byMemory.keys()).sort();
      const pairs = selectedMemoryId
        ? memoryIds.filter((memoryId) => memoryId !== selectedMemoryId).map((memoryId) => [selectedMemoryId, memoryId])
        : createMemoryPairs(memoryIds);

      pairs.forEach(([sourceMemoryId, targetMemoryId]) => {
        const sourceEvidence = byMemory.get(sourceMemoryId) || [];
        const targetEvidence = byMemory.get(targetMemoryId) || [];
        const evidenceRefs = buildEvidenceRefs(sourceEvidence, targetEvidence);
        if (evidenceRefs.length === 0) return;

        const targetNode = resolveTargetNode(nodes, sourceEvidence[0]);
        const visibility = getStrictestVisibility([
          ...sourceEvidence.map((item) => item.visibility),
          ...targetEvidence.map((item) => item.visibility),
          getNodeVisibility(nodes, sourceMemoryId),
          getNodeVisibility(nodes, targetMemoryId),
          targetNode ? targetNode.visibility : 'private',
        ]);
        const suggestionVisibility = normalizeViewerVisibility(visibility, settings.viewerVisibility);

        if (suggestionVisibility === 'private' && settings.viewerVisibility === 'public') return;

        const id = makeSuggestionId(type, sourceMemoryId, targetMemoryId, evidenceRefs);
        if (emitted.has(id)) return;
        emitted.add(id);

        suggestions.push({
          id,
          state: defaultState,
          type,
          sourceMemoryId,
          targetMemoryId,
          targetNodeId: targetNode ? targetNode.id : sourceEvidence[0].targetId,
          evidenceRefs,
          visibility: suggestionVisibility,
          confidence: buildConfidence(sourceEvidence, targetEvidence),
          reasonCode: type,
          copy: COPY,
          previewOnly: true,
        });
      });
    });

    addEdgeCandidates(edges, evidenceRecords, nodes, settings, suggestions, emitted);
    return suggestions.sort(compareSuggestions);
  }

  function addEdgeCandidates(edges, evidenceRecords, nodes, settings, suggestions, emitted) {
    const defaultState = normalizeState(settings.defaultState || settings.state);
    edges.forEach((edge) => {
      const type = normalizeType(edge.type || edge.suggestionType);
      if (!type || !SUGGESTION_TYPES.includes(type)) return;

      const sourceMemoryId = normalizeMemoryId(edge.fromMemoryId || edge.sourceMemoryId || edge.from);
      const targetMemoryId = normalizeMemoryId(edge.toMemoryId || edge.targetMemoryId || edge.to);
      if (!sourceMemoryId || !targetMemoryId || sourceMemoryId === targetMemoryId) return;
      if (settings.selectedMemoryId) {
        const selected = normalizeMemoryId(settings.selectedMemoryId);
        if (sourceMemoryId !== selected && targetMemoryId !== selected) return;
      }

      const evidenceRefs = buildEvidenceRefsFromIds(edge.evidenceIds, evidenceRecords);
      if (evidenceRefs.length === 0) return;

      const visibility = getStrictestVisibility([
        ...evidenceRefs.map((item) => item.visibility),
        getNodeVisibility(nodes, sourceMemoryId),
        getNodeVisibility(nodes, targetMemoryId),
        normalizeVisibility(edge.visibility),
      ]);
      const suggestionVisibility = normalizeViewerVisibility(visibility, settings.viewerVisibility);
      if (suggestionVisibility === 'private' && settings.viewerVisibility === 'public') return;

      const id = makeSuggestionId(type, sourceMemoryId, targetMemoryId, evidenceRefs);
      if (emitted.has(id)) return;
      emitted.add(id);

      suggestions.push({
        id,
        state: defaultState,
        type,
        sourceMemoryId,
        targetMemoryId,
        targetNodeId: edge.targetNodeId || edge.toNode || edge.to,
        evidenceRefs,
        visibility: suggestionVisibility,
        confidence: buildConfidenceFromEvidenceRefs(evidenceRefs),
        reasonCode: type,
        copy: COPY,
        previewOnly: true,
      });
    });
  }

  function normalizeProjection(input) {
    if (!isPlainObject(input)) return { nodes: [], edges: [], evidence: [] };
    return {
      nodes: Array.isArray(input.nodes) ? input.nodes : [],
      edges: Array.isArray(input.edges) ? input.edges : [],
      evidence: Array.isArray(input.evidence) ? input.evidence : [],
    };
  }

  function normalizeNode(node) {
    if (!isPlainObject(node)) return null;
    const id = normalizeMemoryId(node.id || node.memoryId || node.memoryNodeId);
    if (!id) return null;
    return {
      id: normalizeNodeId(node.id || node.memoryNodeId),
      memoryId: id,
      type: String(node.type || ''),
      visibility: normalizeVisibility(node.visibility),
    };
  }

  function normalizeEdge(edge) {
    if (!isPlainObject(edge)) return null;
    const evidenceIds = Array.isArray(edge.evidenceIds) ? edge.evidenceIds.map(String).filter(Boolean) : [];
    if (evidenceIds.length === 0) return null;
    return {
      id: String(edge.id || ''),
      type: String(edge.type || edge.suggestionType || ''),
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      fromMemoryId: normalizeMemoryId(edge.fromMemoryId || edge.sourceMemoryId),
      sourceMemoryId: normalizeMemoryId(edge.sourceMemoryId || edge.fromMemoryId),
      toMemoryId: normalizeMemoryId(edge.toMemoryId || edge.targetMemoryId),
      targetMemoryId: normalizeMemoryId(edge.targetMemoryId || edge.toMemoryId),
      evidenceIds,
      visibility: normalizeVisibility(edge.visibility),
    };
  }

  function normalizeEvidence(evidence) {
    if (!isPlainObject(evidence)) return null;
    const memoryId = normalizeMemoryId(evidence.memoryId || evidence.sourceMemoryId || evidence.memoryNodeId || evidence.memory);
    const targetId = String(evidence.targetId || evidence.nodeId || evidence.id || '');
    const sourceType = normalizeType(evidence.type || evidence.sourceType || evidence.targetType || evidence.reasonCode);
    if (!memoryId || !targetId || !sourceType) return null;
    return {
      id: String(evidence.id || ''),
      memoryId,
      memoryNodeId: normalizeNodeId(evidence.memoryNodeId),
      targetId,
      targetType: String(evidence.targetType || ''),
      sourceType,
      visibility: normalizeVisibility(evidence.visibility),
      confidence: String(evidence.confidence || ''),
      reviewStatus: String(evidence.reviewStatus || ''),
    };
  }

  function groupEvidenceBySuggestionType(evidenceRecords) {
    const groups = new Map();
    evidenceRecords.forEach((evidence) => {
      const type = normalizeType(evidence.sourceType);
      if (!type || !SUGGESTION_TYPES.includes(type)) return;
      const key = `${type}::${evidence.targetId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(evidence);
    });
    return groups;
  }

  function groupEvidenceByMemory(records) {
    const groups = new Map();
    records.forEach((evidence) => {
      if (!groups.has(evidence.memoryId)) groups.set(evidence.memoryId, []);
      groups.get(evidence.memoryId).push(evidence);
    });
    return groups;
  }

  function createMemoryPairs(memoryIds) {
    const pairs = [];
    for (let index = 0; index < memoryIds.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < memoryIds.length; nextIndex += 1) {
        pairs.push([memoryIds[index], memoryIds[nextIndex]]);
      }
    }
    return pairs;
  }

  function buildEvidenceRefs(left, right) {
    const records = [...left, ...right];
    const seen = new Set();
    const refs = [];
    records.forEach((evidence) => {
      const ref = buildEvidenceRef(evidence);
      if (!ref || seen.has(ref.id)) return;
      seen.add(ref.id);
      refs.push(ref);
    });
    return refs;
  }

  function buildEvidenceRefsFromIds(ids, evidenceRecords) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const wanted = new Set(ids.map(String));
    return evidenceRecords
      .filter((evidence) => wanted.has(evidence.id))
      .map(buildEvidenceRef)
      .filter(Boolean);
  }

  function buildEvidenceRef(evidence) {
    if (!evidence || !evidence.id) return null;
    return {
      id: String(evidence.id),
      memoryId: evidence.memoryId,
      targetId: evidence.targetId,
      targetType: evidence.targetType || evidence.sourceType,
      sourceType: evidence.sourceType,
      visibility: normalizeVisibility(evidence.visibility),
      confidence: evidence.confidence || '',
      reviewStatus: evidence.reviewStatus || '',
    };
  }

  function resolveTargetNode(nodes, evidence) {
    if (!evidence) return null;
    return nodes.find((node) => node.id === evidence.targetId || node.id === normalizeNodeId(evidence.targetId)) || null;
  }

  function getNodeVisibility(nodes, memoryId) {
    const normalized = normalizeMemoryId(memoryId);
    const node = nodes.find((item) => item.memoryId === normalized || item.id === normalizeNodeId(normalized));
    return node ? node.visibility : 'private';
  }

  function normalizeViewerVisibility(current, viewerVisibility) {
    if (viewerVisibility === 'public') return normalizeVisibility(current);
    return current;
  }

  function buildConfidence(left, right) {
    return buildConfidenceFromEvidenceRefs(buildEvidenceRefs(left, right));
  }

  function buildConfidenceFromEvidenceRefs(refs) {
    if (refs.length === 0) return 'low';
    const explicitCount = refs.filter((ref) => ref.confidence === 'explicit' || ref.reviewStatus === 'input').length;
    if (explicitCount >= 4) return 'high';
    if (explicitCount >= 2) return 'medium';
    return 'low';
  }

  function makeSuggestionId(type, sourceMemoryId, targetMemoryId, evidenceRefs) {
    const evidenceKey = evidenceRefs.map((ref) => ref.id).sort().join('|');
    return `atlas-suggestion:${normalizeIdPart(type)}:${normalizeIdPart(sourceMemoryId)}:${normalizeIdPart(targetMemoryId)}:${normalizeIdPart(evidenceKey)}`;
  }

  function compareSuggestions(left, right) {
    return left.type.localeCompare(right.type)
      || left.sourceMemoryId.localeCompare(right.sourceMemoryId)
      || left.targetMemoryId.localeCompare(right.targetMemoryId)
      || left.id.localeCompare(right.id);
  }

  function normalizeType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return TYPE_BY_SOURCE[normalized] || normalized || '';
  }

  function normalizeState(value) {
    const normalized = String(value || 'candidate').trim();
    return SUGGESTION_STATES.includes(normalized) ? normalized : 'candidate';
  }

  function normalizeMemoryId(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    return text || '';
  }

  function normalizeNodeId(value) {
    if (!value) return '';
    const text = String(value).trim();
    return text.startsWith('memory:') ? text : `memory:${normalizeIdPart(text)}`;
  }

  function normalizeVisibility(value) {
    return value === 'public' ? 'public' : 'private';
  }

  function getStrictestVisibility(values) {
    return values.every((value) => normalizeVisibility(value) === 'public') ? 'public' : 'private';
  }

  function normalizeIdPart(value) {
    return encodeURIComponent(String(value || '').trim().toLowerCase()).replace(/%20/g, '-');
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    COPY,
    SUGGESTION_STATES,
    SUGGESTION_TYPES,
    createMemoryAtlasRelationshipSuggestions,
  };
});
