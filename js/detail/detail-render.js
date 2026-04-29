(function () {
    function createRenderers({ refs, tText, escapeHtml, getLocalizedTagLabel, buildSoftPanelMarkup, buildVideoMainMarkup, resolveTreeMomentCount, homeHref, searchHref }) {
        const {
            videoMain,
            memoryTitle,
            diaryQuote,
            diaryContent,
            detailArtist,
            detailDate,
            detailSubtitle,
            tagsContainer,
            treeContextEl
        } = refs;

        const buildEmptyMemoMarkup = () => buildSoftPanelMarkup({
            icon: 'auto_stories',
            kicker: tText('empty_memo_kicker', '남겨진 마음'),
            title: tText('empty_memo_title', '아직 길게 남겨진 메모는 없지만, 이 순간의 여운은 그대로 머물러 있어요.'),
            description: tText('empty_memo_desc', '짧은 장면 하나만으로도 시작되는 감정이 있어요. 이 러브트리는 그 조용한 시작까지 함께 감상하는 공간이에요.')
        });

        const setMetaPillVisibility = (valueEl, value) => {
            if (!valueEl) return;
            const pill = valueEl.closest('.detail-meta-pill');
            const hasValue = typeof value === 'string' ? value.trim().length > 0 : !!value;
            if (pill) pill.style.display = hasValue ? '' : 'none';
            valueEl.style.display = hasValue ? '' : 'none';
            if (hasValue) valueEl.textContent = value;
        };

        const renderMemoryBase = (memory) => {
            if (videoMain) videoMain.innerHTML = buildVideoMainMarkup(memory);

        if (memoryTitle) memoryTitle.textContent = memory.title || tText('tree_context_moment', '순간 상세');
        setMetaPillVisibility(detailArtist, memory.artist || '');
        const dateText = (memory.timestamp || '') + (memory.source ? ' · ' + memory.source : '');
        setMetaPillVisibility(detailDate, dateText);
        if (detailSubtitle) detailSubtitle.textContent = tText('current_moment_kicker', '지금 감상 중인 순간');

        if (tagsContainer) {
            const renderedTags = Array.isArray(memory.emotionTags)
                ? memory.emotionTags
                    .map(tag => getLocalizedTagLabel(tag))
                    .filter(Boolean)
                    .map(tag => `<span class="tag-chip active">${escapeHtml(tag)}</span>`)
                    .join('')
                : '';
            tagsContainer.innerHTML = renderedTags;
        }

        const quoteText = String(memory.quote || '').trim();
        const memoText = String(memory.memo || '').trim();
        if (diaryQuote) {
            diaryQuote.textContent = quoteText ? `\"${quoteText}\"` : tText('empty_memo_quote', '짧게 남은 장면 하나도 오래 머무는 마음이 될 수 있어요.');
        }
        if (diaryContent) {
            if (memoText) {
                diaryContent.textContent = memoText;
            } else {
                diaryContent.innerHTML = buildEmptyMemoMarkup();
            }
        }
    };

        const renderTreeContext = ({ hasTreeContext, tree, memories, sourceContext, degradedReason, currentMemory }) => {
            if (!treeContextEl) return;

            if (degradedReason === 'missing-tree-id') {
                treeContextEl.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:14px;">
                        <div style="width:44px; height:44px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="material-symbols-outlined" style="color: var(--primary); font-size:22px;">favorite</span>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px;">${tText('tree_context_viewing', '감상 중')}</div>
                            <p style="margin:0; font-size:13px; color:var(--on-surface-variant); line-height:1.6;">${tText('tree_context_solo_view_warm', '아직 연결된 트리 정보는 보이지 않지만, 이 순간만으로도 남겨진 마음을 천천히 따라가 볼 수 있어요.')}</p>
                        </div>
                    </div>
                `;
                return;
            }

            const treeMomentCount = resolveTreeMomentCount({ tree, memories, currentMemory });
            if (!hasTreeContext || treeMomentCount <= 0) {
                treeContextEl.innerHTML = '';
                return;
            }

            const treeTitle = String(tree?.title || '').trim();
            if (!treeTitle) {
                const contextDescription = degradedReason === 'tree-and-memories-load-failed'
                    ? tText('tree_context_missing_title_full_fail_desc', '지금은 이 순간 하나가 가장 또렷하게 남아 있어요. 트리 전체 이름과 이어진 흐름은 잠시 후 다시 또렷해질 수 있어요.')
                    : degradedReason === 'tree-load-partial'
                        ? tText('tree_context_missing_title_partial_desc', '트리 이름은 아직 또렷하지 않지만, 지금 남아 있는 이 순간과 감정의 결부터 조용히 감상해 볼 수 있어요.')
                        : tText('tree_context_missing_title_desc', '트리 이름은 아직 보이지 않지만, 지금 남아 있는 이 순간부터 조용히 감상해 볼 수 있어요.');

                treeContextEl.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:14px;">
                        <div style="width:44px; height:44px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="material-symbols-outlined" style="color: var(--primary); font-size:22px;">favorite</span>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:4px;">
                                <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.08em;">${tText('tree_context_viewing', '감상 중')}</span>
                                <span style="color: var(--outline-variant);">·</span>
                                <span style="font-size:11px; color:var(--on-surface-variant);">${treeMomentCount}${tText('tree_context_moment_count_short', '개 순간')}</span>
                            </div>
                            <p style="margin:0; font-size:13px; color:var(--on-surface-variant); line-height:1.6;">${contextDescription}</p>
                        </div>
                    </div>
                `;
                return;
            }

            const contextMessages = {
                browse: degradedReason === 'tree-and-memories-load-failed'
                    ? tText('tree_and_memories_load_failed_desc_warm', '지금은 현재 순간 하나가 가장 또렷하게 남아 있어요. 연결된 트리 흐름은 잠시 후 다시 이어서 볼 수 있을 거예요.')
                    : degradedReason === 'tree-load-partial'
                        ? tText('tree_partial_context_desc', '트리의 전체 윤곽은 잠시 흐릿하지만, 지금 이 순간을 중심으로 감정의 분위기는 계속 따라가 볼 수 있어요.')
                        : degradedReason === 'memories-load-failed'
                            ? tText('memories_load_failed_desc_warm', '현재 순간은 또렷하게 남아 있어요. 이어진 다른 순간은 잠시 후 다시 불러올 수 있을 거예요.')
                            : tText('public_tree_context_desc', '이 트리 안에서 남겨진 순간을 감상하고 있어요.'),
                editor: tText('tree_context_editor_desc', '편집 중인 트리를 감상 모드로 보고 있어요'),
                'my-trees': tText('tree_context_my_trees_desc', '내가 기록한 순간들을 다시 감상하고 있어요')
            };

            treeContextEl.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:14px;">
                    <div style="width:44px; height:44px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size:22px;">account_tree</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:4px;">
                            <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.08em;">${tText('current_tree', '현재 트리')}</span>
                            <span style="color: var(--outline-variant);">·</span>
                            <span style="font-size:11px; color:var(--on-surface-variant);">${treeMomentCount}${tText('tree_context_moment_count_short', '개 순간')}</span>
                        </div>
                        <div style="font-size:1.05rem; font-weight:800; color:var(--on-surface); line-height:1.36; margin-bottom:3px;">${escapeHtml(treeTitle)}</div>
                        <p style="margin:0; font-size:13px; color:var(--on-surface-variant); line-height:1.6;">${contextMessages[sourceContext] || contextMessages.browse}</p>
                    </div>
                </div>
            `;
        };

        const renderMissingMemoryState = () => {
            const detailTopbar = document.querySelector('.detail-topbar');
            const detailHero = document.getElementById('detailHero');
            const mainLayout = document.querySelector('.detail-layout');
            const contentSlot = document.querySelector('.detail-main') || document.querySelector('.detail-content') || mainLayout;

            if (detailTopbar) detailTopbar.style.display = 'none';
            if (detailHero) detailHero.style.display = 'none';
            if (mainLayout) mainLayout.style.display = 'block';

            const fallbackHTML = `
                <div style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                    <span class="material-symbols-outlined" style="font-size: 64px; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                    <h2 class="headline" style="font-size: 1.8rem; margin-bottom: 16px; color: var(--on-surface);">${tText('memory_not_found_title', '기억을 찾지 못했어요')}</h2>
                    <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">
                        ${tText('memory_not_found_desc', '요청하신 기억이 존재하지 않거나 접근할 수 없는 상태입니다.').replace('.', '<br>')}
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <a href="${homeHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('back_to_home', '홈으로')}</a>
                        <a href="${searchHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('browse_lovetrees', '러브트리 둘러보기')}</a>
                    </div>
                </div>
            `;

            if (contentSlot) contentSlot.innerHTML = fallbackHTML;
        };

        return {
            buildEmptyMemoMarkup,
            setMetaPillVisibility,
            renderMemoryBase,
            renderTreeContext,
            renderMissingMemoryState
        };
    }

    window.LoveBudDetailRender = { createRenderers };
})();
