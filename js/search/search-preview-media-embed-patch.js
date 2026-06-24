/**
 * Issue #1053: normalize Browse hub YouTube iframe sources without changing API shape.
 * Issue #BROWSE-CTP: 둘러보기 사이드바 renderPreviewIframe()을
 *   내 러브트리와 동일한 클릭-투-플레이 오버레이 패턴으로 교체.
 */
(function() {
    'use strict';

    function getYouTubeVideoId(value) {
        if (!value) return '';
        try {
            var parsed = new URL(String(value), window.location.origin);
            var host = parsed.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtu.be') {
                return parsed.pathname.split('/').filter(Boolean)[0] || '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
                if (parsed.pathname.indexOf('/embed/') === 0) return parsed.pathname.split('/').filter(Boolean)[1] || '';
                if (parsed.pathname.indexOf('/shorts/') === 0) return parsed.pathname.split('/').filter(Boolean)[1] || '';
                return parsed.searchParams.get('v') || '';
            }
            if (host.indexOf('ytimg.com') !== -1 || host.indexOf('img.youtube.com') !== -1) {
                var parts = parsed.pathname.split('/').filter(Boolean);
                var viIndex = parts.indexOf('vi');
                return viIndex >= 0 ? (parts[viIndex + 1] || '') : '';
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        if (!/^https?:\/\//i.test(raw)) return '';
        try { var parsed = new URL(raw); var p = parsed.protocol.toLowerCase(); if (p === 'http:' || p === 'https:') return parsed.href; return ''; } catch(e) { return ''; }
    }

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec && sec.escapeHtml) return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toEmbedUrl(value) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var videoId = getYouTubeVideoId(raw);
        if (videoId) {
            var embedUrl = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));
            embedUrl.searchParams.set('autoplay', '0');
            embedUrl.searchParams.set('mute', '0');
            embedUrl.searchParams.set('controls', '0');
            embedUrl.searchParams.set('rel', '0');
            embedUrl.searchParams.set('modestbranding', '1');
            return embedUrl.href;
        }
        // Non-YouTube URLs rejected — only YouTube embeds are supported
        return '';
    }

    function toAutoplayIframeSource(value) {
        var safeUrl = sanitizeUrl(value);
        if (!safeUrl) return '';
        try {
            var url = new URL(safeUrl);
            url.searchParams.set('autoplay', '1');
            url.searchParams.set('mute', '0');
            return url.href;
        } catch (e) {
            return '';
        }
    }

    /**
     * 클릭-투-플레이 오버레이 이벤트 바인딩.
     * container 내 [data-preview-ctp-overlay]를 찾아 클릭 시
     * 오버레이를 제거하고 autoplay iframe으로 교체한다.
     */
    function bindPreviewOverlayEvents(container) {
        if (!container) return;
        var overlays = container.querySelectorAll('[data-preview-ctp-overlay]');
        overlays.forEach(function(overlay) {
            if (overlay.dataset.ctpBound === 'true') return;
            overlay.dataset.ctpBound = 'true';
            overlay.addEventListener('click', function onCtpClick() {
                var wrapper = overlay.closest('[data-preview-ctp-src]');
                if (!wrapper) return;
                var iframeSrc = toAutoplayIframeSource(wrapper.getAttribute('data-preview-ctp-src'));
                var title = wrapper.getAttribute('data-preview-ctp-title') || 'LoveTree media';
                if (!iframeSrc) return;
                while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
                var iframe = document.createElement('iframe');
                iframe.setAttribute('width', '100%');
                iframe.setAttribute('height', '100%');
                iframe.setAttribute('src', iframeSrc);
                iframe.setAttribute('title', title);
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                iframe.setAttribute('allowfullscreen', '');
                iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
                wrapper.appendChild(iframe);
            });
        });
    }

    function patchMediaHelper() {
        var helper = window.LoveBudSearchPreviewMediaHelper;
        if (!helper || helper.__loveBudEmbedPatchApplied) return;

        helper.generateIframeSource = toEmbedUrl;

        /**
         * 내 러브트리(.memory-preview-overlay + .play-btn) 패턴과 동일하게:
         * 썸네일 위에 반투명 오버레이 + 플레이 버튼 → 클릭 시 iframe 교체.
         * bindPreviewOverlayEvents() 호출로 이벤트 연결.
         */
        helper.renderPreviewIframe = function(sourceUrl, treeTitle, mediaTitle) {
            var iframeSrc = toEmbedUrl(sourceUrl);
            if (!iframeSrc) return '';

            var videoId = getYouTubeVideoId(sanitizeUrl(String(sourceUrl || '')));
            var thumbnailUrl = videoId
                ? 'https://img.youtube.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg'
                : '';
            var safeTitle = escapeHtml(treeTitle || mediaTitle || 'LoveTree media');
            var safeMediaTitle = escapeHtml(mediaTitle || treeTitle || '');
            var safeIframeSrc = escapeHtml(iframeSrc);

            if (thumbnailUrl) {
                return '<div class="preview-media-frame preview-media-frame-iframe preview-ctp-wrapper" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;" data-preview-ctp-src="' + safeIframeSrc + '" data-preview-ctp-title="' + safeTitle + '">' +
                    '<img src="' + escapeHtml(thumbnailUrl) + '" alt="' + safeTitle + '" loading="lazy" data-preview-thumbnail-image="" onerror="if(!this.dataset.ytFallback&&this.src.indexOf(\'hqdefault.jpg\')!==-1){this.dataset.ytFallback=\'1\';this.src=this.src.replace(\'hqdefault.jpg\',\'mqdefault.jpg\');}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">' +
                    '<div class="memory-preview-overlay preview-play-overlay" data-preview-ctp-overlay style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.10);border-radius:inherit;cursor:pointer;transition:background 0.18s;z-index:3;">' +
                        '<div class="play-btn" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.18);pointer-events:none;">' +
                            '<span class="material-symbols-outlined" style="font-size:26px;color:#222;margin-left:3px;">play_arrow</span>' +
                        '</div>' +
                    '</div>' +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.62),transparent);padding:28px 16px 14px;color:white;pointer-events:none;z-index:2;">' +
                        '<div style="font-size:12px;font-weight:700;opacity:0.85;">' + safeMediaTitle + '</div>' +
                    '</div>' +
                '</div>';
            }

            // 썸네일 없는 경우 바로 iframe (폴백)
            return '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;">' +
                '<iframe width="100%" height="100%" src="' + safeIframeSrc + '" title="' + safeTitle + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
            '</div>';
        };

        helper.bindPreviewOverlayEvents = bindPreviewOverlayEvents;
        helper.toAutoplayIframeSource = toAutoplayIframeSource;
        helper.__loveBudEmbedPatchApplied = true;
    }

    patchMediaHelper();
    document.addEventListener('DOMContentLoaded', patchMediaHelper);
})();
