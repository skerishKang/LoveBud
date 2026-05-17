// Editor canvas - Interaction module
import { updateNodePosition } from './canvas-rendering.js';

export function setupCanvasInteractions() {
  const canvas = $('#editor-canvas');
  if (!canvas) return;
  
  let selectedNode = null;
  
  canvas.addEventListener('click', (e) => {
    const node = e.target.closest('.canvas-node');
    if (node) {
      selectedNode = node.dataset.id;
      highlightNode(node);
    }
  });
}

function highlightNode(node) {
  $('.canvas-node.selected')?.classList.remove('selected');
  node.classList.add('selected');
}