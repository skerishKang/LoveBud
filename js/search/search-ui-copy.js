(function () {
    'use strict';

    var previousCopy = window.LoveBudSearchCopy || {};
    var previousGetCurrentLocale = previousCopy.getCurrentLocale;
    var previousGetSearchCopy = previousCopy.getSearchCopy;

    function getCurrentLocale() {
        if (typeof previousGetCurrentLocale === 'function' && previousGetCurrentLocale !== getCurrentLocale) {
            return previousGetCurrentLocale();
        }
        var locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        if (typeof previousGetSearchCopy === 'function' && previousGetSearchCopy !== getSearchCopy) {
            return previousGetSearchCopy(key, fallbackKo, fallbackEn);
        }
        var locale = getCurrentLocale();
        var dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function getSortCopy(sortKey) {
        var key = sortKey === 'popular' ? 'popular' : 'latest';
        if (key === 'popular') {
            return {
                title: getSearchCopy('search.resultsPopularHeading', '많이 감상한 러브트리', 'Popular LoveTrees')
            };
        }
        return {
            title: getSearchCopy('search.resultsHeading', '둘러볼 러브트리', 'LoveTrees to browse')
        };
    }

    var api = {
        getCurrentLocale: getCurrentLocale,
        getSearchCopy: getSearchCopy,
        getSortCopy: getSortCopy
    };

    window.LoveBudSearchUICopy = api;
    window.LoveBudSearchCopy = Object.assign({}, previousCopy, api);
})();
