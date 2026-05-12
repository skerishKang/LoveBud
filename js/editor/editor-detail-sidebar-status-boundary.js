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

        const getEditorBasePath = () => {
            return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        };

        const updateEntrypoints = () => {
            const publicViewerBtn = document.getElementById('sidebarPublicViewerBtn');
            const insightsBtn = document.getElementById('sidebarInsightsBtn');
            const currentTreeData = getCurrentTreeData();
            const treeId = currentTreeData?.id || null;

            // Public viewer entrypoint
            if (publicViewerBtn) {
                if (treeId) {
                    const publicViewerHref = getEditorBasePath() + 'tree?treeId=' + encodeURIComponent(treeId);
                    publicViewerBtn.disabled = false;
                    publicViewerBtn.removeAttribute('aria-disabled');
                    // Replace button with link-like behavior
                    publicViewerBtn.onclick = function() {
                        window.location.href = publicViewerHref;
                    };
                } else {
                    publicViewerBtn.disabled = true;
                    publicViewerBtn.setAttribute('aria-disabled', 'true');
                    publicViewerBtn.onclick = null;
                }
            }

            // Insights entrypoint — always disabled (future)
            if (insightsBtn) {
                insightsBtn.disabled = true;
                insightsBtn.setAttribute('aria-disabled', 'true');
                insightsBtn.onclick = null;
            }
        };

        const updateFlowSummary = (treeState, selected) => {
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            if (!flowSummaryEl) return;

            const count = treeState.totalMomentCount || 0;

            if (selected?.title) {
                // Moment selected — show which moment
                flowSummaryEl.textContent = formatI18nText(
                    'sidebar_flow_summary_selected_short',
                    '지금은 "{title}" 순간을 보고 있어요',
                    { title: selected.title }
                );
            } else if (count === 0) {
                flowSummaryEl.textContent = formatI18nText(
                    'editor_tree_status_empty',
                    '아직 첫 순간을 기다리고 있어요.'
                );
            } else if (count === 1) {
                flowSummaryEl.textContent = formatI18nText(
                    'sidebar_flow_summary_one_moment',
                    '첫 순간이 심어졌어요.'
                );
            } else {
                flowSummaryEl.textContent = formatI18nText(
                    'sidebar_flow_summary_connected_short',
                    '{count}개의 순간으로 이어지고 있어요.',
                    { count: String(count) }
                );
            }
        };

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            const hintEl = document.getElementById('sidebarSelectionHint');
            const currentTreeData = getCurrentTreeData();
            const selectedNodeId = getSelectedNodeId();
            const treeState = getTreeState();
            const selected = treeState.treeMemories.find(m => m.id === selectedNodeId);

            if (treeTitleEl) {
                treeTitleEl.textContent = resolveTreeTitleText(i18n, currentTreeData?.title);
            }

            // Contextual flow summary (replaces raw moment count)
            updateFlowSummary(treeState, selected);

            if (hintEl) {
                hintEl.textContent = selected?.title
                    ? formatI18nText('sidebar_canvas_hint_selected', '선택한 순간을 중심으로 트리를 둘러보세요.')
                    : formatI18nText('sidebar_canvas_hint_empty', '첫 순간을 심으면 감정이 여기서 시작돼요.');
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
