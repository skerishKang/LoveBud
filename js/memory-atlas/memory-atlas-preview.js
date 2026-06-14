(function attachMemoryAtlasPreview(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.LoveBudMemoryAtlasPreview = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMemoryAtlasPreviewApi() {
  'use strict';

  const PREVIEW_COPY = Object.freeze({
    title: 'Atlas preview',
    status: 'Preview only — no relationships are saved.',
    basis: "Based on this memory's existing fields.",
    review: 'Review before saving any future relationship.',
    empty: 'No atlas connections to preview yet.',
  });

  const PREVIEW_GROUP_TYPES = Object.freeze([
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

  function createMemoryAtlasPreview(projection, options) {
    const safeProjection = normalizeProjection(projection);
    const settings = isPlainObject(options) ? options : {};
    const memoryNode = resolveMemoryNode(safeProjection.nodes, settings.memoryNodeId);

    if (!memoryNode) {
      return createEmptyPreview('private');
    }

    const relatedEdges = safeProjection.edges.filter((edge) => edge.from === memoryNode.id || edge.to === memoryNode.id);
    const relatedNodeIds = new Set();
    relatedEdges.forEach((edge) => {
      if (edge.from && edge.from !== memoryNode.id) relatedNodeIds.add(edge.from);
      if (edge.to && edge.to !== memoryNode.id) relatedNodeIds.add(edge.to);
    });

    const relatedNodes = safeProjection.nodes.filter((node) => relatedNodeIds.has(node.id) && node.type !== 'memory');
    const groups = buildGroups(relatedNodes, relatedEdges, safeProjection.evidence);
    const visibility = collectPreviewVisibility(memoryNode, groups, relatedEdges, safeProjection.evidence);
    const hasConnections = groups.some((group) => group.items.length > 0);

    return {
      title: PREVIEW_COPY.title,
      copy: PREVIEW_COPY,
      empty: !hasConnections,
      emptyMessage: hasConnections ? '' : PREVIEW_COPY.empty,
      memory: {
        id: memoryNode.id,
        label: safeLabel(memoryNode.label || memoryNode.id),
        visibility: normalizeVisibility(memoryNode.visibility),
      },
      visibility,
      counts: {
        groups: groups.filter((group) => group.items.length > 0).length,
        nodes: relatedNodes.length,
        edges: relatedEdges.length,
        evidence: countEvidenceForTargets(safeProjection.evidence, relatedNodes, relatedEdges),
      },
      groups,
    };
  }

  function createEmptyPreview(visibility) {
    return {
      title: PREVIEW_COPY.title,
      copy: PREVIEW_COPY,
      empty: true,
      emptyMessage: PREVIEW_COPY.empty,
      memory: null,
      visibility: normalizeVisibility(visibility),
      counts: {
        groups: 0,
        nodes: 0,
        edges: 0,
        evidence: 0,
      },
      groups: PREVIEW_GROUP_TYPES.map((type) => ({ type, label: getGroupLabel(type), items: [] })),
    };
  }

  function normalizeProjection(projection) {
    if (!isPlainObject(projection)) return { nodes: [], edges: [], evidence: [] };
    return {
      nodes: Array.isArray(projection.nodes) ? projection.nodes.filter(isPlainObject) : [],
      edges: Array.isArray(projection.edges) ? projection.edges.filter(isPlainObject) : [],
      evidence: Array.isArray(projection.evidence) ? projection.evidence.filter(isPlainObject) : [],
    };
  }

  function resolveMemoryNode(nodes, memoryNodeId) {
    if (memoryNodeId) {
      const explicit = nodes.find((node) => node.id === memoryNodeId && node.type === 'memory');
      if (explicit) return explicit;
    }
    return nodes.find((node) => node.type === 'memory') || null;
  }

  function buildGroups(nodes, edges, evidenceRecords) {
    return PREVIEW_GROUP_TYPES.map((type) => {
      const items = nodes
        .filter((node) => node.type === type)
        .map((node) => buildPreviewItem(node, edges, evidenceRecords))
        .sort(comparePreviewItems);

      return {
        type,
        label: getGroupLabel(type),
        items,
      };
    });
  }

  function buildPreviewItem(node, edges, evidenceRecords) {
    const connectedEdges = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    const edgeTypes = Array.from(new Set(connectedEdges.map((edge) => edge.type).filter(Boolean))).sort();
    const evidenceIds = collectEvidenceIds(node, connectedEdges);
    const evidenceCount = evidenceIds.filter((id) => evidenceRecords.some((evidence) => evidence.id === id)).length;

    return {
      id: String(node.id || ''),
      type: String(node.type || ''),
      label: safeLabel(node.label || node.id || node.type),
      visibility: normalizeVisibility(node.visibility),
      edgeTypes,
      evidenceCount,
      previewOnly: true,
    };
  }

  function collectEvidenceIds(node, edges) {
    const ids = new Set();
    if (Array.isArray(node.evidenceIds)) {
      node.evidenceIds.forEach((id) => {
        if (id) ids.add(String(id));
      });
    }
    edges.forEach((edge) => {
      if (Array.isArray(edge.evidenceIds)) {
        edge.evidenceIds.forEach((id) => {
          if (id) ids.add(String(id));
        });
      }
    });
    return Array.from(ids);
  }

  function countEvidenceForTargets(evidenceRecords, nodes, edges) {
    const targetIds = new Set();
    nodes.forEach((node) => targetIds.add(node.id));
    edges.forEach((edge) => targetIds.add(edge.id));
    return evidenceRecords.filter((evidence) => targetIds.has(evidence.targetId)).length;
  }

  function collectPreviewVisibility(memoryNode, groups, edges, evidenceRecords) {
    let visibility = normalizeVisibility(memoryNode.visibility);
    const previewTargetIds = collectPreviewTargetIds(memoryNode, groups, edges);

    groups.forEach((group) => {
      group.items.forEach((item) => {
        visibility = getStrictestVisibility(visibility, item.visibility);
      });
    });
    edges.forEach((edge) => {
      visibility = getStrictestVisibility(visibility, normalizeVisibility(edge.visibility));
    });
    evidenceRecords
      .filter((evidence) => previewTargetIds.has(evidence.targetId))
      .forEach((evidence) => {
        visibility = getStrictestVisibility(visibility, normalizeVisibility(evidence.visibility));
      });
    return visibility;
  }

  function collectPreviewTargetIds(memoryNode, groups, edges) {
    const targetIds = new Set([memoryNode.id]);
    groups.forEach((group) => {
      group.items.forEach((item) => targetIds.add(item.id));
    });
    edges.forEach((edge) => {
      if (edge.id) targetIds.add(edge.id);
    });
    return targetIds;
  }

  function getGroupLabel(type) {
    const labels = {
      source: 'Sources',
      video: 'Videos',
      topic: 'Topics',
      person: 'People',
      place: 'Places',
      event: 'Events',
      emotion: 'Emotions',
      time: 'Time',
      tree: 'Trees',
      pack: 'Packs',
    };
    return labels[type] || type;
  }

  function comparePreviewItems(left, right) {
    return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  }

  function safeLabel(value) {
    return String(value || '').trim() || 'Untitled';
  }

  function normalizeVisibility(value) {
    return value === 'public' ? 'public' : 'private';
  }

  function getStrictestVisibility(currentVisibility, incomingVisibility) {
    return currentVisibility === 'public' && incomingVisibility === 'public' ? 'public' : 'private';
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    PREVIEW_COPY,
    PREVIEW_GROUP_TYPES,
    createMemoryAtlasPreview,
  };
});
