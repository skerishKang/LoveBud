/**
 * LoveBud Search Preview Media Helper
 * v20260624-click-to-play
 * 
 * Media helper boundary extracted from search-preview-renderer.js
 * Issue #424 PR B - Media helper extraction
 * Issue #BROWSE-CTP: 둘러보기 사이드바에 내 러브트리와 동일한 클릭-투-플레이 오버레이 패턴 적용
 * 
 * Dependencies: LoveBudSearchSharedUtils (for shared utilities)
 */

(function() {
    'use strict';

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils && utils.escapeHtml) {
            return utils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils && utils.sanitizeUrl) {
            return utils.sanitizeUrl(value);
        }
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';
        if (!/^https?:\/\//i.test(raw)) return '';
        try {
            const parsed = new URL(raw);
            const protocol = parsed.protocol;
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function getCurrentLocale() {
        const locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        const locale = getCurrentLocale();
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    function getMomentLabel(memory, fallbackKo = '시작 순간', fallbackEn = 'Starting moment') {
        const helper = window.LoveBudSearchTitleHelper || null;
        const cleaned = helper?.cleanMomentTitle
            ? helper.cleanMomentTitle(memory?.title || '')
            : String(memory?.title || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || getSearchCopy('search.previewMomentFallback', fallbackKo, fallbackEn);
    }

    function getPreviewMediaMemory(memories) {
        return (Array.isArray(memories) ? memories : []).find(memory => {
            return sanitizeUrl(memory?.sourceUrl || '') || sanitizeUrl(memory?.thumbnail || '');
        }) || null;
    }

    // Returns the helper-approved memory at the given array index within
    // the candidate list. "Helper-approved" is the same predicate as
    // getPreviewMediaMemory: the memory has a sanitized sourceUrl or
    // sanitized thumbnail. This is the explicit-moment counterpart of
    // getPreviewMediaMemory (which always returns the first approved
    // memory). Issue #2825 — flow stage click selects a specific moment
    // and re-renders the media preview for that moment without losing
    // the helper-approved-candidate principle.
    function getPreviewMediaMemoryAt(memories, momentIndex) {
        if (!Array.isArray(memories) || memories.length === 0) return null;
        if (typeof momentIndex !== 'number' || momentIndex < 0 || momentIndex >= memories.length) return null;
        var candidate = memories[momentIndex];
        if (!candidate) return null;
        var hasSource = !!sanitizeUrl(candidate && candidate.sourceUrl || '');
        var hasThumbnail = !!sanitizeUrl(candidate && candidate.thumbnail || '');
        if (!hasSource && !hasThumbnail) return null;
        return candidate;
    }

    function renderPreviewThumbnailFallback(title, subtitle) {
        return `
            <div class="preview-media-fallback" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">movie</span>
                <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${escapeHtml(title)}</div>
                <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(subtitle)}</p>
            </div>
        `;
    }

    function renderPreviewThumbnailMedia(thumbnailUrl, mediaTitle, treeTitle) {
        const fallbackHtml = renderPreviewThumbnailFallback(
            treeTitle,
            getSearchCopy('search.previewNoMomentBody', '시작 순간이 더해지면 이 감상 허브에서 가장 먼저 열어볼 수 있어요.', 'Once the starting moment is added, you will be able to open it here first.')
        );

        return `
            <div class="preview-media-frame preview-media-frame-thumbnail" style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <img src="${thumbnailUrl}" alt="${mediaTitle}" loading="lazy" data-preview-thumbnail-image="" onerror="if(!this.dataset.ytFallback&&this.src.indexOf('hqdefault.jpg')!==-1){this.dataset.ytFallback='1';this.src=this.src.replace('hqdefault.jpg','mqdefault.jpg');}" style="width:100%;height:100%;object-fit:cover;display:block;">
                <div data-preview-thumbnail-fallback hidden style="position:absolute;inset:0;">${fallbackHtml}</div>
                <div data-preview-overlay style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.72),rgba(0,0,0,0.04) 58%);"></div>
                <div data-preview-overlay style="position:absolute;left:18px;right:18px;bottom:18px;color:white;">
                    <div style="display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,0.18);backdrop-filter:blur(10px);font-size:12px;font-weight:800;margin-bottom:10px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">play_circle</span>
                        ${escapeHtml(getSearchCopy('search.previewStartFromFirstMoment', '대표 순간부터 감상하기', 'Start from the featured moment'))}
                    </div>
                    <div style="font-size:14px;font-weight:800;line-height:1.4;">${mediaTitle}</div>
                </div>
            </div>
        `;
    }

    function showPreviewImageFallback(img) {
        if (!img) return;
        if (img.dataset.fallbackTriggered) return;
        img.dataset.fallbackTriggered = 'true';
        img.style.display = 'none';
        const wrapper = img.parentElement;
        if (!wrapper) return;
        const fallback = wrapper.querySelector('[data-preview-thumbnail-fallback]');
        if (fallback) {
            fallback.hidden = false;
        }
        const overlays = wrapper.querySelectorAll('[data-preview-overlay]');
        overlays.forEach(overlay => overlay.style.display = 'none');
    }

    function handlePreviewImageLoad(img) {
        if (!img) return;
        if (isSuspiciousYouTubeThumbnailImage(img)) {
            showPreviewImageFallback(img);
        }
    }

    function bindPreviewThumbnailHandlers(root) {
        if (!root) return;
        root.querySelectorAll('[data-preview-thumbnail-image]').forEach(img => {
            if (img.dataset.previewImageHandlerBound === 'true') return;
            img.dataset.previewImageHandlerBound = 'true';

            if (img.complete) {
                if (img.naturalWidth === 0) {
                    showPreviewImageFallback(img);
                } else {
                    handlePreviewImageLoad(img);
                }
                return;
            }

            img.addEventListener('error', function onPreviewImageError() {
                showPreviewImageFallback(this);
            });
            img.addEventListener('load', function onPreviewImageLoad() {
                handlePreviewImageLoad(this);
            });
        });
    }

    function isSuspiciousYouTubeThumbnailImage(img) {
        const utils = getSharedUtils();
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

    function getYouTubeVideoId(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtu.be') {
                return parsed.pathname.split('/').filter(Boolean)[0] || '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
                if (parsed.pathname.startsWith('/embed/')) {
                    return parsed.pathname.split('/').filter(Boolean)[1] || '';
                }
                if (parsed.pathname.startsWith('/shorts/')) {
                    return parsed.pathname.split('/').filter(Boolean)[1] || '';
                }
                return parsed.searchParams.get('v') || '';
            }
        } catch (e) {
            return '';
        }
        return '';
    }

    function toPlayableEmbedUrl(sourceUrl) {
        const safeSourceUrl = sanitizeUrl(sourceUrl || '');
        if (!safeSourceUrl) return '';

        const youtubeId = getYouTubeVideoId(safeSourceUrl);
        if (youtubeId) {
            const embedUrl = new URL(`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}`);
            embedUrl.searchParams.set('autoplay', '1');
            embedUrl.searchParams.set('mute', '0');
            embedUrl.searchParams.set('controls', '1');
            embedUrl.searchParams.set('rel', '0');
            embedUrl.searchParams.set('modestbranding', '1');
            return embedUrl.href;
        }

        return safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=1&mute=0&controls=1';
    }

    function generateIframeSource(sourceUrl) {
        return toPlayableEmbedUrl(sourceUrl);
    }

    /**
     * 내 러브트리와 동일한 클릭-투-플레이 오버레이 패턴.
     * - 썸네일 위에 반투명 오버레이 + 플레이 버튼을 먼저 보여줌
     * - 클릭 시 오버레이를 제거하고 autoplay iframe으로 교체
     * - bindPreviewOverlayEvents()로 이벤트 연결
     */
    function renderPreviewIframe(sourceUrl, treeTitle, mediaTitle) {
        const iframeSrc = generateIframeSource(sourceUrl);
        if (!iframeSrc) return '';

        const youtubeId = getYouTubeVideoId(sanitizeUrl(sourceUrl || ''));
        const thumbnailUrl = youtubeId
            ? `https://img.youtube.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`
            : '';
        const safeTitle = escapeHtml(treeTitle || mediaTitle || 'LoveTree media');
        const safeMediaTitle = escapeHtml(mediaTitle || treeTitle || '');
        const safeIframeSrc = escapeHtml(iframeSrc);

        if (thumbnailUrl) {
            // 클릭-투-플레이: 썸네일 + 오버레이 → 클릭 시 iframe 교체
            return `<div class="preview-media-frame preview-media-frame-iframe preview-ctp-wrapper" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;" data-preview-ctp-src="${safeIframeSrc}" data-preview-ctp-title="${safeTitle}">
                <img src="${escapeHtml(thumbnailUrl)}" alt="${safeTitle}" loading="lazy" data-preview-thumbnail-image="" onerror="if(!this.dataset.ytFallback&&this.src.indexOf('hqdefault.jpg')!==-1){this.dataset.ytFallback='1';this.src=this.src.replace('hqdefault.jpg','mqdefault.jpg');}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">
                <div class="memory-preview-overlay preview-play-overlay" data-preview-ctp-overlay style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.10);border-radius:inherit;cursor:pointer;transition:background 0.18s;z-index:3;">
                    <div class="play-btn" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.18);pointer-events:none;">
                        <span class="material-symbols-outlined" style="font-size:26px;color:#222;margin-left:3px;">play_arrow</span>
                    </div>
                </div>
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.62),transparent);padding:28px 16px 14px;color:white;pointer-events:none;z-index:2;">
                    <div style="font-size:12px;font-weight:700;opacity:0.85;">${safeMediaTitle}</div>
                </div>
            </div>`;
        }

        // 썸네일 없는 경우 바로 iframe (기존 방식 폴백)
        return `<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;">
            <iframe width="100%" height="100%"
                src="${safeIframeSrc}"
                title="${safeTitle}" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
        </div>`;
    }

    /**
     * 클릭-투-플레이 오버레이 이벤트 바인딩.
     * container 내부의 [data-preview-ctp-overlay]를 찾아 클릭 시
     * 오버레이를 제거하고 autoplay iframe으로 교체한다.
     */
    function bindPreviewOverlayEvents(container) {
        if (!container) return;
        const overlays = container.querySelectorAll('[data-preview-ctp-overlay]');
        overlays.forEach(function(overlay) {
            if (overlay.dataset.ctpBound === 'true') return;
            overlay.dataset.ctpBound = 'true';
            overlay.addEventListener('click', function onCtpClick() {
                const wrapper = overlay.closest('[data-preview-ctp-src]');
                if (!wrapper) return;
                const iframeSrc = wrapper.getAttribute('data-preview-ctp-src');
                const title = wrapper.getAttribute('data-preview-ctp-title') || 'LoveTree media';
                if (!iframeSrc) return;
                wrapper.innerHTML = `<iframe width="100%" height="100%"
                    src="${escapeHtml(iframeSrc)}"
                    title="${escapeHtml(title)}" frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"></iframe>`;
            });
        });
    }

    window.LoveBudSearchPreviewMediaHelper = {
        getPreviewMediaMemory: getPreviewMediaMemory,
        getPreviewMediaMemoryAt: getPreviewMediaMemoryAt,
        renderPreviewThumbnailFallback: renderPreviewThumbnailFallback,
        renderPreviewThumbnailMedia: renderPreviewThumbnailMedia,
        showPreviewImageFallback: showPreviewImageFallback,
        handlePreviewImageLoad: handlePreviewImageLoad,
        bindPreviewThumbnailHandlers: bindPreviewThumbnailHandlers,
        isSuspiciousYouTubeThumbnailImage: isSuspiciousYouTubeThumbnailImage,
        generateIframeSource: generateIframeSource,
        toPlayableEmbedUrl: toPlayableEmbedUrl,
        renderPreviewIframe: renderPreviewIframe,
        bindPreviewOverlayEvents: bindPreviewOverlayEvents
    };

})();
