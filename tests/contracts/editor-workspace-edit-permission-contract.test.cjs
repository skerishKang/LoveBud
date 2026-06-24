'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sourceContains(file, pattern) {
  const src = readSource(file);
  if (pattern instanceof RegExp) return pattern.test(src);
  return src.indexOf(pattern) !== -1;
}

// ── Shared permission helper ──────────────────────────────────────

test('0. shared helper file exists with correct API', () => {
  const src = readSource('js/shared/tree-workspace-permission.js');
  assert.ok(src.length > 0, 'shared helper must not be empty');
  assert.ok(
    src.indexOf('resolveTreeOwnerId') !== -1,
    'must export resolveTreeOwnerId'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'must export resolveTreeWorkspaceCanEdit'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'must attach to window.LoveBudTreeWorkspacePermission'
  );
});

test('0b. shared helper supports ownerId and owner_id fields', () => {
  const src = readSource('js/shared/tree-workspace-permission.js');
  assert.ok(
    src.indexOf('tree.ownerId') !== -1 || src.indexOf("tree['ownerId']") !== -1,
    'must read tree.ownerId'
  );
  assert.ok(
    src.indexOf('tree.owner_id') !== -1,
    'must read tree.owner_id for API shape compatibility'
  );
});

// ── editor.js: effectiveCanEdit via shared helper ─────────────────

test('1. editor.js computes effectiveCanEdit after tree load', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.indexOf('effectiveCanEdit') !== -1,
    'editor.js must define effectiveCanEdit'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'editor.js must use shared permission helper'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'editor.js must call resolveTreeWorkspaceCanEdit'
  );
});

test('2. editor.js defaults to readonly (canEdit: false) before tree load', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.indexOf("canEdit: false") !== -1,
    'editor.js must pass canEdit: false to shell applier (default readonly)'
  );
  assert.ok(
    !sourceContains('js/editor.js', 'canEdit,\n                log\n            });'),
    'must NOT pass raw URL canEdit to shell applier'
  );
});

test('3. mode toggle injection uses effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    /if\s*\(effectiveCanEdit\s*&&/.test(src),
    'Desktop mode toggle injection must use effectiveCanEdit'
  );
});

test('4. createEditorCanvas receives effectiveCanEdit', () => {
  assert.ok(
    sourceContains('js/editor.js', "canEdit: effectiveCanEdit"),
    'createEditorCanvas options must use effectiveCanEdit'
  );
});

test('5. createEditorMemoryActions receives effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  const matches = src.match(/canEdit:\s*effectiveCanEdit/g);
  assert.ok(
    matches && matches.length >= 3,
    'At least 3 downstream consumers must use effectiveCanEdit (got ' + (matches ? matches.length : 0) + ')'
  );
});

// ── mode=edit activation gated by effectiveCanEdit ────────────────

test('5b. mode=edit activation is gated by effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  // mode=edit must be gated on effectiveCanEdit, not raw canEdit
  assert.ok(
    src.indexOf("mode === 'edit' && effectiveCanEdit") !== -1,
    'mode=edit activation must require effectiveCanEdit'
  );
});

// ── Public viewer topbar ─────────────────────────────────────────

test('6. public viewer topbar has 보기|편집 mode group', () => {
  const src = readSource('js/viewer/public-viewer-canvas-topbar-template.js');
  assert.ok(
    src.indexOf('viewerModeGroup') !== -1,
    'Topbar must have viewerModeGroup container'
  );
  assert.ok(
    src.indexOf('viewerModeViewBtn') !== -1,
    'Topbar must have view mode button'
  );
  assert.ok(
    src.indexOf('viewerModeEditBtn') !== -1,
    'Topbar must have edit mode CTA button'
  );
});

// ── public-canvas-init: shared helper integration ────────────────

test('7. public-canvas-init uses shared permission helper', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('updateOwnerModeUI') !== -1,
    'Must have updateOwnerModeUI'
  );
  assert.ok(
    src.indexOf('viewerModeGroup') !== -1,
    'Must reference viewerModeGroup'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'Must use shared helper LoveBudTreeWorkspacePermission'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'Must call resolveTreeWorkspaceCanEdit'
  );
});

// ── Viewer sidebar ───────────────────────────────────────────────

test('8. viewer sidebar populates rich flow summary', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('viewerSidebarSummary') !== -1,
    'Must reference viewerSidebarSummary element'
  );
  assert.ok(
    src.indexOf('preview-summary-line') !== -1,
    'Must render rich summary with preview-summary-line class'
  );
  assert.ok(
    src.indexOf('treeData.description') !== -1 || src.indexOf('description || treeData.summary') !== -1,
    'Must use description/summary fallback chain'
  );
  assert.ok(
    src.indexOf("style.display = 'none'") !== -1,
    'Must hide summary element when no description available'
  );
});

test('8b. sidebar moment count excludes canonical root', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf("m.id !== 'root'") !== -1,
    'Must exclude root placeholder (id !== root) from count'
  );
  assert.ok(
    src.indexOf("m.id !== m.parentId") !== -1,
    'Must exclude self-referential root from count'
  );
});

// ── Detail tree meta: edit CTAs removed ──────────────────────────

test('9. detail tree meta has no edit CTA buttons', () => {
  const src = readSource('js/viewer/public-viewer-detail-tree-meta.js');
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'editBtn'),
    'Must NOT create editBtn in buildTreeMetaRenderModel'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'vv-edit-btn-dynamic'),
    'Must NOT have dynamic edit button class'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'registerOnAuthReady'),
    'Must NOT register auth callback for edit CTA injection'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'apiFetch(\'/trees/'),
    'Must NOT re-fetch tree for edit CTA injection'
  );
});

// ── Editor startup context ───────────────────────────────────────

test('10. editor-startup-context preserves URL source for canEdit hint', () => {
  const src = readSource('js/editor/editor-startup-context.js');
  assert.ok(
    src.indexOf("params.get('readonly')") !== -1,
    'Startup context still reads readonly from URL'
  );
  assert.ok(
    src.indexOf("params.get('mode')") !== -1,
    'Startup context still reads mode from URL'
  );
});

// ── Autoplay and reactions guard preservation ────────────────────

test('11. viewer detail UI preserves autoplay and reactions guards', () => {
  const src = readSource('js/viewer/public-viewer-detail-ui.js');
  // Verify existing guardrail patterns are still present
  assert.ok(
    src.indexOf('createPublicViewerReadOnlyReactionSummaryBoundary') !== -1,
    'Must preserve read-only reaction summary boundary'
  );
  assert.ok(
    src.indexOf('applyReadOnlyReactionFallback') !== -1,
    'Must preserve read-only reaction fallback function'
  );
  assert.ok(
    src.indexOf('is-public-readonly') !== -1,
    'Must preserve is-public-readonly CSS class'
  );
  assert.ok(
    src.indexOf('buildYouTubeEmbedUrl') !== -1,
    'Must preserve YouTube embed URL builder'
  );
  assert.ok(
    src.indexOf('data-editor-detail-player') !== -1,
    'Must preserve inline player guard attribute'
  );
});
