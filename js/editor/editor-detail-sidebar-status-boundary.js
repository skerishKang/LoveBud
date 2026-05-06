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

        const formatCountLabel = (treeState) => {
            const total = treeState.totalMomentCount;
            const visible = treeState.visibleMomentCount;
            if (!treeState.hasMoments) {
                return formatI18nText('sidebar_moment_count_empty_short', '첫 순간 준비 중');
            }
            if (total !== visible) {
                return formatI18nText(
                    'sidebar_moment_count_with_visible_short',
                    '총 {total}개의 저장된 순간 · 캔버스 {visible}개 표시',
                    { total, visible }
                );
            }
            return formatI18nText('sidebar_moment_count_short', '총 {count}개의 저장된 순간', { count: total });
        };

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const visibilityEl = document.getElementById('sidebarTreeVisibility');
            const momentCountEl = document.getElementById('sidebarMomentCount');
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            const hintEl = document.getElementById('sidebarSelectionHint');
            const currentTreeData = getCurrentTreeData();
            const selectedNodeId = getSelectedNodeId();
            const treeState = getTreeState();
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
                momentCountEl.textContent = formatCountLabel(treeState);
            }
            if (flowSummaryEl) {
                flowSummaryEl.textContent = selected?.title
                    ? formatI18nText('sidebar_flow_summary_selected_short', '지금은 "{title}" 순간을 보고 있어요', { title: selected.title })
                    : treeState.hasMoments
                        ? formatI18nText('sidebar_flow_summary_connected_short', '이 트리에 {count}개의 순간이 저장되어 있어요', { count: treeState.totalMomentCount })
                        : formatI18nText('sidebar_flow_summary_empty_short', '첫 순간을 심으면 감정의 흐름이 여기서 시작됩니다.');
            }
            if (hintEl) {
                hintEl.textContent = selected?.title
                    ? formatI18nText('sidebar_canvas_hint_selected', '선택한 순간을 중심으로 트리를 둘러보세요.')
                    : formatI18nText('sidebar_canvas_hint_empty', '첫 순간을 심으면 감정이 여기서 시작돼요.');
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
                    ? formatI18nText('editor_add_first_memory_eyebrow', '첫 순간에서')
                    : i18n('editor_add_memory_eyebrow');
            }
            if (addMemoryIntro) {
                addMemoryIntro.textContent = isEmptyTree
                    ? formatI18nText('editor_empty_tree_hint_short', '첫 순간이 여기서 시작돼요.')
                    : formatI18nText('editor_next_memory_hint_short', '다음 순간을 이어가 보세요.');
            }
        };

        return {
            updateSidebarStatus
        };
    }

    window.createEditorDetailSidebarStatusBoundary = createEditorDetailSidebarStatusBoundary;
})();
