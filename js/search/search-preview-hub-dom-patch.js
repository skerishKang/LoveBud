/* Issue #1058/#1489/#1490: DOM-level Browse hub final layout patch.
   Now limited to copy normalization and flow-stage marking only —
   the truthful social shell is owned by search-share-link.js via the
   playable hub patch. */
(function() {
    'use strict';

    var lastPatchedTitle = '';

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

    function getPreviewSocialSlot() {
        return document.getElementById('previewHubSocialSlot');
    }

    function getPreviewTitleText() {
        var title = document.querySelector('#previewTitle .preview-focus-title') || document.getElementById('previewTitle');
        return String(title && title.textContent || '').trim() || '러브트리';
    }

    function getSummaryText() {
        var summarySlot = document.getElementById('previewHubSummarySlot');
        if (!summarySlot) {
            var desc = getPreviewDesc();
            if (!desc) return '';
            var copy = desc.querySelector('.preview-focus-copy');
            if (!copy) return '';
            var clone = copy.cloneNode(true);
            Array.prototype.slice.call(clone.children).forEach(function(child) {
                if (child.tagName === 'DIV') child.remove();
            });
            return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
        }
        return String(summarySlot.textContent || '').replace(/\s+/g, ' ').trim();
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
