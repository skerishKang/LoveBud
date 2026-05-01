/**
 * LoveBud Search Preview Media Helper
 * v20260428-1
 * 
 * Media helper boundary extracted from search-preview-renderer.js
 * Issue #424 PR B - Media helper extraction
 * 
 * Dependencies: LoveBudSearchSharedUtils (for shared utilities)
 */

(function() {
    'use strict';

    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    function escapeHtml(value) {
        const utils = getSharedUtils();
        if (utils?.escapeHtml) {
            return utils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        const utils = getSharedUtils();
        if (utils?.sanitizeUrl) {
            return utils.sanitizeUrl(value);
        }
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';
        try {
            const parsed = new URL(raw, window.location.origin);
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

    function getMomentLabel(memory, fallbackKo = '시작 순간', fallbackEn = 'Starting moment') {
        const helper = window.LoveBudSearchTitleHelper || null;
        const cleaned = helper?.cleanMomentTitle
            ? helper.cleanMomentTitle(memory?.title || '')
            : String(memory?.title || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || getSearchCopy('search.previewMomentFallback', fallbackKo, fallbackEn);
    }

    /**
     * Find the first memory with media (sourceUrl or thumbnail)
     */
    function getPreviewMediaMemory(memories) {
        return (Array.isArray(memories) ? memories : []).find(memory => {
            return sanitizeUrl(memory?.sourceUrl || '') || sanitizeUrl(memory?.thumbnail || '');
        }) || null;
    }

    /**
     * Render fallback thumbnail HTML
     */
    function renderPreviewThumbnailFallback(title, subtitle) {
        return `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">movie</span>
                <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${escapeHtml(title)}</div>
                <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(subtitle)}</p>
            </div>
        `;
    }

    /**
     * Render thumbnail with media
     */
    function renderPreviewThumbnailMedia(thumbnailUrl, mediaTitle, treeTitle) {
        const fallbackHtml = renderPreviewThumbnailFallback(
            treeTitle,
            getSearchCopy('search.previewNoMomentBody', '시작 순간이 더해지면 이 감상 허브에서 가장 먼저 열어볼 수 있어요.', 'Once the starting moment is added, you will be able to open it here first.')
        );

        return `
            <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <img src="${thumbnailUrl}" alt="${mediaTitle}" loading="lazy" onerror="window.LoveBudSearchPreviewRenderer?.showPreviewImageFallback?.(this)" onload="window.LoveBudSearchPreviewRenderer?.handlePreviewImageLoad?.(this)" style="width:100%;height:100%;object-fit:cover;display:block;">
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

    /**
     * Handle image fallback display
     */
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

    /**
     * Check for suspicious YouTube thumbnails
     */
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

    /**
     * Generate iframe source URL with autoplay and mute parameters
     */
    function generateIframeSource(sourceUrl) {
        const safeSourceUrl = sanitizeUrl(sourceUrl || '');
        if (!safeSourceUrl) return '';
        return safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=0&mute=1';
    }

    /**
     * Render iframe media
     */
    function renderPreviewIframe(sourceUrl, treeTitle, mediaTitle) {
        const iframeSrc = generateIframeSource(sourceUrl);
        if (!iframeSrc) return '';

        return `
            <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <iframe width="100%" height="100%"
                    src="${iframeSrc}"
                    title="${escapeHtml(treeTitle)}" frameborder="0"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                    <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">${escapeHtml(getSearchCopy('search.previewStartFromFirstMoment', '대표 순간부터 감상하기', 'Start from the featured moment'))}</div>
                    <div style="font-size:12px;opacity:0.7;">${escapeHtml(mediaTitle)}</div>
                </div>
            </div>
        `;
    }

    // Expose the media helper
    window.LoveBudSearchPreviewMediaHelper = {
        getPreviewMediaMemory: getPreviewMediaMemory,
        renderPreviewThumbnailFallback: renderPreviewThumbnailFallback,
        renderPreviewThumbnailMedia: renderPreviewThumbnailMedia,
        showPreviewImageFallback: showPreviewImageFallback,
        isSuspiciousYouTubeThumbnailImage: isSuspiciousYouTubeThumbnailImage,
        generateIframeSource: generateIframeSource,
        renderPreviewIframe: renderPreviewIframe
    };

    console.log('[LoveBudSearchPreviewMediaHelper] Search preview media helper loaded v20260428-1');
})();
