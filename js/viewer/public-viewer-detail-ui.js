(function() {
    'use strict';

    function createPublicViewerUpdateFocusSelectedBtn(deps) {
        var getSelectedNodeId = deps && typeof deps.getSelectedNodeId === 'function'
            ? deps.getSelectedNodeId
            : function() { return null; };

        return function updatePublicViewerFocusSelectedBtn() {
            var btn = document.getElementById('focusSelectedBtn');
            if (!btn) return;

            var hasSelection = !!getSelectedNodeId();
            btn.disabled = !hasSelection;
            btn.classList.toggle('is-disabled', !hasSelection);
        };
    }

    function updatePublicViewerSidebarStatus() {}

    function createPublicViewerSetDetailEmptyState(deps) {
        return function setPublicViewerDetailEmptyState(isEmpty) {
            var detailContent = document.getElementById('detailContent');
            if (!detailContent) return;

            var emptyState = document.getElementById('detailEmptyState');
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.id = 'detailEmptyState';
                emptyState.innerHTML = '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span><p style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--on-surface);">첫 순간이 트리를 깨워요</p><p style="font-size:0.9rem;opacity:0.78;line-height:1.6;">첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.</p></div>';
                detailContent.appendChild(emptyState);
            }

            var viewMode = document.getElementById('detailViewMode');
            var footer = document.getElementById('detailPanelFooter');

            if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
            if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'block';
            if (footer) footer.style.display = isEmpty ? 'none' : '';
        };
    }

    function createPublicViewerDetailUI(deps) {
        if (typeof window.createEditorDetailUI !== 'function') {
            throw new Error('createEditorDetailUI is required for public viewer detail UI adapter');
        }

        var detailUI = window.createEditorDetailUI(deps);
        detailUI.updateFocusSelectedBtn = createPublicViewerUpdateFocusSelectedBtn(deps);
        detailUI.updateSidebarStatus = updatePublicViewerSidebarStatus;
        detailUI.setDetailEmptyState = createPublicViewerSetDetailEmptyState(deps);
        return detailUI;
    }

    window.createPublicViewerDetailUI = createPublicViewerDetailUI;
    window.LoveBudPublicViewerDetailUI = {
        createPublicViewerDetailUI: createPublicViewerDetailUI,
        createPublicViewerUpdateFocusSelectedBtn: createPublicViewerUpdateFocusSelectedBtn,
        updatePublicViewerSidebarStatus: updatePublicViewerSidebarStatus,
        createPublicViewerSetDetailEmptyState: createPublicViewerSetDetailEmptyState,
        delegatesToEditorDetailUI: true
    };
})();
