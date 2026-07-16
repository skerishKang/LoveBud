/**
 * Public-safe left rail — thin wrapper around shared tree-scope builder (#3562).
 * Requires classic script js/shared/canonical-appreciation-detail-presentation.js first.
 */

function getSharedPresentationBuilder() {
  if (
    typeof window !== 'undefined' &&
    window.LoveBudCanonicalAppreciationDetailPresentation &&
    typeof window.LoveBudCanonicalAppreciationDetailPresentation.buildTreeScopeShellHtml === 'function'
  ) {
    return window.LoveBudCanonicalAppreciationDetailPresentation;
  }
  throw new Error(
    'LoveBudCanonicalAppreciationDetailPresentation.buildTreeScopeShellHtml missing — ' +
      'load js/shared/canonical-appreciation-detail-presentation.js before public-viewer-sidebar-template.js'
  );
}

function buildTreeScopeRegion() {
  return getSharedPresentationBuilder().buildTreeScopeShellHtml({
    authority: 'public-safe',
    routeAuthority: 'public-safe'
  });
}

export function buildPublicSidebarTemplate() {
  return (
    `
        <aside class="sidebar public-viewer-sidebar reveal-fade" data-appreciation-layout="tree-scope-rail">
            <div class="editor-sidebar-back-wrap">
                <a id="viewerSidebarBackLink" href="search" class="editor-sidebar-back-link">
                    <span aria-hidden="true" class="editor-sidebar-back-icon">←</span>
                    <span id="viewerSidebarBackLabel">둘러보기로 돌아가기</span>
                </a>
            </div>

            ` +
    buildTreeScopeRegion() +
    `

            <!-- Legacy summary IDs retained for public-canvas-init writers; not primary UI. -->
            <section class="editor-status-section appreciation-tree-scope-legacy" hidden aria-hidden="true">
                <div class="editor-status-card">
                    <div class="editor-sidebar-header-row">
                        <div id="viewerSidebarKicker" class="editor-reference-kicker" aria-hidden="true">공개 러브트리</div>
                    </div>
                    <div class="editor-title-row">
                        <strong id="viewerSidebarTreeTitle">러브트리</strong>
                    </div>
                    <div id="viewerSidebarSummary" class="editor-flow-summary" style="display: none;"></div>
                    <div id="viewerSidebarMomentCount" class="viewer-sidebar-moment-count" aria-live="polite">불러오는 중…</div>
                </div>
            </section>

            <section id="viewerSidebarOwnerMode" class="viewer-sidebar-owner-mode" style="display: none;">
                <div class="viewer-sidebar-mode-actions">
                    <button type="button" class="sidebar-btn" id="viewerSidebarViewBtn" disabled>보기</button>
                    <button type="button" class="sidebar-btn sidebar-btn-primary" id="viewerSidebarEditBtn">편집</button>
                </div>
            </section>
        </aside>
    `
  );
}

const mount = document.getElementById('publicViewerSidebarTemplateMount');
if (mount) {
  mount.outerHTML = buildPublicSidebarTemplate();
}
