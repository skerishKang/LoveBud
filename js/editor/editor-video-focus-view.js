/**
 * Editor video-focus view module.
 *
 * Provides an in-app "영상 크게 보기" (watch in larger view) CTA
 * for the editor's right detail panel when a YouTube/moment video
 * is already playing inside [data-editor-detail-player="1"].
 *
 * Design contract:
 *  - Does NOT recreate, move, or replace the existing player iframe.
 *  - Does NOT change iframe.src, cloneNode, or remove/reinsert the player.
 *  - Uses the existing .detail-video wrapper with a fixed-position
 *    CSS overlay to present the focused view.
 *  - The original iframe stays in the DOM — only its visual presentation
 *    changes via body class + CSS focus wrapper styling.
 *  - Closes automatically when the underlying player is removed
 *    (new moment selection, empty selection, or editor state change).
 *  - Closes on explicit close button or backdrop click.
 *
 * Guardrails:
 *  - No iframe src mutation, no fetch/apiClient/localStorage/DB.
 *  - No keydown/Escape/focus-trap/keyboard-navigation in this slice.
 *  - No autoplay, no YouTube provider change, no URL sanitization.
 *  - No changes to protected PRs or protected editor-detail files.
 */
(function () {
    'use strict';

    const FOCUS_BACKDROP_CLASS = 'editor-video-focus-backdrop';
    const FOCUS_CONTAINER_CLASS = 'editor-video-focus-container';
    const FOCUS_PLAYER_CLASS = 'editor-video-focus-player';
    const FOCUS_TOGGLE_BTN_CLASS = 'editor-video-focus-toggle';
    const FOCUS_CLOSE_BTN_CLASS = 'editor-video-focus-close';
    const FOCUS_ACTIVE_CLASS = 'is-editor-video-focused';
    const FOCUS_OPEN_BODY_CLASS = 'editor-video-focus-open';
    const PLAYER_SELECTOR = '[data-editor-detail-player="1"]';
    const VIDEO_WRAPPER_SELECTOR = '.detail-video';

    let isFocusOpen = false;
    let currentPlayer = null;
    let currentVideoWrapper = null;
    let mutationObserver = null;
    let playerWatchActive = false;

    // ---------------------------------------------------------------------------
    // DOM query helpers
    // ---------------------------------------------------------------------------

    function getDetailVideoContainer() {
        return document.querySelector(VIDEO_WRAPPER_SELECTOR);
    }

    function getActivePlayerInWrapper(wrapper) {
        if (!wrapper) return null;
        return wrapper.querySelector(PLAYER_SELECTOR);
    }

    function getIsPlayingState(wrapper) {
        if (!wrapper) return false;
        return wrapper.classList.contains('is-playing');
    }

    // ---------------------------------------------------------------------------
    // CTA visibility
    // ---------------------------------------------------------------------------

    function updateCTAVisibility() {
        const videoWrapper = getDetailVideoContainer();
        if (!videoWrapper) {
            hideFocusToggle();
            return;
        }

        const isPlaying = getIsPlayingState(videoWrapper);
        const hasPlayer = !!getActivePlayerInWrapper(videoWrapper);

        if (isPlaying && hasPlayer) {
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

    // ---------------------------------------------------------------------------
    // Focus open — applies body class to trigger CSS focus overlay
    //
    // Instead of moving the iframe, this adds the .editor-video-focus-open class
    // to body and .is-editor-video-focused class to the .detail-video wrapper.
    // The CSS in editor-video-focus-view.css handles the repositioning via
    // fixed-position .editor-video-focus-container that wraps the existing
    // .detail-video content. The original iframe remains in its DOM position.
    // ---------------------------------------------------------------------------

    function openFocusView() {
        if (isFocusOpen) return;

        var videoWrapper = getDetailVideoContainer();
        if (!videoWrapper) return;

        var player = getActivePlayerInWrapper(videoWrapper);
        if (!player) return;

        var isPlaying = getIsPlayingState(videoWrapper);
        if (!isPlaying) return;

        currentVideoWrapper = videoWrapper;
        currentPlayer = player;

        // Add body class to trigger CSS focus transformation
        document.body.classList.add(FOCUS_OPEN_BODY_CLASS);
        videoWrapper.classList.add(FOCUS_ACTIVE_CLASS);

        isFocusOpen = true;
        startPlayerWatch();
    }

    // ---------------------------------------------------------------------------
    // Focus close — removes body class, restores original layout
    // ---------------------------------------------------------------------------

    function closeFocusView() {
        if (!isFocusOpen) return;

        var videoWrapper = currentVideoWrapper;

        if (videoWrapper) {
            videoWrapper.classList.remove(FOCUS_ACTIVE_CLASS);
        }

        document.body.classList.remove(FOCUS_OPEN_BODY_CLASS);

        currentPlayer = null;
        currentVideoWrapper = null;
        isFocusOpen = false;

        stopPlayerWatch();
        updateCTAVisibility();
    }

    // ---------------------------------------------------------------------------
    // Player watch — auto-close when underlying iframe is removed
    //
    // Uses MutationObserver on the .detail-video wrapper's parent to detect
    // when the player element is removed from the DOM. Automatically closes
    // the focus view so no stale overlay remains.
    // ---------------------------------------------------------------------------

    function startPlayerWatch() {
        if (!currentPlayer) return;
        if (playerWatchActive) return;

        playerWatchActive = true;

        var parent = currentPlayer.parentNode;
        if (parent && parent !== currentVideoWrapper) {
            // Player may be inside the .detail-video .is-playing structure
            // Watch the wrapper itself
            parent = currentVideoWrapper;
        }

        if (!parent) {
            // Fallback: watch the video wrapper
            parent = currentVideoWrapper;
        }

        if (parent && !mutationObserver) {
            mutationObserver = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var mutation = mutations[i];
                    for (var j = 0; j < mutation.removedNodes.length; j++) {
                        var removed = mutation.removedNodes[j];
                        if (removed.nodeType === 1 &&
                            removed.getAttribute &&
                            removed.getAttribute('data-editor-detail-player') === '1') {
                            // Player was removed — close focus
                            closeFocusView();
                            return;
                        }
                    }
                }
            });
            mutationObserver.observe(parent, { childList: true, subtree: false });
        }
    }

    function stopPlayerWatch() {
        if (mutationObserver) {
            try {
                mutationObserver.disconnect();
            } catch (e) {
                // Safe to ignore
            }
            mutationObserver = null;
        }
        playerWatchActive = false;
    }

    // ---------------------------------------------------------------------------
    // CTA toggle (focus button) — inserted into detail-video action area
    // The toggle is only visible when an active player exists.
    // ---------------------------------------------------------------------------

    function ensureFocusToggle() {
        var videoWrapper = getDetailVideoContainer();
        if (!videoWrapper) return;

        // Avoid duplicate toggle
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

        // Insert the toggle near the play button area
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

    // ---------------------------------------------------------------------------
    // Initialize — runs at DOMContentLoaded
    // ---------------------------------------------------------------------------

    function init() {
        ensureFocusToggle();

        // Watch for class changes on .detail-video (is-playing toggling)
        // to update CTA visibility when player state changes
        var videoWrapper = getDetailVideoContainer();
        if (videoWrapper) {
            var classObserver = new MutationObserver(function () {
                updateCTAVisibility();
            });
            classObserver.observe(videoWrapper, {
                attributes: true,
                attributeFilter: ['class'],
                childList: true,
                subtree: true
            });
        }

        // Initial visibility
        updateCTAVisibility();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for external use (e.g. tree switch — close on route change)
    window.LoveBudEditorVideoFocus = {
        open: openFocusView,
        close: closeFocusView,
        isOpen: function () { return isFocusOpen; }
    };
})();