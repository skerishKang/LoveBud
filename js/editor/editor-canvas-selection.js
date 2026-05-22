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
    const doc = documentRef || document;
    const selectedEl = doc.querySelector(`.memory-node[data-memory-id="${selectedNodeId}"]`);
    if (selectedEl) {
        selectedEl.classList.add('selected');
    }
}

