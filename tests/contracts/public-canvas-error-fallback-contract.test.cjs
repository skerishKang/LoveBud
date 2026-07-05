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

test('4. public-canvas-init.js uses local handlePublicCanvasLoadFailure that delegates to fallback namespace', () => {
  const initSrc = fs.readFileSync(INIT_PATH, 'utf8');

  // appendMissingRouteState call site
  const missingRouteCall = 'window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState()';
  assert.ok(
    initSrc.includes(missingRouteCall),
    'initPublicCanvas must delegate to fallback namespace for appendMissingRouteState'
  );

  // Local handlePublicCanvasLoadFailure must exist
  const localHandlerExists = 'function handlePublicCanvasLoadFailure(error)';
  assert.ok(
    initSrc.includes(localHandlerExists),
    'public-canvas-init.js must define a local load failure cleanup handler'
  );

  // Local handler must check for fallback namespace delegation
  const fallbackLookupExpression = 'window.LoveBudPublicCanvasErrorFallback';
  assert.ok(
    initSrc.includes(fallbackLookupExpression),
    'local handlePublicCanvasLoadFailure must check for fallback namespace'
  );

  // Local handler must call fallback.handlePublicCanvasLoadFailure when present
  const fallbackDelegation = 'fallback.handlePublicCanvasLoadFailure(error)';
  assert.ok(
    initSrc.includes(fallbackDelegation),
    'local handler must delegate to fallback when present'
  );

  // Promise rejection must route through the local handler, not a global direct jump
  const catchBinding = '}).catch(handlePublicCanvasLoadFailure);';
  assert.ok(
    initSrc.includes(catchBinding),
    'promise rejection must route through the local catch wrapper'
  );

  // Must not use old direct catch expression in .catch()
  // The old pattern was .catch(window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure)
  // which is now replaced by .catch(handlePublicCanvasLoadFailure) through local handler delegation
  const oldDirectCatchPattern = 'window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure';
  assert.ok(
    !initSrc.includes(oldDirectCatchPattern),
    'source must not use old direct catch expression — local handler replaces it'
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
    'docs/architecture/lovebud-page-loaded-global-bridge-observations.md',
    // #3022 editor video-focus view
    'pages/editor.html',
    'css/editor/editor-video-focus-view.css',
    'js/editor/editor-video-focus-view.js',
    'tests/contracts/editor-video-focus-view-contract.test.cjs',

    // #3075 visitor viewer read-only moment social affordance
    'css/visitor-viewer/visitor-viewer-panel/moment-actions.css',
    'js/visitor-viewer/visitor-viewer-panels.js',
    'tests/contracts/visitor-viewer-panel-css-contracts.test.cjs',

    // #3135 public Viewer read-only social count
    'css/visitor-viewer/visitor-viewer-panel/moment-actions.css',
    'js/viewer/viewer-share-export-bridge.js',
    'tests/contracts/viewer-share-export-bridge-contract.test.cjs',

    // #3142 editor animation/mode transition clarity
    'css/editor/editor-view-edit-mode-transition.css',
    'js/editor/editor-interaction-mode.js',
    'js/editor/editor-mode-clarity.js',
    'tests/contracts/editor-mode-clarity-contract.test.cjs',

    // #3143 mobile card spacing
    'css/my-trees/my-trees-card-spacing.css',
    'tests/contracts/my-trees-card-spacing-contract.test.cjs',

    // #3141 My Trees / Browse shared rhythm
    'css/my-trees/my-trees-browse-shared-structure.css',
    'tests/contracts/my-trees-browse-shared-structure-contract.test.cjs',

    // #2972 viewer/editor detail media boundary
    'js/viewer/public-viewer-detail-builders.js',
    'tests/contracts/viewer-detail-media-boundary-contract.test.cjs',

    // #2981 shared state taxonomy
    'docs/frontend/shared-state-taxonomy-contract.md',

    // #3006 production a11y audit
    'docs/a11y/production-audit-output-contract.md',

    // #2956 extract moment-create API
    'js/editor/editor-moment-create-api.js',
    'tests/contracts/editor-moment-create-api-contract.test.cjs',

    // #2965 editor mobile canvas interaction
    'js/editor/editor-mobile-canvas-interaction.js',
    'tests/contracts/editor-mobile-canvas-interaction-contract.test.cjs',

    // #3072 editor mobile responsive audit
    'docs/editor/editor-mobile-responsive-audit.md',

    // #2976 dynamic UI copy audit
    'tests/contracts/dynamic-ui-copy-audit-contract.test.cjs',

    // #2979 YouTube metadata suggestion
    'js/editor/editor-youtube-metadata-suggestion.js',
    'tests/contracts/editor-youtube-metadata-suggestion-contract.test.cjs',

    // #2991 iOS Safari scroll restoration
    'tests/contracts/ios-scroll-restoration-contract.test.cjs',

    // #3142 focus animation timing
    'css/editor/moment-focus-animation.css',
    'tests/contracts/moment-focus-animation-contract.test.cjs',

    // #3075 moment likes/comments actionable
    'tests/contracts/viewer-social-actionable-contract.test.cjs',
    'css/editor/editor-overrides.css',
    'css/editor.css',
    'js/viewer/public-canvas-bridge.js',
    'js/viewer/public-canvas-error-fallback.js',
    'js/viewer/public-canvas-init.js',
    'js/viewer/public-viewer-detail-ui.js',
    'js/viewer/public-viewer-detail-view-mode-template.js',
    'js/viewer/public-viewer-canvas-entry.js',
    'js/viewer/templates/public-viewer-sidebar-template.js',
    'pages/view.html',
    'tests/contracts/public-canvas-error-fallback-contract.test.cjs',
    'tests/routes/public-viewer-script-dependency-guard.test.cjs',
    'tests/contracts/localization-key-display-contract.test.cjs',
    'tests/contracts/localization-key-predicate-contract.test.cjs',
    'tests/contracts/public-viewer-reaction-safe-fallback-contract.test.cjs',
    'tests/contracts/public-viewer-read-only-social-summary-contract.test.cjs',
    'tests/contracts/public-viewer-authenticated-like-contract.test.cjs',

    // #3213 public Tree Workspace auth bootstrap
    'pages/public-canvas.html',
    'tests/contracts/public-canvas-auth-bootstrap-contract.test.cjs',
    'tests/routes/public-canvas-direct-load-moment-count-regression.test.cjs',
    'tests/routes/public-canvas-loading-state-contract.test.cjs',
    'tests/routes/public-viewer-reactions-contract.test.cjs',
    'tests/routes/public-viewer-detail-ui-core-contract.test.cjs',
    'tests/routes/public-viewer-focus-contract.test.cjs',
    'tests/routes/public-viewer-sidebar-contract.test.cjs',

    // #3175 public moment social read contract
    'js/postgres-client.js',
    'modal_compute/public_reads.py',
    'modal_compute/reactions.py',
    'modal_compute/comments.py',
    'modal_compute/app.py',
    'functions/api/trees/[tree_id]/memories/[memory_id]/reactions.js',
    'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js',
    'tests/contracts/public-moment-social-read-contract.test.cjs',
    'tests/contracts/comments-reactions-access-contract.test.cjs',

    // #3177 harden authenticated moment social writes
    'modal_compute/write_validation.py',
    'modal_compute/social_idempotency.py',
    'modal_compute/social_rate_limit.py',
    'modal_compute/social_write_audit.py',
    'functions/api/memories/[id]/reactions.js',
    'functions/api/memories/[id]/comments.js',
    'tests/contracts/moment-social-write-hardening-contract.test.cjs',
    'tests/contracts/moment-social-write-migration-contract.test.cjs',
    'scripts/migration-harden-moment-social-writes.sql',
    'docs/ops/moment-social-write-hardening-migration-runbook.md',
    // #3178 Do not send tree IDs to moment reaction endpoint
    'js/my-trees/my-trees-preview-hub.js',
    'tests/contracts/my-trees-preview-hub.test.cjs',
    'tests/contracts/comments-reactions-access-contract.test.cjs',
    'tests/contracts/moment-social-write-hardening-contract.test.cjs',

    // #3201 moment social write readiness gate
    'docs/product/lovebud-moment-social-write-readiness-contract.md',
    'tests/contracts/moment-social-write-readiness-contract.test.cjs',

    // #3231 authenticated comment composer
    'tests/contracts/public-viewer-authenticated-comment-composer-contract.test.cjs',

    // #3241 split public social boundaries from detail-ui
    'js/viewer/public-viewer-read-only-social-summary.js',
    'tests/contracts/public-viewer-social-boundary-split-contract.test.cjs',
    'tests/contracts/authenticated-moment-comment-write-boundary-audit-contract.test.cjs',
    'tests/contracts/editor-viewer-selected-moment-media-play-contract.test.cjs',
    'tests/contracts/editor-workspace-edit-permission-contract.test.cjs',
    'tests/routes/public-viewer-tags-contract.test.cjs',
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
