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
        var raw = title.trim();
        if (!raw) return false;
        // Underscore-separated legacy keys: editor_url_only_youtube_title
        if (/^[a-z]+(?:_[a-z]+){2,}$/.test(raw)) return true;
        // Dot-separated legacy keys: tree.title, memory.content, editor.current.moment
        if (/^[a-z]+(?:\.[a-z0-9_]+)+$/.test(raw)) return true;
        return false;
    }

    function sanitizeDisplayTitle(value, fallback) {
        if (!value || typeof value !== 'string') {
            return typeof fallback === 'string' ? fallback : '';
        }
        var raw = value.trim();
        if (!raw) return typeof fallback === 'string' ? fallback : '';
        if (!isLocalizationKeyTitle(raw)) return value;
        // Legacy key detected: never expose the raw key.
        if (typeof fallback === 'string' && fallback) return fallback;
        // Per-key fallbacks
        var FALLBACKS = {
            'editor_url_only_youtube_title': 'YouTube 영상',
            'editor.current.moment': '지금 마음이 머문 장면',
            'editor.current.moment.empty': '이 트리의 첫 순간을 심어 보세요'
        };
        // Context-agnostic fallbacks for a11y/visible contexts where no caller fallback provided
        var GENERIC_FALLBACKS = {
            'tree.title': '순간',
            'memory.content': '순간',
            'memory.memo': '순간',
            'memory.title': '순간'
        };
        return FALLBACKS[raw] || GENERIC_FALLBACKS[raw] || '';
    }

    window.LoveBudTreeWorkspaceClassifier = {
        classifyDuplicateUrls: classifyDuplicateUrls,
        isLocalizationKeyTitle: isLocalizationKeyTitle,
        sanitizeDisplayTitle: sanitizeDisplayTitle
    };
})();
