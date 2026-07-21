/**
 * #3581 — Explicit layout policy boundary for appreciation vs owner edit.
 *
 * Separates tree workspace canEdit (ownership/authorship) from layout
 * persistence scope and interaction mode (view/edit).
 *
 * Loaded as a browser-global before editor-canvas.js.
 */
(function () {
  'use strict';

  var STORAGE_SCOPE_EPHEMERAL = 'ephemeral_appreciation';
  var STORAGE_SCOPE_OWNER_EDIT = 'owner_edit_local';

  /**
   * @param {object} input
   * @param {boolean} [input.canEditTree] - workspace canEdit (owner of tree)
   * @param {'view'|'edit'} [input.interactionMode]
   * @param {'owner'|'public'|'guest'} [input.authority] - optional override
   * @returns {object} policy
   */
  function resolveLayoutPolicy(input) {
    var opts = input || {};
    var canEditTree = opts.canEditTree === true;
    var interactionMode = opts.interactionMode === 'edit' ? 'edit' : 'view';
    var authority =
      opts.authority === 'public' || opts.authority === 'guest' || opts.authority === 'owner'
        ? opts.authority
        : canEditTree
          ? 'owner'
          : 'public';

    // Only authorized owner *edit* may read/write owner-local layout drafts.
    var isOwnerEdit =
      canEditTree === true &&
      interactionMode === 'edit' &&
      authority === 'owner';

    if (isOwnerEdit) {
      return {
        authority: 'owner',
        interactionMode: 'edit',
        storageScope: STORAGE_SCOPE_OWNER_EDIT,
        initialLayoutMode: 'restore_owner_preference',
        allowNodeDrag: true,
        allowPersistMode: true,
        allowPersistPositions: true,
        layoutReadOnly: false,
        publicLinearSpine: false
      };
    }

    // Public appreciation, guest, non-owner, and owner appreciation:
    // ephemeral structured-first presentation; never touch owner draft keys.
    return {
      authority: authority === 'owner' ? 'owner' : 'public',
      interactionMode: 'view',
      storageScope: STORAGE_SCOPE_EPHEMERAL,
      initialLayoutMode: 'structured',
      allowNodeDrag: false,
      allowPersistMode: false,
      allowPersistPositions: false,
      layoutReadOnly: true,
      // Public/read-only surfaces keep linear-spine geometry policy.
      publicLinearSpine: authority !== 'owner'
    };
  }

  function normalizeStoredMode(mode) {
    if (mode === 'free' || mode === 'structured') return mode;
    return 'structured';
  }

  /**
   * Node drag is allowed only in owner-edit free mode.
   */
  function canDragNodes(policy, layoutMode) {
    if (!policy || policy.layoutReadOnly === true) return false;
    if (policy.allowNodeDrag !== true) return false;
    return layoutMode === 'free';
  }

  function cursorForLayout(policy, layoutMode) {
    return canDragNodes(policy, layoutMode) ? 'grab' : 'default';
  }

  window.LoveBudEditorCanvasLayoutPolicy = {
    STORAGE_SCOPE_EPHEMERAL: STORAGE_SCOPE_EPHEMERAL,
    STORAGE_SCOPE_OWNER_EDIT: STORAGE_SCOPE_OWNER_EDIT,
    resolveLayoutPolicy: resolveLayoutPolicy,
    normalizeStoredMode: normalizeStoredMode,
    canDragNodes: canDragNodes,
    cursorForLayout: cursorForLayout
  };
})();
