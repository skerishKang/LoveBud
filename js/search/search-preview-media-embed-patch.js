/* Issue #1053: normalize Browse hub YouTube iframe sources without changing API shape.
   클릭-투-플레이 패턴 — 내 러브트리(bindDetailMediaPlayback)와 동일하게 통일. */
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
        if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function toEmbedUrl(value, autoplay) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var videoId = getYouTubeVideoId(raw);
        if (videoId) {
            var embedUrl = new URL('https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId));
            embedUrl.searchParams.set('autoplay', autoplay ? '1' : '0');
            embedUrl.searchParams.set('rel', '0');
            if (!autoplay) {
                embedUrl.searchParams.set('mute', '0');
                embedUrl.searchParams.set('controls', '0');
                embedUrl.searchParams.set('modestbranding', '1');
            }
            return embedUrl.href;
        }
        // Non-YouTube URLs rejected — only YouTube embeds are supported
        return '';
    }

    /* 내 러브트리와 동일: 썸네일 오버레이 HTML 반환. 실제 DOM 바인딩은 renderPreviewOverlay() 사용 */
    function buildOverlayHtml(thumbUrl, embedAutoplay, title) {
        return '<img src="' + escapeHtml(thumbUrl) + '" alt="' + escapeHtml(title || '') + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;" loading="lazy">' +
            '<div class="memory-preview-overlay preview-play-overlay" role="button" tabindex="0" aria-label="재생" data-embed-autoplay="' + escapeHtml(embedAutoplay) + '" data-embed-title="' + escapeHtml(title || 'LoveTree media') + '" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.10);border-radius:inherit;cursor:pointer;">' +
                '<button type="button" class="play-btn" aria-label="재생" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:transform 0.15s;">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" fill="#904951"/></svg>' +
                '</button>' +
            '</div>';
    }

    /* container DOM에 오버레이를 직접 렌더하고 클릭 이벤트 바인딩 — 내 러브트리 bindDetailMediaPlayback과 동일 역할 */
    function renderPreviewOverlay(container, sourceUrl, title) {
        if (!container) return;
        var videoId = getYouTubeVideoId(sanitizeUrl(sourceUrl));
        if (!videoId) return;
        var thumbUrl = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg';
        var embedAutoplay = toEmbedUrl(sourceUrl, true);
        container.innerHTML = buildOverlayHtml(thumbUrl, embedAutoplay, title);
        container.classList.remove('preview-state-empty', 'preview-state-loading', 'preview-state-no-moments');
        container.classList.add('preview-state-thumbnail');

        var overlay = container.querySelector('.preview-play-overlay');
        if (!overlay || overlay.dataset.previewPlayBound) return;
        overlay.dataset.previewPlayBound = 'true';

        function activatePlayer() {
            var src = overlay.dataset.embedAutoplay || '';
            var ttl = overlay.dataset.embedTitle || 'LoveTree media';
            container.innerHTML =
                '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;">' +
                '<iframe width="100%" height="100%" src="' + escapeHtml(src) + '" title="' + escapeHtml(ttl) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
                '</div>';
            container.classList.remove('preview-state-thumbnail');
            container.classList.add('preview-state-media');
        }

        overlay.addEventListener('click', activatePlayer);
        overlay.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activatePlayer(); }
        });
        var playBtn = overlay.querySelector('.play-btn');
        if (playBtn) {
            playBtn.addEventListener('mouseenter', function() { playBtn.style.transform = 'scale(1.08)'; });
            playBtn.addEventListener('mouseleave', function() { playBtn.style.transform = ''; });
        }
    }

    function patchMediaHelper() {
        var helper = window.LoveBudSearchPreviewMediaHelper;
        if (!helper || helper.__loveBudEmbedPatchApplied) return;

        helper.generateIframeSource = function(value) { return toEmbedUrl(value, false); };

        /* renderPreviewIframe — 이름은 기존 유지하되, 실제로는 오버레이 HTML 반환 */
        helper.renderPreviewIframe = function(sourceUrl, treeTitle, mediaTitle) {
            var videoId = getYouTubeVideoId(sanitizeUrl(sourceUrl));
            if (!videoId) return '';
            var thumbUrl = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg';
            var embedAutoplay = toEmbedUrl(sourceUrl, true);
            var title = String(treeTitle || mediaTitle || 'LoveTree media');
            /* 반환된 HTML을 container에 삽입한 뒤 bindPreviewOverlayEvents()로 이벤트 바인딩 필요 */
            return '<div class="preview-media-overlay-pending" data-embed-autoplay="' + escapeHtml(embedAutoplay) + '" data-embed-title="' + escapeHtml(title) + '">' +
                buildOverlayHtml(thumbUrl, embedAutoplay, title) +
                '</div>';
        };

        /* 삽입 후 이벤트 바인딩용 헬퍼 — 렌더러가 innerHTML 설정 후 호출 */
        helper.bindPreviewOverlayEvents = function(container) {
            var overlays = container ? container.querySelectorAll('.preview-play-overlay:not([data-preview-play-bound])') : [];
            Array.prototype.forEach.call(overlays, function(overlay) {
                if (overlay.dataset.previewPlayBound) return;
                overlay.dataset.previewPlayBound = 'true';
                var wrapper = overlay.closest('.video-container, [data-preview-video-container]') || overlay.parentElement;
                function activatePlayer() {
                    var src = overlay.dataset.embedAutoplay || '';
                    var ttl = overlay.dataset.embedTitle || 'LoveTree media';
                    if (!wrapper) return;
                    wrapper.innerHTML =
                        '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;">' +
                        '<iframe width="100%" height="100%" src="' + escapeHtml(src) + '" title="' + escapeHtml(ttl) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
                        '</div>';
                    wrapper.classList.remove('preview-state-thumbnail');
                    wrapper.classList.add('preview-state-media');
                }
                overlay.addEventListener('click', activatePlayer);
                overlay.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activatePlayer(); }
                });
                var playBtn = overlay.querySelector('.play-btn');
                if (playBtn) {
                    playBtn.addEventListener('mouseenter', function() { playBtn.style.transform = 'scale(1.08)'; });
                    playBtn.addEventListener('mouseleave', function() { playBtn.style.transform = ''; });
                }
            });
        };

        /* 직접 container에 렌더+바인딩하는 편의 메서드 */
        helper.renderPreviewOverlay = renderPreviewOverlay;

        helper.__loveBudEmbedPatchApplied = true;
    }

    patchMediaHelper();
    document.addEventListener('DOMContentLoaded', patchMediaHelper);
})();
