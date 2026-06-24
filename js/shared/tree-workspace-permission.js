(function() {
    'use strict';

    function resolveTreeOwnerId(tree) {
        if (!tree) return null;
        return tree.ownerId || tree.owner_id || null;
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
})();
