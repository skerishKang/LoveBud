/**
 * LoveBud — Public Tree View Recorder
 * Issue #3599 / security slice #3917
 *
 * Records a single tree-level public view event on the active canonical
 * appreciation route (pages/view.html → public-canvas-init.js) after a public
 * tree loads successfully.
 *
 * Boundary contract (security slice #3917):
 *   - One shot per treeId per page lifecycle (client-side guard); the guard
 *     state lives on window so it survives duplicate script evaluations in the
 *     same window. Server daily dedup remains authoritative in tree_views.py.
 *   - Guest (anonymous) capable — no auth token required.
 *   - The browser NEVER mints, stores, or sends viewer identity. It sends an
 *     empty POST body. The edge (Cloudflare) derives an anonymous,
 *     server-authoritative actor from trusted request context and forwards only
 *     a signed assertion to Modal. This prevents a client-chosen actorKey from
 *     inflating public tree view counts (Issue #3917).
 *   - Failures are caught and never break viewer initialization/render.
 *     Raw response/error never surfaces in UI.
 *
 * Endpoint: POST /api/trees/:treeId/views  (→ Modal /modal/public/trees/:treeId/views)
 *
 * Idempotency / double-evaluation safety:
 *   - A global marker (window.LoveBudPublicTreeViewRecorderLoaded) blocks the
 *     second IIFE evaluation in the same window: the existing API object and
 *     the existing window-global state are preserved, so a duplicate <script>
 *     load cannot add a second POST for an already-sent treeId.
 */
(function () {
  'use strict';

  var VIEW_SOURCE = 'public_tree_detail';

  // Global marker: set once the first IIFE evaluation installs the API. A second
  // evaluation in the same window short-circuits and reuses the existing object.
  var GLOBAL_LOADED_MARKER = 'LoveBudPublicTreeViewRecorderLoaded';

  // Existing API object reused on duplicate evaluation (keeps identity stable).
  if (window[GLOBAL_LOADED_MARKER] && window.LoveBudPublicTreeViewRecorder) {
    return;
  }

  function buildTreeViewEndpoint(treeId) {
    return '/api/trees/' + encodeURIComponent(treeId) + '/views';
  }

  function markTreeIdSent(treeId) {
    var state = window.__lovebudPublicTreeViewRecorderState;
    if (!state) {
      state = { sentTreeIds: Object.create(null) };
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

    // No actor identity is sent from the browser. The edge (Cloudflare) derives
    // an anonymous, server-authoritative actor from trusted request context and
    // forwards only a signed assertion to Modal. The browser must never mint or
    // influence viewer identity (Issue #3917).
    try {
      fetch(buildTreeViewEndpoint(treeId), {
        method: 'POST',
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

  window.LoveBudPublicTreeViewRecorder = Object.freeze({
    recordPublicTreeView: recordPublicTreeView,
    buildTreeViewEndpoint: buildTreeViewEndpoint,
    VIEW_SOURCE: VIEW_SOURCE
  });

  // Install the global marker LAST so a partially-initialized object is never
  // reused by a duplicate evaluation.
  window[GLOBAL_LOADED_MARKER] = true;
})();
