(function() {
    const treeHelpers = window.LoveBudEditorTreeHelpers || (window.LoveBudEditorTreeHelpers = {});

    if (!treeHelpers.createInitialMemory) {
        treeHelpers.createInitialMemory = function createInitialMemory(options) {
            const opts = options || {};
            const getTreeMemories = opts.getTreeMemories || function() { return []; };
            const findRootMemory = opts.findRootMemory || function(memories) {
                if (!Array.isArray(memories)) return null;
                const parentNullNodes = memories.filter(function(m) {
                    return m && (m.parentId === null || m.parentId === undefined);
                });

                if (parentNullNodes.length === 1) return parentNullNodes[0];
                if (parentNullNodes.length > 1) {
                    return parentNullNodes.sort(function(a, b) {
                        const aTime = a.createdAt || a.timestamp || '9999';
                        const bTime = b.createdAt || b.timestamp || '9999';
                        return new Date(aTime) - new Date(bTime);
                    })[0];
                }

                return memories.find(function(m) {
                    return m && m.id === 'root';
                }) || null;
            };

            const canonicalRootId = opts.canonicalRootId || 'root';
            const treeId = opts.treeId || null;
            const i18n = opts.i18n || function(key) { return key; };

            const memories = getTreeMemories();
            const rootMem = findRootMemory(memories);

            if (rootMem) return rootMem;
            if (memories.length > 0) return memories[0];

            const isNewTree = memories.length === 0;

            return {
                id: canonicalRootId,
                treeId: treeId,
                title: i18n('first_memory'),
                memo: i18n('no_memory_yet'),
                timestamp: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
                thumbnail: isNewTree
                    ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23e8f5e9" width="120" height="90"/><text x="60" y="45" text-anchor="middle" fill="%234caf50" font-size="24">🌱</text><text x="60" y="70" text-anchor="middle" fill="%23666" font-size="10">빈 트리</text></svg>'
                    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
                emotionTags: [],
                parentId: null,
                isNewTree: isNewTree
            };
        };
    }
})();
