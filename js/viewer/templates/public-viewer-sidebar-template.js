/**
 * Public-safe left rail — tree-scope host (#3562).
 * Whole-tree meta/actions mount into #detailTreeMetaMount (same id as owner route).
 * Selected-moment content stays in the right detail panel only.
 */
export function buildPublicSidebarTemplate() {
    return `
        <aside class="sidebar public-viewer-sidebar reveal-fade" data-appreciation-layout="tree-scope-rail">
            <div class="editor-sidebar-back-wrap">
                <a id="viewerSidebarBackLink" href="search" class="editor-sidebar-back-link">
                    <span aria-hidden="true" class="editor-sidebar-back-icon">←</span>
                    <span id="viewerSidebarBackLabel">둘러보기로 돌아가기</span>
                </a>
            </div>

            <!-- #3562: primary tree-scope region (shared mount id with owner appreciation). -->
            <section
                class="editor-tree-meta-section appreciation-tree-scope"
                id="detailTreeMetaSection"
                data-canonical-section="tree-scope"
                data-appreciation-region="tree-scope"
                aria-label="현재 트리"
            >
                <div class="editor-section-eyebrow" id="detailTreeStatusLabel">현재 트리</div>
                <div id="detailTreeMetaMount" data-tree-scope-mount="true"></div>
            </section>

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
    `;
}

const mount = document.getElementById('publicViewerSidebarTemplateMount');
if (mount) {
    mount.outerHTML = buildPublicSidebarTemplate();
}
