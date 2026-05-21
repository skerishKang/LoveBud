(function() {
    'use strict';

    var MARKER = 'LoveBudViewerDataLoaderLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    async function loadPublicData(treeId) {
        var getMemories = window.apiClient &&
            (window.apiClient.communityApi && window.apiClient.communityApi.getCachedCommunityMemories ||
             window.apiClient.getCachedCommunityMemories);

        if (typeof getMemories !== 'function') throw new Error('Community API not available');

        var memories = await getMemories({ treeId: treeId, limit: 100 });
        return Array.isArray(memories) ? memories.filter(function(m) { return m && m.visibility === 'public'; }) : [];
    }

    window.LoveBudViewerDataLoader = {
        loadPublicData: loadPublicData
    };
})();
