(function () {
    function createEditorDetailSidebarStatusBoundary(deps) {
        const {
            i18n,
            formatI18nText,
            resolveTreeTitleText,
            getCurrentTreeData,
            getTreeState
        } = deps;

        const escapeHtml = (value) => {
            const sec = window.LoveBudSecurity;
            if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(value);
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const updateFlowSummary = (treeState) => {
            const flowSummaryEl = document.getElementById('sidebarFlowSummary');
            if (!flowSummaryEl) return;

            const currentTreeData = getCurrentTreeData() || {};
            const count = treeState.totalMomentCount || 0;
            const timeRange = String(currentTreeData.timeRange || currentTreeData.time_range || '').trim();

            if (count === 0) {
                flowSummaryEl.textContent = formatI18nText(
                    'editor_tree_status_empty',
                    '아직 첫 순간을 기다리고 있어요.'
                );
            } else {
                const safeTimeRange = escapeHtml(timeRange);

                if (timeRange) {
                    flowSummaryEl.innerHTML = formatI18nText(
                        'editor_sidebar_tree_summary_with_range',
                        '<p class="preview-summary-line">이 트리에 담긴 <strong>{count}개의 순간</strong>이 <strong>{timeRange}</strong>에 걸쳐 이어졌어요.</p>',
                        { count: String(count), timeRange: safeTimeRange }
                    );
                } else {
                    flowSummaryEl.innerHTML = formatI18nText(
                        'editor_sidebar_tree_summary',
                        '<p class="preview-summary-line">이 트리에 담긴 <strong>{count}개의 순간</strong>이 이어졌어요.</p>',
                        { count: String(count) }
                    );
                }
            }
        };

        const updateMomentFlow = (treeState) => {
            const journeyEl = document.getElementById('sidebarMomentJourney');
            const flowEl = document.getElementById('sidebarMomentFlow');
            if (!journeyEl || !flowEl) return;

            const memories = Array.isArray(treeState.treeMemories) ? treeState.treeMemories : [];
            flowEl.replaceChildren();
            journeyEl.hidden = memories.length === 0;
            if (memories.length === 0) return;

            memories.slice(0, 3).forEach((memory, index) => {
                const chip = document.createElement('span');
                chip.className = 'editor-sidebar-moment-chip';

                const order = document.createElement('strong');
                order.textContent = String(index + 1);

                const title = document.createElement('span');
                title.textContent = String(memory?.title || memory?.name || `순간 ${index + 1}`);

                chip.append(order, title);
                flowEl.appendChild(chip);
            });

            if (memories.length > 3) {
                const more = document.createElement('span');
                more.className = 'editor-sidebar-moment-more';
                more.textContent = `+${memories.length - 3}`;
                more.setAttribute('aria-label', `이어진 순간 ${memories.length - 3}개 더 있음`);
                flowEl.appendChild(more);
            }
        };

        const resolveCount = (source, keys) => {
            for (let index = 0; index < keys.length; index += 1) {
                const rawValue = source?.[keys[index]];
                if (rawValue === undefined || rawValue === null || rawValue === '') continue;
                if (typeof rawValue !== 'number' && typeof rawValue !== 'string') continue;
                const value = Number(rawValue);
                if (Number.isFinite(value) && value >= 0) return Math.floor(value);
            }
            return null;
        };

        const updateTreeReactions = (currentTreeData) => {
            const reactionsEl = document.getElementById('editorTreeReactions');
            const likeMetricEl = document.getElementById('editorTreeLikeMetric');
            const commentMetricEl = document.getElementById('editorTreeCommentMetric');
            const likeCountEl = document.getElementById('editorTreeLikeCount');
            const commentCountEl = document.getElementById('editorTreeCommentCount');
            const likeCount = resolveCount(currentTreeData, ['likeCount', 'like_count', 'likesCount', 'likes']);
            const commentCount = resolveCount(currentTreeData, ['commentCount', 'comment_count', 'commentsCount']);

            if (likeCountEl && likeCount !== null) likeCountEl.textContent = String(likeCount);
            if (commentCountEl && commentCount !== null) commentCountEl.textContent = String(commentCount);
            if (likeMetricEl) likeMetricEl.hidden = likeCount === null;
            if (commentMetricEl) commentMetricEl.hidden = commentCount === null;
            if (reactionsEl) reactionsEl.hidden = likeCount === null && commentCount === null;
        };

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const currentTreeData = getCurrentTreeData();
            const treeState = getTreeState();

            if (treeTitleEl) {
                treeTitleEl.textContent = resolveTreeTitleText(i18n, currentTreeData?.title);
            }

            // Tree-level summary (replaces moment-selected summary, #1128)
            updateMomentFlow(treeState);
            updateFlowSummary(treeState);
            updateTreeReactions(currentTreeData || {});

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
