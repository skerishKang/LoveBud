(function () {
    'use strict';

    function canLoadMorePublicTrees(state, callbacks, flags) {
        state = state || {};
        callbacks = callbacks || {};
        flags = flags || {};
        return Boolean(
            callbacks.loadMorePublicTrees
            && state.apiTreesLoaded
            && state.hasMoreTrees
            && !state.isLoadingMore
            && !flags.isQueued
            && Number(state.currentLimit || 0) < 60
        );
    }

    function getSentinelDoneState(state) {
        state = state || {};
        return !state.apiTreesLoaded || Number(state.currentLimit || 0) >= 60 || !state.hasMoreTrees;
    }

    function syncScrollLoadSentinel(sentinel, state) {
        if (!sentinel) return null;

        var isDone = getSentinelDoneState(state || {});
        sentinel.hidden = isDone;
        sentinel.classList.toggle('is-loading', Boolean(state && state.isLoadingMore));
        sentinel.classList.toggle('is-idle', !isDone && !Boolean(state && state.isLoadingMore));
        sentinel.setAttribute('aria-hidden', isDone ? 'true' : 'false');

        var icon = sentinel.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.hidden = !Boolean(state && state.isLoadingMore);
        }

        var text = sentinel.querySelector('[data-scroll-load-label]');
        if (text) {
            text.textContent = state && state.isLoadingMore ? 'Loading more LoveTrees...' : '';
        }

        return sentinel;
    }

    function isSentinelNearViewport(sentinel, win) {
        if (!sentinel || sentinel.hidden || typeof sentinel.getBoundingClientRect !== 'function') return false;
        var targetWindow = win || window;
        var rect = sentinel.getBoundingClientRect();
        return rect.top <= targetWindow.innerHeight + 720 && rect.bottom >= -240;
    }

    function createScrollLoadSentinel(doc) {
        var targetDocument = doc || document;
        var sentinel = targetDocument.createElement('div');
        sentinel.id = 'browseScrollLoadSentinel';
        sentinel.className = 'browse-scroll-load-sentinel';
        sentinel.innerHTML = '\n                <span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>\n                <span data-scroll-load-label></span>\n            ';
        return sentinel;
    }

    function isScrollIntentKey(event) {
        return !!event && [' ', 'PageDown', 'End', 'ArrowDown'].indexOf(event.key) !== -1;
    }

    // Sentinel lifecycle helpers - ownership extension for preparation
    function ensureScrollLoadSentinel(resultsList, state, callbacks) {
        if (!resultsList || scrollLoadSentinel) return scrollLoadSentinel;

        scrollLoadSentinel = createScrollLoadSentinel(document);
        resultsList.insertAdjacentElement('afterend', scrollLoadSentinel);
        syncScrollLoadSentinel(scrollLoadSentinel, state);

        if ('IntersectionObserver' in window) {
            scrollLoadObserver = new IntersectionObserver((entries) => {
                if (entries.some(entry => entry.isIntersecting)) {
                    scheduleScrollLoadCheck();
                }
            }, {
                root: null,
                rootMargin: '720px 0px 720px 0px',
                threshold: 0
            });
            scrollLoadObserver.observe(scrollLoadSentinel);
        }

        bindScrollLoadIntentHandlers();
        scheduleScrollLoadCheck();
        return scrollLoadSentinel;
    }

    function requestScrollLoadMore(state, callbacks, flags) {
        flags = flags || {};
        if (!hasUserScrolledTowardFeed || !isSentinelNearViewport(scrollLoadSentinel, window) || !canLoadMorePublicTrees(state, callbacks, flags)) return;

        flags.isQueued = true;
        syncScrollLoadSentinel(scrollLoadSentinel, state);
        try {
            callbacks.loadMorePublicTrees({ source: 'scroll' });
        } finally {
            flags.isQueued = false;
            syncScrollLoadSentinel(scrollLoadSentinel, state);
        }
    }

    function scheduleScrollLoadCheck(state) {
        if (scrollCheckRaf) return;
        scrollCheckRaf = window.requestAnimationFrame(() => {
            scrollCheckRaf = 0;
            if ((window.scrollY || window.pageYOffset || 0) > 80) {
                hasUserScrolledTowardFeed = true;
            }
            requestScrollLoadMore(state, callbacks, {});
        });
    }

    function markScrollLoadIntent() {
        hasUserScrolledTowardFeed = true;
        scheduleScrollLoadCheck();
    }

    function handleScrollLoadKeydown(event) {
        var isIntentKey = isScrollIntentKey(event);
        if (isIntentKey) {
            markScrollLoadIntent();
        }
    }

    function bindScrollLoadIntentHandlers() {
        if (scrollLoadIntentBound) return;
        scrollLoadIntentBound = true;

        window.addEventListener('scroll', scheduleScrollLoadCheck, { passive: true });
        window.addEventListener('wheel', markScrollLoadIntent, { passive: true });
        window.addEventListener('touchmove', markScrollLoadIntent, { passive: true });
        window.addEventListener('keydown', handleScrollLoadKeydown);
        window.addEventListener('resize', scheduleScrollLoadCheck, { passive: true });
        window.addEventListener('pageshow', scheduleScrollLoadCheck);
    }

    // Internal state for helper usage
    var scrollLoadSentinel = null;
    var scrollLoadObserver = null;
    var scrollCheckRaf = 0;
    var isScrollLoadQueued = false;
    var hasUserScrolledTowardFeed = false;
    var scrollLoadIntentBound = false;
    var callbacks = {};

    function patchSearchUIFactory() {
        var SearchUI = window.LoveBudSearchUI;
        if (!SearchUI || typeof SearchUI.createSearchUI !== 'function' || SearchUI.__scrollLoadHelperPatched) return;

        var originalCreateSearchUI = SearchUI.createSearchUI;
        SearchUI.createSearchUI = function (config) {
            var ui = originalCreateSearchUI(config);
            if (!ui) return ui;
            ui.__scrollLoadHelperPatched = true;
            ui.scrollLoadHelpers = window.LoveBudSearchScrollLoad;
            return ui;
        };

        SearchUI.__scrollLoadHelperPatched = true;
    }

    window.LoveBudSearchScrollLoad = {
        canLoadMorePublicTrees: canLoadMorePublicTrees,
        getSentinelDoneState: getSentinelDoneState,
        syncScrollLoadSentinel: syncScrollLoadSentinel,
        isSentinelNearViewport: isSentinelNearViewport,
        createScrollLoadSentinel: createScrollLoadSentinel,
        isScrollIntentKey: isScrollIntentKey,
        // Sentinel lifecycle helpers
        ensureScrollLoadSentinel: ensureScrollLoadSentinel,
        requestScrollLoadMore: requestScrollLoadMore,
        scheduleScrollLoadCheck: scheduleScrollLoadCheck,
        markScrollLoadIntent: markScrollLoadIntent,
        handleScrollLoadKeydown: handleScrollLoadKeydown,
        bindScrollLoadIntentHandlers: bindScrollLoadIntentHandlers,
        patchSearchUIFactory: patchSearchUIFactory
    };

    patchSearchUIFactory();
})();
