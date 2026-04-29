(function () {
    function createCopyHelpers({ refs, tText }) {
        const {
            detailHeroTitle,
            detailHeroDesc,
            detailHeroKicker,
            detailViewChipLabel,
            detailSideSummary,
            connectedKicker,
            connectedTitle,
            connectedSummary,
            growthLabel
        } = refs;

        const getHeroFallbackTitle = (memory) => {
            const artist = String(memory?.artist || '').trim();
            if (artist) {
                return `${artist}${tText('public_tree_fallback_title_with_artist_suffix', '에게 마음이 닿기 시작한 순간을 감상하고 있어요')}`;
            }
            return tText('public_tree_fallback_title', '누군가의 러브트리를 감상하고 있어요');
        };

        const getHeroFallbackDesc = ({ memoryCount, memoryTitleText }) => {
            if (memoryTitleText) {
                return `“${memoryTitleText}”${tText('public_tree_desc_fallback_with_memory_suffix', '에서 시작된 마음을 따라가고 있어요.')}`;
            }
            const baseCount = memoryCount > 0 ? memoryCount : 1;
            return `${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요.')}`;
        };

        const applyViewingPageCopy = ({ sourceContext, treeTitle, memoryTitleText, treeMomentCount, connectedCount, memory, degradedReason }) => {
            const isMissingTreeId = degradedReason === 'missing-tree-id';
            const isTreeDegraded = degradedReason === 'tree-load-partial' || degradedReason === 'tree-and-memories-load-failed';

            if (detailViewChipLabel) {
                detailViewChipLabel.textContent = isMissingTreeId
                    ? tText('single_moment_view_chip', '한 순간 감상')
                    : isTreeDegraded
                        ? tText('moment_centered_view_chip', '지금은 이 순간 중심 감상')
                        : tText('public_tree_view_chip', '공개 러브트리 감상');
            }
            if (detailHeroKicker) {
                detailHeroKicker.textContent = isMissingTreeId
                    ? tText('single_moment_kicker', '남겨진 한 순간')
                    : isTreeDegraded
                        ? tText('moment_centered_kicker', '지금은 이 순간 중심 감상')
                        : tText('public_tree_kicker', '공개 러브트리');
            }
            if (detailHeroTitle) {
                detailHeroTitle.textContent = isMissingTreeId
                    ? (memoryTitleText || tText('single_moment_fallback_title', '이 순간에 남겨진 마음을 감상하고 있어요'))
                    : treeTitle || getHeroFallbackTitle(memory);
            }
            if (detailHeroDesc) {
                const baseCount = treeMomentCount > 0 ? treeMomentCount : 1;
                if (isMissingTreeId) {
                    detailHeroDesc.textContent = memoryTitleText
                        ? `“${memoryTitleText}” ${tText('single_moment_hero_desc', '하나에 남겨진 감정을 따라가고 있어요.')}`
                        : tText('single_moment_hero_desc_fallback', '지금 남아 있는 이 장면 하나를 중심으로 감상하고 있어요.');
                } else if (isTreeDegraded) {
                    detailHeroDesc.textContent = tText('tree_partial_hero_desc', '지금 남아 있는 이 순간을 중심으로 감정의 결을 보고 있어요.');
                } else {
                    detailHeroDesc.textContent = treeTitle
                        ? `${treeTitle}${tText('public_tree_desc_join', ' 안에서')} ${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요.')}`
                        : getHeroFallbackDesc({ memoryCount: baseCount, memoryTitleText });
                }
            }
            if (detailSideSummary) {
                detailSideSummary.textContent = memoryTitleText
                    ? `“${memoryTitleText}” ${tText('current_moment_side_summary', '순간에 남겨진 마음을 천천히 읽어보세요.')}`
                    : tText('current_moment_side_summary_fallback', '지금 이 순간에 남겨진 마음을 천천히 읽어보세요.');
            }
            if (connectedKicker) {
                connectedKicker.textContent = isMissingTreeId
                    ? tText('single_moment_connected_kicker', '지금 머무는 장면')
                    : tText('connected_flow_kicker', '이어진 흐름');
            }
            if (connectedTitle) {
                connectedTitle.textContent = isMissingTreeId
                    ? tText('single_moment_connected_title', '지금은 이 순간을 중심으로 감상 중이에요')
                    : tText('connected_flow_title', '이 트리의 이어진 기억');
            }
            if (connectedSummary) {
                if (isMissingTreeId) {
                    connectedSummary.textContent = tText('single_moment_connected_summary', '지금 남아 있는 이 장면과 마음부터 따라가 볼 수 있어요.');
                } else if (connectedCount > 0) {
                    connectedSummary.textContent = treeMomentCount > 1
                        ? `${treeMomentCount}${tText('connected_flow_count_suffix', '개의 순간 가운데 지금 장면과 함께 읽히는 기억을 이어서 살펴보세요.')}`
                        : tText('connected_flow_summary', '이 공개 러브트리 안에서 함께 이어지는 순간을 따라가 보세요.');
                } else if (degradedReason === 'memories-load-failed' || degradedReason === 'tree-and-memories-load-failed') {
                    connectedSummary.textContent = tText('connected_flow_temporarily_unavailable_summary', '지금은 이 순간 하나를 중심으로 감상하고 있어요.');
                } else if (isTreeDegraded) {
                    connectedSummary.textContent = tText('connected_flow_partial_tree_summary', '지금 보이는 이 장면을 중심으로 감정의 결을 따라가고 있어요.');
                } else if (treeMomentCount > 1) {
                    connectedSummary.textContent = tText('connected_flow_empty_summary', '지금은 이 순간이 가장 먼저 또렷하게 열려 있어요.');
                } else {
                    connectedSummary.textContent = tText('connected_flow_single_summary', '지금은 이 장면 하나를 중심으로 감상하고 있어요.');
                }
            }

            if (growthLabel) {
                const growthMap = {
                    browse: tText('public_tree_growth_label', '공개 트리 감상 중'),
                    'my-trees': tText('my_tree_growth_label', '내 트리를 다시 감상 중'),
                    editor: tText('editor_tree_growth_label', '편집 트리를 감상 모드로 확인 중')
                };
                growthLabel.textContent = isMissingTreeId
                    ? tText('single_moment_growth_label', '한 순간 감상 중')
                    : isTreeDegraded
                        ? tText('moment_centered_growth_label', '지금은 이 순간 중심 감상 중')
                        : (growthMap[sourceContext] || growthMap.browse);
            }
        };

        return {
            getHeroFallbackTitle,
            getHeroFallbackDesc,
            applyViewingPageCopy
        };
    }

    window.LoveBudDetailCopy = { createCopyHelpers };
})();
