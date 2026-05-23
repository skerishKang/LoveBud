/**
 * UI helpers for the Editor Canvas.
 * Focuses on DOM manipulations and simple UI state updates.
 */

/**
 * Updates the layout toggle button UI based on the current layout mode.
 */
export function updateLayoutToggleUI(layoutMode, i18n) {
    const toggleBtn = document.getElementById('layoutModeToggleBtn');
    const toggleLabel = document.getElementById('layoutModeToggleLabel');
    const toggleIcon = document.getElementById('layoutModeToggleIcon');
    if (!toggleBtn) return;
    
    const isStructured = layoutMode === 'structured';
    toggleBtn.classList.toggle('is-active', isStructured);
    
    if (toggleLabel) {
        toggleLabel.textContent = isStructured
            ? (i18n('editor_layout_structured') || '정리된 트리')
            : (i18n('editor_layout_free') || '자유 배치');
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
