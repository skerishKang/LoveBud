/**
 * LoveBud — Public Viewer appreciation DOM renderer
 * Issue #3507 / parent #3475 / corrective #3519
 *
 * Viewer-owned thin wrapper over route-neutral shared slot DOM helpers.
 * Uses Public Viewer element ids and never binds Editor authority.
 */
(function () {
  'use strict';

  var ERROR_PREFIX = '[public-viewer-appreciation-dom-renderer]';

  function requireSharedSlotDom() {
    var shared = window.LoveBudAppreciationSlotDom;
    if (!shared || typeof shared.createAppreciationSlotDomRenderer !== 'function') {
      throw new Error(
        ERROR_PREFIX +
          ' LoveBudAppreciationSlotDom.createAppreciationSlotDomRenderer is required'
      );
    }
    return shared;
  }

  function createPublicViewerAppreciationDomRenderer(options) {
    var shared = requireSharedSlotDom();
    var doc =
      options && options.document
        ? options.document
        : typeof document !== 'undefined'
          ? document
          : null;

    return shared.createAppreciationSlotDomRenderer({
      document: doc,
      ids: {
        title: 'detailCurrentMomentTitle',
        date: 'detailDateText',
        dateGroup: 'detailDateGroup',
        tags: 'detailTags',
        tagsGroup: 'detailTagsGroup',
        knowledgeList: 'detailPublicKnowledgeList',
        knowledgeGroup: 'detailPublicKnowledgeGroup',
        knowledgeItemClass: 'public-viewer-knowledge-item',
        memo: 'detailMemo',
        memoGroup: 'detailMemoGroup'
      }
    });
  }

  window.LoveBudPublicViewerAppreciationDomRenderer = Object.freeze({
    createPublicViewerAppreciationDomRenderer:
      createPublicViewerAppreciationDomRenderer
  });
})();
