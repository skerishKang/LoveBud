(function() {
    function readConfirmedAuthCache() {
        try {
            if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
                const raw = localStorage.getItem('lovebud_auth_cache');
                if (raw && raw !== 'null') {
                    return JSON.parse(raw);
                }
            }
        } catch (e) {}
        return null;
    }

    function getConfirmedSessionUser() {
        try {
            if (window.getConfirmedAuthUser) {
                return window.getConfirmedAuthUser();
            }
        } catch (e) {}

        return readConfirmedAuthCache();
    }

    window.LoveBudEditorAuthHelpers = {
        readConfirmedAuthCache,
        getConfirmedSessionUser
    };
})();
