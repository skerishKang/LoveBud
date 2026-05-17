// Public Tree Viewer Runtime - Viewer Module
// Handles tree display, node rendering, and viewer interactions

// Tree viewer state
let currentTreeId = null;
let currentTreeData = null;

// Initialize viewer for a tree
export function initTreeViewer(treeId) {
  currentTreeId = treeId;
  return loadTreeData(treeId);
}

// Load tree data from API
async function loadTreeData(treeId) {
  try {
    const res = await fetch(`/api/public/trees/${treeId}`);
    if (!res.ok) throw new Error('Failed to load tree');
    currentTreeData = await res.json();
    return currentTreeData;
  } catch (err) {
    console.error('Tree load error:', err);
    return null;
  }
}

// Render tree nodes
export function renderTreeNodes(nodes) {
  const container = $('#tree-nodes-container');
  if (!container) return;
  
  container.innerHTML = nodes.map(node => `
    <div class="tree-node" data-node-id="${node.id}">
      <h3>${node.title || 'Untitled'}</h3>
      <p>${node.memo || ''}</p>
    </div>
  `).join('');
}

// Navigate to node
export function navigateToNode(nodeId) {
  window.location.hash = `#node-${nodeId}`;
}