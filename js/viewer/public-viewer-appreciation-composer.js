/**
 * LoveBud — Public Viewer appreciation composition boundary
 * Issue #3499 / parent #3475 / corrective #3519
 *
 * Pure orchestration only:
 *   source + capabilities
 *     → LoveBudPublicViewerAppreciationModelAdapter
 *         .createPublicViewerAppreciationModel
 *     → LoveBudPublicViewerAppreciationPresentationModel
 *         .createPublicViewerAppreciationPresentationModel
 *         (delegates to shared presentation slots with public hard-close)
 *     → presentation result
 *
 * Does not inspect, clone, sanitize, or normalize raw source fields.
 * Does not invent presentation slots, capabilities, or counts.
 * Does not touch DOM / Auth / network / storage / Editor / My Trees.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-composer]';

  function requireAdapter() {
    var adapter = window.LoveBudPublicViewerAppreciationModelAdapter;
    if (!adapter || typeof adapter !== 'object') {
      throw new Error(
        ERROR_PREFIX + ' Public Viewer appreciation adapter is required'
      );
    }
    if (typeof adapter.createPublicViewerAppreciationModel !== 'function') {
      throw new Error(
        ERROR_PREFIX +
          ' Public Viewer appreciation adapter method createPublicViewerAppreciationModel is required'
      );
    }
    return adapter;
  }

  function requirePresentationModel() {
    var presentation = window.LoveBudPublicViewerAppreciationPresentationModel;
    if (!presentation || typeof presentation !== 'object') {
      throw new Error(
        ERROR_PREFIX +
          ' Public Viewer appreciation presentation model is required'
      );
    }
    if (
      typeof presentation.createPublicViewerAppreciationPresentationModel !==
      'function'
    ) {
      throw new Error(
        ERROR_PREFIX +
          ' Public Viewer appreciation presentation model method createPublicViewerAppreciationPresentationModel is required'
      );
    }
    return presentation;
  }

  /**
   * Compose a Public Viewer appreciation presentation from a selected-memory
   * source via the fixed adapter → presentation chain.
   *
   * @param {*} source - passed by reference to the adapter only
   * @param {*} capabilities - passed by reference to the adapter only
   * @returns {*} exact presentation-model result
   */
  function composePublicViewerAppreciationPresentation(source, capabilities) {
    var adapter = requireAdapter();
    var presentation = requirePresentationModel();

    var canonicalModel = adapter.createPublicViewerAppreciationModel(
      source,
      capabilities
    );

    return presentation.createPublicViewerAppreciationPresentationModel(
      canonicalModel
    );
  }

  window.LoveBudPublicViewerAppreciationComposer = Object.freeze({
    composePublicViewerAppreciationPresentation:
      composePublicViewerAppreciationPresentation
  });
})();
