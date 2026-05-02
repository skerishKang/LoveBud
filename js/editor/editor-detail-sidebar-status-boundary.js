(function () {
    function createEditorDetailSidebarStatusBoundary(deps) {
        const {
            i18n,
            formatI18nText,
            resolveTreeTitleText,
            getCurrentTreeData,
            getSelectedNodeId,
            getTreeState
        } = deps;

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const visibilityEl = document.getElementById('sidebarTreeVisibility');
            const momentCountEl = document.getElementById('sidebarMomentCount');
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            const hintEl = document.getElementById('sidebarSelectionHint');
            const currentTreeData = getCurrentTreeData();
            const selectedNodeId = getSelectedNodeId();
            const treeState = getTreeState();
            const count = treeState.visibleMomentCount;
            const selected = treeState.treeMemories.find(m => m.id === selectedNodeId);
            const visibility = currentTreeData?.visibility || 'public';
            const isPublic = visibility === 'public';

            if (treeTitleEl) {
                treeTitleEl.textContent = resolveTreeTitleText(currentTreeData?.title);
            }
            if (visibilityEl) {
                visibilityEl.textContent = isPublic
                    ? formatI18nText('editor_sidebar_public_tree', '공개 러브트리')
                    : formatI18nText('editor_sidebar_private_tree', '비공개 러브트리');
                visibilityEl.classList.toggle('is-public', isPublic);
                visibilityEl.classList.toggle('is-private', !isPublic);
            }
            if (momentCountEl) {
                momentCountEl.textContent = treeState.hasVisibleMoments
                    ? formatI18nText('sidebar_moment_count_short', `총 ${count}개의 순간`, { count })
                    : formatI18nText('sidebar_moment_count_empty_short', '첫 순간 준비 중');
            }
            if (flowSummaryEl) {
                flowSummaryEl.textContent = selected?.title
                    ? formatI18nText('sidebar_flow_summary_selected_short', `지금은 "{title}"에 마음이 머물러 있어요.`, { title: selected.title })
                    : treeState.hasVisibleMoments
                        ? formatI18nText('sidebar_flow_summary_connected_short', `이 트리에 {count}개의 순간이 이어져 있어요.`, { count })
                        : formatI18nText('sidebar_flow_summary_empty_short', '첫 순간을 심으면 감정의 흐름이 여기서 시작됩니다.');
            }
            if (hintEl) {
                hintEl.textContent = selected?.title
                    ? formatI18nText('sidebar_canvas_hint_selected', '빈 공간을 드래그해 이동하고, “트리 한눈에 보기”로 전체 흐름을 다시 볼 수 있어요.')
                    : formatI18nText('sidebar_canvas_hint_empty', '트리가 화면 밖으로 밀리면 “트리 한눈에 보기”로 다시 가운데에 맞출 수 있어요.');
                hintEl.style.fontStyle = 'normal';
                hintEl.style.color = 'var(--on-surface-variant)';
            }

            const addMemoryBtnLabel = document.getElementById('addMemoryBtnLabel');
            const addMemoryEyebrow = document.getElementById('addMemoryEyebrow');
            const addMemoryIntro = document.getElementById('addMemoryIntro');
            const isEmptyTree = !treeState.hasVisibleMoments;

            if (addMemoryBtnLabel) {
                addMemoryBtnLabel.textContent = isEmptyTree
                    ? i18n('editor_add_first_memory')
                    : i18n('editor_add_next_memory');
            }
            if (addMemoryEyebrow) {
                addMemoryEyebrow.textContent = isEmptyTree
                    ? formatI18nText('editor_add_first_memory_eyebrow', '첫 순간 심기')
                    : i18n('editor_add_memory_eyebrow');
            }
            if (addMemoryIntro) {
                addMemoryIntro.textContent = isEmptyTree
                    ? formatI18nText('editor_empty_tree_hint_short', '이 트리의 첫 장면을 남기면 가운데 캔버스에 감정의 흐름이 열립니다.')
                    : formatI18nText('editor_next_memory_hint_short', '지금 머문 장면 다음에 새로운 순간을 이어 심어 보세요.');
            }
        };

        return {
            updateSidebarStatus
        };
    }

    window.createEditorDetailSidebarStatusBoundary = createEditorDetailSidebarStatusBoundary;
})();
