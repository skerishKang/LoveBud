function getEditorRenameI18n() {
    return window.t || function(key) { return key; };
}

function syncEditorTreeTitle(nextTitle) {
    const sidebarTitleEl = document.getElementById('sidebarTreeTitle');
    if (sidebarTitleEl) sidebarTitleEl.textContent = nextTitle;

    document.querySelectorAll('.tree-title-text').forEach((el) => {
        el.textContent = nextTitle;
    });
}

function bindEditorRenameButton(buttonEl, canEdit) {
    if (!buttonEl || buttonEl.dataset.renameBound === '1') return;
    if (canEdit === false) {
        buttonEl.style.display = 'none';
        return;
    }
    buttonEl.dataset.renameBound = '1';

    buttonEl.addEventListener('click', async () => {
        const i18n = getEditorRenameI18n();
        const currentTree = window.currentTreeData || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('treeId');
        if (!treeId) {
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(i18n('rename_tree_missing') || '트리 정보를 찾을 수 없습니다', 'error', 2500);
            }
            return;
        }

        const currentTitle = currentTree.title || (i18n('lovetree_brand') || '러브트리');
        const nextTitle = window.prompt(i18n('rename_tree_prompt') || '새 트리 제목을 입력해 주세요.', currentTitle);
        if (nextTitle === null) return;
        const trimmed = String(nextTitle || '').trim();
        if (!trimmed || trimmed === currentTitle) return;

        try {
            if (window.apiClient && typeof window.apiClient.updateTree === 'function') {
                await window.apiClient.updateTree(treeId, { title: trimmed });
            }
            window.currentTreeData = {
                ...currentTree,
                title: trimmed
            };
            syncEditorTreeTitle(trimmed);
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(i18n('rename_tree_success') || '트리 제목을 변경했습니다', 'success', 2200);
            }
        } catch (error) {
            console.error('[editor] rename tree failed:', error);
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(i18n('rename_tree_error') || '트리 제목 변경에 실패했습니다', 'error', 2600);
            }
        }
    });
}

function injectEditorRenameButton(canEdit) {
    if (canEdit === undefined) {
        canEdit = window.LoveBudEditor?.canEdit;
    }
    bindEditorRenameButton(document.getElementById('renameTreeBtn'), canEdit);
    bindEditorRenameButton(document.getElementById('sidebarTitleEditBtn'), canEdit);
}

window.syncEditorTreeTitle = syncEditorTreeTitle;
window.bindEditorRenameButton = bindEditorRenameButton;
window.injectEditorRenameButton = injectEditorRenameButton;

document.addEventListener('DOMContentLoaded', injectEditorRenameButton);
