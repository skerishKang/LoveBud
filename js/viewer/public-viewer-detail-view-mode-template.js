/**
 * Public/guest appreciation detail shell — thin compatibility wrapper.
 * Issue #3563
 *
 * Does NOT own a second full presentation template.
 * Mounts the shared canonical builder with public-safe authority options.
 *
 * Requires classic script:
 *   js/shared/canonical-appreciation-detail-presentation.js
 * loaded before this file in pages/view.html.
 *
 * Loaders / publicRead remain route-owned. Guests are not bootstrapped via editor.js.
 */
(function () {
  'use strict';

  var builder = typeof window !== 'undefined'
    ? window.LoveBudCanonicalAppreciationDetailPresentation
    : null;

  if (!builder || typeof builder.mountDetailViewMode !== 'function') {
    if (typeof console !== 'undefined' && console.error) {
      console.error(
        '[LoveBud] LoveBudCanonicalAppreciationDetailPresentation missing — ' +
        'load js/shared/canonical-appreciation-detail-presentation.js before the public detail shell'
      );
    }
    return;
  }

  builder.mountDetailViewMode('editorDetailViewModeTemplateMount', {
    authority: 'public-safe',
    includeOwnerEditChip: false,
    includeOwnerActions: false,
    includeAtlasMount: false,
    knowledgeMode: 'public',
    socialMode: 'public-readonly',
    initialHidden: false
  });

  window.LoveBudPublicViewerDetailViewModeTemplate = {
    mountId: 'editorDetailViewModeTemplateMount',
    viewModeId: 'detailViewMode',
    builderId: builder.BUILDER_ID || 'LoveBudCanonicalAppreciationDetailPresentation',
    authority: 'public-safe'
  };
})();
