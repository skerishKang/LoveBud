(function() {
    'use strict';

    var MARKER = 'LoveBudPublicCanvasErrorFallbackLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createLoadFailureState(message) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.createLoadFailureState === 'function') {
            return canvasEntry.createLoadFailureState(message);
        }

        var errState = document.createElement('div');
        var icon = document.createElement('span');
        var title = document.createElement('h2');
        var description = document.createElement('p');

        errState.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;';

        icon.className = 'material-symbols-outlined';
        icon.style.cssText = 'font-size:48px;color:var(--error);margin-bottom:16px;';
        icon.textContent = 'error_outline';

        title.style.cssText = 'margin:0 0 8px;';
        title.textContent = '트리를 불러올 수 없어요';

        description.style.cssText = 'margin:0;color:var(--on-surface-variant);';
        description.textContent = message || 'Public endpoint returned an error';

        errState.appendChild(icon);
        errState.appendChild(title);
        errState.appendChild(description);
        return errState;
    }

    function createMissingRouteState() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.createMissingRouteState === 'function') {
            return canvasEntry.createMissingRouteState();
        }

        var errEl = document.createElement('div');
        errEl.style.cssText = 'padding:2rem;text-align:center;font-size:1.2rem;';
        errEl.textContent = 'treeId parameter required. Usage: ?treeId=<id>';
        return errEl;
    }

    function appendMissingRouteState() {
        var errEl = createMissingRouteState();
        if (errEl) {
            document.body.appendChild(errEl);
            return true;
        }
        return false;
    }

    function appendPublicLoadFailureState(container, error) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.appendPublicLoadFailureState === 'function') {
            return canvasEntry.appendPublicLoadFailureState(container, error);
        }

        if (container) {
            container.textContent = '';
            container.appendChild(createLoadFailureState(error && error.message));
            return true;
        }
        return false;
    }

    function handlePublicCanvasLoadFailure(error) {
        console.error('[public-canvas] Load failed:', error);
        var container = document.getElementById('canvasArea');
        appendPublicLoadFailureState(container, error);
    }

    window.LoveBudPublicCanvasErrorFallback = {
        escapeHtml: escapeHtml,
        createLoadFailureState: createLoadFailureState,
        createMissingRouteState: createMissingRouteState,
        appendMissingRouteState: appendMissingRouteState,
        appendPublicLoadFailureState: appendPublicLoadFailureState,
        handlePublicCanvasLoadFailure: handlePublicCanvasLoadFailure
    };
})();