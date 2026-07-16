/**
 * LoveBud — My Trees explicit entry-target resolver
 * Issue #3492 / parent #3475 / product correction #3563
 *
 * Pure navigation target model for owned-tree open intents.
 *
 * User-visible interaction modes (#3563):
 *   - primary / appreciation → 감상하기 (Editor default interaction mode)
 *   - edit                   → 편집하기 (Editor mode=edit)
 *
 * Internal only (NOT a third UI action):
 *   - publicView / shareTarget → public compatibility href (view.html) for
 *     share-link copy on public trees. Do not render as “공개 화면 보기”.
 *
 * Separates access state, interaction mode, and route surface.
 * Does not navigate, mutate inputs, touch DOM, credentials, network,
 * storage, or load Editor/Viewer runtime modules.
 *
 * Canonical routes:
 *   - Owner appreciation: editor?treeId=<id>  (no mode param; defaults to view)
 *   - Owner edit:         editor?treeId=<id>&mode=edit
 *   - Public compatibility / share: view.html?treeId=<id>
 *   - tree id query key:   treeId
 *   - visibility: exact "public" | "private" (case-sensitive)
 *
 * Hrefs are fixed canonical relative routes plus encodeURIComponent(treeId).
 * Caller context cannot inject route prefixes, origins, schemes, or fragments.
 */
(function () {
  'use strict';

  var ACCESS_PUBLIC = 'public';
  var ACCESS_PRIVATE = 'private';
  var ACCESS_UNKNOWN = 'unknown';

  var ACTION_APPRECIATION = 'appreciation';
  var ACTION_PUBLIC_VIEW = 'public-view';
  var ACTION_EDIT = 'edit';

  var INTERACTION_APPRECIATION = 'appreciation';
  var INTERACTION_EDIT = 'edit';
  var INTERACTION_NONE = 'none';

  var SURFACE_EDITOR = 'editor';
  var SURFACE_PUBLIC_VIEWER = 'public-viewer';

  var TREE_ID_KEYS = ['id', 'treeId', 'tree_id'];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  /**
   * Fail-closed tree id: first usable non-empty trimmed string among aliases.
   * missing / null / undefined / empty / whitespace / non-string → try next.
   * All aliases unusable → null.
   */
  function resolveTreeId(tree) {
    if (!isPlainObject(tree)) return null;
    var i;
    for (i = 0; i < TREE_ID_KEYS.length; i += 1) {
      var key = TREE_ID_KEYS[i];
      if (!hasOwn(tree, key)) continue;
      var raw = tree[key];
      if (typeof raw !== 'string') continue;
      var trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (!trimmed) continue;
      return trimmed;
    }
    return null;
  }

  /**
   * Case-sensitive canonical visibility only.
   * No truthy/falsy coercion; no lowercase normalization.
   */
  function normalizeMyTreesAccessState(visibility) {
    if (visibility === ACCESS_PUBLIC) return ACCESS_PUBLIC;
    if (visibility === ACCESS_PRIVATE) return ACCESS_PRIVATE;
    return ACCESS_UNKNOWN;
  }

  function resolveAccessState(tree) {
    if (!isPlainObject(tree) || !hasOwn(tree, 'visibility')) {
      return ACCESS_UNKNOWN;
    }
    return normalizeMyTreesAccessState(tree.visibility);
  }

  function buildEditorAppreciationHref(treeId) {
    return 'editor?treeId=' + encodeURIComponent(treeId);
  }

  function buildEditorEditHref(treeId) {
    return 'editor?treeId=' + encodeURIComponent(treeId) + '&mode=edit';
  }

  function buildPublicViewerHref(treeId) {
    return 'view.html?treeId=' + encodeURIComponent(treeId);
  }

  function createTarget(available, href, action, interactionMode, routeSurface) {
    return {
      available: available === true,
      href: available === true && typeof href === 'string' ? href : null,
      action: action,
      interactionMode: interactionMode,
      routeSurface: routeSurface
    };
  }

  function createUnavailableBundle() {
    var unavailableShare = createTarget(
      false,
      null,
      ACTION_PUBLIC_VIEW,
      INTERACTION_NONE,
      SURFACE_PUBLIC_VIEWER
    );
    return {
      treeId: null,
      accessState: ACCESS_UNKNOWN,
      primary: createTarget(
        false,
        null,
        ACTION_APPRECIATION,
        INTERACTION_APPRECIATION,
        SURFACE_EDITOR
      ),
      publicView: unavailableShare,
      shareTarget: unavailableShare,
      edit: createTarget(
        false,
        null,
        ACTION_EDIT,
        INTERACTION_EDIT,
        SURFACE_EDITOR
      )
    };
  }

  /**
   * Resolve My Trees entry targets for an owned tree record.
   * Pure: no navigation, no input mutation, detached plain objects only.
   *
   * Interaction targets: primary (appreciation) + edit.
   * publicView/shareTarget: internal share/compatibility href only (#3563).
   *
   * @param {object} tree - allowlisted fields: id | treeId | tree_id, visibility
   * @param {object} [context] - reserved for signature compatibility; ignored
   * @returns {object} detached target model
   */
  function resolveMyTreesEntryTargets(tree, context) {
    // context is intentionally unused: hrefs are fixed canonical routes only.
    void context;

    var treeId = resolveTreeId(tree);
    if (!treeId) {
      return createUnavailableBundle();
    }

    var accessState = resolveAccessState(tree);
    var publicAvailable = accessState === ACCESS_PUBLIC;
    var shareTarget = createTarget(
      publicAvailable,
      publicAvailable ? buildPublicViewerHref(treeId) : null,
      ACTION_PUBLIC_VIEW,
      INTERACTION_NONE,
      SURFACE_PUBLIC_VIEWER
    );

    return {
      treeId: treeId,
      accessState: accessState,
      primary: createTarget(
        true,
        buildEditorAppreciationHref(treeId),
        ACTION_APPRECIATION,
        INTERACTION_APPRECIATION,
        SURFACE_EDITOR
      ),
      // Keep publicView key for existing consumers; prefer shareTarget for new code.
      publicView: shareTarget,
      shareTarget: shareTarget,
      edit: createTarget(
        true,
        buildEditorEditHref(treeId),
        ACTION_EDIT,
        INTERACTION_EDIT,
        SURFACE_EDITOR
      )
    };
  }

  window.LoveBudMyTreesEntryTargetResolver = Object.freeze({
    resolveMyTreesEntryTargets: resolveMyTreesEntryTargets,
    normalizeMyTreesAccessState: normalizeMyTreesAccessState
  });
})();
