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

    const createEditorDetailUIBuilders = window.createEditorDetailUIBuilders || function({ formatI18nText }) {
        const createInlineIcon = (name, size = '12px') => {
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.style.fontSize = size;
            icon.textContent = name;
            return icon;
        };

        const getDisplayEmotionTags = (data, options = {}) => {
            const opts = options || {};
            const isRootSelected = !!opts.isRootSelected;
            const isEmptyState = !!opts.isEmptyState;
            const rawTags = Array.isArray(data?.emotionTags) ? data.emotionTags.filter(Boolean) : [];
            const normalizedTags = rawTags.map((tag) => {
                const trimmed = String(tag || '').trim();
                if (!trimmed) return '';
                if (trimmed === '기록') {
                    return formatI18nText('editor_root_emotion_tag', '첫 마음');
                }
                return trimmed;
            }).filter(Boolean);

            if (normalizedTags.length > 0) return normalizedTags;
            if (!isEmptyState && isRootSelected) return [formatI18nText('editor_root_emotion_tag', '첫 마음')];
            return [];
        };

        const getMemoFallbackText = (options = {}) => {
            const opts = options || {};
            if (opts.isEmptyState) {
                return formatI18nText('empty_tree_memo', '아직 비어 있는 자리예요. 첫 순간을 심으면 이 트리가 당신의 흐름으로 자라나기 시작해요.');
            }
            if (opts.isRootSelected) {
                return formatI18nText('editor_root_memo_fallback', '이 장면이 왜 시작이 되었는지 남겨두면, 다음 순간들이 더 자연스럽게 이어져요.');
            }
            return formatI18nText('editor_selected_memo_fallback', '이 순간의 마음을 한 줄 남겨두면, 이어진 흐름을 다시 떠올리기 쉬워져요.');
        };

        return {
            createInlineIcon,
            getDisplayEmotionTags,
            getMemoFallbackText
        };
    };
    const {
        createInlineIcon,
        getDisplayEmotionTags,
        getMemoFallbackText
    } = createEditorDetailUIBuilders({ formatI18nText });

    // ── Tree meta boundary integration ───────────────────────────────────────
    // Use extracted helper from PR #664 for tree meta boundary
    const treeMetaBoundary = window.createEditorDetailTreeMetaBoundary({
        i18n,
        formatI18nText,
        resolveTreeTitleText,
        createInlineIcon,
        showToast,
        openCurrentMomentDetail
    });
    const { buildTreeMetaRenderModel, renderTreeMetaBoundary } = treeMetaBoundary;
    // ──────────────────────────────────────────────────────────────────

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

    // ── Inline edit boundary integration ───────────────────────────────────────
    // Use extracted helper for title/memo edit boundaries
    const inlineEditHelper = window.createEditorDetailInlineEditBoundary({
        updateSelectedMemoryFields,
        showToast,
        formatI18nText,
        i18n,
        getMemoFallbackText
    });
    const createTitleEditBoundary = inlineEditHelper.createTitleEditBoundary;
    const createMemoEditBoundary = inlineEditHelper.createMemoEditBoundary;
    // ──────────────────────────────────────────────────────────────────────────

    const resetDetailViewState = () => {
        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = formatI18nText('editor_current_hub_heading', '현재 순간 허브');
        }

        const imgEl = detailPanel.querySelector('.detail-video img');
        if (imgEl) {
            imgEl.removeAttribute('src');
            imgEl.src = '';
            imgEl.alt = '';
        }

        const treeMetaMount = document.getElementById('detailTreeMetaMount');
        if (treeMetaMount) treeMetaMount.innerHTML = '';

        const dateEl = document.getElementById('detailDateText');
        if (dateEl) {
            dateEl.textContent = '';
        }

        const tagsContainer = detailPanel.querySelector('.tags-container');
        if (tagsContainer) {
            tagsContainer.innerHTML = '';
        }

        const noteEl = document.querySelector('.diary-note');
        if (noteEl) {
            noteEl.innerHTML = '';
        }

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

    const setDetailEmptyState = (isEmpty) => {
        const detailContent = document.getElementById('detailContent');
        if (!detailContent) return;

        let emptyState = document.getElementById('detailEmptyState');
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = 'detailEmptyState';
            emptyState.innerHTML = '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span><p style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--on-surface);">' + formatI18nText('detail_empty_title', '첫 순간이 트리를 깨워요') + '</p><p style="font-size:0.9rem;opacity:0.78;line-height:1.6;">' + formatI18nText('detail_empty_desc', '첫 순간을 심으면 이 패널이 현재 순간 허브로 바뀝니다.') + '</p></div>';
            detailContent.appendChild(emptyState);
        }

        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');
        const actions = detailContent.querySelector('.memory-actions');
        const indicator = document.getElementById('saveStatusIndicator');

        if (isEmpty) {
            resetDetailViewState();
        }

        if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
        if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'block';
        if (editMode) editMode.style.display = 'none';
        if (actions) actions.style.display = isEmpty ? 'none' : 'flex';
        if (indicator && isEmpty) indicator.style.display = 'none';
        const footer = document.getElementById('detailPanelFooter');
        if (footer) {
            footer.style.display = 'none';
        }
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
         const isEmptyState = !!data?.isNewTree && !treeState.hasMoments;
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
         const dateEl = document.getElementById('detailDateText');
         const tagsContainer = detailPanel.querySelector('.tags-container');
         const noteEl = document.querySelector('.diary-note');
         const memoEditButtonMount = prepareMemoHeadingActionSlot();
         const memoryActions = detailPanel.querySelector('.memory-actions');

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
            badgeEl.textContent = isEmptyState
                ? formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요')
                : isRootSelected
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
            titleText.textContent = isEmptyState
                ? formatI18nText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요')
                : (data.title || formatI18nText('editor_current_moment_title', '지금 마음이 머문 장면'));

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
            hintEl.textContent = isEmptyState
                ? formatI18nText('editor_current_moment_empty_hint', '첫 순간이 심어지면 여기서 감정 메모와 다음 행동이 자연스럽게 이어집니다.')
                : isRootSelected
                    ? formatI18nText('editor_current_moment_root_hint', '이 순간은 트리의 시작점이에요. 다음 장면을 이어 심으며 감정의 흐름을 키워보세요.')
                    : formatI18nText('editor_current_moment_selected_hint', '지금 선택한 순간을 중심으로 메모를 읽고, 수정하거나 다음 장면을 이어갈 수 있어요.');
        }

        if (imgEl) {
            imgEl.src = resolveMemoryThumbnail(data);
            imgEl.alt = isEmptyState ? '' : (data.title || '');
        }

        if (dateEl) {
            dateEl.textContent = isEmptyState ? '' : (data?.timestamp || '');
            dateEl.style.fontSize = '0.85rem';
            dateEl.style.color = 'var(--on-surface-variant)';
            dateEl.style.opacity = '0.8';
            dateEl.style.fontWeight = '500';
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
            memoBody.textContent = isEmptyState
                ? getMemoFallbackText({ isEmptyState: true })
                : (data.memo || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요'));
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

            if (!isEmptyState) {
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
                    memoHint.style.color = 'var(--on-surface-variant)';
                    memoHint.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">account_tree</span> ${formatI18nText('path_moment_hint', '이 순간은 감정 경로 안에 연결되어 있습니다')}`;
                }

                if (memoHint.innerHTML) {
                    noteEl.appendChild(memoHint);
                }
            }
        }

        if (memoryActions) {
            memoryActions.style.display = isEmptyState ? 'none' : 'flex';
            memoryActions.style.marginTop = '4px';
        }
    };

    const detailMoreBtn = document.getElementById('detailMoreBtn');
    if (detailMoreBtn && detailMoreBtn.dataset.bound !== '1') {
        detailMoreBtn.dataset.bound = '1';
        detailMoreBtn.addEventListener('click', () => {
            if (typeof openCurrentMomentDetail === 'function') {
                openCurrentMomentDetail();
                return;
            }
            if (typeof focusSelectedMoment === 'function') {
                focusSelectedMoment();
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
