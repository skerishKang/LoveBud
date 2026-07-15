/**
 * LoveBud — Editor appreciation composition boundary
 * Issue #3519 / parent #3475
 *
 * Pure orchestration only:
 *   owner selected-memory + capabilities
 *     → LoveBudEditorAppreciationModelAdapter
 *         .createEditorAppreciationModel
 *     → LoveBudAppreciationPresentationSlots
 *         .createAppreciationPresentationSlots
 *     → presentation result
 *
 * Does not call Public Viewer adapters/composers.
 * Does not bind edit/continue/connect/delete/like handlers.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[editor-appreciation-composer]';

  function requireAdapter() {
    var adapter = window.LoveBudEditorAppreciationModelAdapter;
    if (!adapter || typeof adapter !== 'object') {
      throw new Error(
        ERROR_PREFIX + ' Editor appreciation adapter is required'
      );
    }
    if (typeof adapter.createEditorAppreciationModel !== 'function') {
      throw new Error(
        ERROR_PREFIX +
          ' Editor appreciation adapter method createEditorAppreciationModel is required'
      );
    }
    return adapter;
  }

  function requirePresentationSlots() {
    var presentation = window.LoveBudAppreciationPresentationSlots;
    if (!presentation || typeof presentation !== 'object') {
      throw new Error(
        ERROR_PREFIX +
          ' Shared appreciation presentation slots are required'
      );
    }
    if (
      typeof presentation.createAppreciationPresentationSlots !== 'function'
    ) {
      throw new Error(
        ERROR_PREFIX +
          ' Shared presentation method createAppreciationPresentationSlots is required'
      );
    }
    return presentation;
  }

  /**
   * Compose an Editor appreciation presentation from a selected-memory source.
   *
   * @param {*} source - passed by reference to the Editor adapter only
   * @param {*} capabilities - passed by reference to the Editor adapter only
   * @returns {*} exact presentation-slots result
   */
  function composeEditorAppreciationPresentation(source, capabilities) {
    var adapter = requireAdapter();
    var presentation = requirePresentationSlots();

    var canonicalModel = adapter.createEditorAppreciationModel(
      source,
      capabilities
    );

    return presentation.createAppreciationPresentationSlots(canonicalModel);
  }

  window.LoveBudEditorAppreciationComposer = Object.freeze({
    composeEditorAppreciationPresentation:
      composeEditorAppreciationPresentation
  });
})();
