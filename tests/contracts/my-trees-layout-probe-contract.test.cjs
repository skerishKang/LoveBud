'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('My Trees page includes layout probe markup when hubLayoutProbe=1 is enabled', () => {
  const html = read('pages/my-trees.html');

  // probe slot exists and is hidden by default
  assert.match(html, /<button[^>]*class="[^"]*my-trees-hub-layout-probe-slot[^"]*"[^>]*hidden/, 'probe slot must exist with hidden attribute');

  // probe status exists and is hidden by default
  assert.match(html, /<div[^>]*class="[^"]*copy-status-text[^"]*"[^>]*hidden/, 'probe status must exist with hidden attribute');

  // probe slot has expected Browse mirror geometry
  assert.match(html, /<button[^>]*class="[^"]*btn-round[^"]*"[^>]*>[\s\S]*?content_copy[\s\S]*?내 러브트리로 가져오기/, 'probe slot must mirror Browse 4th action');
});

test('My Trees hub JS exposes probe slot only when URL query hubLayoutProbe=1', () => {
  const hubJs = read('js/my-trees/my-trees-preview-hub.js');

  // probe guard must exist
  assert.match(hubJs, /hubLayoutProbe=1/, 'hub JS must check hubLayoutProbe=1 query');
  assert.match(hubJs, /data-layout-probe-slot/, 'hub JS must target probe slot');
  assert.match(hubJs, /data-layout-probe-status/, 'hub JS must target probe status');

  // probe block must not reference copy handler attributes
  const probeBlockMatch = hubJs.match(/\/\* #2903 layout probe[\s\S]*?bindFlowToggle\(\);/);
  assert.ok(probeBlockMatch, 'probe guard must be wrapped in #2903 layout probe block');
  const probeBlock = probeBlockMatch[0];
  assert.ok(!probeBlock.includes('data-copy-public-tree'), 'probe block must not reference copy handler');
  assert.ok(!probeBlock.includes('addEventListener'), 'probe block must not attach click handler');
});
