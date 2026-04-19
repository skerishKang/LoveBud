const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const NETLIFY_TOML = path.join(ROOT, 'netlify.toml');

function readToml() {
  return fs.readFileSync(NETLIFY_TOML, 'utf8');
}

function hasRedirect(toml, from, to) {
  // Split by [[redirects]] blocks and find matching from->to pair
  const blocks = toml.split('[[redirects]]');
  
  for (const block of blocks) {
    const hasFrom = block.includes(`from = "${from}"`) || block.includes(`from = '${from}'`);
    const hasTo = block.includes(`to = "${to}"`) || block.includes(`to = '${to}'`);
    
    if (hasFrom && hasTo) return true;
  }
  
  return false;
}

test('netlify api routes map to the expected serverless functions', () => {
  const toml = readToml();

  const requiredApiRoutes = [
    ['/api/trees', '/.netlify/functions/trees'],
    ['/api/trees/:treeId', '/.netlify/functions/tree-detail'],
    ['/api/memories', '/.netlify/functions/memories'],
    ['/api/memories/:memoryId', '/.netlify/functions/memory-detail'],
    ['/api/community/trees', '/.netlify/functions/community-trees'],
    ['/api/community/memories', '/.netlify/functions/community-memories'],
  ];

  for (const [from, to] of requiredApiRoutes) {
    assert.equal(
      hasRedirect(toml, from, to),
      true,
      `missing API redirect: ${from} -> ${to}`
    );
  }
});