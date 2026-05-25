(function() {
    'use strict';

    var copyApplyScheduled = false;

    function setText(selector, text) {
        var el = document.querySelector(selector);
        if (!el) return false;
        if (el.textContent === text) return false;
        el.textContent = text;
        return true;
    }

    function hide(selector) {
        var el = document.querySelector(selector);
        if (!el) return false;
        if (el.hidden && el.style.display === 'none') return false;
        el.hidden = true;
        el.style.display = 'none';
        return true;
    }

    function replaceRawLayoutLabel() {
        var label = document.getElementById('layoutModeToggleLabel');
        if (!label) return false;
        var value = String(label.textContent || '').trim();
        if (value === 'editor_layout_free') {
            label.textContent = '자유 배치';
            return true;
        }
        if (value === 'editor_layout_structured') {
            label.textContent = '구조 보기';
            return true;
        }
        return false;
    }

    function applyPublicViewerCopy() {
        copyApplyScheduled = false;
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

    function scheduleCopyApply() {
        if (copyApplyScheduled) return;
        copyApplyScheduled = true;
        window.requestAnimationFrame(applyPublicViewerCopy);
    }

    function installCopyObserver() {
        applyPublicViewerCopy();
        var target = document.getElementById('detailPanel');
        if (!target) return false;
        if (target.__publicViewerCopyObserverInstalled) return true;
        var observer = new MutationObserver(scheduleCopyApply);
        observer.observe(target, { childList: true, subtree: true });
        target.__publicViewerCopyObserverInstalled = true;
        return true;
    }

    function retryInstallCopyObserver() {
        var tries = 0;
        var timer = window.setInterval(function() {
            tries += 1;
            if (installCopyObserver() || tries > 40) {
                window.clearInterval(timer);
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', retryInstallCopyObserver);
    } else {
        retryInstallCopyObserver();
    }

    window.setTimeout(scheduleCopyApply, 800);
})();
