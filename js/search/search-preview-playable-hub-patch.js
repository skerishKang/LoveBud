/* Issue #1053: make selected Browse hub media playable when source URLs can be inferred. */
(function() {
    'use strict';

    function getYouTubeVideoId(value) {
        if (!value) return '';
        try {
            var parsed = new URL(String(value), window.location.origin);
            var host = parsed.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
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

    function toEmbedUrl(value) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var videoId = getYouTubeVideoId(raw);
        if (!videoId) return '';
        var embedUrl = new URL('https://www.youtube.com/embed/' + encodeURIComponent(videoId));
        embedUrl.searchParams.set('autoplay', '0');
        embedUrl.searchParams.set('mute', '0');
        embedUrl.searchParams.set('controls', '1');
        embedUrl.searchParams.set('rel', '0');
        embedUrl.searchParams.set('modestbranding', '1');
        return embedUrl.href;
    }

    function getCandidateUrlFromTree(tree) {
        if (!tree) return '';
        if (tree.representativeSourceUrl) return tree.representativeSourceUrl;
        var memories = Array.isArray(tree.memories) ? tree.memories : [];
        for (var i = 0; i < memories.length; i += 1) {
            var memory = memories[i] || {};
            var candidate = memory.sourceUrl || memory.videoUrl || memory.mediaUrl || memory.linkUrl || memory.thumbnail || memory.thumbnailUrl || '';
            if (getYouTubeVideoId(candidate)) return candidate;
        }
        return tree.representativeThumbnail || tree.thumbnail || '';
    }

    function renderIframe(embedUrl, title) {
        return '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">' +
            '<iframe width="100%" height="100%" src="' + embedUrl + '" title="' + String(title || 'LoveTree media').replace(/"/g, '&quot;') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
            '</div>';
    }

    function patchRenderer() {
        var renderer = window.LoveBudSearchPreviewRenderer;
        if (!renderer || renderer.__loveBudPlayableHubPatchApplied || typeof renderer.updatePreview !== 'function') return;
        var originalUpdatePreview = renderer.updatePreview;
        renderer.updatePreview = function(tree) {
            originalUpdatePreview.apply(renderer, arguments);
            var embedUrl = toEmbedUrl(getCandidateUrlFromTree(tree));
            var container = document.getElementById('previewVideoContainer');
            if (!embedUrl || !container) return;
            container.innerHTML = renderIframe(embedUrl, tree && tree.title);
            container.classList.remove('preview-state-thumbnail');
            container.classList.add('preview-state-media');
        };
        renderer.__loveBudPlayableHubPatchApplied = true;
    }

    patchRenderer();
    document.addEventListener('DOMContentLoaded', patchRenderer);
    console.log('[LoveBudSearchPreviewPlayableHubPatch] loaded v20260512-1058');
})();
