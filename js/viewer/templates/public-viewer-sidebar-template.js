export function buildPublicSidebarTemplate() {
    return `
        <aside class="sidebar public-viewer-sidebar reveal-fade">
            <div class="editor-sidebar-back-wrap">
                <a id="viewerSidebarBackLink" href="search" class="editor-sidebar-back-link">
                    <span aria-hidden="true" class="editor-sidebar-back-icon">←</span>
                    <span id="viewerSidebarBackLabel">둘러보기로 돌아가기</span>
                </a>
            </div>
            <section class="editor-status-section">
                <div class="editor-status-card">
                    <div class="editor-sidebar-header-row">
                        <div id="viewerSidebarKicker" class="editor-reference-kicker" aria-hidden="true">공개 러브트리</div>
                    </div>
                    <div class="editor-title-row">
                        <strong id="viewerSidebarTreeTitle">러브트리</strong>
                    </div>
                    <div id="viewerSidebarSummary" class="editor-flow-summary" style="display: none;"></div>
                    <div id="viewerSidebarMomentCount" class="viewer-sidebar-moment-count">0개의 순간</div>
                </div>
            </section>
            <section id="viewerSidebarOwnerMode" class="viewer-sidebar-owner-mode" style="display: none;">
                <div class="viewer-sidebar-mode-actions">
                    <button type="button" class="sidebar-btn" id="viewerSidebarViewBtn" disabled>보기</button>
                    <button type="button" class="sidebar-btn sidebar-btn-primary" id="viewerSidebarEditBtn">편집</button>
                </div>
            </section>
        </aside>
    `;
}

const mount = document.getElementById('publicViewerSidebarTemplateMount');
if (mount) {
    mount.outerHTML = buildPublicSidebarTemplate();
}
