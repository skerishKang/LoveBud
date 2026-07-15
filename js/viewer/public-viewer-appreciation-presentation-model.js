/**
 * LoveBud — Public Viewer appreciation presentation-slot model
 * Issue #3495 / parent #3475 / corrective #3519
 *
 * Public Viewer route wrapper around the route-neutral shared presentation
 * slots. Re-applies Public Viewer owner/editor capability hard-close so
 * public-safe presentation never advertises owner authority.
 *
 * Pure presentation-intent projection only.
 * Consumes an already-canonicalized appreciation render model
 * (window.LoveBudAppreciationRenderModel output shape).
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-presentation-model]';

  var SLOT_KEYS = [
    'identity',
    'media',
    'rememberedDate',
    'emotionTags',
    'connectedKnowledge',
    'emotionMemo',
    'socialSummary'
  ];

  var OWNER_EDITOR_CAPABILITY_KEYS = [
    'canEdit',
    'canContinue',
    'canConnect',
    'canDelete',
    'canSwitchMode',
    'isOwner'
  ];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isLiteralTrue(value) {
    return value === true;
  }

  function requireSharedPresentationSlots() {
    var shared = window.LoveBudAppreciationPresentationSlots;
    if (!shared || typeof shared.createAppreciationPresentationSlots !== 'function') {
      throw new Error(
        ERROR_PREFIX +
          ' LoveBudAppreciationPresentationSlots.createAppreciationPresentationSlots is required'
      );
    }
    return shared;
  }

  function forcePublicViewerCapabilities(rawCaps) {
    var out = {
      canEdit: false,
      canContinue: false,
      canConnect: false,
      canReact: false,
      canComment: false,
      canDelete: false,
      canSwitchMode: false,
      isOwner: false,
      isPublicRoute: false
    };

    if (isPlainObject(rawCaps)) {
      out.canReact = isLiteralTrue(rawCaps.canReact);
      out.canComment = isLiteralTrue(rawCaps.canComment);
      out.isPublicRoute = isLiteralTrue(rawCaps.isPublicRoute);
    }

    var i;
    for (i = 0; i < OWNER_EDITOR_CAPABILITY_KEYS.length; i += 1) {
      out[OWNER_EDITOR_CAPABILITY_KEYS[i]] = false;
    }

    return out;
  }

  function withPublicSafeCapabilities(canonicalModel) {
    if (!isPlainObject(canonicalModel)) {
      return {
        moment: {},
        social: {},
        availability: {},
        capabilities: forcePublicViewerCapabilities(null)
      };
    }

    return {
      moment: isPlainObject(canonicalModel.moment) ? canonicalModel.moment : {},
      social: isPlainObject(canonicalModel.social) ? canonicalModel.social : {},
      availability: isPlainObject(canonicalModel.availability)
        ? canonicalModel.availability
        : {},
      capabilities: forcePublicViewerCapabilities(canonicalModel.capabilities)
    };
  }

  /**
   * Build a detached ordered presentation-slot model from a canonical
   * appreciation render model, with Public Viewer capability hard-close.
   *
   * @param {*} canonicalModel - output of createAppreciationRenderModel
   * @returns {{ slots: Array, capabilities: Object }}
   */
  function createPublicViewerAppreciationPresentationModel(canonicalModel) {
    var shared = requireSharedPresentationSlots();
    var safeModel = withPublicSafeCapabilities(canonicalModel);
    var presentation = shared.createAppreciationPresentationSlots(safeModel);

    // Belt-and-suspenders: never leak owner/editor capability truth from shared.
    if (isPlainObject(presentation)) {
      presentation.capabilities = forcePublicViewerCapabilities(
        presentation.capabilities
      );
    }

    return presentation;
  }

  function getPresentationSlotOrder() {
    var shared = window.LoveBudAppreciationPresentationSlots;
    if (shared && typeof shared.getPresentationSlotOrder === 'function') {
      return shared.getPresentationSlotOrder();
    }
    return SLOT_KEYS.slice();
  }

  window.LoveBudPublicViewerAppreciationPresentationModel = Object.freeze({
    createPublicViewerAppreciationPresentationModel:
      createPublicViewerAppreciationPresentationModel,
    getPresentationSlotOrder: getPresentationSlotOrder,
    SLOT_KEYS: Object.freeze(SLOT_KEYS.slice())
  });
})();
