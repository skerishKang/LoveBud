(function () {
    var PREFETCH_CACHE_KEY = 'public_trees_summary_latest_10_latest_6';
    var PREFETCH_TTL_MS = 5 * 60 * 1000;
    var PREFETCH_LIMIT = 6;
    var PREFETCH_SORT = 'latest';

    var inFlightPromise = null;
    var prefetchStarted = false;
    var hoverTriggerBound = false;

    function isBrowseLink(target) {
        var link = target && target.closest && target.closest('a[href]');
        if (!link) return false;
        var href = link.getAttribute('href') || '';
        return /(?:^|\/)search(?:\.html)?(?:[?#]|$)/.test(href);
    }

    function prefetchBrowseTrees() {
        if (inFlightPromise) return;

        if (window.LoveBudCache) {
            var cached = window.LoveBudCache.get(PREFETCH_CACHE_KEY);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                return;
            }
        }

        inFlightPromise = fetch('/api/community/trees?view=summary' + '&sort=' + encodeURIComponent(PREFETCH_SORT) + '&limit=' + PREFETCH_LIMIT, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
        }).then(function (response) {
            if (!response.ok) throw new Error('Browse prefetch failed: ' + response.status);
            return response.json();
        }).then(function (rawTrees) {
            var trees = Array.isArray(rawTrees) ? rawTrees : [];
            var models;

            if (window.LoveTreePublicTreeAdapter && window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels) {
                models = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(trees);
            } else {
                models = trees.map(function (raw) {
                    var source = raw && raw.data ? raw.data : raw || {};
                    return {
                        id: source.id || (raw && raw.id) || null,
                        title: source.title || '',
                        visibility: source.visibility || 'private',
                        createdAt: source.createdAt || source.created_at || null,
                        updatedAt: source.updatedAt || source.updated_at || null,
                        ownerId: source.ownerId || source.owner_id || null,
                        memories: [],
                        memoryCount: Number(source.memoryCount || source.memory_count || 0),
                        emotionTags: [],
                        timeRange: '기록 없음',
                        representativeThumbnail: source.representativeThumbnail || source.representative_thumbnail || source.thumbnail || '',
                        theme: source.theme || '',
                        stage: source.stage || ''
                    };
                }).filter(function (t) { return t.id && t.visibility === 'public'; }).slice(0, PREFETCH_LIMIT);
            }

            if (!Array.isArray(models) || models.length === 0) return;

            if (window.LoveBudCache) {
                window.LoveBudCache.set(PREFETCH_CACHE_KEY, models, PREFETCH_TTL_MS);
            }
        }).catch(function (e) {
            console.warn('[LoveBudBrowsePrefetch] prefetch failed:', e.message);
        }).then(function () {
            inFlightPromise = null;
        });
    }

    function scheduleIdlePrefetch() {
        if (prefetchStarted) return;
        prefetchStarted = true;

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(prefetchBrowseTrees, { timeout: 2000 });
        } else {
            setTimeout(prefetchBrowseTrees, 1500);
        }
    }

    function setupHoverTrigger() {
        if (hoverTriggerBound) return;
        hoverTriggerBound = true;

        document.body.addEventListener('pointerover', function (event) {
            if (isBrowseLink(event.target)) prefetchBrowseTrees();
        }, { passive: true });

        document.body.addEventListener('focusin', function (event) {
            if (isBrowseLink(event.target)) prefetchBrowseTrees();
        });
    }

    window.LoveBudBrowsePrefetch = {
        init: function (options) {
            options = options || {};
            if (options.idle !== false) scheduleIdlePrefetch();
            if (options.hover !== false) setupHoverTrigger();
        },
        prefetch: prefetchBrowseTrees
    };
})();
