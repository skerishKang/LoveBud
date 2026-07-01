/**
 * Focused contract test: public canvas error/fallback source split extraction.
 *
 * Verifies that the 6 error/fallback functions have been extracted from
 * public-canvas-init.js into public-canvas-error-fallback.js without
 * behavioral changes, and that the expected namespace and loading order
 * are preserved.
 *
 * Refs #3111, #3087, #3086, #2976, #1882
 * (not #2960, #2856, #3070, #3072, #2972, #2976 — those are separate)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FALLBACK_PATH = path.join(ROOT, 'js/viewer/public-canvas-error-fallback.js');
const INIT_PATH = path.join(ROOT, 'js/viewer/public-canvas-init.js');
const VIEW_HTML_PATH = path.join(ROOT, 'pages/view.html');

test('1. public-canvas-error-fallback.js exists', () => {
  assert.ok(fs.existsSync(FALLBACK_PATH), 'public-canvas-error-fallback.js must exist at js/viewer/');
});

test('2. window.LoveBudPublicCanvasErrorFallback namespace exposes exactly 6 functions', () => {
  const fallbackSrc = fs.readFileSync(FALLBACK_PATH, 'utf8');

  assert.ok(fallbackSrc.includes('window.LoveBudPublicCanvasErrorFallback = {'), 'namespace must be exported');

  const namespaceBlock = fallbackSrc.slice(
    fallbackSrc.indexOf('window.LoveBudPublicCanvasErrorFallback = {'),
    fallbackSrc.indexOf('});')
  );

  // Count the named exports
  const fnNames = [
    'escapeHtml',
    'createLoadFailureState',
    'createMissingRouteState',
    'appendMissingRouteState',
    'appendPublicLoadFailureState',
    'handlePublicCanvasLoadFailure'
  ];

  for (const name of fnNames) {
    assert.ok(
      namespaceBlock.includes(name + ':'),
      `namespace must export ${name}`
    );
  }

  // Count matches — ensure no extras
  const exportCount = (namespaceBlock.match(/: /g) || []).length;
  assert.equal(exportCount, 6, 'namespace must expose exactly 6 functions (no more, no less)');
});

test('3. pages/view.html loads fallback script before public-canvas-init.js', () => {
  const viewHtml = fs.readFileSync(VIEW_HTML_PATH, 'utf8');

  const fallbackPos = viewHtml.indexOf('public-canvas-error-fallback.js');
  const initPos = viewHtml.indexOf('public-canvas-init.js');

  assert.notEqual(fallbackPos, -1, 'fallback script must appear in view.html');
  assert.notEqual(initPos, -1, 'init script must appear in view.html');
  assert.ok(fallbackPos < initPos, 'fallback script must load before public-canvas-init.js');
});

test('4. public-canvas-init.js uses fallback namespace for appendMissingRouteState and handlePublicCanvasLoadFailure', () => {
  const initSrc = fs.readFileSync(INIT_PATH, 'utf8');

  // appendMissingRouteState call site
  const missingRouteCall = 'window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState()';
  assert.ok(
    initSrc.includes(missingRouteCall),
    'initPublicCanvas must delegate to fallback namespace for appendMissingRouteState'
  );

  // handlePublicCanvasLoadFailure call site
  const loadFailureCall = 'window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure';
  assert.ok(
    initSrc.includes(loadFailureCall),
    'initPublicCanvas .catch must delegate to fallback namespace for handlePublicCanvasLoadFailure'
  );
});

test('5. appendMissingRouteState appends to document.body', () => {
  const fallbackSrc = fs.readFileSync(FALLBACK_PATH, 'utf8');

  // In appendMissingRouteState, after creating the missing route state element,
  // it should append to document.body
  assert.ok(
    fallbackSrc.includes('document.body.appendChild(errEl)') ||
    fallbackSrc.includes('document.body.appendChild(err)'),
    'appendMissingRouteState must target document.body'
  );
});

test('6. handlePublicCanvasLoadFailure targets #canvasArea', () => {
  const fallbackSrc = fs.readFileSync(FALLBACK_PATH, 'utf8');

  assert.ok(
    fallbackSrc.includes("document.getElementById('canvasArea')") ||
    fallbackSrc.includes("document.getElementById(\"canvasArea\")"),
    'handlePublicCanvasLoadFailure must target #canvasArea'
  );
});

test('7. LoveBudPublicViewerCanvasEntry optional delegation boundary is preserved in new file', () => {
  const fallbackSrc = fs.readFileSync(FALLBACK_PATH, 'utf8');

  // Each of the 6 functions checks for the delegation boundary:
  // if (canvasEntry && typeof canvasEntry.<method> === 'function') ...
  const delegationPattern = 'window.LoveBudPublicViewerCanvasEntry';

  // escapeHtml
  assert.ok(
    fallbackSrc.includes('window.LoveBudSecurity'),
    'escapeHtml must delegate to window.LoveBudSecurity first'
  );

  // createLoadFailureState
  assert.ok(
    fallbackSrc.includes('canvasEntry && typeof canvasEntry.createLoadFailureState'),
    'createLoadFailureState must check canvasEntry delegation'
  );

  // createMissingRouteState
  assert.ok(
    fallbackSrc.includes('canvasEntry && typeof canvasEntry.createMissingRouteState'),
    'createMissingRouteState must check canvasEntry delegation'
  );

  // appendMissingRouteState — delegates via createMissingRouteState, so the inner
  // delegation chain is implicit. Check the outer boundary:
  assert.ok(
    fallbackSrc.includes('window.LoveBudPublicViewerCanvasEntry'),
    'appendMissingRouteState must reference LoveBudPublicViewerCanvasEntry'
  );

  // appendPublicLoadFailureState
  assert.ok(
    fallbackSrc.includes('canvasEntry && typeof canvasEntry.appendPublicLoadFailureState'),
    'appendPublicLoadFailureState must check canvasEntry delegation'
  );

  // handlePublicCanvasLoadFailure — delegates via appendPublicLoadFailureState
  // Check the top-level entry has the delegation
  assert.ok(
    fallbackSrc.includes('window.LoveBudPublicViewerCanvasEntry'),
    'handlePublicCanvasLoadFailure must reference LoveBudPublicViewerCanvasEntry'
  );
});

test('8. non-allowlisted files are not modified', () => {
  const allowlisted = [
    'js/viewer/public-canvas-bridge.js',
    'js/viewer/public-canvas-error-fallback.js',
    'js/viewer/public-canvas-init.js',
    'js/viewer/public-viewer-detail-ui.js',
    'js/viewer/templates/public-viewer-sidebar-template.js',
    'pages/view.html',
    'tests/contracts/public-canvas-error-fallback-contract.test.cjs',
    'tests/contracts/localization-key-display-contract.test.cjs',
    'tests/contracts/localization-key-predicate-contract.test.cjs',
    'tests/routes/public-canvas-direct-load-moment-count-regression.test.cjs',
    'tests/routes/public-canvas-loading-state-contract.test.cjs',
    'tests/routes/public-viewer-detail-ui-core-contract.test.cjs',
    'tests/routes/public-viewer-focus-contract.test.cjs',
    'tests/routes/public-viewer-sidebar-contract.test.cjs'
  ];

  // Read git diff to check what files are modified
  const { execSync } = require('node:child_process');
  const gitOutput = execSync('git diff --name-only HEAD', { encoding: 'utf8', cwd: ROOT });
  const modifiedFiles = gitOutput.split('\n').filter(Boolean);

  for (const file of modifiedFiles) {
    const isAllowlisted = allowlisted.some(a => file.endsWith(a) || file === a);
    assert.ok(
      isAllowlisted,
      `Modified file "${file}" is not in the allowlist — only these ${allowlisted.length} files may be changed`
    );
  }
});
