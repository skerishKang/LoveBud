// Public Tree Viewer Runtime - Interaction Module
// Handles user interactions for public tree viewing

import { navigateToNode, currentTreeData } from './viewer.js';

// Setup tree viewer interactions
export function setupTreeViewerInteractions() {
  const container = $('#tree-viewer-container');
  if (!container) return;

  // Node click handler
  container.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.tree-node');
    if (!nodeEl) return;
    
    const nodeId = nodeEl.dataset.nodeId;
    if (nodeId) {
      navigateToNode(nodeId);
    }
  });

  // Zoom controls
  const zoomIn = $('#zoom-in-btn');
  const zoomOut = $('#zoom-out-btn');
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => adjustZoom(1.1));
  }
  if (zoomOut) {
    zoomOut.addEventListener('click', () => adjustZoom(0.9));
  }
}

// Adjust viewer zoom
function adjustZoom(factor) {
  const viewer = $('.tree-viewer-canvas');
  if (!viewer) return;
  
  const currentScale = parseFloat(viewer.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1');
  viewer.style.transform = `scale(${currentScale * factor})`;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTreeViewerInteractions);
} else {
  setupTreeViewerInteractions();
}