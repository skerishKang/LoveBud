/* Issue #1053/#1058/#1489/#1490: playable Browse hub media, flow moment switching, and final hub action layout.
   둘러보기는 helper.renderPreviewIframe()를 통해 내 러브트리와 동일한 오버레이 패턴을 코울 */
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

    /* 내 러브트리와 동일: helper.renderPreviewIframe()를 호출하여 오버레이 패턴으로 렌더 */
    function replaceWithIframe(tree, preferredIndex) {
        var container = document.getElementById('previewVideoContainer');
        if (!container) return false;
        var helper = window.LoveBudSearchPreviewMediaHelper;
        if (!helper || typeof helper.renderPreviewIframe !== 'function') return false;

        var candidate = getCandidateUrlFromTree(tree, preferredIndex) || getCandidateUrlFromRenderedDom(container);
        if (!getYouTubeVideoId(candidate)) return false;

        var memories = Array.isArray(tree && tree.memories) ? tree.memories : [];
        var memory = memories[Number(preferredIndex || 0)] || memories[0] || null;
        var treeTitle = tree && tree.title || '';
        var mediaTitle = memory ? getMomentLabel(memory, Number(preferredIndex || 0)) : treeTitle;

        var markup = helper.renderPreviewIframe(candidate, treeTitle, mediaTitle);
        if (!markup) return false;

        container.innerHTML = markup;
        container.classList.remove('preview-state-thumbnail');
        container.classList.add('preview-state-media');

        /* helper가 bindPreviewOverlayEvents를 제공하면 오버레이 이벤트 바인딩 */
        if (typeof helper.bindPreviewOverlayEvents === 'function') {
            helper.bindPreviewOverlayEvents(container);
        }
        return true;
    }

    /**
     * Render the truthful preview social shell via the share-link helper.
     *
     * Shows only view count (when valid) and a read-only share button.
     * No likes, comments, or fake share counts.
     * Degrades gracefully to empty string when the helper is unavailable.
     */
    function renderSocialBar(tree) {
        var shareLink = window.LoveBudSearchShareLink;
        if (shareLink && typeof shareLink.renderPreviewSocialShell === 'function') {
            return shareLink.renderPreviewSocialShell(tree);
        }
        // Graceful degrade: helper unavailable → empty social shell
        return '<div class="preview-social-shell" data-preview-social-shell><div class="preview-social-bar" aria-label="트리 반응"></div></div>';
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
                replaceWithIframe(tree, index);
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

    function finalizeHub(tree) {
        var treeKey = getTreeKey(tree);
        var selectedIndex = Number(selectedMomentIndexByTree[treeKey] || 0);
        replaceWithIframe(tree, selectedIndex);
        window.setTimeout(function() { replaceWithIframe(tree, selectedIndex); }, 80);
        normalizePreviewCopy(tree);
        hideRedundantBlocks();
        enhanceFlowStages(tree);
        // Bind the delegated share click handler once (idempotent)
        var shareLink = window.LoveBudSearchShareLink;
        if (shareLink && typeof shareLink.bindPreviewShareHandler === 'function') {
            shareLink.bindPreviewShareHandler();
        }
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
