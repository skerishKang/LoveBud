// My Trees UI Runtime - Rendering Module
// Handles DOM rendering for tree list, tree cards, and UI state
import { $, $$ } from '../utils/dom.js';

/**
 * Render tree list from data
 */
export function renderTreeList(trees) {
  const container = $('#my-trees-container');
  if (!container) return;

  container.innerHTML = '';
  
  trees.forEach(tree => {
    const card = renderTreeCard(tree);
    container.appendChild(card);
  });
}

/**
 * Render single tree card
 */
export function renderTreeCard(tree) {
  const card = document.createElement('div');
  card.className = 'tree-card';
  card.dataset.treeId = tree.id;
  
  card.innerHTML = `
    <div class="tree-card-header">
      <h3 class="tree-title">${escapeHtml(tree.title || 'Untitled')}</h3>
      <span class="tree-updated">${formatDate(tree.updated_at)}</span>
    </div>
    <div class="tree-preview">${truncate(tree.preview || '', 100)}</div>
    <div class="tree-meta">
      <span class="tree-count">${tree.node_count || 0} nodes</span>
      ${tree.is_public ? '<span class="tree-public">Public</span>' : ''}
    </div>
  `;
  
  return card;
}

/**
 * Show loading state
 */
export function showLoading() {
  const container = $('#my-trees-container');
  if (container) {
    container.innerHTML = '<div class="loading">Loading trees...</div>';
  }
}

/**
 * Show empty state
 */
export function showEmpty() {
  const container = $('#my-trees-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No trees yet. Create your first tree!</p>
        <button id="create-tree-btn" class="btn-primary">Create Tree</button>
      </div>
    `;
  }
}

// Utility functions
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}