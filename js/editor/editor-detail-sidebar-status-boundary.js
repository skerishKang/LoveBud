(function () {
    function createEditorDetailSidebarStatusBoundary(deps) {
        const {
            i18n,
            formatI18nText,
            resolveTreeTitleText,
            getCurrentTreeData,
            getTreeState
        } = deps;

        const updateEntrypoints = () => {
            const publicViewerBtn = document.getElementById('sidebarPublicViewerBtn');
            const insightsBtn = document.getElementById('sidebarInsightsBtn');

            // Hide sidebar action buttons; replaced by tree summary (#1128)
            if (publicViewerBtn) {
                publicViewerBtn.style.display = 'none';
            }
            if (insightsBtn) {
                insightsBtn.style.display = 'none';
            }
        };

        const updateFlowSummary = (treeState) => {
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            if (!flowSummaryEl) return;

            const count = treeState.totalMomentCount || 0;

            if (count === 0) {
                flowSummaryEl.textContent = formatI18nText(
                    'editor_tree_status_empty',
                    '아직 첫 순간을 기다리고 있어요.'
                );
            } else if (count === 1) {
                flowSummaryEl.textContent = formatI18nText(
                    'sidebar_flow_summary_one_moment',
                    '첫 순간이 심어진 러브트리예요.'
                );
            } else {
                flowSummaryEl.textContent = formatI18nText(
                    'sidebar_flow_summary_connected',
                    '{count}개의 순간이 이어진 러브트리예요.',
                    { count: String(count) }
                );
            }
        };

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            const hintEl = document.getElementById('sidebarSelectionHint');
            const currentTreeData = getCurrentTreeData();
            const treeState = getTreeState();

            if (treeTitleEl) {
                treeTitleEl.textContent = resolveTreeTitleText(i18n, currentTreeData?.title);
            }

            // Tree-level summary (replaces moment-selected summary, #1128)
            updateFlowSummary(treeState);

            if (hintEl) {
                // Tree cue based on first visible moment title
                const firstMoment = treeState.treeMemories.find(m => m.id !== 'root' && m.parentId);
                if (firstMoment?.title) {
                    hintEl.textContent = formatI18nText(
                        'sidebar_flow_cue_first_moment',
                        '첫 순간 "{title}"에서 이어진 감정 흐름을 정리하고 있어요.',
                        { title: firstMoment.title }
                    );
                } else {
                    hintEl.textContent = formatI18nText(
                        'sidebar_flow_cue_empty',
                        '캔버스에서 순간을 선택하면 오른쪽 패널에서 자세히 볼 수 있어요.'
                    );
                }
                hintEl.style.fontStyle = 'normal';
                hintEl.style.color = 'var(--on-surface-variant)';
            }

            // Update entrypoints (public viewer, insights)
            updateEntrypoints();

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
