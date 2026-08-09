(function () {
    function createUtils({ isPagesContext }) {
        const buildPageHref = (page, params = {}) => {
            const base = isPagesContext ? `${page}.html` : `pages/${page}.html`;
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') searchParams.set(key, value);
            });
            const query = searchParams.toString();
            return query ? `${base}?${query}` : base;
        };

        const homeHref = isPagesContext ? '../index.html' : 'index.html';
        const searchHref = buildPageHref('search');
        const myTreesHref = buildPageHref('my-trees');
        const createDetailNavigationHrefs = () => ({
            homeHref,
            searchHref,
            myTreesHref,
            buildPageHref
        });
        const i18n = window.t || ((k) => k);
        const tText = (key, fallback) => {
            const translated = i18n(key);
            if (typeof translated !== 'string') return fallback;
            const normalized = translated.trim();
            if (!normalized || normalized === key) return fallback;
            return translated;
        };

        const escapeHtml = (value) => {
            var sec = window.LoveBudSecurity;
            if (sec) return sec.escapeHtml(value);
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const prettifyTagLabel = (tag) => {
            const raw = String(tag ?? '').trim();
            if (!raw) return '';
            const withoutPrefix = raw.replace(/^tag[_-]?/i, '');
            const spaced = withoutPrefix.replace(/[_-]+/g, ' ').trim();
            return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : raw;
        };

        const shouldHideEmotionTag = (tag) => {
            const raw = String(tag ?? '').trim();
            if (!raw) return true;
            const normalized = raw.toLowerCase().replace(/\s+/g, '');
            return normalized === 'tag_record'
                || normalized === 'tag-record'
                || normalized === '#기록';
        };

        const getLocalizedTagLabel = (tag) => {
            const raw = String(tag ?? '').trim();
            if (!raw || shouldHideEmotionTag(raw)) return '';
            return tText(raw, prettifyTagLabel(raw));
        };

        const TRUSTED_YOUTUBE_HOSTS = new Set([
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'music.youtube.com',
            'youtube-nocookie.com',
            'www.youtube-nocookie.com'
        ]);
        const YOUTUBE_SHORT_HOST = 'youtu.be';
        const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
        const emptyVideoSource = () => ({ embedUrl: '', watchUrl: '' });

        const sanitizeVideoHttpUrl = (value) => {
            const security = window.LoveBudSecurity;
            if (security && typeof security.sanitizeUrl === 'function') {
                return security.sanitizeUrl(value);
            }

            const raw = String(value ?? '').trim();
            if (!/^https?:\/\//i.test(raw)) return '';
            try {
                const parsed = new URL(raw);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                    ? parsed.href
                    : '';
            } catch (error) {
                return '';
            }
        };

        const normalizeVideoSourceUrl = (url) => {
            if (typeof url !== 'string') return '';
            const trimmed = url.trim();
            if (!trimmed) return '';

            const safeUrl = sanitizeVideoHttpUrl(trimmed);
            if (!safeUrl) return emptyVideoSource();

            try {
                const parsed = new URL(safeUrl);
                if (parsed.username || parsed.password) return emptyVideoSource();

                const host = parsed.hostname.toLowerCase();
                const isShortYouTubeHost = host === YOUTUBE_SHORT_HOST;
                const isTrustedYouTubeHost = isShortYouTubeHost || TRUSTED_YOUTUBE_HOSTS.has(host);

                if (!isTrustedYouTubeHost) {
                    return { embedUrl: '', watchUrl: parsed.href };
                }

                let videoId = '';
                if (isShortYouTubeHost) {
                    videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
                } else if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/')) {
                    videoId = parsed.pathname.split('/').filter(Boolean)[1] || '';
                } else {
                    videoId = parsed.searchParams.get('v') || '';
                }

                if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return emptyVideoSource();

                return {
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    watchUrl: `https://www.youtube.com/watch?v=${videoId}`
                };
            } catch (error) {
                return emptyVideoSource();
            }
        };

        const parseMomentOrderValue = (memory) => {
            const source = memory?.createdAt || memory?.timestamp || '';
            const parsed = new Date(source).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const isStructuralRootMemory = (memory) => {
            if (!memory) return true;
            const id = String(memory.id || '').trim().toLowerCase();
            return id === 'root'
                || memory.sourceType === 'system'
                || (!memory.parentId && !memory.sourceUrl && !memory.thumbnail);
        };

        const mergeTreeMemories = (memories, currentMemory) => {
            const list = Array.isArray(memories) ? memories.filter(Boolean) : [];
            if (!currentMemory?.id) return list;
            if (list.some(item => item && item.id === currentMemory.id)) return list;
            return [...list, currentMemory];
        };

        const sortTreeMemories = (memories, currentMemory) => mergeTreeMemories(memories, currentMemory)
            .sort((a, b) => parseMomentOrderValue(a) - parseMomentOrderValue(b));

        const resolveTreeMomentCount = ({ tree, memories, currentMemory }) => {
            const sortedMemories = sortTreeMemories(memories, currentMemory);
            const listCount = sortedMemories.length;
            const treeCount = Number(tree?.memoryCount) || 0;
            return Math.max(listCount, treeCount, currentMemory?.treeId ? 1 : 0);
        };

        const inferTreeContext = ({ treeId, currentMemory, mergedMemories }) => {
            if (!treeId) return null;
            const memoryCount = Math.max(mergedMemories.length, currentMemory?.treeId ? 1 : 0);
            return {
                id: treeId,
                title: '',
                memoryCount
            };
        };

        return {
            buildPageHref,
            createDetailNavigationHrefs,
            tText,
            escapeHtml,
            prettifyTagLabel,
            shouldHideEmotionTag,
            getLocalizedTagLabel,
            normalizeVideoSourceUrl,
            parseMomentOrderValue,
            isStructuralRootMemory,
            mergeTreeMemories,
            sortTreeMemories,
            resolveTreeMomentCount,
            inferTreeContext
        };
    }

    window.LoveBudDetailUtils = { createUtils };
})();
