/**
 * UI helpers for the Editor Canvas.
 * Focuses on DOM manipulations and simple UI state updates.
 */
import { findMemoryNodeById } from './editor-canvas-selection.js?v=20260628-2971-selector-safe-lookup-3';

/**
 * Updates the layout toggle button UI based on the current layout mode.
 */
function resolveLayoutLabel(i18n, key, fallback) {
    if (typeof i18n !== 'function') return fallback;
    const value = i18n(key);
    return value && value !== key ? value : fallback;
}

export function updateLayoutToggleUI(layoutMode, i18n) {
    const toggleBtn = document.getElementById('layoutModeToggleBtn');
    const toggleLabel = document.getElementById('layoutModeToggleLabel');
    const toggleIcon = document.getElementById('layoutModeToggleIcon');
    if (!toggleBtn) return;
    
    const isStructured = layoutMode === 'structured';
    toggleBtn.classList.toggle('is-active', isStructured);
    
    if (toggleLabel) {
        toggleLabel.textContent = isStructured
            ? resolveLayoutLabel(i18n, 'editor_layout_structured', '정리된 트리')
            : resolveLayoutLabel(i18n, 'editor_layout_free', '자유 배치');
    }
    if (toggleIcon) {
        toggleIcon.textContent = isStructured ? 'account_tree' : 'auto_awesome';
    }
}

/**
 * Shows a temporary toast message when a node is moved in free layout.
 */
export function showMovedToast() {
    const toast = document.getElementById('movedToast');
    if (toast) {
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }
}

/**
 * Applies CSS classes to the body element based on the current layout mode.
 */
export function applyLayoutModeClasses(layoutMode) {
    if (layoutMode === 'structured') {
        document.body.classList.remove('layout-free');
        document.body.classList.add('layout-structured');
    } else {
        document.body.classList.remove('layout-structured');
        document.body.classList.add('layout-free');
    }
}

/**
 * Looks up and returns the standard viewport control buttons from the DOM.
 */
export function getViewportControlButtons() {
    return {
        focusBtn: document.getElementById('focusSelectedBtn'),
        recenterBtn: document.getElementById('recenterCanvasBtn'),
        zoomInBtn: document.getElementById('zoomInCanvasBtn'),
        zoomOutBtn: document.getElementById('zoomOutCanvasBtn')
    };
}

/**
 * Bind the compact/detail mode toggle for the canvas toolbar.
 * Toggles .is-compact class on .editor-canvas-toolbar and swaps the toggle icon.
 * Preference is persisted in localStorage.
 */
export function bindCompactModeToggle() {
    const toggleBtn = document.getElementById('compactModeToggleBtn');
    const toolbar = document.querySelector('.editor-canvas-toolbar');
    if (!toggleBtn || !toolbar) return;
    if (toggleBtn.dataset.compactBound) return;

    // Restore saved preference
    var saved = localStorage.getItem('lovebud_toolbar_compact');
    if (saved === 'true') {
        toolbar.classList.add('is-compact');
        var icon = toggleBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'unfold_less';
    }

    toggleBtn.addEventListener('click', function() {
        var isCompact = toolbar.classList.toggle('is-compact');
        var icon = toggleBtn.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = isCompact ? 'unfold_less' : 'unfold_more';
        }
        try {
            localStorage.setItem('lovebud_toolbar_compact', isCompact ? 'true' : 'false');
        } catch (e) {
            // localStorage may not be available
        }
    });

    toggleBtn.dataset.compactBound = '1';
}

/**
 * Binds the layout mode toggle button event.
 * @param {Function} onToggleLayoutMode - Callback to trigger when the button is clicked.
 */
export function bindLayoutModeToggle(onToggleLayoutMode) {
    const toggleBtn = document.getElementById('layoutModeToggleBtn');
    if (!toggleBtn) return;
    if (toggleBtn.dataset.layoutBound) return;

    toggleBtn.addEventListener('click', () => {
        if (typeof onToggleLayoutMode === 'function') {
            onToggleLayoutMode();
        }
    });

    toggleBtn.dataset.layoutBound = '1';
}

/**
 * Binds the window resize event with a debounce timer.
 * @param {Object} state - The viewport state to track binding and timer.
 * @param {Function} onResize - Callback to trigger after the debounce period.
 */
export function bindResizeHandling(state, onResize) {
    if (state.resizeBound) return;
    state.resizeBound = true;

    window.addEventListener('resize', () => {
        if (state.resizeTimer) {
            clearTimeout(state.resizeTimer);
        }
        state.resizeTimer = setTimeout(() => {
            if (typeof onResize === 'function') onResize();
        }, 120);
    });
}

/**
 * Binds stopPropagation to viewport control buttons to prevent canvas pan interference.
 * @param {Object|Array} buttons - Collection of button elements.
 */
export function bindViewportControlPropagationGuards(buttons) {
    const btnList = Array.isArray(buttons) ? buttons : Object.values(buttons);
    btnList.forEach((button) => {
        if (!button) return;
        button.addEventListener('mousedown', (event) => { event.stopPropagation(); });
        button.addEventListener('touchstart', (event) => { event.stopPropagation(); }, { passive: true });
    });
}

