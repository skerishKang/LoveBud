'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const editorJs = path.join(ROOT, 'js/editor.js');
const editorStartupContextJs = path.join(ROOT, 'js/editor/editor-startup-context.js');
const treeWorkspacePermissionJs = path.join(ROOT, 'js/shared/tree-workspace-permission.js');

function readSource(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function runInSandbox(code, sandbox) {
  sandbox.window = sandbox.window || {};
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
}

test('editor-startup-context: readonly=1 URL parameter sets canEdit=false', () => {
  const src = readSource('js/editor/editor-startup-context.js');
  assert.ok(
    src.includes("params.get('readonly')"),
    'must read readonly param'
  );
  assert.ok(
    src.includes("canEdit = params.get('readonly') !== '1'"),
    'readonly=1 must yield canEdit=false'
  );
});

test('tree-workspace-permission: requestedReadOnly option blocks edit even for owner', () => {
  const sandbox = {
    window: {
      LoveTreeAuthPolicy: {
        hasConfirmedAuthSession: () => true,
        getCachedAuthUser: () => ({ uid: 'user123' })
      }
    }
  };
  runInSandbox(readSource('js/shared/tree-workspace-permission.js'), sandbox);

  const perm = sandbox.window.LoveBudTreeWorkspacePermission;
  const tree = { id: 'tree1', ownerId: 'user123', viewerCanEdit: true, _viewerCapabilityAuthUid: 'user123' };

  assert.equal(
    perm.resolveTreeWorkspaceCanEdit(tree),
    true,
    'owner with viewerCanEdit=true should be editable'
  );

  assert.equal(
    perm.resolveTreeWorkspaceCanEdit(tree, { requestedReadOnly: true }),
    false,
    'owner with requestedReadOnly=true must be read-only'
  );
});

test('editor.js: initial shell starts readonly (canEdit: false)', () => {
  const src = readSource('js/editor.js');
  const shellIdx = src.indexOf('createEditorStartupShellApplier({');
  const block = src.slice(shellIdx, src.indexOf('});', shellIdx) + 2);
  assert.ok(
    block.includes('canEdit: false'),
    'startup shell must receive canEdit: false'
  );
  const canEditMatches = block.match(/canEdit:\s*(false|true|canEdit)/g) || [];
  assert.ok(
    canEditMatches.length === 1 && canEditMatches[0].includes('false'),
    'must ONLY pass canEdit: false to startup shell, not URL canEdit'
  );
});

test('editor.js: effectiveCanEdit computed after tree load with requestedReadOnly', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.includes('requestedReadOnly'),
    'must reference requestedReadOnly variable'
  );
  assert.ok(
    src.includes('requestedReadOnly: requestedReadOnly'),
    'must pass requestedReadOnly to resolveTreeWorkspaceCanEdit'
  );
});

test('editor.js: always applies editability state after tree load (no comparison guard)', () => {
  const src = readSource('js/editor.js');
  const treeIdIdx = src.indexOf('const treeId = initialLoadResult.treeId;');
  const block = src.slice(treeIdIdx, src.indexOf('const normalizeMemory = initialLoadResult.normalizeMemory;', treeIdIdx));

  assert.ok(
    !block.includes('effectiveCanEdit !== (canEdit !== false)'),
    'must NOT contain comparison guard that prevents reconciliation'
  );

  assert.ok(
    block.includes('applyEditorEditabilityState({ canEdit: effectiveCanEdit })'),
    'must unconditionally apply editability state after tree load'
  );
});

test('editor.js: reconciliation handles owner + confirmed editable tree', () => {
  const src = readSource('js/editor.js');
  const treeIdIdx = src.indexOf('const treeId = initialLoadResult.treeId;');
  const block = src.slice(treeIdIdx, src.indexOf('const normalizeMemory = initialLoadResult.normalizeMemory;', treeIdIdx));

  assert.ok(
    block.includes('requestedReadOnly: requestedReadOnly'),
    'must pass requestedReadOnly to resolveTreeWorkspaceCanEdit after load'
  );
  assert.ok(
    block.includes('applyEditorEditabilityState({ canEdit: effectiveCanEdit })'),
    'must apply editability state unconditionally after tree load'
  );
});

test('editor.js: reconciliation handles explicit readonly=1', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.includes('var requestedReadOnly = canEdit === false;'),
    'must derive requestedReadOnly from URL canEdit'
  );
  assert.ok(
    src.includes('requestedReadOnly: requestedReadOnly'),
    'must pass requestedReadOnly to resolveTreeWorkspaceCanEdit'
  );
});

test('editor.js: reconciliation handles non-owner', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.includes('resolveTreeWorkspaceCanEdit'),
    'must call resolveTreeWorkspaceCanEdit for permission evaluation'
  );
});

test('editor.js: comparison guard regression test - no stale shortcut', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    !src.includes('effectiveCanEdit !== (canEdit !== false)'),
    'comparison guard that prevented reconciliation must be removed'
  );
});

test('editor.js: does NOT reintroduce #2937 auth-callback route policy', () => {
  const src = readSource('js/editor.js');
  // #2937 removed these from editor.js; #2938 must not bring them back.
  assert.ok(
    !src.includes('_editorAuthEditabilityCallbackRegistered'),
    'must NOT reintroduce _editorAuthEditabilityCallbackRegistered guard'
  );
  assert.ok(
    !src.includes('registerOnAuthReady'),
    'must NOT reintroduce registerOnAuthReady callback in editor.js'
  );
  assert.ok(
    !src.includes('window.location.href = myTreesHref'),
    'must NOT reintroduce forced my-trees redirect in editor.js'
  );
});

test('editor.js: shell state and namespace stay consistent', () => {
  const src = readSource('js/editor.js');
  const shellStartupSrc = readSource('js/editor/editor-shell-startup.js');
  assert.ok(
    shellStartupSrc.includes('editorNamespace.canEdit = canEdit'),
    'namespace.canEdit must be set'
  );
  assert.ok(
    shellStartupSrc.includes("classList.toggle('editor-readonly', !canEdit)"),
    'body.editor-readonly must be toggled'
  );
});