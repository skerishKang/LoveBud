(function() {
    'use strict';

    var MARKER = 'LoveBudPublicCanvasBridgeLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    /**
     * LoveBud Public Canvas Bridge
     * 
     * Fetches public tree data via public API endpoints and normalizes
     * the payload to the editor canvas shape.
     * 
     * Security: only uses publicRead=true fetch (no auth headers).
     * Private trees are never returned by the public endpoint.
     */
    function loadPublicTreeData(treeId) {
        if (!treeId) return Promise.reject(new Error('treeId required'));

        var apiFetch = window.LoveTreeBaseApiFetch && window.LoveTreeBaseApiFetch.apiFetch;
        if (typeof apiFetch !== 'function') {
            return Promise.reject(new Error('LoveTreeBaseApiFetch.apiFetch not available'));
        }

        var communityApi = window.apiClient && (
            window.apiClient.communityApi ||
            (window.apiClient.getCachedCommunityMemories ? { getCachedCommunityMemories: window.apiClient.getCachedCommunityMemories } : null)
        );

        var getCommunityMemories = communityApi && (
            typeof communityApi.getCachedCommunityMemories === 'function'
                ? function() { return communityApi.getCachedCommunityMemories({ treeId: treeId, limit: 100 }); }
                : null
        );

        return apiFetch('/trees/' + encodeURIComponent(treeId), { publicRead: true })
            .then(function(tree) {
                if (!tree || !tree.id) {
                    throw new Error('Tree not found or not public');
                }
                return tree;
            })
            .then(function(tree) {
                if (typeof getCommunityMemories !== 'function') {
                    return { tree: tree, memories: [] };
                }
                return getCommunityMemories().then(function(memories) {
                    return { tree: tree, memories: Array.isArray(memories) ? memories : [] };
                });
            });
    }

    /**
     * Normalize public tree + memories to the editor canvas shape.
     * Sets window.currentTreeData and window.currentTreeMemories.
     */
    function normalizeForCanvas(tree, rawMemories) {
        var adapter = window.LoveTreePublicTreeAdapter;
        var ownerId = tree.ownerId || tree.owner_id || (tree.data && (tree.data.ownerId || tree.data.owner_id)) || '';
        var description = tree.description || (tree.data && tree.data.description) || '';
        var summary = tree.summary || (tree.data && tree.data.summary) || '';
        var memo = tree.memo || (tree.data && tree.data.memo) || '';

        var treeData = {
            id: tree.id || tree.treeId || '',
            title: tree.title || '',
            visibility: 'public',
            stage: tree.stage || '',
            ownerId: ownerId,
            viewerCanEdit: tree.viewerCanEdit,
            description: description,
            summary: summary,
            memo: memo,
            memoryCount: Array.isArray(rawMemories) ? rawMemories.length : 0,
            data: {
                ownerId: ownerId,
                description: description,
                summary: summary,
                memo: memo
            }
        };

        var normalize = function(mem) {
            if (!mem) return null;
            var source = adapter && typeof adapter.unwrapMemoryRecord === 'function'
                ? adapter.unwrapMemoryRecord(mem)
                : (mem.data || mem || {});
            return {
                id: source.id || mem.id || null,
                treeId: source.treeId || source.tree_id || mem.treeId || mem.tree_id || tree.id,
                parentId: source.parentId ?? source.parent_id ?? mem.parentId ?? mem.parent_id ?? null,
                title: source.title || mem.title || '',
                memo: source.memo || source.description || source.emotionMemo || mem.memo || mem.description || mem.emotionMemo || '',
                quote: source.quote || mem.quote || '',
                timestamp: source.timestamp || mem.timestamp || '',
                thumbnail: source.thumbnail || mem.thumbnail || '',
                visibility: 'public',
                artist: source.artist || mem.artist || '',
                source: source.source || mem.source || '',
                sourceUrl: source.sourceUrl || source.source_url || mem.sourceUrl || mem.source_url || '',
                sourceType: source.sourceType || source.source_type || mem.sourceType || mem.source_type || 'youtube',
                emotionTags: source.emotionTags || source.emotion_tags || mem.emotionTags || mem.emotion_tags || [],
                createdAt: source.createdAt || source.created_at || mem.createdAt || mem.created_at || null,
                updatedAt: source.updatedAt || source.updated_at || mem.updatedAt || mem.updated_at || null
            };
        };

        var normalizedMemories = (Array.isArray(rawMemories) ? rawMemories : [])
            .map(normalize)
            .filter(function(memory) {
                return !!(memory && memory.id);
            });

        // Set window globals expected by createEditorCanvas
        window.currentTreeData = treeData;
        window.currentTreeMemories = normalizedMemories;

        return {
            treeData: treeData,
            treeMemories: normalizedMemories
        };
    }

    window.LoveBudPublicCanvasBridge = {
        loadPublicTreeData: loadPublicTreeData,
        normalizeForCanvas: normalizeForCanvas
    };
})();
