/**
 * Owner appreciation detail shell — thin wrapper over shared canonical builder.
 * Issue #3563
 *
 * Requires classic script:
 *   js/shared/canonical-appreciation-detail-presentation.js
 * loaded before this module in pages/editor.html.
 *
 * Presentation is owned by LoveBudCanonicalAppreciationDetailPresentation.
 * This file only projects owner authority options.
 */

function getCanonicalBuilder() {
  if (typeof window !== 'undefined' && window.LoveBudCanonicalAppreciationDetailPresentation) {
    return window.LoveBudCanonicalAppreciationDetailPresentation;
  }
  throw new Error(
    'LoveBudCanonicalAppreciationDetailPresentation missing — load js/shared/canonical-appreciation-detail-presentation.js first'
  );
}

export function buildDetailViewModeTemplate() {
  return getCanonicalBuilder().buildDetailViewModeHtml({
    authority: 'owner',
    includeOwnerEditChip: true,
    includeOwnerActions: true,
    includeAtlasMount: true,
    knowledgeMode: 'owner',
    socialMode: 'owner-interactive',
    initialHidden: true
  });
}

const mount = document.getElementById('editorDetailViewModeTemplateMount');
if (mount) {
  mount.outerHTML = buildDetailViewModeTemplate();
}
