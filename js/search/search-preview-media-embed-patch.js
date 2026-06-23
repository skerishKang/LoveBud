/* Issue #1053: normalize Browse hub YouTube iframe sources without changing API shape. */
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

    function patchMediaHelper() {
        var helper = window.LoveBudSearchPreviewMediaHelper;
        if (!helper || helper.__loveBudEmbedPatchApplied) return;

        helper.generateIframeSource = toEmbedUrl;
        helper.renderPreviewIframe = function(sourceUrl, treeTitle, mediaTitle) {
            var iframeSrc = toEmbedUrl(sourceUrl);
            if (!iframeSrc) return '';
            return '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">' +
                '<iframe width="100%" height="100%" src="' + iframeSrc + '" title="' + String(treeTitle || mediaTitle || 'LoveTree media').replace(/"/g, '&quot;') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
                '</div>';
        };
        helper.__loveBudEmbedPatchApplied = true;
    }

    patchMediaHelper();
    document.addEventListener('DOMContentLoaded', patchMediaHelper);
})();
