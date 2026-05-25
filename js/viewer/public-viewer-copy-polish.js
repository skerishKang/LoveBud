(function() {
    'use strict';

    function setText(selector, text) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.textContent = text;
    }

    function hide(selector) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.hidden = true;
        el.style.display = 'none';
    }

    function replaceRawLayoutLabel() {
        var label = document.getElementById('layoutModeToggleLabel');
        if (!label) return;
        var value = String(label.textContent || '').trim();
        if (value === 'editor_layout_free') label.textContent = '자유 배치';
        if (value === 'editor_layout_structured') label.textContent = '구조 보기';
    }

    function applyPublicViewerCopy() {
        if (!document.body.classList.contains('editor-readonly')) return;

        setText('.editor-panel-headline', '선택한 순간');
        setText('#detailTreeStatusLabel', '러브트리 정보');
        setText('#detailCurrentMomentBadge', '선택한 순간');
        setText('#detailCurrentMomentHint', '이 순간의 장면과 메모를 감상해 보세요.');
        setText('#detailActionsPrimaryLabel', '감상 동선');
        setText('#viewMomentDetailBtnLabel', '순간 자세히 보기');
        setText('#detailMomentInfoLabel', '순간 기록');
        setText('#detailDateLabel', '기록일');
        setText('#detailTagsLabel', '감정 태그');
        setText('#detailMemoLabel', '남긴 메모');

        hide('#editMemoryBtn');
        hide('#continueFromMomentBtn');
        hide('.editor-save-status-card');

        replaceRawLayoutLabel();
    }

    function installCopyObserver() {
        applyPublicViewerCopy();
        var target = document.getElementById('detailPanel') || document.body;
        if (!target || target.__publicViewerCopyObserverInstalled) return;
        var observer = new MutationObserver(function() {
            applyPublicViewerCopy();
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });
        target.__publicViewerCopyObserverInstalled = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installCopyObserver);
    } else {
        installCopyObserver();
    }

    window.setTimeout(installCopyObserver, 250);
    window.setTimeout(applyPublicViewerCopy, 800);
})();
