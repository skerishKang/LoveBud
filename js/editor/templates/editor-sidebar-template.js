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
                <h3 id="editorFlowHeading">트리 정보</h3>
                <p id="editorFlowLead" class="editor-flow-lead">트리 제목과 현재 흐름을 차분하게 정리해두는 공간이에요.</p>
                <div class="editor-status-card">
                    <div class="editor-space-between-row editor-sidebar-header-row">
                        <div class="editor-reference-kicker" aria-hidden="true">내가 키우는 러브트리</div>
                        <button type="button" id="renameTreeBtn" class="icon-menu-btn editor-rename-btn" aria-label="트리 제목 수정" title="트리 제목 수정">수정</button>
                    </div>
                    <div class="editor-title-row">
                        <strong id="sidebarTreeTitle">러브트리</strong>
                    </div>
                    <div id="sidebarFlowSummary" class="editor-flow-summary"></div>
                    <div class="editor-sidebar-rail-note" aria-hidden="true">
                        <span class="editor-sidebar-rail-note-kicker">한눈에 보기</span>
                        <p class="editor-sidebar-rail-note-copy">왼쪽에서 트리 정보를, 가운데에서 흐름을, 오른쪽에서 지금 선택한 순간을 정리해요.</p>
                    </div>
                </div>
            </section>

            <section class="editor-add-section editor-add-section-bottom" aria-hidden="true">
                <div class="editor-add-card">
                    <div>
                        <div id="addMemoryEyebrow" class="editor-add-eyebrow">순간 이어가기</div>
                        <p id="addMemoryIntro" class="editor-add-intro">지금 마음이 이어지는 다음 순간을 가볍게 심어보세요.</p>
                    </div>
                    <button type="button" class="sidebar-btn sidebar-btn-primary" id="addMemoryBtn" tabindex="-1">
                        <span class="btn-icon">+</span>
                        <span class="btn-label" id="addMemoryBtnLabel">새 순간 만들기</span>
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
