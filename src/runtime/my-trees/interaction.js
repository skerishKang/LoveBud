// My Trees UI Runtime - Interaction Module
// Handles user interactions, clicks, and state changes
import { renderTreeList, showLoading, showEmpty } from './rendering.js';

// Event delegation for tree list
export function setupTreeListHandlers() {
  const container = $('#my-trees-container');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const card = e.target.closest('.tree-card');
    if (!card) return;

    const treeId = card.dataset.treeId;
    
    // Open tree button
    if (e.target.matches('.tree-open-btn')) {
      await openTree(treeId);
    }
    
    // Delete tree button
    if (e.target.matches('.tree-delete-btn')) {
      await deleteTree(treeId);
    }
  });
}

// Open tree in editor
async function openTree(treeId) {
  window.location.href = `/editor?tree=${treeId}`;
}

// Delete tree with confirmation
async function deleteTree(treeId) {
  if (!confirm('Delete this tree? This cannot be undone.')) return;
  
  try {
    const res = await fetch(`/api/trees/${treeId}`, { method: 'DELETE' });
    if (res.ok) {
      // Remove from DOM
      const card = $(`.tree-card[data-tree-id="${treeId}"]`);
      if (card) card.remove();
    }
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

// Load trees from API
export async function loadTrees() {
  showLoading();
  
  try {
    const res = await fetch('/api/trees');
    const trees = await res.json();
    
    if (trees.length === 0) {
      showEmpty();
    } else {
      renderTreeList(trees);
    }
  } catch (err) {
    console.error('Load trees failed:', err);
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupTreeListHandlers();
    loadTrees();
  });
} else {
  setupTreeListHandlers();
  loadTrees();
}