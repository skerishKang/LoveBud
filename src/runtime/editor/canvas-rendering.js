// Editor canvas runtime - Rendering module
export function renderCanvasNodes(nodes) {
  const container = $('#editor-canvas');
  if (!container) return;
  
  container.innerHTML = nodes.map(n => `
    <div class="canvas-node" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px">
      ${n.title}
    </div>
  `).join('');
}

export function updateNodePosition(id, x, y) {
  const node = $(`.canvas-node[data-id="${id}"]`);
  if (node) {
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  }
}