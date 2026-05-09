(function () {
    function createPreviewCache({ cache, previewCache, previewCacheTtlMs, getPreviewCacheKey, state }) {
        function readPreviewCache(treeId) {
            if (!treeId) return null;

            if (previewCache.has(treeId)) {
                return previewCache.get(treeId);
            }

            if (!cache || typeof cache.get !== 'function') {
                return null;
            }

            const cachedPreview = cache.get(getPreviewCacheKey(treeId));
            if (cachedPreview && typeof cachedPreview === 'object') {
                previewCache.set(treeId, cachedPreview);
                return cachedPreview;
            }

            return null;
        }

        function writePreviewCache(treeId, hydratedTree) {
            if (!treeId || !hydratedTree || typeof hydratedTree !== 'object') return;

            previewCache.set(treeId, hydratedTree);
            if (cache && typeof cache.set === 'function') {
                cache.set(getPreviewCacheKey(treeId), hydratedTree, previewCacheTtlMs);
            }
        }

        function mergeHydratedTree(hydratedTree) {
            if (!hydratedTree || !hydratedTree.id) return;
            state.allTrees = state.allTrees.map(item => item.id === hydratedTree.id ? hydratedTree : item);
        }

        function areTreesEffectivelySame(prevTrees, nextTrees) {
            if (!Array.isArray(prevTrees) || !Array.isArray(nextTrees)) return false;
            if (prevTrees.length !== nextTrees.length) return false;

            return prevTrees.every((prevTree, index) => {
                const nextTree = nextTrees[index];
                if (!nextTree) return false;
                const prevStamp = prevTree.updatedAt || prevTree.createdAt || prevTree.memoryCount || 0;
                const nextStamp = nextTree.updatedAt || nextTree.createdAt || nextTree.memoryCount || 0;
                return prevTree.id === nextTree.id && prevStamp === nextStamp;
            });
        }

        return {
            readPreviewCache,
            writePreviewCache,
            mergeHydratedTree,
            areTreesEffectivelySame
        };
    }

    window.LoveBudSearchPreviewCache = { createPreviewCache };
})();
