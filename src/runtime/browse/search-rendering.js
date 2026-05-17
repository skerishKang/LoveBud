// Browse search UI - Rendering module
import { $, $$ } from '../utils/dom.js';

export function renderSearchResults(results) {
  const container = $('#search-results');
  if (!container) return;
  
  container.innerHTML = results.map(item => `
    <div class="search-result" data-id="${item.id}">
      <h3>${item.title}</h3>
      <p>${item.description || ''}</p>
    </div>
  `).join('');
}

export function showSearchLoading() {
  const container = $('#search-results');
  if (container) container.innerHTML = '<div class="loading">Searching...</div>';
}

export function showSearchEmpty() {
  const container = $('#search-results');
  if (container) container.innerHTML = '<div class="empty">No results found</div>';
}