/**
 * Binds the click handler for the Focus Selected button.
 * @param {HTMLElement} focusBtn - The button element.
 * @param {Function} getSelectedId - Callback to retrieve the currently selected node ID.
 * @param {Function} onFocusSelected - Callback to trigger focus on a specific node ID.
 */
export function bindFocusSelectedControl(focusBtn, getSelectedId, onFocusSelected) {
    if (!focusBtn) return;
    focusBtn.addEventListener('click', () => {
        const selectedId = typeof getSelectedId === 'function' ? getSelectedId() : null;
        if (selectedId && typeof onFocusSelected === 'function') {
            onFocusSelected(selectedId);
        }
    });
}

/**
 * Binds the click handler for the Recenter button.
 * @param {HTMLElement} recenterBtn - The button element.
 * @param {Function} onRecenter - Callback to trigger the recenter logic.
 */
export function bindRecenterControl(recenterBtn, onRecenter) {
    if (!recenterBtn) return;
    recenterBtn.addEventListener('click', () => {
        if (typeof onRecenter === 'function') {
            onRecenter();
        }
    });
}

/**
 * Binds the zoom in/out button events.
 * @param {HTMLElement} zoomInBtn - The zoom in button element.
 * @param {HTMLElement} zoomOutBtn - The zoom out button element.
 * @param {Function} onZoom - Callback to trigger zoom logic with a factor.
 */
export function bindZoomControls(zoomInBtn, zoomOutBtn, onZoom) {
    if (zoomInBtn && typeof onZoom === 'function') {
        zoomInBtn.addEventListener('click', () => { onZoom(1.01); });
    }
    if (zoomOutBtn && typeof onZoom === 'function') {
        zoomOutBtn.addEventListener('click', () => { onZoom(0.99); });
    }
}

/**
 * Fallback orchestration for binding all viewport control buttons
 * when the external canvasViewport.bindControls delegate is unavailable.
 * @param {Object} options
 * @param {Object} options.viewportState - Viewport state (controlsBound flag).
 * @param {Function} options.getSelectedMemoryId - Returns currently selected memory ID.
 * @param {Function} options.focusNodeById - Focuses on a node by ID.
 * @param {Function} options.recenterViewport - Recenters the viewport.
 * @param {Function} options.zoomBy - Zooms by a factor.
 * @returns {boolean} True if controls were bound, false if already bound.
 */
export function bindViewportControlsFallback(options) {
    const {
        viewportState,
        getSelectedMemoryId,
        focusNodeById,
        recenterViewport,
        zoomBy
    } = options;

    if (viewportState.controlsBound) return false;
    viewportState.controlsBound = true;

    const buttons = getViewportControlButtons();
    const { focusBtn, recenterBtn, zoomInBtn, zoomOutBtn } = buttons;

    bindViewportControlPropagationGuards(buttons);

    bindFocusSelectedControl(
        focusBtn,
        getSelectedMemoryId,
        focusNodeById
    );

    bindRecenterControl(recenterBtn, recenterViewport);
    bindZoomControls(zoomInBtn, zoomOutBtn, zoomBy);

    return true;
}

/**
 * Binds keyboard shortcuts on a node element to trigger selection and optional
 * previous/next keyboard navigation.
 * @param {HTMLElement} nodeEl - The memory node element.
 * @param {Function} onSelect - Callback to trigger when Enter/Space is pressed.
 * @param {Object} [options]
 * @param {Function} [options.onArrowNavigate]
 * @param {Function} [options.shouldHandleArrowNavigation]
 */
export function bindNodeControlShortcuts(nodeEl, onSelect, options = {}) {
    if (!nodeEl) return;
    const onArrowNavigate = options.onArrowNavigate;
    const shouldHandleArrowNavigation = options.shouldHandleArrowNavigation;

    nodeEl.addEventListener('keydown', (e) => {
        if (
            (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown')
            && typeof onArrowNavigate === 'function'
        ) {
            if (typeof shouldHandleArrowNavigation === 'function' && !shouldHandleArrowNavigation(e)) {
                return;
            }
            const offset = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
            e.preventDefault();
            e.stopPropagation();
            onArrowNavigate(offset, e);
            return;
        }

        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof onSelect === 'function') onSelect();
    });
}

/**
 * Binds hover and focus events on a node element to trigger affordance rendering.
 * @param {HTMLElement} nodeEl - The memory node element.
 * @param {Object} mem - The memory data object.
 * @param {Function} onHover - Callback to trigger affordance render.
 */
export function bindNodeHoverAffordance(nodeEl, mem, onHover) {
    if (!nodeEl || typeof onHover !== 'function') return;
    nodeEl.addEventListener('mouseenter', () => {
        onHover(mem);
    });
    nodeEl.addEventListener('focusin', () => {
        onHover(mem);
    });
}

