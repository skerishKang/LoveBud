/**
 * LoveBud — Public Tree View Recorder
 * Issue #3599
 *
 * Records a single tree-level public view event on the active canonical
 * appreciation route (pages/view.html → public-canvas-init.js) after a public
 * tree loads successfully.
 *
 * Boundary contract:
 *   - One shot per treeId per page lifecycle (client-side guard); the guard
 *     state lives on window so it survives duplicate script evaluations in the
 *     same window. Server daily dedup remains authoritative in tree_views.py.
 *   - Guest (anonymous) capable — no auth token required.
 *   - actorKey reused from localStorage across reloads on the same profile.
 *   - Failures are caught and never break viewer initialization/render.
 *   - Raw response/error never surfaces in UI.
 *
 * Endpoint: POST /api/trees/:treeId/views  (→ Modal /modal/public/trees/:treeId/views)
 * Payload: { actorKey, actorKind:'anonymous', source:'public_tree_detail' }
 *
 * Idempotency / double-evaluation safety:
 *   - A global marker (window.LoveBudPublicTreeViewRecorderLoaded) blocks the
 *     second IIFE evaluation in the same window: the existing API object and
 *     the existing window-global state are preserved, so a duplicate <script>
 *     load cannot add a second POST for an already-sent treeId.
 */
(function () {
  'use strict';

  var VIEW_ACTOR_KEY_STORAGE = 'lovebud_public_tree_view_actor_key_v1';
  var VIEW_SOURCE = 'public_tree_detail';
  var VIEW_ACTOR_KIND = 'anonymous';

  // Global marker: set once the first IIFE evaluation installs the API. A second
  // evaluation in the same window short-circuits and reuses the existing object.
  var GLOBAL_LOADED_MARKER = 'LoveBudPublicTreeViewRecorderLoaded';

  // Existing API object reused on duplicate evaluation (keeps identity stable).
  if (window[GLOBAL_LOADED_MARKER] && window.LoveBudPublicTreeViewRecorder) {
    return;
  }

  function createRandomViewActorKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'anon-' + window.crypto.randomUUID();
    }
    return 'anon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function getOrCreateViewActorKey() {
    // Prefer persisted key (stable across reloads on same profile).
    try {
      var ls = window.localStorage;
      if (ls) {
        var stored = ls.getItem(VIEW_ACTOR_KEY_STORAGE);
        if (stored) return stored;
      }
    } catch (error) {
      // localStorage read blocked (private mode / disabled) — fall through.
    }

    // Fall back to a window-global ephemeral key, created once per lifecycle so
    // repeated calls return the SAME key even when localStorage is unavailable.
    var state = window.__lovebudPublicTreeViewRecorderState;
    if (!state) {
      state = { sentTreeIds: Object.create(null), ephemeralActorKey: null };
      window.__lovebudPublicTreeViewRecorderState = state;
    }
    if (state.ephemeralActorKey) return state.ephemeralActorKey;

    var created = createRandomViewActorKey();
    try {
      var lsWrite = window.localStorage;
      if (lsWrite) lsWrite.setItem(VIEW_ACTOR_KEY_STORAGE, created);
    } catch (error) {
      // localStorage write blocked — ephemeral key still used for this lifecycle.
    }
    state.ephemeralActorKey = created;
    return created;
  }

  function buildTreeViewEndpoint(treeId) {
    return '/api/trees/' + encodeURIComponent(treeId) + '/views';
  }

  function markTreeIdSent(treeId) {
    var state = window.__lovebudPublicTreeViewRecorderState;
    if (!state) {
      state = { sentTreeIds: Object.create(null), ephemeralActorKey: null };
      window.__lovebudPublicTreeViewRecorderState = state;
    }
    state.sentTreeIds[treeId] = true;
  }

  function isTreeIdSent(treeId) {
    var state = window.__lovebudPublicTreeViewRecorderState;
    return !!(state && state.sentTreeIds[treeId]);
  }

  function recordPublicTreeView(treeId) {
    if (!treeId) return;
    // TreeId-keyed, window-global one-shot: A→A = 1 POST, A→B→A = 2 POSTs.
    if (isTreeIdSent(treeId)) return;
    markTreeIdSent(treeId);

    var actorKey = getOrCreateViewActorKey();
    var payload = JSON.stringify({
      actorKey: actorKey,
      actorKind: VIEW_ACTOR_KIND,
      source: VIEW_SOURCE
    });

    try {
      fetch(buildTreeViewEndpoint(treeId), {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: payload,
        keepalive: true
      }).catch(function (error) {
        // Non-blocking: viewer must keep working regardless of view-count failure.
        // No automatic retry within the lifecycle: the treeId is already marked
        // sent, so a subsequent call for the same treeId is a no-op.
        if (window.console && typeof window.console.warn === 'function') {
          window.console.warn('[public-tree-view-recorder] view count failed:', error);
        }
      });
    } catch (error) {
      // fetch itself threw (e.g., malformed URL) — swallow, never break viewer.
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('[public-tree-view-recorder] view count send error:', error);
      }
    }
  }

  // Test-only reset hook. Not used by production runtime.
  function _resetForTest() {
    var state = window.__lovebudPublicTreeViewRecorderState;
    if (state) {
      state.sentTreeIds = Object.create(null);
      state.ephemeralActorKey = null;
    }
  }

  window.LoveBudPublicTreeViewRecorder = Object.freeze({
    recordPublicTreeView: recordPublicTreeView,
    getOrCreateViewActorKey: getOrCreateViewActorKey,
    buildTreeViewEndpoint: buildTreeViewEndpoint,
    VIEW_ACTOR_KEY_STORAGE: VIEW_ACTOR_KEY_STORAGE,
    VIEW_SOURCE: VIEW_SOURCE,
    VIEW_ACTOR_KIND: VIEW_ACTOR_KIND,
    _resetForTest: _resetForTest
  });

  // Install the global marker LAST so a partially-initialized object is never
  // reused by a duplicate evaluation.
  window[GLOBAL_LOADED_MARKER] = true;
})();
