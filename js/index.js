document.addEventListener('DOMContentLoaded', () => {
    // Reveal Observer for scroll animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Language Toggle Logic (Visual only)
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            console.log('Language changed to:', btn.textContent);
            // In a real app, this would trigger i18n logic
        });
    });

    setupBrowseSafePrefetch();

    console.log('Landing Portal Initialized');
});

function setupBrowseSafePrefetch() {
    const PREFETCH_LIMIT = 6;
    const PREFETCH_SORT = 'latest';
    const PREFETCH_CACHE_KEY = `public_trees_summary_latest_10_${PREFETCH_SORT}_${PREFETCH_LIMIT}`;
    const PREFETCH_TTL_MS = 5 * 60 * 1000;
    let prefetchStarted = false;

    const safeString = (value) => String(value || '').trim();

    const cacheKey = (key) => `lb_${key}`;

    const getStorage = () => {
        try {
            if (typeof window === 'undefined' || !window.sessionStorage) return null;
            return window.sessionStorage;
        } catch (e) {
            return null;
        }
    };

    const hasFreshPrefetchCache = () => {
        const storage = getStorage();
        if (!storage) return false;
        try {
            const raw = storage.getItem(cacheKey(PREFETCH_CACHE_KEY));
            if (!raw) return false;
            const item = JSON.parse(raw);
            if (!item || !Array.isArray(item.value)) return false;
            return !item.expiry || Date.now() <= Number(item.expiry);
        } catch (e) {
            return false;
        }
    };

    const writePrefetchCache = (trees) => {
        if (!Array.isArray(trees) || trees.length === 0) return;
        const item = {
            value: trees,
            expiry: Date.now() + PREFETCH_TTL_MS,
            cachedAt: Date.now()
        };

        if (window.LoveBudCache?.set) {
            window.LoveBudCache.set(PREFETCH_CACHE_KEY, trees, PREFETCH_TTL_MS);
            return;
        }

        const storage = getStorage();
        if (!storage) return;
        try {
            storage.setItem(cacheKey(PREFETCH_CACHE_KEY), JSON.stringify(item));
        } catch (e) {
            // Prefetch must never block landing interactions.
        }
    };

    const sanitizeUrl = (value) => {
        const raw = safeString(value);
        if (!raw) return '';
        try {
            const parsed = new URL(raw, window.location.origin);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
        } catch (e) {
            return '';
        }
    };

    const estimateStage = (count) => {
        if (count <= 0) return '새 트리';
        if (count <= 2) return '입덕';
        if (count <= 4) return '성장';
        return '최애';
    };

    const normalizePublicTreeSummary = (rawTree) => {
        const source = rawTree?.data || rawTree || {};
        const memoryCount = Number(source.memoryCount || source.memory_count || 0);
        const rawEmotionTags = Array.isArray(source.emotionTags)
            ? source.emotionTags
            : (Array.isArray(source.emotion_tags) ? source.emotion_tags : []);
        const thumbnail = source.representativeThumbnail || source.representative_thumbnail || source.thumbnail || '';

        return {
            id: source.id || rawTree?.id || null,
            title: source.title || '',
            visibility: source.visibility || 'private',
            createdAt: source.createdAt || source.created_at || null,
            updatedAt: source.updatedAt || source.updated_at || null,
            ownerId: source.ownerId || source.owner_id || null,
            memories: [],
            memoryCount: Number.isFinite(memoryCount) ? memoryCount : 0,
            emotionTags: rawEmotionTags.filter(Boolean).slice(0, 4),
            timeRange: source.timeRange || source.time_range || '기록 없음',
            representativeThumbnail: sanitizeUrl(thumbnail),
            theme: source.theme || '',
            stage: source.stage || estimateStage(memoryCount)
        };
    };

    const prefetchBrowseTrees = () => {
        if (prefetchStarted || hasFreshPrefetchCache() || typeof fetch !== 'function') return;
        prefetchStarted = true;

        fetch(`/api/community/trees?view=summary&sort=${encodeURIComponent(PREFETCH_SORT)}&limit=${PREFETCH_LIMIT}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
        })
            .then((response) => {
                if (!response.ok) throw new Error(`Browse prefetch failed: ${response.status}`);
                return response.json();
            })
            .then((payload) => {
                const rawTrees = Array.isArray(payload) ? payload : [];
                const trees = rawTrees
                    .map(normalizePublicTreeSummary)
                    .filter((tree) => tree.id && tree.visibility === 'public')
                    .slice(0, PREFETCH_LIMIT);
                writePrefetchCache(trees);
            })
            .catch(() => {
                // Safe prefetch is opportunistic; Browse page owns visible loading and error states.
            });
    };

    const scheduleIdlePrefetch = () => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(prefetchBrowseTrees, { timeout: 1800 });
            return;
        }
        window.setTimeout(prefetchBrowseTrees, 1200);
    };

    const isBrowseLink = (target) => {
        const link = target?.closest?.('a[href]');
        if (!link) return false;
        const href = link.getAttribute('href') || '';
        return href.includes('search.html');
    };

    document.body?.addEventListener('pointerover', (event) => {
        if (isBrowseLink(event.target)) prefetchBrowseTrees();
    }, { passive: true });

    document.body?.addEventListener('focusin', (event) => {
        if (isBrowseLink(event.target)) prefetchBrowseTrees();
    });

    scheduleIdlePrefetch();
}
