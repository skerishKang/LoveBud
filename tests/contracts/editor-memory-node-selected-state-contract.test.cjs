const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_NODE_CSS = path.join(ROOT, 'css/editor/editor-memory-node.css');
const css = fs.readFileSync(MEMORY_NODE_CSS, 'utf8');

test('memory node selected state is visually calmer than hover state', () => {
  assert.match(css, /\.memory-node:hover \.node-card\s*\{[\s\S]*?transform:\s*scale\(1\.02\)/);
  assert.match(css, /\.memory-node:hover \.node-card\s*\{[\s\S]*?box-shadow:\s*0 12px 28px rgba\(144, 73, 81, 0\.10\)/);

  assert.match(css, /\.memory-node\.selected \.node-card\s*\{[\s\S]*?transform:\s*scale\(1\.01\)/);
  assert.match(css, /\.memory-node\.selected \.node-card\s*\{[\s\S]*?box-shadow:\s*0 10px 24px rgba\(144, 73, 81, 0\.09\)/);
});

test('memory node hover and selected states are not coupled to the same heavy rule', () => {
  assert.doesNotMatch(css, /\.memory-node:hover \.node-card,\s*\n\.memory-node\.selected \.node-card\s*\{[\s\S]*?transform:\s*scale\(1\.03\)/);
  assert.doesNotMatch(css, /\.memory-node\.selected \.node-card\s*\{[\s\S]*?box-shadow:\s*0 18px 40px/);
});

test('memory node base and new-node highlight affordances stay intact', () => {
  assert.match(css, /\.memory-node\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.node-card\s*\{[\s\S]*?width:\s*102px/);
  assert.match(css, /\.new-node-highlight \.node-card\s*\{[\s\S]*?animation:\s*newNodePulse 1\.5s ease-in-out 3/);
});

test('#3561 structured hover never clobbers node transform with none !important', () => {
  assert.doesNotMatch(
    css,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i
  );
  assert.match(css, /\.memory-node\s*\{[\s\S]*?min-width:\s*108px/);
});
