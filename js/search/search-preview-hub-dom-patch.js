/* Issue #1058/#1489/#1490: DOM-level Browse hub final layout patch. */
(function() {
    'use strict';

    var lastPatchedTitle = '';
    var socialBound = false;

    function escapeHtml(value) {
        if (window.LoveBudSecurity && typeof window.LoveBudSecurity.escapeHtml === 'function') {
            return window.LoveBudSecurity.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hide(el) {
        if (!el) return;
        el.hidden = true;
        el.style.display = 'none';
    }

    function getPreviewDesc() {
        return document.getElementById('previewDesc');
    }

    function getPreviewTitleText() {
        var title = document.querySelector('#previewTitle .preview-focus-title') || document.getElementById('previewTitle');
        return String(title && title.textContent || '').trim() || '러브트리';
    }

    function getSummaryText() {
        var copy = document.querySelector('#previewDesc .preview-focus-copy');
        if (!copy) return '';
        var clone = copy.cloneNode(true);
        Array.prototype.slice.call(clone.children).forEach(function(child) {
            if (child.tagName === 'DIV') child.remove();
        });
        return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeCopy() {
        var desc = getPreviewDesc();
        if (!desc) return;
        var copy = desc.querySelector('.preview-focus-copy');
        if (!copy) return;

        Array.prototype.slice.call(copy.children).forEach(function(child) {
            if (child.tagName === 'DIV') child.remove();
        });

        if (!copy.querySelector('.preview-summary-line')) {
            var summaryText = getSummaryText();
            if (summaryText) {
                copy.innerHTML = '<p class="preview-summary-line">' + escapeHtml(summaryText) + '</p>';
            }
        }
    }

    // PR #2761: restore 공유 stat alongside 좋아요/댓글/조회수 so the
    // social bar mirrors the card reaction row and the My Trees hub
    // pill row. The earlier Issue #1489 #1490 removal predated the card
    // parity work; restoring it here keeps Browse ↔ My Trees symmetric.
    function renderSocialShell() {
        return '' +
            '<div class="preview-social-shell" data-preview-social-shell>' +
                '<div class="preview-social-bar" aria-label="트리 반응">' +
                    '<button type="button" class="preview-social-action" data-preview-like disabled aria-label="좋아요 0"><span class="material-symbols-outlined" aria-hidden="true">favorite</span><strong>0</strong><span>좋아요</span></button>' +
                    '<button type="button" class="preview-social-action" data-preview-comments aria-expanded="false" aria-label="댓글 0"><span class="material-symbols-outlined" aria-hidden="true">mode_comment</span><strong>0</strong><span>댓글</span></button>' +
                    '<div class="preview-social-action preview-social-stat" aria-label="공유" role="status"><span class="material-symbols-outlined" aria-hidden="true">share</span><strong>0</strong><span>공유</span></div>' +
                    '<div class="preview-social-action preview-social-stat" aria-label="조회수" role="status"><span class="material-symbols-outlined" aria-hidden="true">visibility</span><strong>0</strong><span>조회수</span></div>' +
                '</div>' +
                '<div class="preview-comments-panel" data-preview-comments-panel hidden>' +
                    '<div class="preview-comments-title">댓글</div>' +
                    '<p>아직 댓글이 없어요.</p>' +
                    '<p class="preview-comments-note">댓글 작성 기능은 후속 기능으로 준비 중입니다.</p>' +
                '</div>' +
            '</div>';
    }

    function ensureSocialShell() {
        var desc = getPreviewDesc();
        if (!desc) return;
        if (!desc.querySelector('[data-preview-social-shell]')) {
            desc.insertAdjacentHTML('beforeend', renderSocialShell());
        }
        if (socialBound) return;
        socialBound = true;
        document.addEventListener('click', function(event) {
            var button = event.target && event.target.closest && event.target.closest('[data-preview-comments]');
            if (!button) return;
            var shell = button.closest('[data-preview-social-shell]');
            var panel = shell && shell.querySelector('[data-preview-comments-panel]');
            if (!panel) return;
            var willOpen = panel.hidden;
            panel.hidden = !willOpen;
            button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
    }

    function removeRedundantBlocks() {
        hide(document.querySelector('.preview-focus-title-meta'));
        hide(document.getElementById('previewTreeStats'));
        hide(document.getElementById('previewEmotionSection'));
        normalizeCopy();
    }

    function markFlowStages() {
        var desc = getPreviewDesc();
        if (!desc) return;
        var stages = Array.prototype.slice.call(desc.querySelectorAll('.preview-flow-stage'));
        stages.forEach(function(stage, index) {
            stage.setAttribute('role', 'button');
            stage.setAttribute('tabindex', '0');
            stage.dataset.previewMomentIndex = String(index);
        });
    }

    function patchHubDom() {
        var desc = getPreviewDesc();
        if (!desc || desc.hidden) return;
        var currentTitle = getPreviewTitleText();
        removeRedundantBlocks();
        markFlowStages();
        ensureSocialShell();
        lastPatchedTitle = currentTitle;
    }

    function installObserver() {
        var sidebar = document.getElementById('previewSidebar') || document.body;
        if (!sidebar || sidebar.dataset.previewHubDomPatchObserved) return;
        sidebar.dataset.previewHubDomPatchObserved = 'true';
        var observer = new MutationObserver(function() {
            window.requestAnimationFrame(patchHubDom);
        });
        observer.observe(sidebar, { childList: true, subtree: true, attributes: true });
    }

    document.addEventListener('click', function(event) {
        var stage = event.target && event.target.closest && event.target.closest('.preview-flow-stage');
        if (!stage) return;
        Array.prototype.slice.call(document.querySelectorAll('.preview-flow-stage')).forEach(function(item) {
            item.classList.remove('is-active');
        });
        stage.classList.add('is-active');
    });

    document.addEventListener('keydown', function(event) {
        var stage = event.target && event.target.closest && event.target.closest('.preview-flow-stage');
        if (!stage) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        stage.click();
    });

    function start() {
        installObserver();
        patchHubDom();
        window.setTimeout(patchHubDom, 100);
        window.setTimeout(patchHubDom, 500);
        window.setInterval(patchHubDom, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();
