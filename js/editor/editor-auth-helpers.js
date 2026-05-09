(function() {
    function parseConfirmedAuthCache(raw) {
        if (!raw || raw === 'null') return null;

        try {
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.uid) return null;
            return parsed;
        } catch (e) {}

        return null;
    }

    function readConfirmedAuthCache() {
        try {
            if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
                return parseConfirmedAuthCache(localStorage.getItem('lovebud_auth_cache'));
            }
        } catch (e) {}
        return null;
    }

    function getConfirmedSessionUser() {
        try {
            if (window.getConfirmedAuthUser) {
                const authUser = window.getConfirmedAuthUser();
                if (authUser && authUser.uid) {
                    return authUser;
                }
            }
        } catch (e) {}

        return readConfirmedAuthCache();
    }

    function hasConfirmedSessionUser() {
        return !!getConfirmedSessionUser();
    }

    window.LoveBudEditorAuthHelpers = {
        parseConfirmedAuthCache,
        readConfirmedAuthCache,
        getConfirmedSessionUser,
        hasConfirmedSessionUser
    };
})();
