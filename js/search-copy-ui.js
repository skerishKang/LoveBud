/**
 * LoveBud Search Copy UI
 *
 * Adds a lightweight "copy public tree to my LoveTrees" action to the Search Preview panel.
 * Loaded from i18n-search.js only on pages/search.html to avoid touching the large
 * Search renderer/orchestrator files while local git verification is unavailable.
 */
(function () {
    'use strict';

    const COPY_BUTTON_SELECTOR = '[data-copy-public-tree]';
    const SHARE_BUTTON_SELECTOR = '[data-share-tree-link]';
    const SCRIPT_MARK = 'lovebudSearchCopyUiLoaded';

    if (window[SCRIPT_MARK]) return;
    window[SCRIPT_MARK] = true;

    function getLocale() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function getCopy(key, fallbackKo, fallbackEn) {
        const locale = getLocale();
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(new RegExp(String.fromCharCode(34), 'g'), '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getBasePath() {
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    function buildLoginHref(treeId) {
        const basePath = getBasePath();
        const redirect = `search.html?tree=${encodeURIComponent(treeId)}`;
        return `${basePath}login.html?redirect=${encodeURIComponent(redirect)}`;
    }

    function hasAuthSession() {
        try {
            if (window.firebase?.auth?.().currentUser) return true;
        } catch (e) {}

        try {
            if (window.LoveTreeBaseApiFetch?.getCachedTokenRecord?.()) return true;
        } catch (e) {}

        try {
            return localStorage.getItem('lovebud_auth_confirmed') === 'true';
        } catch (e) {
            return false;
        }
    }

    function getPreviewTitleFallback() {
        const titleRoot = document.getElementById('previewTitle');
        if (!titleRoot) {
            return getCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
        }
        const firstLine = titleRoot.querySelector('div div') || titleRoot.querySelector('div') || titleRoot;
        const text = String(firstLine.textContent || '').trim();
        return text || getCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
    }

    function getSelectedTreeIdFromPreview() {
        const shareButton = document.querySelector(SHARE_BUTTON_SELECTOR);
        return shareButton?.dataset?.shareTreeLink || '';
    }

    function sanitizeMemoryPayload(memory, treeId, parentId) {
        const tags = Array.isArray(memory?.emotionTags) ? memory.emotionTags : [];
        return {
            treeId,
            parentId: parentId || null,
            title: String(memory?.title || '').slice(0, 200),
            memo: String(memory?.memo || '').slice(0, 5000),
            artist: String(memory?.artist || '').slice(0, 100),
            source: String(memory?.source || '').slice(0, 200),
            sourceUrl: String(memory?.sourceUrl || '').slice(0, 1000),
            sourceType: String(memory?.sourceType || 'youtube').slice(0, 50),
            thumbnail: String(memory?.thumbnail || '').slice(0, 500),
            emotionTags: tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 20),
            timestamp: String(memory?.timestamp || '').slice(0, 100),
            visibility: 'public'
        };
    }

    async function loadPublicTreeForCopy(treeId) {
        if (!window.apiClient?.getPublicTreePreview) {
            throw new Error('Public tree preview API unavailable');
        }
        return window.apiClient.getPublicTreePreview({
            id: treeId,
            title: getPreviewTitleFallback(),
            memoryCount: 0,
            memories: []
        });
    }

    async function copyPublicTree(treeId) {
        if (!window.apiClient?.createTree || !window.apiClient?.createMemory) {
            throw new Error('Private tree API unavailable');
        }

        const publicTree = await loadPublicTreeForCopy(treeId);
        const title = String(publicTree?.title || getPreviewTitleFallback()).trim() || getCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
        const newTree = await window.apiClient.createTree({
            title,
            visibility: 'public'
        });
        const newTreeId = newTree?.id;
        if (!newTreeId) {
            throw new Error('Copied tree id missing');
        }

        const memories = Array.isArray(publicTree?.memories) ? publicTree.memories : [];
        let previousNewMemoryId = null;
        let copiedMemoryCount = 0;
        for (const memory of memories) {
            const createdMemory = await window.apiClient.createMemory(
                sanitizeMemoryPayload(memory, newTreeId, previousNewMemoryId)
            );
            previousNewMemoryId = createdMemory?.id || previousNewMemoryId;
            copiedMemoryCount += 1;
        }

        return { tree: newTree, copiedMemoryCount };
    }

    function renderCopyButton(treeId) {
        const label = getCopy('search.previewCopyToMyTrees', '내 러브트리로 가져오기', 'Copy to my LoveTrees');
        const safeTreeId = escapeHtml(treeId);
        const safeLabel = escapeHtml(label);
        return `
            <button type="button" data-copy-public-tree="${safeTreeId}" class="btn-round" style="width:100%;margin-top:10px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;gap:6px;background:var(--primary-container);color:var(--on-primary-container);border:1px solid var(--outline-variant);">
                <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                <span data-copy-public-tree-label>${safeLabel}</span>
            </button>
        `;
    }

    function syncCopyButton() {
        const shareButton = document.querySelector(SHARE_BUTTON_SELECTOR);
        if (!shareButton || !shareButton.parentElement) return;
        const treeId = shareButton.dataset.shareTreeLink;
        if (!treeId) return;

        const existing = shareButton.parentElement.querySelector(COPY_BUTTON_SELECTOR);
        if (existing) {
            if (existing.dataset.copyPublicTree !== treeId) {
                existing.dataset.copyPublicTree = treeId;
            }
            return;
        }

        shareButton.insertAdjacentHTML('afterend', renderCopyButton(treeId));
    }

    function setButtonState(button, key, fallbackKo, fallbackEn, disabled) {
        const label = button.querySelector('[data-copy-public-tree-label]');
        if (label) {
            label.textContent = getCopy(key, fallbackKo, fallbackEn);
        }
        button.disabled = Boolean(disabled);
    }

    async function handleCopyClick(event) {
        const button = event.target.closest(COPY_BUTTON_SELECTOR);
        if (!button) return;
        event.preventDefault();

        const treeId = button.dataset.copyPublicTree || getSelectedTreeIdFromPreview();
        if (!treeId) return;

        if (!hasAuthSession()) {
            window.location.href = buildLoginHref(treeId);
            return;
        }

        setButtonState(button, 'search.previewCopyingToMyTrees', '가져오는 중이에요', 'Copying...', true);
        try {
            await copyPublicTree(treeId);
            setButtonState(button, 'search.previewCopyToMyTreesDone', '내 러브트리로 복사됐어요', 'Copied to my LoveTrees', true);
        } catch (error) {
            console.warn('[search-copy-ui] public tree copy failed:', error.message);
            setButtonState(button, 'search.previewCopyToMyTreesFailed', '가져오지 못했어요', 'Copy failed', false);
        }
    }

    function start() {
        syncCopyButton();
        document.addEventListener('click', handleCopyClick);
        const observer = new MutationObserver(() => syncCopyButton());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
