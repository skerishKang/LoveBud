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
  const blocks = toml.split('[[redirects]]');
  
  for (const block of blocks) {
    const hasFrom = block.includes(`from = "${from}"`) || block.includes(`from = '${from}'`);
    const hasTo = block.includes(`to = "${to}"`) || block.includes(`to = '${to}'`);
    
    if (hasFrom && hasTo) return true;
  }
  
  return false;
}

test('netlify static page aliases map root pages to /pages/*.html', () => {
  const toml = readToml();

  const requiredAliases = [
    ['/intro.html', '/pages/intro.html'],
    ['/login.html', '/pages/login.html'],
    ['/search.html', '/pages/search.html'],
    ['/detail.html', '/pages/detail.html'],
    ['/editor.html', '/pages/editor.html'],
    ['/my-trees.html', '/pages/my-trees.html'],
  ];

  for (const [from, to] of requiredAliases) {
    assert.equal(
      hasRedirect(toml, from, to),
      true,
      `missing redirect: ${from} -> ${to}`
    );
  }
});