export function buildFloatingToolbarTemplate() {
    return `
        <div id="editorFloatingToolbar" class="editor-floating-toolbar is-hidden" role="toolbar" aria-label="선택한 순간 도구" style="display:none;">
            <button type="button" class="editor-floating-toolbar-btn" id="ftbEditBtn" aria-label="순간 수정" title="순간 수정">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                <span class="editor-floating-toolbar-label">순간 수정</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn editor-floating-toolbar-btn-primary" id="ftbContinueBtn" aria-label="이 순간에서 이어가기" title="이 순간에서 이어가기">
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                <span class="editor-floating-toolbar-label">이 순간에서 이어가기</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn" id="ftbViewBtn" aria-label="감상하기" title="감상하기">
                <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                <span class="editor-floating-toolbar-label">감상하기</span>
            </button>
            <button type="button" class="editor-floating-toolbar-btn editor-ftb-more-btn" id="ftbMoreBtn" aria-label="더 보기" title="더 보기" aria-expanded="false" aria-haspopup="true">
                <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
            </button>
            <div id="ftbDropdown" class="editor-ftb-dropdown is-hidden" role="menu" aria-label="추가 행동" style="display:none;">
                <button type="button" class="editor-ftb-dropdown-item" id="ftbBranchBtn" role="menuitem" aria-label="기존 순간 연결하기" title="이미 기록한 순간을 현재 흐름에 이어 붙여요">
                    <span class="material-symbols-outlined" aria-hidden="true">link</span>
                    <span>기존 순간 연결하기</span>
                </button>
                <button type="button" class="editor-ftb-dropdown-item" id="ftbForkBtn" role="menuitem" aria-label="분기하기" aria-hidden="true" tabindex="-1" hidden style="display:none;">
                    <span class="material-symbols-outlined" aria-hidden="true">fork_right</span>
                    <span>분기하기</span>
                </button>
                <div class="editor-ftb-dropdown-divider editor-ftb-branch-divider" aria-hidden="true"></div>
                <button type="button" class="editor-ftb-dropdown-item" id="ftbScoutAction" role="menuitem" data-action="scout" aria-label="Scout로 순간 저장">
                    <span class="material-symbols-outlined" aria-hidden="true">scanner</span>
                    <span data-i18n="scout_trigger_label">Scout로 순간 저장</span>
                </button>
                <button type="button" class="editor-ftb-dropdown-item" id="ftbFocusAction" role="menuitem" data-action="focus" aria-label="선택한 순간 보기">
                    <span class="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
                    <span>선택한 순간 보기</span>
                </button>
                <button type="button" class="editor-ftb-dropdown-item" id="ftbShareAction" role="menuitem" data-action="share" aria-label="링크 복사">
                    <span class="material-symbols-outlined" aria-hidden="true">link</span>
                    <span>링크 복사</span>
                </button>
                <button type="button" class="editor-ftb-dropdown-item editor-ftb-dropdown-item-danger" id="ftbDeleteAction" role="menuitem" data-action="delete" aria-label="순간 삭제">
                    <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                    <span>순간 삭제</span>
                    <span class="editor-ftb-shortcut-hint">Del</span>
                </button>
            </div>
        </div>
        <!-- Floating toolbar tooltip (moment info on hover) -->
        <div id="ftbTooltip" class="editor-floating-tooltip is-hidden" role="tooltip" aria-hidden="true" style="display:none;"></div>
        <!-- Quick-add signifier near selected node -->
        <button type="button" id="ftbQuickAdd" class="editor-floating-quick-add is-hidden" aria-label="빠른 추가" title="빠른 추가" style="display:none;">
            <span class="material-symbols-outlined" aria-hidden="true">add</span>
        </button>
    `;
}

const mount = document.getElementById('editorFloatingToolbarTemplateMount');
if (mount) {
    mount.outerHTML = buildFloatingToolbarTemplate();
}