/**
 * Binds pointer selection events (click, touch) to trigger memory selection.
 * @param {HTMLElement} nodeEl - The memory node element.
 * @param {Object} options - Handlers and configuration.
 * @param {Function} options.onSelect - Callback to trigger memory selection.
 * @param {Function} options.onHover - Callback to trigger affordance on touch start.
 * @param {Object} options.mem - The memory data object.
 * @param {number} [options.tapThreshold=6] - The threshold for touch tap vs drag.
 */
export function bindNodePointerSelection(nodeEl, options) {
    if (!nodeEl) return;
    const { onSelect, onHover, mem, tapThreshold = 6 } = options;
    let touchStartPoint = null;

    nodeEl.addEventListener('click', (e) => {
        if (nodeEl.dataset.skipNextClick === '1') {
            nodeEl.dataset.skipNextClick = '';
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (nodeEl.dataset.suppressClick === '1') {
            nodeEl.dataset.suppressClick = '';
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof onSelect === 'function') onSelect();
    });

    nodeEl.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        touchStartPoint = { x: touch.clientX, y: touch.clientY };
        if (typeof onHover === 'function') onHover(mem);
    }, { passive: true });

    nodeEl.addEventListener('touchend', (e) => {
        if (!touchStartPoint) return;
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) {
            touchStartPoint = null;
            return;
        }
        const dx = touch.clientX - touchStartPoint.x;
        const dy = touch.clientY - touchStartPoint.y;
        touchStartPoint = null;
        if (Math.abs(dx) > tapThreshold || Math.abs(dy) > tapThreshold) return;
        e.preventDefault();
        e.stopPropagation();
        nodeEl.dataset.skipNextClick = '1';
        if (typeof onSelect === 'function') onSelect();
    }, { passive: false });

    nodeEl.addEventListener('touchcancel', () => {
        touchStartPoint = null;
    });
}

/**
 * Binds mouse down event on a node to initiate drag.
 * @param {HTMLElement} nodeEl - The memory node element.
 * @param {Function} getLayoutMode - Function returning current layout mode ('structured' or 'free').
 * @param {Function} onDragStart - Callback executed to begin the drag operation.
 */
export function bindNodeDragStart(nodeEl, getLayoutMode, onDragStart) {
    if (!nodeEl) return;

    function handleDragStart(e) {
        const layoutMode = typeof getLayoutMode === 'function' ? getLayoutMode() : null;
        if (layoutMode === 'structured') return;

        if (typeof onDragStart === 'function') {
            onDragStart(e);
        }
    }

    nodeEl.addEventListener('mousedown', handleDragStart);
    nodeEl.addEventListener('pointerdown', handleDragStart);
}

/**
 * Checks if the drag distance exceeds the threshold for considering it a node drag movement.
 * @param {number} dx - The distance moved along the X axis.
 * @param {number} dy - The distance moved along the Y axis.
 * @param {number} threshold - The threshold distance (default: 6).
 * @returns {boolean} True if the threshold is exceeded, false otherwise.
 */
export function hasExceededNodeDragThreshold(dx, dy, threshold = 6) {
    return Math.abs(dx) > threshold || Math.abs(dy) > threshold;
}

/**
 * Resets the canvas UI state (class and cursor) after panning ends.
 * @param {HTMLElement} canvasEl - The canvas element.
 * @param {string} layoutMode - The current layout mode ('structured' or 'free').
 */
export function resetCanvasPanUI(canvasEl, layoutMode) {
    if (!canvasEl) return;
    canvasEl.classList.remove('panning');
    canvasEl.style.cursor = layoutMode === 'structured' ? 'default' : 'grab';
}

/**
 * Determines whether a mousedown event on the canvas should initiate panning.
 * Returns false if the event target is on a memory node, the add memory form,
 * or a growth affordance element (these should handle their own interactions).
 * @param {Event} event - The mousedown event.
 * @returns {boolean} True if canvas panning should start, false if blocked.
 */
export function shouldStartCanvasPan(event) {
    if (
        event.target.closest('.memory-node') ||
        event.target.closest('#addMemoryForm') ||
        event.target.closest('.memory-add-affordance')
    ) {
        return false;
    }
    return true;
}

/**
 * Updates the canvas background position during panning.
 * @param {HTMLElement} canvasEl - The canvas element.
 * @param {number} offsetX - The current pan offset X.
 * @param {number} offsetY - The current pan offset Y.
 */
export function updateCanvasPanBackgroundPosition(canvasEl, offsetX, offsetY) {
    if (!canvasEl) return;
    canvasEl.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
}

/**
 * Resets the cursor of a dragged memory node to 'grab' on mouseup.
 * @param {Document} documentRef - The document reference for DOM queries (pass `document`).
 * @param {string} draggedId - The data-memory-id of the dragged node.
 * @returns {HTMLElement|null} The dragged element if found, null otherwise.
 */
export function resetDraggedNodeCursor(documentRef, draggedId) {
    if (!documentRef || !draggedId) return null;
    const draggedEl = findMemoryNodeById(draggedId, documentRef);
    if (draggedEl) {
        draggedEl.style.cursor = 'grab';
    }
    return draggedEl;
}
