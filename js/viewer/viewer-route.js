(function() {
    'use strict';

    function getTreeId(locationLike) {
        var loc = locationLike || window.location || {};
        var search = typeof loc.search === 'string' ? loc.search : '';
        var params = new URLSearchParams(search);
        return params.get('treeId');
    }

    window.LoveBudViewerRoute = {
        getTreeId: getTreeId
    };
})();
