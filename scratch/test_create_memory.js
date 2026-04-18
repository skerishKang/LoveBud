const { createMemory, getTree } = require('../netlify/functions/_lib/doc-store');

async function test_memory() {
  try {
    // 1. Get the newly created tree (I assume there's at least one)
    const trees = await require('../netlify/functions/_lib/doc-store').queryTrees({ limit: 1 });
    if (!trees.length) {
      console.log("No trees found. Run test_create_tree.js first.");
      return;
    }
    const treeId = trees[0].id;
    console.log("Using treeId:", treeId);

    // 2. Create a memory (NMIXX DASH)
    const res = await createMemory({
      treeId: treeId,
      title: 'DASH',
      memo: 'NMIXX DASH is so cool!',
      timestamp: '2024.04.18',
      thumbnail: 'https://img.youtube.com/vi/pD1WBOit504/mqdefault.jpg',
      emotionTags: ['NMIXX', 'DASH']
    });
    console.log("Success creating memory:", res.id);

    // 3. Verify the tree payload
    const updatedTree = await getTree(treeId);
    console.log("Updated tree payload nodes count:", updatedTree.payload.nodes.length);
    console.log("Node details:", updatedTree.payload.nodes[0]);

  } catch (err) {
    console.error("Failed:", err);
  }
}

test_memory();
