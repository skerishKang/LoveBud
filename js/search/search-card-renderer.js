/**
 * LoveBud Search Card Renderer
 * v20260720-3578-3
 * 
 * Rendering layer: tree cards, empty states.
 * Returns HTML strings (DOM-agnostic at public API boundary).
 * 
 * Dependencies: LoveBudPath, LoveBudSearchSharedUtils, LoveBudTreeCardComposition
 * 
 * Load order (must be satisfied at runtime):
 *   js/utils/security.js
 *   js/shared/tree-card-metrics.js
 *   js/shared/tree-card-composition.js
 *   js/search/search-card-renderer.js
 * 
 * Fail-closed: LoveBudTreeCardComposition must be loaded or renderTreeCard throws.
 * No legacy fallback card HTML — missing dependency is always explicit.
 */

(function() {
    'use strict';

    var _cardFallback = window.LoveBudSearchCardFallback || null;

    // #3578 Phase 2 CTO: fail-closed — require composition, no fallback
    function requireComposition() {
        var c = window.LoveBudTreeCardComposition;
        if (c && typeof c.buildTreeCard === 'function' && typeof c.htmlToFragment === 'function') return c;
        throw new Error(
            '[LoveBudSearchCardRenderer] LoveBudTreeCardComposition not loaded. ' +
            'tree-card-composition.js must be loaded before search-card-renderer.js.'
        );
    }

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.escapeHtml) return utils.escapeHtml(value);
        if (_cardFallback && _cardFallback.escapeHtml) return _cardFallback.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        if (_cardFallback && typeof _cardFallback.sanitizeUrl === 'function') return _cardFallback.sanitizeUrl(value);
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.sanitizeUrl) return utils.sanitizeUrl(value);
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        try {
            var parsed = new URL(raw, window.location.origin);
            var protocol = parsed.protocol;
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function isSuspiciousYouTubeThumbnailImage(img) {
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.isSuspiciousYouTubeThumbnailImage) {
            return utils.isSuspiciousYouTubeThumbnailImage(img);
        }
        if (!img || !img.currentSrc) return false;
        const src = String(img.currentSrc || img.src || '');
        const isYouTubeThumb = src.includes('ytimg.com/vi/') || src.includes('img.youtube.com/vi/');
        if (!isYouTubeThumb) return false;

        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        return width > 0 && height > 0 && width <= 120 && height <= 90;
    }

    function showImageFallback(img) {
        if (!img) return;
        if (img.dataset.fallbackTriggered) return;
        img.dataset.fallbackTriggered = 'true';
        img.style.display = 'none';
        const fallback = img.nextElementSibling;
        if (fallback) {
            fallback.hidden = false;
        }
        const mediaPreview = img.parentElement?.querySelector?.('.tree-card-preview-strip-media');
        if (mediaPreview) {
            mediaPreview.hidden = true;
        }
    }

    let _resultsList = null;

    function init(resultsListEl) {
        _resultsList = resultsListEl;
    }

    function getBasePath() {
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.getBasePath) {
            return utils.getBasePath();
        }
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        const path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    function getSearchTitleHelper() {
        return window.LoveBudSearchTitleHelper || null;
    }

    function getDisplayThemeLabel(theme) {
        const raw = String(theme || '').trim();
        if (!raw || raw === 'LoveTree' || raw === 'Mixed') {
            return '';
        }
        return raw;
    }

    function getDisplayMemoryCount(memoryCount) {
        const count = Number(memoryCount || 0);
        return Number.isFinite(count) && count > 0 ? count : 0;
    }

    function getTreeViewerHref(tree) {
        if (!tree?.id) return '';
        return `${getBasePath()}view.html?treeId=${encodeURIComponent(tree.id)}`;
    }

    function getTreePreviewTone(tree) {
        const memoryCount = getDisplayMemoryCount(tree?.memoryCount);
        if (memoryCount >= 6) return 'full';
        if (memoryCount >= 3) return 'growing';
        if (memoryCount >= 1) return 'sprout';
        return 'empty';
    }

    function hashSeed(value) {
        if (_cardFallback && typeof _cardFallback.hashSeed === 'function') return _cardFallback.hashSeed(value);
        var source = String(value || 'lovetree');
        var hash = 0;
        for (var i = 0; i < source.length; i++) {
            hash = ((hash << 5) - hash) + source.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function buildPremiumFallbackSVG(tree, palette) {
        if (_cardFallback && typeof _cardFallback.buildPremiumFallbackSVG === 'function') return _cardFallback.buildPremiumFallbackSVG(tree, palette);
        return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg>';
    }

    function renderMediaFallback(tree, titleText) {
        if (_cardFallback && typeof _cardFallback.renderMediaFallback === 'function') return _cardFallback.renderMediaFallback(tree, titleText);
        return '';
    }

    function renderRepresentativeImage(src, alt, tree, titleText) {
        if (_cardFallback && typeof _cardFallback.renderRepresentativeImage === 'function') return _cardFallback.renderRepresentativeImage(src, alt, tree, titleText);
        return '';
    }

    function renderRepresentativeMedia(tree, firstMem, titleText) {
        if (_cardFallback && typeof _cardFallback.renderRepresentativeMedia === 'function') return _cardFallback.renderRepresentativeMedia(tree, firstMem, titleText);
        return '';
    }

    /**
     * Adapter-owned HTML-to-Node conversion.
     * Used only for content produced by Browse's own sanitised renderers
     * (renderRepresentativeMedia, metadata helper). NOT a generic public API.
     */
    function htmlToNode(html) {
        if (!html) return null;
        var t = document.createElement('div');
        t.innerHTML = String(html);
        return t.firstChild || null;
    }

    function renderTreeCard(tree, index) {
        const memories = Array.isArray(tree.memories) ? tree.memories : [];
        const firstMem = memories[0];
        const titleHelper = getSearchTitleHelper();
        const memoryCount = getDisplayMemoryCount(tree.memoryCount);
        const displayTheme = getDisplayThemeLabel(tree.theme);

        const displayTitleRaw = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree.title || '').trim() || '러브트리');
        const primaryTag = titleHelper?.getPrimaryBrowseTag ? titleHelper.getPrimaryBrowseTag(tree) : '';

        const viewerHref = getTreeViewerHref(tree);
        const cardSelectLabel = `${displayTitleRaw} 러브트리를 감상 허브에서 미리보기`;
        const softMoodLine = displayTheme
            ? `${displayTheme}와 함께 시작된 마음`
            : primaryTag
                 ? `${primaryTag}의 결이 먼저 남겨진 트리`
                 : memoryCount > 0
                     ? '첫 순간에서 이어진 감정을 천천히 따라가 보세요.'
                     : '이제 막 열리기 시작한 공개 러브트리예요.';

        // Renders tree-public-metadata via helper
        const metadataHelper = window.LoveBudSearchPublicMetadataHelper;
        const metadataHtml = (metadataHelper && typeof metadataHelper.renderCardMetadata === 'function')
            ? metadataHelper.renderCardMetadata(tree)
            : '';

        // #3578 Phase 2 CTO: route through shared composition (fail-closed)
        var comp = requireComposition();

        // Convert adapter-owned HTML strings to trusted Nodes
        // These come from Browse's own sanitised renderers
        var mediaNode = htmlToNode(renderRepresentativeMedia(tree, firstMem, displayTitleRaw));
        var metadataNode = htmlToNode(metadataHtml);

        var cardEl = comp.buildTreeCard(tree, {
            surface: 'browse',
            mediaNode: mediaNode,
            title: displayTitleRaw,
            subtitleText: softMoodLine,
            bodyExtensionNode: metadataNode,
            primaryHref: viewerHref,
            primaryLabel: '트리 열기',
            accessibilityLabel: cardSelectLabel,
            isFeatured: index === 0,
            index: index
        });

        // Set surface-specific id on the root element before serialising
        if (cardEl && tree && tree.id) {
            cardEl.id = 'tree-card-' + escapeHtml(tree.id);
        }

        return cardEl ? cardEl.outerHTML : '';
    }

    function renderNoTreesState() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        const isEnglish = String(locale).toLowerCase().startsWith('en');
        const heading = window.i18nSearch?.['search.noTreesHeading']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'No public LoveTrees yet' : '아직 공개된 러브트리가 없어요');
        const body = window.i18nSearch?.['search.noTreesBody']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'Public LoveTrees will appear here once someone shares one.' : '다른 팬이 공개한 러브트리가 생기면 이곳에서 만날 수 있어요.');

        return `
            <div class="search-empty-state">
                <span class="material-symbols-outlined search-empty-icon" aria-hidden="true">public</span>
                <h3 class="search-empty-heading">${escapeHtml(heading)}</h3>
                <p class="search-empty-body">${escapeHtml(body)}</p>
            </div>
        `;
    }

    function renderEmptySearchState() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        const isEnglish = String(locale).toLowerCase().startsWith('en');
        const heading = window.i18nSearch?.['search.emptySearchHeading']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'No matches found' : '조건에 맞는 트리가 없어요');
        const body = window.i18nSearch?.['search.emptySearchBody']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'Try a different keyword or filter.' : '다른 키워드나 필터로 다시 찾아보세요.');

        return `
            <div class="search-empty-state">
                <span class="material-symbols-outlined search-empty-icon" aria-hidden="true">search_off</span>
                <h3 class="search-empty-heading">${escapeHtml(heading)}</h3>
                <p class="search-empty-body">${escapeHtml(body)}</p>
            </div>
        `;
    }

    function renderDemoBadge() {
        return `
            <div style="grid-column:1 / -1;background: var(--surface-container); border: 1px solid var(--outline-variant); color: var(--on-surface-variant); padding: 12px 20px; border-radius: 1rem; margin-bottom: 6px; font-size: 13px; text-align: center; font-style: italic;">
                <span style="font-weight: 700;">🌸 샘플 러브트리</span> — 다른 팬들이 남긴 감정의 경로를 둘러보세요
            </div>
        `;
    }

    function renderSkeletonCard(index) {
        return `
            <div class="tree-card search-skeleton-card" aria-hidden="true" style="animation-delay:${index * 0.04}s;pointer-events:none;">
                <div class="tree-card-media search-skeleton-block" style="min-height:${index === 0 ? 210 : 182}px;"></div>
                <div class="tree-card-body">
                    <div class="search-skeleton-line search-skeleton-title"></div>
                    <div class="search-skeleton-line search-skeleton-copy"></div>
                    <div class="tree-meta-row">
                        <div class="tree-meta-left">
                            <span class="tree-meta-chip search-skeleton-chip"></span>
                        </div>
                        <div class="tree-meta-right">
                            <span class="search-skeleton-line search-skeleton-count"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSkeletonGrid(options = {}) {
        _addAnimations();
        const count = Math.max(1, Math.min(Number(options.count || 6), 8));
        return Array.from({ length: count }, (_, index) => renderSkeletonCard(index)).join('');
    }

    function renderLoading(options = {}) {
        return renderSkeletonGrid(options);
    }

    function renderResults(trees, options = {}) {
        const { isDemo = false } = options;

        _addAnimations();

        if (trees.length === 0) {
            return renderEmptySearchState();
        }

        let html = '';

        if (isDemo) {
            html += renderDemoBadge();
        }

        trees.forEach((tree, index) => {
            html += renderTreeCard(tree, index);
        });

        return html;
    }

    function _addAnimations() {
        if (document.getElementById('search-card-anim-style')) return;
        
        const style = document.createElement('style');
        style.id = 'search-card-anim-style';
        style.textContent = `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes searchSkeletonPulse { 0%, 100% { opacity: 0.58; } 50% { opacity: 1; } }
            .results-fade-in { animation: fadeIn 0.3s ease-out; }
            .search-skeleton-card { cursor: default; box-shadow: 0 16px 32px rgba(75, 64, 57, 0.035); }
            .search-skeleton-card::before { opacity: 0; }
            .search-skeleton-block,
            .search-skeleton-line,
            .search-skeleton-chip {
                display: block;
                border-radius: 999px;
                background: linear-gradient(90deg, rgba(144,73,81,0.07), rgba(255,255,255,0.72), rgba(122,139,110,0.07));
                background-size: 220% 100%;
                animation: searchSkeletonPulse 1.35s ease-in-out infinite;
            }
            .search-skeleton-block { border-radius: 1.35rem; width: 100%; }
            .search-skeleton-title { width: 72%; height: 18px; }
            .search-skeleton-copy { width: 92%; height: 13px; opacity: 0.75; }
            .search-skeleton-chip { width: 96px; height: 28px; }
            .search-skeleton-count { width: 82px; height: 13px; }
            @media (prefers-reduced-motion: reduce) {
                .search-skeleton-block,
                .search-skeleton-line,
                .search-skeleton-chip { animation: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function handleImageLoad(img) {
        if (!img) return;
        if (isSuspiciousYouTubeThumbnailImage(img)) {
            showImageFallback(img);
        }
    }

    function bindCardImageHandlers(root) {
        if (!root) return;
        root.querySelectorAll('[data-search-card-image]').forEach(img => {
            if (img.dataset.searchCardImageHandlerBound === 'true') return;
            img.dataset.searchCardImageHandlerBound = 'true';

            function tryYoutubeFallback(el) {
                var isYtHq = el.dataset.ytHqThumbnail === 'true' || (el.src && el.src.indexOf('hqdefault.jpg') !== -1);
                if (isYtHq && !el.dataset.ytFallback) {
                    el.dataset.ytFallback = '1';
                    el.src = el.src.replace('hqdefault.jpg', 'mqdefault.jpg');
                    return true;
                }
                return false;
            }

            img.addEventListener('error', function onCardImageError() {
                if (!tryYoutubeFallback(this)) {
                    showImageFallback(this);
                }
            });
            img.addEventListener('load', function onCardImageLoad() {
                handleImageLoad(this);
            });

            if (img.complete) {
                if (img.naturalWidth === 0) {
                    if (!tryYoutubeFallback(img)) {
                        showImageFallback(img);
                    }
                } else {
                    handleImageLoad(img);
                }
            }
        });
    }

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderSkeletonGrid: renderSkeletonGrid,
        renderNoTreesState: renderNoTreesState,
        renderEmptySearchState: renderEmptySearchState,
        renderDemoBadge: renderDemoBadge,
        getBasePath: getBasePath,
        getTreeViewerHref: getTreeViewerHref,
        showImageFallback: showImageFallback,
        handleImageLoad: handleImageLoad,
        bindCardImageHandlers: bindCardImageHandlers
    };


 })();
