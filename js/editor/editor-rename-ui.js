function injectEditorRenameButton() {
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 400;

    function syncTreeTitleEverywhere(nextTitle) {
        const sidebarTitleEl = document.getElementById('sidebarTreeTitle');
        if (sidebarTitleEl) sidebarTitleEl.textContent = nextTitle;

        document.querySelectorAll('.tree-title-text').forEach((el) => {
            el.textContent = nextTitle;
        });
    }

    function bindRenameButton(buttonEl) {
        if (!buttonEl || buttonEl.dataset.renameBound === '1') return;
        buttonEl.dataset.renameBound = '1';

        buttonEl.addEventListener('click', async () => {
            const currentTree = window.currentTreeData || {};
            const treeId = currentTree.id || new URLSearchParams(window.location.search).get('treeId');
            if (!treeId) {
                if (window.LoveBudUI?.showToast) {
                    window.LoveBudUI.showToast('트리 정보를 찾을 수 없습니다', 'error', 2500);
                }
                return;
            }

            const currentTitle = currentTree.title || '러브트리';
            const nextTitle = window.prompt('새 트리 제목을 입력해 주세요.', currentTitle);
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
                syncTreeTitleEverywhere(trimmed);
                if (window.LoveBudUI?.showToast) {
                    window.LoveBudUI.showToast('트리 제목을 변경했습니다', 'success', 2200);
                }
            } catch (error) {
                console.error('[editor] rename tree failed:', error);
                if (window.LoveBudUI?.showToast) {
                    window.LoveBudUI.showToast('트리 제목 변경에 실패했습니다', 'error', 2600);
                }
            }
        });
    }

    function attemptInject() {
        attempts += 1;
        const inlineButton = document.getElementById('renameTreeBtn');
        const legacyButton = document.getElementById('renameTreeSidebarBtn');
        const hintEl = document.getElementById('sidebarSelectionHint');

        if (inlineButton) {
            bindRenameButton(inlineButton);
        } else if (attempts < maxAttempts) {
            setTimeout(attemptInject, retryDelay);
            return;
        }

        if (legacyButton) {
            legacyButton.remove();
        }

        if (hintEl) {
            const baseHint = hintEl.dataset.baseHintText || hintEl.textContent || '첫 순간을 추가해 트리를 시작해 보세요.';
            hintEl.dataset.baseHintText = baseHint;
            if (!hintEl.textContent.includes('드래그')) {
                hintEl.textContent = `${baseHint} · 빈 공간 드래그로 화면 이동, 순간 드래그로 위치 조정`;
            }
        }
    }

    attemptInject();
}

window.injectEditorRenameButton = injectEditorRenameButton;
document.addEventListener('DOMContentLoaded', injectEditorRenameButton);