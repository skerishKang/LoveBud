export function buildFloatingToolbarTemplate() {
    return `
        <div id="editorFloatingToolbar" class="editor-floating-toolbar is-hidden" role="toolbar" aria-label="선택한 순간 도구" style="display:none;">
            <button type="button" class="editor-floating-toolbar-btn" id="ftbEditBtn" aria-label="순간 수정" title="순간 수정">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                <span class="editor-floating-toolbar-label">순간 수정</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn" id="ftbContinueBtn" aria-label="이어가기" title="이어가기">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                <span class="editor-floating-toolbar-label">이어가기</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn" id="ftbViewBtn" aria-label="감상하기" title="감상하기">
                <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                <span class="editor-floating-toolbar-label">감상하기</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn editor-ftb-more-btn" id="ftbMoreBtn" aria-label="더 보기" title="더 보기" aria-expanded="false" aria-haspopup="true">
                <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
            </button>
            <!-- Branch/connection-mode buttons (hidden by default, shown via JS) -->
            <button type="button" class="editor-floating-toolbar-btn editor-ftb-branch-btn" id="ftbBranchBtn" aria-label="가지 만들기" title="가지 만들기" style="display:none;">
                <span class="material-symbols-outlined" aria-hidden="true">call_split</span>
                <span class="editor-floating-toolbar-label">가지</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn editor-ftb-branch-btn" id="ftbForkBtn" aria-label="분기하기" title="분기하기" style="display:none;">
                <span class="material-symbols-outlined" aria-hidden="true">fork_right</span>
                <span class="editor-floating-toolbar-label">분기</span>
            </button>
        </div>
        <!-- Floating toolbar tooltip (moment info on hover) -->
        <div id="ftbTooltip" class="editor-floating-tooltip is-hidden" role="tooltip" aria-hidden="true" style="display:none;"></div>
        <!-- Quick-add signifier near selected node -->
        <button type="button" id="ftbQuickAdd" class="editor-floating-quick-add is-hidden" aria-label="빠른 추가" title="빠른 추가" style="display:none;">
            <span class="material-symbols-outlined" aria-hidden="true">add</span>
        </button>
        <!-- Secondary actions dropdown for "..." button -->
        <div id="ftbDropdown" class="editor-ftb-dropdown is-hidden" role="menu" aria-label="추가 행동" style="display:none;">
            <button type="button" class="editor-ftb-dropdown-item" id="ftbScoutAction" role="menuitem" data-action="scout" aria-label="Scout로 순간 저장">
                <span class="material-symbols-outlined" aria-hidden="true">scanner</span>
                <span data-i18n="scout_trigger_label">Scout로 순간 저장</span>
            </button>
            <button type="button" class="editor-ftb-dropdown-item" id="ftbDeleteAction" role="menuitem" data-action="delete" aria-label="순간 삭제">
                <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                <span>순간 삭제</span>
                <span class="editor-ftb-shortcut-hint">Del</span>
            </button>
            <button type="button" class="editor-ftb-dropdown-item" id="ftbShareAction" role="menuitem" data-action="share" aria-label="링크 복사">
                <span class="material-symbols-outlined" aria-hidden="true">link</span>
                <span>링크 복사</span>
            </button>
            <button type="button" class="editor-ftb-dropdown-item" id="ftbFocusAction" role="menuitem" data-action="focus" aria-label="선택한 순간 보기">
                <span class="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
                <span>선택한 순간 보기</span>
            </button>
        </div>
    `;
}

const mount = document.getElementById('editorFloatingToolbarTemplateMount');
if (mount) {
    mount.outerHTML = buildFloatingToolbarTemplate();
}
