const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

const TRACKED_ASSETS = [
  'js/editor/editor-memory-actions.js',
  'js/editor/editor-bindings.js',
  'js/editor/editor-save-status.js',
  'js/editor/editor-save-status-ui.js',
  'js/editor/editor-save-status-orchestration.js'
];

function getSHA256First12(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12);
}

test('assert five tracked editor scripts have query-string version matching content SHA-256 fingerprint', () => {
  const htmlContent = fs.readFileSync(path.join(ROOT, 'pages/editor.html'), 'utf8');

  // Verify that all 5 tracked assets are actually loaded in editor.html
  for (const assetPath of TRACKED_ASSETS) {
    const expectedFingerprint = getSHA256First12(assetPath);
    
    // We expect something like: src="../js/editor/editor-memory-actions.js?v=6baf0b064db9"
    // Since page paths are relative to pages/, the src attribute is ../<assetPath>
    const regex = new RegExp(`src=["']\\.\\./${assetPath}\\?v=([^"']+)["']`);
    const match = htmlContent.match(regex);
    
    assert.ok(match, `pages/editor.html must load the script "../${assetPath}"`);
    const actualFingerprint = match[1];
    
    assert.strictEqual(
      actualFingerprint,
      expectedFingerprint,
      `Fingerprint mismatch for ${assetPath}. Expected ?v=${expectedFingerprint}, but found ?v=${actualFingerprint} in pages/editor.html`
    );
  }
});
