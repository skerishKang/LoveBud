window.LoveBudEditorCanvasViewportTargets = {
  getViewportTargets(viewportApi, options) {
    const { getTreeMemories, getCanonicalRootId, isRootMemory } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) return [];

    if (typeof getCanonicalRootId !== 'function' || typeof isRootMemory !== 'function') {
      return treeMemories;
    }

    const canonicalRootId = getCanonicalRootId();
    const visibleNodes = treeMemories.filter((memory) => !isRootMemory(memory, canonicalRootId));
    if (visibleNodes.length) return visibleNodes;

    const rootMemory = treeMemories.find((memory) => isRootMemory(memory, canonicalRootId));
    return rootMemory ? [rootMemory] : [];
  }
};
