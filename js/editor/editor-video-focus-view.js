(function () {
    'use strict';

    var FOCUS_BACKDROP_CLASS = 'editor-video-focus-backdrop';
    var FOCUS_CLOSE_BTN_CLASS = 'editor-video-focus-close';
    var FOCUS_TOGGLE_BTN_CLASS = 'editor-video-focus-toggle';
    var FOCUS_ACTIVE_CLASS = 'is-editor-video-focused';
    var FOCUS_OPEN_BODY_CLASS = 'editor-video-focus-open';
    var PLAYER_SELECTOR = '[data-editor-detail-player="1"]';
    var VIDEO_WRAPPER_SELECTOR = '.detail-video';

    var isFocusOpen = false;
    var currentPlayer = null;
    var currentVideoWrapper = null;
    var currentBackdrop = null;
    var currentCloseBtn = null;

    function getDetailVideoContainer() {
        return document.querySelector(VIDEO_WRAPPER_SELECTOR);
    }

    function getActivePlayerInWrapper(wrapper) {
        if (!wrapper) return null;
        return wrapper.querySelector(PLAYER_SELECTOR);
    }

    function updateCTAVisibility() {
        var videoWrapper = getDetailVideoContainer();
        if (!videoWrapper) {
            hideFocusToggle();
            return;
        }
        if (getActivePlayerInWrapper(videoWrapper)) {
            showFocusToggle();
        } else {
            hideFocusToggle();
        }
    }

    function showFocusToggle() {
        var toggle = document.querySelector('.' + FOCUS_TOGGLE_BTN_CLASS);
        if (toggle) {
            toggle.hidden = false;
            toggle.style.display = '';
            toggle.disabled = false;
        }
    }

    function hideFocusToggle() {
        var toggle = document.querySelector('.' + FOCUS_TOGGLE_BTN_CLASS);
        if (toggle) {
            toggle.hidden = true;
            toggle.style.display = 'none';
            toggle.disabled = true;
        }
    }

    function openFocusView() {
        if (isFocusOpen) return;

        var videoWrapper = getDetailVideoContainer();
        if (!videoWrapper) return;

        var player = getActivePlayerInWrapper(videoWrapper);
        if (!player) return;

        currentVideoWrapper = videoWrapper;
        currentPlayer = player;

        var backdrop = document.createElement('div');
        backdrop.className = FOCUS_BACKDROP_CLASS;
        document.body.appendChild(backdrop);
        currentBackdrop = backdrop;

        var closeBtn = document.createElement('button');
        closeBtn.className = FOCUS_CLOSE_BTN_CLASS;
        closeBtn.setAttribute('type', 'button');
        closeBtn.setAttribute('aria-label', '닫기');
        closeBtn.textContent = '닫기';
        videoWrapper.appendChild(closeBtn);
        currentCloseBtn = closeBtn;

        backdrop.addEventListener('click', closeFocusView);
        closeBtn.addEventListener('click', closeFocusView);

        document.body.classList.add(FOCUS_OPEN_BODY_CLASS);
        videoWrapper.classList.add(FOCUS_ACTIVE_CLASS);

        isFocusOpen = true;
    }

    function closeFocusView() {
        if (!isFocusOpen) return;

        if (currentVideoWrapper) {
            currentVideoWrapper.classList.remove(FOCUS_ACTIVE_CLASS);
        }
        document.body.classList.remove(FOCUS_OPEN_BODY_CLASS);

        if (currentBackdrop && currentBackdrop.parentNode) {
            currentBackdrop.parentNode.removeChild(currentBackdrop);
        }
        currentBackdrop = null;

        if (currentCloseBtn && currentCloseBtn.parentNode) {
            currentCloseBtn.parentNode.removeChild(currentCloseBtn);
        }
        currentCloseBtn = null;

        currentPlayer = null;
        currentVideoWrapper = null;
        isFocusOpen = false;

        updateCTAVisibility();
    }

    function ensureFocusToggle(videoWrapper) {
        if (!videoWrapper) return;
        var existingToggle = videoWrapper.querySelector('.' + FOCUS_TOGGLE_BTN_CLASS);
        if (existingToggle) return;

        var toggle = document.createElement('button');
        toggle.className = FOCUS_TOGGLE_BTN_CLASS;
        toggle.setAttribute('type', 'button');
        toggle.setAttribute('aria-label', '영상 크게 보기');
        toggle.textContent = '영상 크게 보기';

        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openFocusView();
        });

        var actionArea = videoWrapper.querySelector('.play-btn') ||
            videoWrapper.querySelector('button') ||
            videoWrapper;

        if (actionArea && actionArea !== videoWrapper) {
            actionArea.parentElement.insertBefore(toggle, actionArea.nextSibling);
        } else {
            videoWrapper.appendChild(toggle);
        }

        updateCTAVisibility();
    }

    function handleSync() {
        var videoWrapper = getDetailVideoContainer();
        if (videoWrapper) {
            ensureFocusToggle(videoWrapper);
        }
        updateCTAVisibility();

        if (isFocusOpen) {
            var shouldClose = false;
            if (!currentPlayer || !currentPlayer.isConnected) {
                shouldClose = true;
            } else if (!currentVideoWrapper || !currentVideoWrapper.isConnected) {
                shouldClose = true;
            } else if (!currentVideoWrapper.contains(currentPlayer)) {
                shouldClose = true;
            }
            if (shouldClose) {
                closeFocusView();
            }
        }
    }

    var syncObserver = new MutationObserver(function () {
        handleSync();
    });
    syncObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleSync);
    } else {
        handleSync();
    }

    window.LoveBudEditorVideoFocus = {
        open: openFocusView,
        close: closeFocusView,
        isOpen: function () { return isFocusOpen; }
    };
})();
