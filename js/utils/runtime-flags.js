(function () {
    function isMockFallbackEnabled() {
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('mock=1') ||
            window.localStorage?.getItem('lovebud_force_mock') === '1'
        );
    }

    window.LoveBudRuntimeFlags = {
        isMockFallbackEnabled,
    };
})();
