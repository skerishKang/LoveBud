(function() {
    'use strict';

    function resolveTreeOwnerId(tree) {
        if (!tree) return null;
        return tree.ownerId || tree.owner_id || (tree.data && (tree.data.ownerId || tree.data.owner_id)) || null;
    }

    function resolveTreeData(tree) {
        if (!tree) return null;
        return tree.data || null;
    }

    function resolveAuthSessionUser() {
        var authPolicy = window.LoveTreeAuthPolicy;
        if (!authPolicy) return null;
        var hasSession = typeof authPolicy.hasConfirmedAuthSession === 'function'
            ? authPolicy.hasConfirmedAuthSession()
            : false;
        if (!hasSession) return null;
        var currentUser = typeof authPolicy.getCachedAuthUser === 'function'
            ? authPolicy.getCachedAuthUser()
            : null;
        return currentUser || null;
    }

    function resolveTreeWorkspaceCanEdit(tree, options) {
        if (!tree) return false;
        if (options && options.requestedReadOnly === true) return false;
        var currentUser = resolveAuthSessionUser();
        if (tree.viewerCanEdit === true) {
            return !!(currentUser && currentUser.uid && tree._viewerCapabilityAuthUid === currentUser.uid);
        }
        if (tree.viewerCanEdit === false) return false;
        if (!currentUser || !currentUser.uid) return false;
        var ownerId = resolveTreeOwnerId(tree);
        if (!ownerId) return false;
        if (ownerId !== currentUser.uid) return false;
        return true;
    }

    window.LoveBudTreeWorkspacePermission = {
        resolveTreeOwnerId: resolveTreeOwnerId,
        resolveTreeWorkspaceCanEdit: resolveTreeWorkspaceCanEdit
    };

    function resolveMemoryUrl(memory) {
        if (!memory) return '';
        return memory.sourceUrl || memory.source_url || memory.videoUrl || memory.video_url || memory.url || memory.linkUrl || memory.link_url || '';
    }

    function classifyDuplicateUrls(memories) {
        if (!Array.isArray(memories)) return [];
        var urlMap = Object.create(null);
        memories.forEach(function(memory) {
            var url = resolveMemoryUrl(memory);
            if (!url) return;
            if (!urlMap[url]) urlMap[url] = [];
            urlMap[url].push({ id: memory.id, title: memory.title || '' });
        });
        var duplicates = [];
        Object.keys(urlMap).forEach(function(url) {
            if (urlMap[url].length > 1) {
                duplicates.push({ url: url, count: urlMap[url].length, items: urlMap[url] });
            }
        });
        return duplicates;
    }

    function isLocalizationKeyTitle(title) {
        if (!title || typeof title !== 'string') return false;
        return /^[a-z]+(?:_[a-z]+){2,}$/.test(title) && title.indexOf('_') !== -1;
    }

    window.LoveBudTreeWorkspaceClassifier = {
        classifyDuplicateUrls: classifyDuplicateUrls,
        isLocalizationKeyTitle: isLocalizationKeyTitle
    };
})();
