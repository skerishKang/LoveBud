export function buildSidebarTemplate() {
    return `
        <aside class="sidebar reveal-fade">
            <div class="editor-sidebar-back-wrap">
                <a id="backToMyTreesLink" href="my-trees" class="editor-sidebar-back-link">
                    <span aria-hidden="true" class="editor-sidebar-back-icon">←</span>
                    <span id="backToMyTreesLabel">내 러브트리로 돌아가기</span>
                </a>
            </div>
            <section class="editor-status-section">
                <h3 id="editorFlowHeading">러브트리</h3>
                <p id="editorFlowLead" class="editor-flow-lead">...</p>
                <div class="editor-status-card">
                    <div class="editor-space-between-row editor-sidebar-header-row">
                        <div class="editor-reference-kicker" aria-hidden="true">내가 키우는 러브트리</div>
                        <button type="button" id="renameTreeBtn" class="icon-menu-btn editor-rename-btn" aria-label="트리 제목 수정" title="트리 제목 수정">수정</button>
                    </div>
                    <div class="editor-title-row">
                        <strong id="sidebarTreeTitle">러브트리</strong>
                    </div>
                    <p id="sidebarFlowSummary" class="editor-flow-summary"></p>
                </div>
            </section>

            <section class="editor-add-section editor-add-section-bottom" aria-hidden="true">
                <div class="editor-add-card">
                    <div>
                        <div id="addMemoryEyebrow" class="editor-add-eyebrow">...</div>
                        <p id="addMemoryIntro" class="editor-add-intro">...</p>
                    </div>
                    <button type="button" class="sidebar-btn sidebar-btn-primary" id="addMemoryBtn" tabindex="-1">
                        <span class="btn-icon">+</span>
                        <span class="btn-label" id="addMemoryBtnLabel">추가</span>
                    </button>
                </div>
            </section>
        </aside>
    `;
}

const mount = document.getElementById('editorSidebarTemplateMount');
if (mount) {
    mount.outerHTML = buildSidebarTemplate();
}
