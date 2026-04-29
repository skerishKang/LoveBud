(function () {
    function createConnectedRenderer({ refs, tText, escapeHtml, buildPageHref, sortTreeMemories, isStructuralRootMemory, buildSoftPanelMarkup }) {
        const { connectedFragments } = refs;

        const buildConnectedEmptyMarkup = ({ treeMomentCount = 0, degradedReason = null } = {}) => buildSoftPanelMarkup({
            icon: 'device_hub',
            kicker: tText('connected_empty_kicker', '이어질 다음 장면'),
            title: degradedReason === 'missing-tree-id'
                ? tText('connected_single_moment_title', '지금은 이 한 순간을 중심으로 감상하고 있어요.')
                : degradedReason === 'tree-load-partial'
                    ? tText('connected_partial_tree_title', '지금은 이 순간 주변의 흐름만 조용히 감상하고 있어요.')
                    : treeMomentCount > 1
                        ? tText('connected_missing_cards_title', '이 트리의 다른 순간은 아직 여기서 또렷하게 펼쳐지지 않았어요.')
                        : tText('connected_empty_title', '지금은 이 순간이 가장 또렷하게 남아 있어요.'),
            description: degradedReason === 'missing-tree-id'
                ? tText('connected_single_moment_desc', '아직 트리 전체 흐름은 보이지 않지만, 이 장면 하나만으로도 남겨진 마음을 조용히 따라가 볼 수 있어요.')
                : degradedReason === 'tree-load-partial'
                    ? tText('connected_partial_tree_desc', '트리 전체 맥락은 아직 흐릿하지만, 지금 보이는 장면과 이어질 감정의 여운은 차분히 따라가 볼 수 있어요.')
                    : treeMomentCount > 1
                        ? `${treeMomentCount}${tText('connected_missing_cards_desc_suffix', '개의 순간이 이 트리에 남아 있지만, 지금은 현재 장면을 중심으로 감정의 흐름을 읽고 있어요.')}`
                        : tText('connected_empty_desc', '아직 같은 흐름의 다른 순간은 보이지 않지만, 이 장면 하나만으로도 트리의 분위기를 천천히 느껴볼 수 있어요.')
        });

        const buildTemporarilyUnavailableMarkup = () => buildSoftPanelMarkup({
            icon: 'schedule',
            kicker: tText('connected_empty_kicker', '이어질 다음 장면'),
            title: tText('connected_temporarily_unavailable_title', '이어진 다른 순간은 잠시 후 다시 또렷해질 거예요.'),
            description: tText('connected_temporarily_unavailable_desc', '지금은 현재 장면을 중심으로 감상하고 있어요. 연결된 흐름은 잠시 후 다시 이어서 볼 수 있을 거예요.')
        });

        const getConnectedFlowMoments = ({ memory, memories }) => {
            const sortedMemories = sortTreeMemories(memories, memory);
            return sortedMemories.filter(item => item.id !== memory.id && !isStructuralRootMemory(item));
        };

        const getConnectedRelationLabel = (targetMemory, currentMemory) => {
            if (!targetMemory || !currentMemory) return tText('connected_relation_same_tree', '같은 트리의 다른 순간');
            if (targetMemory.id === currentMemory.parentId) return tText('connected_relation_previous', '이전에 남겨진 순간');
            if (targetMemory.parentId === currentMemory.id) return tText('connected_relation_next', '이후에 이어진 순간');
            return tText('connected_relation_same_tree', '같은 트리의 다른 순간');
        };

        const buildDetailHref = (memoryId, treeId, sourceContext) => buildPageHref('detail', { id: memoryId, tree: treeId, from: sourceContext });

        const renderConnectedFragments = ({ memory, memories, treeId, sourceContext, degradedReason, treeMomentCount }) => {
          if (!connectedFragments) return;
          const flowMoments = getConnectedFlowMoments({ memory, memories });
          const connectedSection = connectedFragments.closest('.connected-section');
          connectedSection.classList.remove('is-empty', 'is-solo', 'is-threaded');

          if (degradedReason === 'missing-tree-id') {
                connectedFragments.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                        ${buildConnectedEmptyMarkup({ treeMomentCount, degradedReason })}
                    </div>
                `;
                connectedSection.classList.add('is-empty');
                return;
          }

          if (degradedReason === 'memories-load-failed' || degradedReason === 'tree-and-memories-load-failed') {
                connectedFragments.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                        ${buildTemporarilyUnavailableMarkup()}
                    </div>
                `;
                connectedSection.classList.add('is-empty');
                return;
          }

          if (flowMoments.length > 0) {
                connectedFragments.innerHTML = flowMoments.map(moment => {
                    const href = buildDetailHref(moment.id, treeId, sourceContext);
                    const relationLabel = getConnectedRelationLabel(moment, memory);
                    const thumbnailMarkup = moment.thumbnail
                        ? `<img src="${escapeHtml(moment.thumbnail)}" alt="${escapeHtml(moment.title || '')}" style="width: 76px; height: 76px; border-radius: 1rem; object-fit: cover;">`
                        : `<div style="width:76px;height:76px;border-radius:1rem;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg, rgba(250,246,243,0.98), rgba(255,255,255,0.98));border:1px solid rgba(144,73,81,0.08);color:var(--primary);flex-shrink:0;">
                                <span class="material-symbols-outlined" style="font-size:28px;">favorite</span>
                           </div>`;

                    return `
                        <div class="moment-card" data-detail-href="${href}" tabindex="0" role="link">
                            ${thumbnailMarkup}
                            <div style="min-width:0;">
                                <div style="font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.06em;">${escapeHtml(relationLabel)}</div>
                                <div style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; margin-bottom: 4px;">${escapeHtml(moment.timestamp || '')}</div>
                                <div style="font-weight: 800; color: var(--on-surface); font-size: 15px; line-height:1.45; margin-bottom: 4px;">${escapeHtml(moment.title || tText('tree_context_moment', '순간 상세'))}</div>
                                <div style="font-size: 12px; color: var(--on-surface-variant); line-height:1.5;">${escapeHtml(moment.artist || '')}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                connectedFragments.querySelectorAll('.moment-card[data-detail-href]').forEach(card => {
                    const navigate = () => {
                        const href = card.getAttribute('data-detail-href');
                        if (href) window.location.href = href;
                    };
                    card.addEventListener('click', navigate);
                    card.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate();
                        }
                    });
                });
                connectedSection.classList.add(flowMoments.length >= 2 ? 'is-threaded' : 'is-solo');
          } else {
            connectedFragments.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                    ${buildConnectedEmptyMarkup({ treeMomentCount, degradedReason })}
                </div>
            `;
            connectedSection.classList.add('is-empty');
          }
        };

        return {
            buildConnectedEmptyMarkup,
            buildTemporarilyUnavailableMarkup,
            getConnectedFlowMoments,
            getConnectedRelationLabel,
            renderConnectedFragments
        };
    }

    window.LoveBudDetailConnected = { createConnectedRenderer };
})();
