/**
 * Scout Read-Only Action Guard Contract Test
 * Issue #3212 — Refs #1882
 *
 * Verifies that the floating toolbar's Scout action is guarded in read-only trees:
 *   1. The dropdown module exposes isEditorReadOnly + syncScoutActionVisibility
 *   2. showDropdown re-syncs Scout visibility on open (dual guard §1)
 *   3. The Scout click handler re-checks editability before calling
 *      LoveBudScoutDraftUI.open (dual guard §2)
 *   4. In read-only trees, LoveBudScoutDraftUI.open is NEVER called
 *   5. Delete/share/focus actions are not affected by the guard
 *   6. No new global editability flag is introduced
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const dropdownPath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar-dropdown.js');
const toolbarPath = path.join(ROOT, 'js', 'editor', 'editor-floating-toolbar.js');
const dropdownSource = fs.readFileSync(dropdownPath, 'utf8');
const toolbarSource = fs.readFileSync(toolbarPath, 'utf8');

test('dropdown module exposes isEditorReadOnly and syncScoutActionVisibility helpers', () => {
  assert.match(dropdownSource, /isEditorReadOnly:\s*isEditorReadOnly/);
  assert.match(dropdownSource, /syncScoutActionVisibility:\s*syncScoutActionVisibility/);
  assert.match(dropdownSource, /function\s+isEditorReadOnly\s*\(/);
  assert.match(dropdownSource, /function\s+syncScoutActionVisibility\s*\(/);
});

test('isEditorReadOnly prioritizes window.LoveBudEditor.canEdit === false', () => {
  assert.match(
    dropdownSource,
    /window\.LoveBudEditor\s*&&\s*window\.LoveBudEditor\.canEdit\s*===\s*false/
  );
  assert.match(
    dropdownSource,
    /body\.classList\.contains\('editor-readonly'\)/
  );
});

test('showDropdown re-syncs Scout action visibility on open (dual guard §1)', () => {
  // showDropdown must call syncScoutActionVisibility before showing
  assert.match(dropdownSource, /syncScoutActionVisibility\(scoutAction\)/);
  // showDropdown signature accepts scoutAction
  assert.match(dropdownSource, /function\s+showDropdown\(dropdown,\s*moreBtn,\s*scoutAction\)/);
});

test('toggleDropdown passes scoutAction through to showDropdown', () => {
  assert.match(dropdownSource, /function\s+toggleDropdown\(dropdown,\s*moreBtn,\s*e,\s*scoutAction\)/);
  assert.match(dropdownSource, /showDropdown\(dropdown,\s*moreBtn,\s*scoutAction\)/);
});

test('Scout click handler re-checks editability before opening (dual guard §2)', () => {
  // Find the scoutAction click handler block
  const scoutHandlerStart = dropdownSource.indexOf("scoutAction.addEventListener('click'");
  assert.notStrictEqual(scoutHandlerStart, -1, 'scoutAction click handler must exist');

  const scoutHandlerBlock = dropdownSource.slice(scoutHandlerStart, scoutHandlerStart + 800);

  // Must call isEditorReadOnly() inside the click handler
  assert.match(scoutHandlerBlock, /if\s*\(isEditorReadOnly\(\)\)\s*\{\s*return;\s*\}/);

  // LoveBudScoutDraftUI.open must only be called AFTER the guard
  const guardIndex = scoutHandlerBlock.indexOf('if (isEditorReadOnly())');
  const openIndex = scoutHandlerBlock.indexOf('window.LoveBudScoutDraftUI.open');

  assert.ok(guardIndex !== -1, 'guard must exist in click handler');
  assert.ok(openIndex !== -1, 'LoveBudScoutDraftUI.open call must exist');
  assert.ok(
    guardIndex < openIndex,
    'editability guard must appear before LoveBudScoutDraftUI.open call'
  );
});

test('read-only trees: LoveBudScoutDraftUI.open is never reached', () => {
  // The guard returns before the open call — verified by ordering assertion above.
  // Additionally, no toast/redirect/API call is introduced in the guard path.
  const scoutHandlerStart = dropdownSource.indexOf("scoutAction.addEventListener('click'");
  const scoutHandlerBlock = dropdownSource.slice(scoutHandlerStart, scoutHandlerStart + 800);

  // The guard block should only contain `return;` — no side effects
  const guardMatch = scoutHandlerBlock.match(/if\s*\(isEditorReadOnly\(\)\)\s*\{([^}]*)\}/);
  assert.ok(guardMatch, 'guard block must exist');
  const guardBody = guardMatch[1];
  assert.ok(
    !guardBody.includes('showToast') &&
    !guardBody.includes('location.href') &&
    !guardBody.includes('fetch(') &&
    !guardBody.includes('localStorage'),
    'guard path must not trigger toast/redirect/API/local-storage side effects'
  );
});

test('delete/share/focus actions are not affected by the guard', () => {
  // The isEditorReadOnly guard must only appear in the scoutAction click handler,
  // not in delete/share/focus handlers.
  const deleteStart = dropdownSource.indexOf("deleteAction.addEventListener('click'");
  const deleteBlock = dropdownSource.slice(deleteStart, deleteStart + 500);
  assert.doesNotMatch(deleteBlock, /isEditorReadOnly/, 'delete action must not check isEditorReadOnly');

  const shareStart = dropdownSource.indexOf("shareAction.addEventListener('click'");
  const shareBlock = dropdownSource.slice(shareStart, shareStart + 500);
  assert.doesNotMatch(shareBlock, /isEditorReadOnly/, 'share action must not check isEditorReadOnly');

  const focusStart = dropdownSource.indexOf("focusAction.addEventListener('click'");
  const focusBlock = dropdownSource.slice(focusStart, focusStart + 500);
  assert.doesNotMatch(focusBlock, /isEditorReadOnly/, 'focus action must not check isEditorReadOnly');
});

test('no new global editability flag is introduced', () => {
  // The dropdown module must not create a new global editability flag.
  // It must only read from existing window.LoveBudEditor.canEdit and body.editor-readonly.
  assert.doesNotMatch(
    dropdownSource,
    /window\.\w*[Ee]ditab\w*\s*=\s*/,
    'must not introduce a new global editability flag on window'
  );
  assert.doesNotMatch(
    dropdownSource,
    /var\s+\w*[Ee]ditab\w*\s*=\s*(true|false)/,
    'must not introduce a standalone editability boolean variable'
  );
});

test('floating toolbar syncs Scout action visibility on init', () => {
  assert.match(
    toolbarSource,
    /LoveBudFloatingToolbarDropdown\.syncScoutActionVisibility\(scoutAction\)/
  );
});

test('floating toolbar still passes selectedNode as function reference', () => {
  // Regression guard: the existing scout-add-memory-flow contract requires this.
  assert.match(toolbarSource, /selectedNode:\s*getSelectedNodeEl/);
  assert.doesNotMatch(toolbarSource, /selectedNode:\s*getSelectedNodeEl\(\)/);
});
