/* Issue #1053/#1058/#1489/#1490: playable Browse hub media, flow moment switching, and final hub action layout.
   클릭-투-플레이 패턴 — 내 러브트리(bindDetailMediaPlayback)와 동일하게 통일. */
(function() {
    'use strict';

    var selectedMomentIndexByTree = Object.create(null);

    function escapeHtml(value) { var sec = window.LoveBudSecurity; if (sec) return sec.escapeHtml(value); return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

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

    function toEmbedUrl(value, autoplay) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var videoId = getYouTubeVideoId(raw);
        if (!videoId) return '';
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

    function getTreeKey(tree) {
        if (!tree) return 'unknown';
        if (tree.id != null && tree.id !== '') return String(tree.id);
        return String(tree.title || 'tree') + ':' + String((tree.memories || []).length || tree.memoryCount || 0);
    }

    function getMomentLabel(memory, index) {
        var helper = window.LoveBudSearchTitleHelper || null;
        var raw = memory && memory.title || '';
        var cleaned = helper && helper.cleanMomentTitle ? helper.cleanMomentTitle(raw) : String(raw || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || (index === 0 ? '시작 순간' : '이어진 순간');
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

    function getCandidateUrlFromMemory(memory) {
        if (!memory) return '';
        return sanitizeUrl(memory.sourceUrl || memory.videoUrl || memory.videoURL || memory.mediaUrl || memory.mediaURL || memory.linkUrl || memory.linkURL || memory.thumbnail || memory.thumbnailUrl || memory.imageUrl || '');
    }

    function getCandidateUrlFromTree(tree, preferredIndex) {
        if (!tree) return '';
        var memories = Array.isArray(tree.memories) ? tree.memories : [];
        var preferredMemory = memories[Number(preferredIndex || 0)];
        var preferredCandidate = getCandidateUrlFromMemory(preferredMemory);
        if (getYouTubeVideoId(preferredCandidate)) return preferredCandidate;
        if (preferredIndex === 0 && tree.representativeSourceUrl) return sanitizeUrl(tree.representativeSourceUrl);
        for (var i = 0; i < memories.length; i += 1) {
            var candidate = getCandidateUrlFromMemory(memories[i]);
            if (getYouTubeVideoId(candidate)) return candidate;
        }
        return sanitizeUrl(tree.representativeThumbnail || tree.thumbnail || '');
    }

    function getCandidateUrlFromRenderedDom(container) {
        if (!container) return '';
        var img = container.querySelector('img');
        if (!img) return '';
        return sanitizeUrl(img.currentSrc || img.src || img.getAttribute('src') || '');
    }

    function getThumbnailUrl(videoId) {
        if (!videoId) return '';
        return 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg';
    }

    /* 내 러브트리와 동일: 썸네일 + 오버레이 플레이 버튼 렌더. 클릭 시 autoplay iframe으로 교체 */
    function renderThumbnailWithOverlay(container, embedUrlNoAutoplay, embedUrlAutoplay, title) {
        var videoId = getYouTubeVideoId(embedUrlNoAutoplay);
        var thumbUrl = getThumbnailUrl(videoId);

        container.innerHTML =
            '<img src="' + escapeHtml(thumbUrl) + '" alt="' + escapeHtml(title || '') + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;" loading="lazy">' +
            '<div class="memory-preview-overlay preview-play-overlay" role="button" tabindex="0" aria-label="재생" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.10);border-radius:inherit;cursor:pointer;">' +
                '<button type="button" class="play-btn" aria-label="재생" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.92);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:transform 0.15s;">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" fill="#904951"/></svg>' +
                '</button>' +
            '</div>';

        container.classList.remove('preview-state-empty', 'preview-state-loading', 'preview-state-no-moments');
        container.classList.add('preview-state-thumbnail');

        var overlay = container.querySelector('.preview-play-overlay');
        if (!overlay) return;
        if (overlay.dataset.previewPlayBound) return;
        overlay.dataset.previewPlayBound = 'true';

        function activatePlayer() {
            container.innerHTML =
                '<div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;">' +
                '<iframe width="100%" height="100%" src="' + escapeHtml(embedUrlAutoplay) + '" title="' + escapeHtml(title || 'LoveTree media') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;"></iframe>' +
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

    function replaceWithOverlay(tree, preferredIndex) {
        var container = document.getElementById('previewVideoContainer');
        if (!container) return false;
        var candidate = getCandidateUrlFromTree(tree, preferredIndex) || getCandidateUrlFromRenderedDom(container);
        var videoId = getYouTubeVideoId(candidate);
        if (!videoId) return false;
        var embedNoAutoplay = toEmbedUrl(candidate, false);
        var embedAutoplay = toEmbedUrl(candidate, true);
        var memories = Array.isArray(tree && tree.memories) ? tree.memories : [];
        var memory = memories[Number(preferredIndex || 0)] || memories[0] || null;
        var title = memory ? getMomentLabel(memory, Number(preferredIndex || 0)) : tree && tree.title;
        renderThumbnailWithOverlay(container, embedNoAutoplay, embedAutoplay, title);
        return true;
    }

    function getCount(tree, keys) {
        for (var i = 0; i < keys.length; i += 1) {
            var value = Number(tree && tree[keys[i]]);
            if (Number.isFinite(value) && value >= 0) return value;
        }
        return 0;
    }

    // Issue #1489 #1490: 조회수→좋아요→댓글 순서, 공유 제거, totalViewCount 우선
    function renderSocialBar(tree) {
        var views    = getCount(tree, ['totalViewCount', 'viewCount', 'view_count', 'views']);
        var likes    = getCount(tree, ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count']);
        var comments = getCount(tree, ['commentCount', 'commentsCount', 'comments', 'replyCount', 'reply_count']);
        return '<div class="preview-social-shell" data-preview-social-shell>' +
            '<div class="preview-social-bar" aria-label="트리 반응">' +
                '<div class="preview-social-action preview-social-stat" aria-label="조회수 ' + escapeHtml(String(views)) + '" role="status"><span class="material-symbols-outlined" aria-hidden="true">visibility</span><strong>' + escapeHtml(String(views)) + '</strong><span>조회수</span></div>' +
                '<button type="button" class="preview-social-action" data-preview-like disabled aria-label="좋아요 ' + escapeHtml(String(likes)) + '"><span class="material-symbols-outlined" aria-hidden="true">favorite</span><strong>' + escapeHtml(String(likes)) + '</strong><span>좋아요</span></button>' +
                '<button type="button" class="preview-social-action" data-preview-comments aria-expanded="false" aria-label="댓글 ' + escapeHtml(String(comments)) + '"><span class="material-symbols-outlined" aria-hidden="true">mode_comment</span><strong>' + escapeHtml(String(comments)) + '</strong><span>댓글</span></button>' +
            '</div>' +
            '<div class="preview-comments-panel" data-preview-comments-panel hidden>' +
                '<div class="preview-comments-title">댓글</div>' +
                '<p>아직 댓글이 없어요.</p>' +
                '<p class="preview-comments-note">댓글 작성 기능은 후속 기능으로 준비 중입니다.</p>' +
            '</div>' +
        '</div>';
    }

    function normalizePreviewCopy(tree) {
        var previewDesc = document.getElementById('previewDesc');
        if (!previewDesc) return;
        var copy = document.getElementById('previewHubSummarySlot');
        if (!copy) {
            copy = previewDesc.querySelector('.preview-focus-copy');
        }
        if (copy) {
            var title = String(tree && tree.title || '러브트리').trim();
            var count = Number(tree && tree.memoryCount || (tree && tree.memories && tree.memories.length) || 0);
            var range = String(tree && tree.timeRange || '').trim();
            if (range) {
                copy.innerHTML = '<p class="preview-summary-line"><strong>' + escapeHtml(title) + '</strong>에 담긴 <strong>' + count + '개의 순간</strong>이 <strong>' + escapeHtml(range) + '</strong>에 걸쳐 이어졌어요.</p>';
            } else {
                copy.innerHTML = '<p class="preview-summary-line"><strong>' + escapeHtml(title) + '</strong>에 담긴 <strong>' + count + '개의 순간</strong>이 이어졌어요.</p>';
            }
        }
        var socialSlot = document.getElementById('previewHubSocialSlot');
        if (socialSlot) {
            socialSlot.innerHTML = renderSocialBar(tree || {});
        } else {
            var oldSocial = previewDesc.querySelector('[data-preview-social-shell]');
            if (oldSocial) oldSocial.remove();
            previewDesc.insertAdjacentHTML('beforeend', renderSocialBar(tree || {}));
        }
    }

    function hideRedundantBlocks() {
        var titleMeta = document.querySelector('.preview-focus-title-meta');
        if (titleMeta) titleMeta.hidden = true;
        var stats = document.getElementById('previewTreeStats');
        if (stats) stats.hidden = true;
        var emotion = document.getElementById('previewEmotionSection');
        if (emotion) emotion.hidden = true;
    }

    function enhanceFlowStages(tree) {
        var previewDesc = document.getElementById('previewDesc');
        if (!previewDesc || !tree) return;
        var stages = Array.prototype.slice.call(previewDesc.querySelectorAll('.preview-flow-stage'));
        if (!stages.length) return;
        var treeKey = getTreeKey(tree);
        var selectedIndex = Number(selectedMomentIndexByTree[treeKey] || 0);
        stages.forEach(function(stage, index) {
            stage.setAttribute('role', 'button');
            stage.setAttribute('tabindex', '0');
            stage.dataset.previewMomentIndex = String(index);
            stage.classList.toggle('is-active', index === selectedIndex);
            if (stage.dataset.previewMomentBound) return;
            stage.dataset.previewMomentBound = 'true';
            var activate = function() {
                selectedMomentIndexByTree[treeKey] = index;
                stages.forEach(function(item) { item.classList.remove('is-active'); });
                stage.classList.add('is-active');
                replaceWithOverlay(tree, index);
            };
            stage.addEventListener('click', activate);
            stage.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        });
    }

    function bindCommentsToggle() {
        var button = document.querySelector('[data-preview-comments]');
        var panel = document.querySelector('[data-preview-comments-panel]');
        if (!button || !panel || button.dataset.previewCommentsBound) return;
        button.dataset.previewCommentsBound = 'true';
        button.addEventListener('click', function() {
            var willOpen = panel.hidden;
            panel.hidden = !willOpen;
            button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
    }

    function finalizeHub(tree) {
        var treeKey = getTreeKey(tree);
        var selectedIndex = Number(selectedMomentIndexByTree[treeKey] || 0);
        replaceWithOverlay(tree, selectedIndex);
        window.setTimeout(function() { replaceWithOverlay(tree, selectedIndex); }, 80);
        normalizePreviewCopy(tree);
        hideRedundantBlocks();
        enhanceFlowStages(tree);
        bindCommentsToggle();
    }

    function patchRenderer() {
        var renderer = window.LoveBudSearchPreviewRenderer;
        if (!renderer || renderer.__loveBudPlayableHubPatchApplied || typeof renderer.updatePreview !== 'function') return;
        var originalUpdatePreview = renderer.updatePreview;
        renderer.updatePreview = function(tree) {
            originalUpdatePreview.apply(renderer, arguments);
            finalizeHub(tree);
        };
        renderer.__loveBudPlayableHubPatchApplied = true;
    }

    patchRenderer();
    document.addEventListener('DOMContentLoaded', patchRenderer);
})();
