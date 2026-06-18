/**
 * LoveBud Public Tree Viewer
 * v20260505-802-1
 *
 * Read-only public LoveTree viewer shell.
 * Loads public tree data and displays nodes + selected moment preview.
 * Enhanced: YouTube embed support, improved accessibility.
 */

(function() {
    'use strict';

    const MARKER = 'LoveBudPublicTreeViewerLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    const VIEW_ACTOR_KEY_STORAGE = 'lovebud_public_tree_view_actor_key_v1';

    // Selectors
    const SEL = {
        treeShell: '#viewerTreeShell',
        loadingState: '#viewerLoadingState',
        emptyState: '#viewerEmptyState',
        errorState: '#viewerErrorState',
        treeContainer: '#viewerTreeContainer',
        treeTitle: '#viewerTreeTitle',
        treeMeta: '#viewerTreeMeta',
        nodesList: '#viewerNodesList',
        previewContainer: '#viewerPreviewContainer',
        previewEmpty: '#viewerPreviewEmpty',
        previewContent: '#viewerPreviewContent',
        previewMedia: '#viewerPreviewMedia',
        momentTitle: '#viewerMomentTitle',
        momentTags: '#viewerMomentTags',
        momentMeta: '#viewerMomentMeta',
        momentDiary: '#viewerMomentDiary',
        diaryQuote: '#viewerDiaryQuote',
        diaryContent: '#viewerDiaryContent',
        retryBtn: '#viewerRetryBtn',
        backLink: '#backButton'
    };

    // State
    let currentTreeId = null;
    let currentTree = null;
    let currentMemories = [];
    let selectedMemoryId = null;
    let viewEventSentForTreeId = null;

    // i18n helper
    function t(key, fallbackKo, fallbackEn) {
        const dict = window.i18nViewer?.[key];
        if (dict && typeof dict === 'object') {
            const locale = (window.i18n?.currentLang || 'ko').toLowerCase();
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return dict || fallbackKo || fallbackEn || key;
    }

    // escapeHtml
    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // sanitizeUrl
    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec && typeof sec.sanitizeUrl === 'function') {
            return sec.sanitizeUrl(value);
        }
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        if (!/^https?:\/\//i.test(raw)) return '';
        try {
            var parsed = new URL(raw);
            var protocol = String(parsed.protocol).toLowerCase();
            return protocol === 'http:' || protocol === 'https:' ? parsed.href : '';
        } catch (e) {
            return '';
        }
    }

    // getCurrentLocale
    function getCurrentLocale() {
        const locale = window.i18n?.currentLang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function createRandomViewActorKey() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return 'anon-' + window.crypto.randomUUID();
        }
        return 'anon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }

    function getOrCreateViewActorKey() {
        try {
            const stored = window.localStorage?.getItem(VIEW_ACTOR_KEY_STORAGE);
            if (stored) return stored;
            const created = createRandomViewActorKey();
            window.localStorage?.setItem(VIEW_ACTOR_KEY_STORAGE, created);
            return created;
        } catch (error) {
            return createRandomViewActorKey();
        }
    }

    function buildTreeViewEndpoint(treeId) {
        return '/api/trees/' + encodeURIComponent(treeId) + '/views';
    }

    function recordPublicTreeView(treeId) {
        if (!treeId || viewEventSentForTreeId === treeId) return;
        viewEventSentForTreeId = treeId;

        const actorKey = getOrCreateViewActorKey();
        const payload = JSON.stringify({
            actorKey,
            actorKind: 'anonymous',
            source: 'public_tree_detail'
        });

        fetch(buildTreeViewEndpoint(treeId), {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: payload,
            keepalive: true
        }).catch((error) => {
            console.warn('[viewer] tree view count failed:', error);
        });
    }

    // Render helpers
    function resolveElement(sel) {
        if (!sel) return null;
        if (typeof sel === 'string') {
            return document.querySelector(sel);
        }
        return sel; // already an element
    }

    function setContent(sel, text) {
        const el = resolveElement(sel);
        if (el) el.textContent = text;
    }

    function show(...sels) {
        for (const sel of sels) {
            const el = resolveElement(sel);
            if (el) el.removeAttribute('hidden');
        }
    }

    function hide(...sels) {
        for (const sel of sels) {
            const el = resolveElement(sel);
            if (el) el.setAttribute('hidden', '');
        }
    }

    function getBasePath() {
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    // Main entry
    async function initViewer() {
        const params = new URLSearchParams(window.location.search);
        const treeId = params.get('treeId')?.trim();
        if (!treeId) {
            renderEmpty();
            return;
        }

        currentTreeId = treeId;
        showLoading();

        try {
            // Use public tree preview from Browse data pattern
            // We'll fetch the tree's public memories via community endpoint
            const memories = await loadPublicMemories(treeId);

            if (!memories || memories.length === 0) {
                renderEmpty();
                return;
            }

            currentMemories = memories;
            // Build a minimal tree object
            currentTree = {
                id: treeId,
                memoryCount: memories.length,
                title: inferTreeTitle(memories)
            };

            renderTree();
            renderPreview(); // show first moment
            recordPublicTreeView(treeId);
        } catch (error) {
            console.error('[viewer] load failed:', error);
            renderError();
        }
    }

    async function loadPublicMemories(treeId) {
        // Defensive: community methods may be on apiClient.communityApi or flattened onto apiClient
        const getCachedCommunityMemories =
            window.apiClient?.communityApi?.getCachedCommunityMemories ||
            window.apiClient?.getCachedCommunityMemories;

        if (typeof getCachedCommunityMemories !== 'function') {
            throw new Error('Community API not available');
        }

        const memories = await getCachedCommunityMemories({ treeId, limit: 100 });
        return Array.isArray(memories)
            ? memories.filter(m => m && m.visibility === 'public')
            : [];
    }

    function inferTreeTitle(memories) {
        // Use first memory's tree title if available, else fallback
        const first = memories[0];
        if (first?.treeTitle) return first.treeTitle;
        if (first?.title) return first.title;
        return t('viewer.treeTitle', '러브트리', 'LoveTree');
    }

    // Rendering states
    function showLoading() {
        hide(SEL.treeContainer, SEL.emptyState, SEL.errorState);
        show(SEL.loadingState);
    }

    function renderEmpty() {
        hide(SEL.treeContainer, SEL.loadingState, SEL.errorState);
        show(SEL.emptyState);
    }

    function renderError() {
        hide(SEL.treeContainer, SEL.loadingState, SEL.emptyState);
        show(SEL.errorState);
    }

    function renderTree() {
        hide(SEL.loadingState, SEL.emptyState, SEL.errorState);
        show(SEL.treeContainer);

        // Title
        setContent(SEL.treeTitle, currentTree.title);
        const metaText = t('viewer.treeMeta', '{count}개의 순간', '{count} moments')
            .replace('{count}', String(currentTree.memoryCount || 0));
        setContent(SEL.treeMeta, metaText);

        // Render nodes
        renderNodesList();
    }

    function renderNodesList() {
        const list = resolveElement(SEL.nodesList);
        if (!list) return;
        list.innerHTML = '';

        for (const memory of currentMemories) {
            const node = document.createElement('div');
            node.className = 'viewer-node' + (memory.id === selectedMemoryId ? ' viewer-node-active' : '');
            node.dataset.memoryId = memory.id;
            node.setAttribute('role', 'button');
            node.setAttribute('tabindex', '0');
            node.setAttribute('aria-label', escapeHtml(memory.title || memory.emotionMemo || t('viewer.momentTitle', '그때의 마음', 'That Moment')));

            // Node content: title + date + tags
            let tagsHtml = '';
            for (const tag of (memory.emotionTags || [])) {
                tagsHtml += `<span class="viewer-node-tag">${escapeHtml(tag)}</span>`;
            }
            node.innerHTML = `
                <div class="viewer-node-header">
                    <span class="viewer-node-title">${escapeHtml(memory.title || memory.emotionMemo || '')}</span>
                    <span class="viewer-node-date">${escapeHtml(formatMemoryDate(memory))}</span>
                </div>
                <div class="viewer-node-tags">
                    ${tagsHtml}
                </div>
            `;

            node.addEventListener('click', () => selectMemory(memory.id));
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectMemory(memory.id);
                }
            });
            list.appendChild(node);
        }
    }

    function formatMemoryDate(memory) {
        // memory.createdAt or memory.date
        const raw = memory.createdAt || memory.date || '';
        if (!raw) return '';
        try {
            const d = new Date(raw);
            return d.toLocaleDateString(getCurrentLocale() === 'en' ? 'en-US' : 'ko-KR');
        } catch (e) {
            return raw;
        }
    }

    function extractYouTubeVideoId(url) {
        if (!url) return null;
        const s = String(url);
        // Standard watch URL with v= parameter
        const vMatch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (vMatch) return vMatch[1];
        // youtu.be/ID, shorts/ID, embed/ID, live/ID, v/ID
        const pathMatch = s.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
        if (pathMatch) return pathMatch[1];
        return null;
    }

    function selectMemory(memoryId) {
        selectedMemoryId = memoryId;
        // update active node class
        const list = resolveElement(SEL.nodesList);
        const nodes = list ? list.querySelectorAll('.viewer-node') : [];
        nodes.forEach(n => {
            n.classList.toggle('viewer-node-active', n.dataset.memoryId === memoryId);
        });

        // find memory data
        const memory = currentMemories.find(m => m.id === memoryId);
        if (!memory) return;

        renderPreviewMemory(memory);
    }

    function renderPreview() {
        hide(SEL.previewEmpty);
        show(SEL.previewContent);
        // If no memory selected yet, select first (unless eager video is hidden)
        const hideEagerVideo = window.LoveBudHideEagerVideo === true;
        if (!selectedMemoryId && currentMemories.length > 0) {
            // When hiding eager video, don't auto-select first memory on page load
            // User must manually select a moment to view media
            if (!hideEagerVideo) {
                selectMemory(currentMemories[0].id);
            } else {
                // Show placeholder instead of auto-playing first video
                renderPreviewPlaceholder();
            }
        }
    }

    function renderPreviewPlaceholder() {
        // Show a placeholder message that user should select a moment
        const container = resolveElement(SEL.previewMedia);
        if (container) {
            container.innerHTML = `
                <div class="preview-media-placeholder" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                    <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">play_circle</span>
                    <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">순간 선택하기</div>
                    <p style="margin:0;font-size:13px;line-height:1.6;">왼쪽 목록에서 순간을 선택하면 영상이 재생됩니다.</p>
                </div>
            `;
        }
    }

    function renderPreviewMemory(memory) {
        // Media (video embed or thumbnail)
        const mediaContainer = resolveElement(SEL.previewMedia);
        if (mediaContainer) {
            const sourceUrl = memory.sourceUrl || memory.originalUrl || '';
            const thumb = memory.representativeThumbnail || memory.thumbnail || '';

            const safeSourceUrl = sanitizeUrl(sourceUrl);
            const safeThumb = sanitizeUrl(thumb);

            // Check for YouTube embed URL
            const ytVideoId = extractYouTubeVideoId(safeSourceUrl);
            if (ytVideoId) {
                const embedUrl = `https://www.youtube.com/embed/${ytVideoId}?rel=0&modestbranding=1`;
                // Sanitize embed URL before iframe src insertion (defense-in-depth)
                var safeEmbedUrl = sanitizeUrl(embedUrl);
                if (safeEmbedUrl) {
                    var safeTitle = escapeHtml(memory.title || 'moment video');
                    mediaContainer.innerHTML = '<iframe src="' + escapeHtml(safeEmbedUrl) + '" class="viewer-preview-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" title="' + safeTitle + '"></iframe>';
                } else if (safeThumb) {
                    mediaContainer.innerHTML = '<img src="' + escapeHtml(safeThumb) + '" alt="' + escapeHtml(memory.title || '') + '" class="viewer-preview-image" loading="lazy" />';
                    bindViewerPreviewImageHandlers(mediaContainer);
                } else {
                    mediaContainer.innerHTML = '<div class="viewer-preview-no-media"><span class="material-symbols-outlined">image</span></div>';
                }
            } else if (safeThumb) {
                mediaContainer.innerHTML = `<img src="${escapeHtml(safeThumb)}" alt="${escapeHtml(memory.title || '')}" class="viewer-preview-image" loading="lazy" />`;
                bindViewerPreviewImageHandlers(mediaContainer);
            } else {
                mediaContainer.innerHTML = `<div class="viewer-preview-no-media"><span class="material-symbols-outlined">image</span></div>`;
            }
        }

        // Title & tags
        setContent(SEL.momentTitle, memory.title || memory.emotionMemo || '');
        const tagsContainer = resolveElement(SEL.momentTags);
        if (tagsContainer) {
            tagsContainer.innerHTML = (memory.emotionTags || [])
                .map(tag => `<span class="viewer-preview-tag">${escapeHtml(tag)}</span>`)
                .join('');
        }

        // Meta: date/location
        const metaContainer = resolveElement(SEL.momentMeta);
        if (metaContainer) {
            const dateStr = formatMemoryDate(memory);
            const location = memory.location || '';
            metaContainer.innerHTML = `
                <span class="viewer-meta-item">${escapeHtml(dateStr)}</span>
                ${location ? `<span class="viewer-meta-divider">•</span><span class="viewer-meta-item">${escapeHtml(location)}</span>` : ''}
            `;
        }

        // Diary
        const quoteEl = resolveElement(SEL.diaryQuote);
        const contentEl = resolveElement(SEL.diaryContent);
        if (quoteEl) quoteEl.textContent = memory.emotionMemo || '';
        if (contentEl) {
            // raw diary content is not exposed; show placeholder if empty
            contentEl.innerHTML = memory.diaryContent
                ? escapeHtml(memory.diaryContent).replace(/\n/g, '<br>')
                : '';
        }
    }

    function bindViewerPreviewImageHandlers(container) {
        if (!container) return;
        const img = container.querySelector('.viewer-preview-image');
        if (!img) return;

        function tryYoutubeFallback(el) {
            var isYtHq = el.src && el.src.indexOf('hqdefault.jpg') !== -1;
            if (isYtHq && !el.dataset.ytFallback) {
                el.dataset.ytFallback = '1';
                el.src = el.src.replace('hqdefault.jpg', 'mqdefault.jpg');
                return true;
            }
            return false;
        }

        if (img.complete) {
            if (img.naturalWidth === 0) {
                tryYoutubeFallback(img);
            }
            return;
        }

        img.addEventListener('error', function onViewerImageError() {
            tryYoutubeFallback(this);
        });
    }

    // Error retry
    function setupRetry() {
        const btn = resolveElement(SEL.retryBtn);
        if (btn && typeof btn.addEventListener === 'function') {
            btn.addEventListener('click', () => {
                if (currentTreeId) {
                    initViewer();
                }
            });
        }
    }

    // Navigation back
    function setupBackLink() {
        const back = resolveElement(SEL.backLink);
        if (back && typeof back.addEventListener === 'function') {
            back.addEventListener('click', (e) => {
                // default behavior is fine (link to search)
            });
        }
    }

    // Init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupRetry();
            setupBackLink();
            initViewer();
        });
    } else {
        setupRetry();
        setupBackLink();
        initViewer();
    }
})();
