(function() {
    'use strict';

    var copyApplyScheduled = false;

    function getCopyHelper() {
        return window.LoveBudPublicViewerCopyHelper || null;
    }

    function getVisibilityHelper() {
        return window.LoveBudPublicViewerControlVisibilityHelper || null;
    }

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
        var helper = getCopyHelper();
        var label = document.getElementById('layoutModeToggleLabel');
        if (!label || !helper || typeof helper.getRawLayoutLabel !== 'function') return false;
        var value = String(label.textContent || '').trim();
        var replacement = helper.getRawLayoutLabel(value);
        if (!replacement) return false;
        label.textContent = replacement;
        return true;
    }

    function applyTextRules(helper) {
        if (!helper || typeof helper.getTextRules !== 'function') return;
        helper.getTextRules().forEach(function(rule) {
            if (!rule || !rule.selector) return;
            setText(rule.selector, rule.text || '');
        });
    }

    function applyVisibilityRules(helper) {
        if (!helper || typeof helper.getControlSelectors !== 'function') return;
        helper.getControlSelectors().forEach(hide);
    }

    function applyPublicViewerCopy() {
        copyApplyScheduled = false;
        if (!document.body.classList.contains('editor-readonly')) return;

        var helper = getCopyHelper();
        applyTextRules(helper);
        applyVisibilityRules(getVisibilityHelper());
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
