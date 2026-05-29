const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function getScriptSrcs() {
  const html = fs.readFileSync('pages/view.html', 'utf8');
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)]
    .map((match) => String(match[1] || '').split('?')[0]);
}

function hasScript(scripts, needle) {
  return scripts.some((src) => src.includes(needle));
}

test('public view does not load shared normalize utility prelude', () => {
  const scripts = getScriptSrcs();

  assert.equal(
    hasScript(scripts, 'js/utils/normalize.js'),
    false,
    'view.html must not load utils/normalize.js on the public viewer route'
  );
  assert.ok(
    hasScript(scripts, 'js/viewer/public-canvas-bridge.js'),
    'public viewer must keep the public canvas bridge that owns route-specific normalization'
  );
});

test('public canvas bridge owns public viewer normalization locally', () => {
  const bridgeSrc = fs.readFileSync('js/viewer/public-canvas-bridge.js', 'utf8');

  assert.ok(
    bridgeSrc.includes('function normalizeForCanvas'),
    'public canvas bridge must expose normalizeForCanvas for route-specific normalization'
  );
  assert.ok(
    bridgeSrc.includes('window.currentTreeData = treeData'),
    'public canvas bridge must still set currentTreeData for the shared canvas runtime'
  );
  assert.ok(
    bridgeSrc.includes('window.currentTreeMemories = normalizedMemories'),
    'public canvas bridge must still set currentTreeMemories for the shared canvas runtime'
  );
  assert.equal(
    bridgeSrc.includes('LoveBudNormalize'),
    false,
    'public canvas bridge must not depend on the shared LoveBudNormalize utility for public viewer normalization'
  );
});
