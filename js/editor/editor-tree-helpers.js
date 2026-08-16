(function() {
    const treeHelpers = window.LoveBudEditorTreeHelpers || (window.LoveBudEditorTreeHelpers = {});

    function isEditorDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_EDITOR_DEBUG === true;
    }

    function editorDebugLog() {
        if (!isEditorDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

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

    if (!treeHelpers.syncCurrentTreeData) {
        treeHelpers.syncCurrentTreeData = function syncCurrentTreeData(tree) {
            window.currentTreeData = {
                ...tree,
                visibility: tree && tree.visibility ? tree.visibility : 'public'
            };
            editorDebugLog('[editor] currentTreeData set');
        };
    }

    if (!treeHelpers.applyUpdatedTreeVisibility) {
        treeHelpers.applyUpdatedTreeVisibility = function applyUpdatedTreeVisibility(options) {
            var opts = options || {};
            var updatedTree = opts.updatedTree || {};
            var nextVisibility = opts.nextVisibility;
            var currentTreeData = opts.currentTreeData || window.currentTreeData || {};

            window.currentTreeData = {
                ...currentTreeData,
                ...updatedTree,
                visibility: updatedTree && updatedTree.visibility ? updatedTree.visibility : nextVisibility
            };

            editorDebugLog('[editor] currentTreeData visibility updated');
            return window.currentTreeData;
        };
    }

    if (!treeHelpers.resolveParentIdForCreate) {
        treeHelpers.resolveParentIdForCreate = function resolveParentIdForCreate(selectedNodeId, canonicalRootId) {
            if (!selectedNodeId || selectedNodeId === canonicalRootId) {
                return canonicalRootId === 'root' ? null : canonicalRootId;
            }
            return selectedNodeId;
        };
    }

    if (!treeHelpers.nextMemoryIdFromMemories) {
        treeHelpers.nextMemoryIdFromMemories = function nextMemoryIdFromMemories(memories) {
            var max = 0;

            (Array.isArray(memories) ? memories : []).forEach(function(m) {
                if (!m || !m.id) return;
                var match = String(m.id).match(/^m(\d+)$/);
                if (match) {
                    max = Math.max(max, parseInt(match[1], 10));
                }
            });

            return 'm' + (max + 1);
        };
    }

    if (!treeHelpers.createTreeVisibilityUpdater) {
        treeHelpers.createTreeVisibilityUpdater = function createTreeVisibilityUpdater(options) {
            var opts = options || {};
            var canEdit = opts.canEdit;
            var getTreeId = opts.getTreeId || function() { return null; };
            var getApiClient = opts.getApiClient || function() { return window.apiClient; };
            var applyUpdatedTreeVisibility = opts.applyUpdatedTreeVisibility;
            var getCurrentTreeData = opts.getCurrentTreeData || function() { return window.currentTreeData || {}; };
            var updateSidebarStatus = opts.updateSidebarStatus;
            var getCurrentEditingMemory = opts.getCurrentEditingMemory || function() { return null; };
            var updateDetailPanel = opts.updateDetailPanel;
            var reportError = opts.reportError || function() {};

            return async function updateTreeVisibility(nextVisibility) {
                if (canEdit === false) return;
                var treeId = getTreeId();
                var apiClient = getApiClient();

                if (!treeId || !apiClient || typeof apiClient.updateTree !== 'function') {
                    throw new Error('updateTree not available');
                }

                var updatedTree = await apiClient.updateTree(treeId, { visibility: nextVisibility });

                // #4055: after a CONFIRMED visibility mutation, purge this tree's
                // public Browse/preview projections immediately. This runs only on
                // success — a failed/unauthorized mutation must not pretend the
                // revocation happened.
                if (apiClient && typeof apiClient.clearCommunityCaches === 'function') {
                    try {
                        apiClient.clearCommunityCaches(treeId);
                    } catch (e) {
                        editorDebugLog('[editor] Failed to clear community caches after visibility change');
                    }
                }

                if (typeof applyUpdatedTreeVisibility === 'function') {
                    applyUpdatedTreeVisibility({
                        updatedTree: updatedTree,
                        nextVisibility: nextVisibility,
                        currentTreeData: getCurrentTreeData()
                    });
                } else {
                    reportError('LoveBudEditorTreeHelpers.applyUpdatedTreeVisibility missing');
                }

                if (typeof updateSidebarStatus === 'function') updateSidebarStatus();

                var currentEditingMemory = getCurrentEditingMemory();
                if (currentEditingMemory && typeof updateDetailPanel === 'function') {
                    updateDetailPanel(currentEditingMemory);
                }
            };
        };
    }
})();
