(function () {
    const sidebarUI = window.LoveBudEditorSidebarUI || {};

    sidebarUI.updateSidebarTreeActions = function(options) {
        const i18n = options.i18n;
        const safeI18nText = options.safeI18nText;
        const treeId = typeof options.getTreeId === 'function' ? options.getTreeId() : options.treeId;

        const visibilityToggleBtn = document.getElementById('sidebarVisibilityToggleBtn');
        const visibilityToggleLabel = document.getElementById('sidebarVisibilityToggleBtnLabel');
        const visibilityToggleIcon = document.getElementById('sidebarVisibilityToggleBtnIcon');
        if (!visibilityToggleBtn || !visibilityToggleLabel || !visibilityToggleIcon) return;

        const visibility = (window.currentTreeData?.visibility || 'public');
        const isPublic = visibility === 'public';
        const nextActionLabel = isPublic
            ? safeI18nText(i18n, 'editor_make_private', '이 트리 비공개로 전환')
            : safeI18nText(i18n, 'editor_make_public', '이 트리 공개하기');

        visibilityToggleLabel.textContent = nextActionLabel;
        visibilityToggleIcon.textContent = isPublic ? 'lock' : 'public';
        visibilityToggleBtn.setAttribute('aria-label', nextActionLabel);
        visibilityToggleBtn.setAttribute('title', nextActionLabel);
        visibilityToggleBtn.disabled = !treeId;
        visibilityToggleBtn.dataset.idleLabel = nextActionLabel;
        visibilityToggleBtn.dataset.loadingLabel = isPublic
            ? safeI18nText(i18n, 'editor_visibility_loading_private', '비공개로 전환하는 중...')
            : safeI18nText(i18n, 'editor_visibility_loading_public', '공개로 전환하는 중...');
    };

    sidebarUI.bindSidebarVisibilityToggle = function(options) {
        const updateTreeVisibility = options.updateTreeVisibility;
        const showToast = options.showToast;
        const safeI18nText = options.safeI18nText;
        const i18n = options.i18n;
        const getHttpStatus = options.getHttpStatus;
        const updateSidebarStatus = options.updateSidebarStatus;

        const sidebarVisibilityToggleBtn = document.getElementById('sidebarVisibilityToggleBtn');
        const sidebarVisibilityToggleBtnLabel = document.getElementById('sidebarVisibilityToggleBtnLabel');
        const sidebarVisibilityToggleBtnIcon = document.getElementById('sidebarVisibilityToggleBtnIcon');

        if (sidebarVisibilityToggleBtn && sidebarVisibilityToggleBtn.dataset.bound !== '1') {
            sidebarVisibilityToggleBtn.dataset.bound = '1';
            sidebarVisibilityToggleBtn.addEventListener('click', async () => {
                const currentTreeId = typeof options.getTreeId === 'function' ? options.getTreeId() : options.treeId;
                if (!currentTreeId) return;
                const currentVisibility = window.currentTreeData?.visibility || 'public';
                const isCurrentlyPublic = currentVisibility === 'public';
                const idleLabel = sidebarVisibilityToggleBtn.dataset.idleLabel || sidebarVisibilityToggleBtnLabel?.textContent || '';
                const loadingLabel = sidebarVisibilityToggleBtn.dataset.loadingLabel || (isCurrentlyPublic
                    ? safeI18nText(i18n, 'editor_visibility_loading_private', '비공개로 전환하는 중...')
                    : safeI18nText(i18n, 'editor_visibility_loading_public', '공개로 전환하는 중...'));

                sidebarVisibilityToggleBtn.disabled = true;
                if (sidebarVisibilityToggleBtnLabel) {
                    sidebarVisibilityToggleBtnLabel.textContent = loadingLabel;
                }
                if (sidebarVisibilityToggleBtnIcon) {
                    sidebarVisibilityToggleBtnIcon.textContent = 'hourglass_empty';
                }
                try {
                    await updateTreeVisibility(isCurrentlyPublic ? 'private' : 'public');
                    showToast(
                        isCurrentlyPublic
                            ? (i18n('editor_visibility_updated_private') || '이 트리를 비공개로 전환했어요.')
                            : (i18n('editor_visibility_updated_public') || '이 트리를 공개로 전환했어요.'),
                        'success'
                    );
                } catch (error) {
                    console.error('[editor] Failed to toggle sidebar visibility:', error);
                    const status = typeof getHttpStatus === 'function' ? getHttpStatus(error) : (error && error.status ? error.status : 500);
                    const message = String((error && error.message) ? error.message : '');
                    const isPublicationGuard = status === 409 || /공개 순간이|at least 3 public moments/i.test(message);
                    showToast(
                        isPublicationGuard
                            ? (i18n('editor_visibility_guard_failed') || '공개 순간이 3개 이상일 때만 이 트리를 공개할 수 있어요.')
                            : (i18n('editor_visibility_update_failed') || '공개 상태를 바꾸지 못했어요.'),
                        'error'
                    );
                } finally {
                    if (sidebarVisibilityToggleBtnLabel) {
                        sidebarVisibilityToggleBtnLabel.textContent = idleLabel;
                    }
                    if (typeof updateSidebarStatus === 'function') {
                        updateSidebarStatus();
                    }
                }
            });
        }
    };

    window.LoveBudEditorSidebarUI = sidebarUI;
})();
