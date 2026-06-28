/**
 * Safely finds a memory node DOM element by its canonical ID.
 * Uses collection iteration instead of CSS selector interpolation.
 *
 * @param {*} memoryId - The memory ID to look for (coerced to string).
 * @param {Document} [documentRef] - The document context (defaults to global document).
 * @returns {HTMLElement|null} - The matching .memory-node element, or null.
 */
export function findMemoryNodeById(memoryId, documentRef) {
    if (memoryId === null || memoryId === undefined) return null;
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return null;
    const expectedId = String(memoryId);
    var nodes = doc.querySelectorAll('.memory-node');
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node && node.dataset && node.dataset.memoryId === expectedId) {
            return node;
        }
    }
    return null;
}

// Global namespace for classic-script consumers (e.g. editor-memory-form.js)
if (typeof window !== 'undefined' && window) {
    window.LoveBudEditorCanvasSelection = window.LoveBudEditorCanvasSelection || {};
    window.LoveBudEditorCanvasSelection.findMemoryNodeById = findMemoryNodeById;
}

/**
 * Gets the currently selected memory ID from the DOM.
 * @param {Document} documentRef - The document context
 * @returns {string|null} - The selected memory ID, or null if none
 */
export function getSelectedMemoryId(documentRef) {
    const doc = documentRef || document;
    const selectedEl = doc.querySelector('.memory-node.selected');
    return selectedEl ? selectedEl.dataset.memoryId : null;
}

/**
 * Gets the full memory object for the currently selected node.
 * @param {Document} documentRef - The document context
 * @param {Array} treeMemories - The current array of tree memories
 * @returns {Object|null} - The memory object, or null if none
 */
export function getSelectedMemory(documentRef, treeMemories) {
    const selectedId = getSelectedMemoryId(documentRef);
    if (!selectedId) return null;
    return treeMemories.find((m) => m.id === selectedId) || null;
}

/**
 * Applies the 'selected' class to a memory node in the DOM.
 * @param {string} selectedNodeId - The ID of the node to select
 * @param {Document} documentRef - The document context
 */
export function reapplySelection(selectedNodeId, documentRef) {
    if (!selectedNodeId) return;
    const selectedEl = findMemoryNodeById(selectedNodeId, documentRef);
    if (selectedEl) {
        selectedEl.classList.add('selected');
    }
}
