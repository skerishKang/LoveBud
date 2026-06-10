function createEditorDetailUI(deps) {
    const {
        detailPanel,
        i18n,
        resolveTreeTitleText,
        resolveHintText,
        resolveInfoText,
        resolveMemoryThumbnail,
        escapeHtml,
        isRootMemory,
        getCanonicalRootId,
        getSelectedNodeId,
        getTreeMemories,
        getCurrentTreeData,
        getLocalSaveMode,
        showToast,
        updateTreeVisibility,
        openCurrentMomentDetail,
        focusSelectedMoment,
        updateSelectedMemoryFields
    } = deps;

    const formatI18nText = (key, fallback, replacements) => {
        let text = i18n(key) || fallback;
        if (!text || text === key) text = fallback;
        if (replacements && typeof replacements === 'object') {
            Object.keys(replacements).forEach((name) => {
                text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacements[name] ?? ''));
            });
        }
        return text;
    };

    const createEditorDetailUIBuilders = window.createEditorDetailUIBuilders;
    const {
        createInlineIcon,
        getDisplayEmotionTags,
        getMemoFallbackText
    } = createEditorDetailUIBuilders({ formatI18nText });

    const treeMetaBoundary = window.createEditorDetailTreeMetaBoundary({
        i18n,
        formatI18nText,
        resolveTreeTitleText,
        createInlineIcon,
        showToast,
        openCurrentMomentDetail
    });
    const { buildTreeMetaRenderModel, renderTreeMetaBoundary } = treeMetaBoundary;

    const getTreeState = () => {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const rootMemory = treeMemories.find((memory) => isRootMemory(memory, canonicalRootId)) || null;
        const nonRootMemories = treeMemories.filter((memory) => !isRootMemory(memory, canonicalRootId));
        const totalMomentCount = treeMemories.length;
        const visibleMomentCount = nonRootMemories.length > 0 ? nonRootMemories.length : (rootMemory ? 1 : 0);

        return {
            canonicalRootId,
            treeMemories,
            rootMemory,
            nonRootMemories,
            totalMomentCount,
            visibleMomentCount,
            hasMoments: totalMomentCount > 0,
            hasVisibleMoments: visibleMomentCount > 0
        };
    };

    const inlineEditHelper = window.createEditorDetailInlineEditBoundary({
        updateSelectedMemoryFields,
        showToast,
        formatI18nText,
        i18n,
        getMemoFallbackText
    });
    const createTitleEditBoundary = inlineEditHelper.createTitleEditBoundary;
    const createMemoEditBoundary = inlineEditHelper.createMemoEditBoundary;

    const clearDetailMedia = () => {
        const mediaWrap = detailPanel.querySelector('.detail-video');
        const imgEl = detailPanel.querySelector('.detail-video img');
        if (imgEl) {
            imgEl.removeAttribute('src');
            imgEl.src = '';
            imgEl.alt = '';
        }
        if (mediaWrap) mediaWrap.style.display = 'none';
    };

    const resetDetailViewState = () => {
        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = formatI18nText('editor_current_hub_heading', '현재 순간 허브');
        }

        clearDetailMedia();

        const treeMetaMount = document.getElementById('detailTreeMetaMount');
        if (treeMetaMount) treeMetaMount.innerHTML = '';

        const dateEl = document.getElementById('detailDateText');
        if (dateEl) dateEl.textContent = '';

        const tagsContainer = detailPanel.querySelector('.tags-container');
        if (tagsContainer) tagsContainer.innerHTML = '';

        const noteEl = document.querySelector('.diary-note');
        if (noteEl) noteEl.innerHTML = '';

        const editTitleInput = document.getElementById('editTitleInput');
        const editMemoInput = document.getElementById('editMemoInput');
        const editTagsInput = document.getElementById('editTagsInput');
        if (editTitleInput) editTitleInput.value = '';
        if (editMemoInput) editMemoInput.value = '';
        if (editTagsInput) editTagsInput.value = '';

        const indicator = document.getElementById('saveStatusIndicator');
        const iconEl = document.getElementById('saveStatusIcon');
        const textEl = document.getElementById('saveStatusText');
        const timeEl = document.getElementById('lastSavedTime');

        if (indicator) indicator.style.display = 'none';
        if (iconEl) iconEl.textContent = '';
        if (textEl) textEl.textContent = i18n('save_saved') || '저장됨';
        if (timeEl) {
            timeEl.textContent = '';
            timeEl.style.display = 'none';
        }
    };

    const bindDetailEmptyStartButton = (emptyState) => {
        const startBtn = emptyState && emptyState.querySelector('#detailEmptyStartBtn');
        if (!startBtn || startBtn.dataset.bound === '1') return;
        startBtn.dataset.bound = '1';
        startBtn.addEventListener('click', () => {
            const addBtn = document.getElementById('addMemoryBtn');
            if (addBtn) {
                addBtn.click();
                return;
            }
            const emptyStartBtn = document.getElementById('canvasEmptyStartBtn');
            if (emptyStartBtn) emptyStartBtn.click();
        });
    };

    const setDetailEmptyState = (isEmpty) => {
        const detailContent = document.getElementById('detailContent');
        if (!detailContent) return;

        let emptyState = document.getElementById('detailEmptyState');
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = 'detailEmptyState';
            emptyState.innerHTML = [
                '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);">',
                '<span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span>',
                '<p style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--on-surface);">' + formatI18nText('detail_empty_title', '첫 순간이 트리를 깨워요') + '</p>',
                '<p style="font-size:0.9rem;opacity:0.78;line-height:1.6;margin-bottom:18px;">' + formatI18nText('detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.') + '</p>',
                '<button type="button" id="detailEmptyStartBtn" class="btn-round btn-primary">' + formatI18nText('create_first_moment', '첫 순간 만들기') + '</button>',
                '</div>'
            ].join('');
            detailContent.appendChild(emptyState);
        }
        bindDetailEmptyStartButton(emptyState);

        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');
        const actions = detailContent.querySelector('.memory-actions');
        const indicator = document.getElementById('saveStatusIndicator');
        const reactionsCard = document.getElementById('momentReactionsCard');

        if (isEmpty) resetDetailViewState();

        if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
        if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'block';
        if (editMode) editMode.style.display = 'none';
        if (actions) actions.style.display = isEmpty ? 'none' : 'flex';
        if (indicator && isEmpty) indicator.style.display = 'none';
        if (reactionsCard && isEmpty) reactionsCard.style.display = 'none';
        const footer = document.getElementById('detailPanelFooter');
        if (footer) footer.style.display = 'none';
    };

    const updateFocusSelectedBtn = () => {
        const btn = document.getElementById('focusSelectedBtn');
        if (!btn) return;

        const hasSelection = !!getSelectedNodeId();
        btn.disabled = !hasSelection;
        btn.classList.toggle('is-disabled', !hasSelection);
    };

    const sidebarStatusBoundary = window.createEditorDetailSidebarStatusBoundary({
        i18n,
        formatI18nText,
        resolveTreeTitleText,
        getCurrentTreeData,
        getSelectedNodeId,
        getTreeState
    });
    const { updateSidebarStatus } = sidebarStatusBoundary;

    const prepareMemoHeadingActionSlot = () => {
        const memoLabel = document.getElementById('detailMemoLabel');
        if (!memoLabel) return null;

        const memoGroup = memoLabel.closest('.detail-info-group');
        if (!memoGroup) return null;

        memoGroup.classList.add('editor-memo-section-group');

        let headingRow = memoGroup.querySelector('.editor-memo-heading-row');
        if (!headingRow) {
            headingRow = document.createElement('div');
            headingRow.className = 'editor-memo-heading-row';
            memoGroup.insertBefore(headingRow, memoLabel);
        }

        if (memoLabel.parentElement !== headingRow) {
            headingRow.insertBefore(memoLabel, headingRow.firstChild);
        }

        let actionSlot = headingRow.querySelector('.editor-memo-heading-action-slot');
        if (!actionSlot) {
            actionSlot = document.createElement('div');
            actionSlot.className = 'editor-memo-heading-action-slot';
            headingRow.appendChild(actionSlot);
        }

        actionSlot.innerHTML = '';
        return actionSlot;
    };

    const updateDetailPanel = (data) => {
        const currentTree = getCurrentTreeData() || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');
        const treeState = getTreeState();
        const canonicalRootId = treeState.canonicalRootId;
        const selectedNodeId = getSelectedNodeId();
        const hasSelectedMemory = !!(data && data.id && !data.isNewTree && selectedNodeId);
        const isEmptyState = !hasSelectedMemory || !treeState.hasMoments || !!data?.isNewTree;
        const isRootSelected = !isEmptyState && isRootMemory(data, canonicalRootId);
        const localSaveMode = getLocalSaveMode();

        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = formatI18nText('editor_current_hub_heading', '현재 순간 허브');
        }

        const badgeEl = document.getElementById('detailCurrentMomentBadge');
        const titleEl = document.getElementById('detailCurrentMomentTitle');
        const hintEl = document.getElementById('detailCurrentMomentHint');
        const treeMetaMount = document.getElementById('detailTreeMetaMount');
        const imgEl = detailPanel.querySelector('.detail-video img');
        const mediaWrap = detailPanel.querySelector('.detail-video');
        const dateEl = document.getElementById('detailDateText');
        const tagsContainer = detailPanel.querySelector('.tags-container');
        const noteEl = document.querySelector('.diary-note');
        const memoEditButtonMount = prepareMemoHeadingActionSlot();
        const memoryActions = detailPanel.querySelector('.memory-actions');

        if (isEmptyState) {
            if (badgeEl) badgeEl.textContent = formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요');
            if (titleEl) titleEl.textContent = formatI18nText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요');
            if (hintEl) {
                hintEl.textContent = '';
                hintEl.hidden = true;
            }
            setDetailEmptyState(true);
            updateFocusSelectedBtn();
            return;
        }

        setDetailEmptyState(false);

        const treeMetaModel = buildTreeMetaRenderModel({
            currentTree: currentTree || {},
            treeState,
            data,
            isEmptyState,
            localSaveMode
        });

        if (treeMetaMount) {
            renderTreeMetaBoundary(treeMetaMount, treeMetaModel, treeId, data);
        }

        if (badgeEl) {
            badgeEl.textContent = isRootSelected
                ? formatI18nText('start_moment', '시작 순간')
                : formatI18nText('selected_moment', '선택된 순간');
        }

        if (titleEl) {
            titleEl.innerHTML = '';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'memory-inline-edit';
            titleContainer.style.width = '100%';
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'flex-start';

            const titleText = document.createElement('span');
            titleText.style.flex = '1';
            titleText.textContent = data.title || formatI18nText('editor_current_moment_title', '지금 마음이 머문 장면');

            titleContainer.appendChild(titleText);

            createTitleEditBoundary(titleContainer, data, {
                updateSelectedMemoryFields,
                showToast,
                formatI18nText,
                i18n,
                isEmptyState
            });

            titleEl.appendChild(titleContainer);
        }

        if (hintEl) {
            hintEl.textContent = '';
            hintEl.hidden = true;
        }

        if (imgEl) {
            const thumbnail = resolveMemoryThumbnail(data);
            if (thumbnail) {
                imgEl.src = thumbnail;
                imgEl.alt = data.title || '';
                if (mediaWrap) mediaWrap.style.display = '';
            } else {
                clearDetailMedia();
            }
        }

        if (dateEl) {
            dateEl.textContent = data?.timestamp || '';
        }

        if (tagsContainer) {
            tagsContainer.innerHTML = '';
            const displayTags = getDisplayEmotionTags(data, { isRootSelected, isEmptyState });
            displayTags.forEach((tag) => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag tag-primary';
                tagEl.textContent = tag;
                tagsContainer.appendChild(tagEl);
            });
        }

        if (noteEl) {
            noteEl.innerHTML = '';

            const memoContainer = document.createElement('div');
            memoContainer.style.width = '100%';

            const memoBody = document.createElement('div');
            memoBody.style.lineHeight = '1.8';
            memoBody.style.fontSize = '0.95rem';
            memoBody.style.color = 'var(--on-surface)';
            memoBody.style.whiteSpace = 'pre-line';
            memoBody.textContent = data.memo || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요');
            memoContainer.appendChild(memoBody);

            createMemoEditBoundary(memoContainer, data, {
                updateSelectedMemoryFields,
                showToast,
                formatI18nText,
                getMemoFallbackText,
                isEmptyState,
                editButtonMount: memoEditButtonMount
            });

            noteEl.appendChild(memoContainer);

            const memoHint = document.createElement('div');
            memoHint.style.marginTop = '12px';
            memoHint.style.fontSize = '12px';
            memoHint.style.lineHeight = '1.65';

            if (isRootSelected) {
                memoHint.style.color = 'var(--primary)';
                memoHint.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">star</span> ${formatI18nText('root_moment_hint', '이 순간은 현재 트리의 시작점입니다')}`;
            } else if (data.parentId) {
                memoHint.style.paddingTop = '12px';
                memoHint.style.borderTop = '1px solid var(--outline-variant)';
            }

            if (memoHint.innerHTML) {
                noteEl.appendChild(memoHint);
            }
        }

        const reactionsCard = document.getElementById('momentReactionsCard');
        if (reactionsCard) {
            if (isEmptyState || !data?.id || isRootMemory(data, canonicalRootId)) {
                reactionsCard.style.display = 'none';
            } else {
                reactionsCard.style.display = '';

                const likeBtn = document.getElementById('momentLikeBtn');
                const likeCount = document.getElementById('momentLikeCount');
                const commentCount = document.getElementById('momentCommentCount');

                if (likeBtn && likeCount && commentCount) {
                    likeBtn.dataset.reacted = 'false';
                    likeBtn.querySelector('.editor-reaction-like-icon').textContent = '🤍';
                    likeCount.textContent = '0';
                    commentCount.textContent = '0';

                    if (window.apiClient?.fetchReactionSummary) {
                        window.apiClient.fetchReactionSummary(data.id)
                            .then(summary => {
                                if (!summary) return;
                                likeCount.textContent = summary.like_count ?? summary.likeCount ?? 0;
                                commentCount.textContent = summary.comment_count ?? summary.commentCount ?? 0;
                                const userReacted = summary.user_reacted ?? summary.userReacted ?? false;
                                likeBtn.dataset.reacted = userReacted ? 'true' : 'false';
                                likeBtn.querySelector('.editor-reaction-like-icon').textContent = userReacted ? '❤️' : '🤍';
                            })
                            .catch(() => {});
                    }

                    likeBtn.onclick = async () => {
                        const wasReacted = likeBtn.dataset.reacted === 'true';
                        const prevCount = parseInt(likeCount.textContent) || 0;

                        const nextReacted = !wasReacted;
                        const nextCount = nextReacted ? prevCount + 1 : Math.max(0, prevCount - 1);
                        likeBtn.dataset.reacted = nextReacted ? 'true' : 'false';
                        likeBtn.querySelector('.editor-reaction-like-icon').textContent = nextReacted ? '❤️' : '🤍';
                        likeCount.textContent = nextCount;

                        try {
                            const result = await window.apiClient.toggleReaction(data.id, 'like');
                            if (result) {
                                likeCount.textContent = result.like_count ?? result.likeCount ?? nextCount;
                                const serverReacted = result.user_reacted ?? result.userReacted ?? nextReacted;
                                likeBtn.dataset.reacted = serverReacted ? 'true' : 'false';
                                likeBtn.querySelector('.editor-reaction-like-icon').textContent = serverReacted ? '❤️' : '🤍';
                            }
                        } catch (e) {
                            likeBtn.dataset.reacted = wasReacted ? 'true' : 'false';
                            likeBtn.querySelector('.editor-reaction-like-icon').textContent = wasReacted ? '❤️' : '🤍';
                            likeCount.textContent = prevCount;
                            showToast(i18n('reaction_failed') || '반응을 저장하지 못했어요.', 'error');
                        }
                    };

                    const commentBtn = document.getElementById('momentCommentBtn');
                    if (commentBtn) {
                        commentBtn.onclick = () => {
                            if (!data.id || !treeId) return;
                            const basePath = typeof window.getEditorBasePath === 'function' ? window.getEditorBasePath() : '../pages/';
                            window.location.href = basePath
                                + 'detail.html?id=' + encodeURIComponent(data.id)
                                + '&tree=' + encodeURIComponent(treeId)
                                + '&from=editor';
                        };
                    }
                }
            }
        }

        if (memoryActions) {
            memoryActions.style.display = isEmptyState ? 'none' : 'flex';
            memoryActions.style.marginTop = '4px';
        }
    };

    const viewMomentDetailBtn = document.getElementById('viewMomentDetailBtn');
    if (viewMomentDetailBtn && viewMomentDetailBtn.dataset.bound !== '1') {
        viewMomentDetailBtn.dataset.bound = '1';
        viewMomentDetailBtn.addEventListener('click', () => {
            if (typeof openCurrentMomentDetail === 'function') {
                openCurrentMomentDetail();
                return;
            }
            if (typeof focusSelectedMoment === 'function') {
                focusSelectedMoment();
            }
        });
    }

    const continueFromMomentBtn = document.getElementById('continueFromMomentBtn');
    if (continueFromMomentBtn && continueFromMomentBtn.dataset.bound !== '1') {
        continueFromMomentBtn.dataset.bound = '1';
        continueFromMomentBtn.addEventListener('click', () => {
            const addBtn = document.getElementById('addMemoryBtn');
            if (addBtn) {
                addBtn.click();
            } else {
                const emptyStartBtn = document.getElementById('canvasEmptyStartBtn');
                if (emptyStartBtn) emptyStartBtn.click();
            }
        });
    }

    return {
        setDetailEmptyState,
        updateFocusSelectedBtn,
        updateSidebarStatus,
        updateDetailPanel
    };
}

window.createEditorDetailUI = createEditorDetailUI;
// cache bust
