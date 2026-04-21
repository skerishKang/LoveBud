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

    const createInlineIcon = (name, size = '12px') => {
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.style.fontSize = size;
        icon.textContent = name;
        return icon;
    };

    const createTextBlock = (tag, text, styleMap = null) => {
        const el = document.createElement(tag);
        el.textContent = text || '';
        if (styleMap) Object.assign(el.style, styleMap);
        return el;
    };

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

        if (normalizedTags.length > 0) {
            return normalizedTags;
        }

        if (!isEmptyState && isRootSelected) {
            return [formatI18nText('editor_root_emotion_tag', '첫 마음')];
        }

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

    const createPillButton = ({ label, icon, tone = 'default' }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '6px';
        btn.style.padding = tone === 'primary' ? '10px 15px' : '9px 13px';
        btn.style.borderRadius = '999px';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '800';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease';
        btn.style.border = '1px solid rgba(144,73,81,0.10)';
        btn.style.background = tone === 'primary'
            ? 'linear-gradient(180deg, rgba(144,73,81,0.98), rgba(144,73,81,0.90))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
        btn.style.color = tone === 'primary' ? '#fff' : 'var(--primary)';
        btn.style.boxShadow = tone === 'primary'
            ? '0 10px 22px rgba(144, 73, 81, 0.18)'
            : '0 6px 16px rgba(75, 64, 57, 0.06)';
        if (icon) btn.appendChild(createInlineIcon(icon, '14px'));
        btn.appendChild(document.createTextNode(label));
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-1px)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
        });
        return btn;
    };

    const createShareTreeButton = ({ shareLabel }) => createPillButton({
        label: shareLabel,
        icon: 'content_copy'
    });

    const createVisibilityToggleButton = ({ isPublic }) => createPillButton({
        label: isPublic
            ? formatI18nText('editor_make_private', '이 트리 비공개로 전환')
            : formatI18nText('editor_make_public', '이 트리 공개하기'),
        icon: isPublic ? 'lock' : 'public',
        tone: 'default'
    });

    const createOpenDetailButton = () => createPillButton({
        label: formatI18nText('editor_open_detail', '상세로 보기'),
        icon: 'open_in_new',
        tone: 'primary'
    });

    const bindShareButton = ({ btn, data, treeId, i18n, showToast }) => {
        if (!btn || !data?.id) return;
        if (btn.dataset.shareBound === '1') return;
        btn.dataset.shareBound = '1';

        const basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

        btn.addEventListener('click', () => {
            const shareUrl = window.location.origin + '/' + basePath + 'detail.html?id=' + data.id + '&tree=' + treeId;
            navigator.clipboard?.writeText(shareUrl).then(() => {
                showToast(i18n('copied_link') || '링크가 복사되었습니다', 'success');
            }).catch(() => {
                showToast(i18n('copy_link_failed') || '링크 복사에 실패했습니다', 'error');
            });
        });
    };

    const bindVisibilityToggleButton = ({ btn, isPublic, showToast }) => {
        if (!btn || typeof updateTreeVisibility !== 'function') return;
        if (btn.dataset.visibilityBound === '1') return;
        btn.dataset.visibilityBound = '1';
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            try {
                await updateTreeVisibility(isPublic ? 'private' : 'public');
                showToast(
                    isPublic
                        ? formatI18nText('editor_visibility_updated_private', '이 트리를 비공개로 전환했어요.')
                        : formatI18nText('editor_visibility_updated_public', '이 트리를 공개로 전환했어요.'),
                    'success'
                );
            } catch (error) {
                console.error('[editor] Failed to toggle visibility:', error);
                showToast(formatI18nText('editor_visibility_update_failed', '공개 상태를 바꾸지 못했어요.'), 'error');
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    };

    const bindOpenDetailButton = (btn) => {
        if (!btn || typeof openCurrentMomentDetail !== 'function') return;
        if (btn.dataset.openDetailBound === '1') return;
        btn.dataset.openDetailBound = '1';
        btn.addEventListener('click', () => {
            openCurrentMomentDetail();
        });
    };

    const createTreeMetaBlock = ({
        displayTreeTitle,
        visIcon,
        visLabel,
        visInfo,
        visStyle,
        countLabel,
        shareButtonEl = null,
        visibilityToggleButtonEl = null,
        openDetailButtonEl = null
    }) => {
        const wrap = document.createElement('div');
        wrap.style.padding = '20px 20px 18px';
        wrap.style.borderRadius = '22px';
        wrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(250,246,244,0.97))';
        wrap.style.boxShadow = '0 14px 30px rgba(75, 64, 57, 0.08)';
        wrap.style.border = '1px solid rgba(144,73,81,0.10)';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '14px';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'flex-start';
        topRow.style.justifyContent = 'space-between';
        topRow.style.gap = '12px';
        topRow.style.flexWrap = 'wrap';

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.flexDirection = 'column';
        titleWrap.style.gap = '8px';
        titleWrap.style.flex = '1 1 220px';

        titleWrap.appendChild(createTextBlock('div', formatI18nText('current_tree', '현재 트리'), {
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--on-surface-variant)'
        }));

        titleWrap.appendChild(createTextBlock('div', displayTreeTitle, {
            fontSize: '22px',
            fontWeight: '900',
            color: 'var(--on-surface)',
            lineHeight: '1.28',
            letterSpacing: '-0.035em'
        }));

        titleWrap.appendChild(createTextBlock('div', countLabel, {
            fontSize: '12px',
            color: 'var(--on-surface-variant)',
            lineHeight: '1.75'
        }));

        const visBadge = document.createElement('span');
        visBadge.style.cssText = `${visStyle}padding:6px 11px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(75,64,57,0.05);`;
        visBadge.appendChild(createInlineIcon(visIcon, '12px'));
        visBadge.appendChild(document.createTextNode(visLabel));

        topRow.appendChild(titleWrap);
        topRow.appendChild(visBadge);
        wrap.appendChild(topRow);

        if (visInfo) {
            wrap.appendChild(createTextBlock('div', visInfo, {
                fontSize: '12px',
                color: 'var(--on-surface-variant)',
                lineHeight: '1.75'
            }));
        }

        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.alignItems = 'center';
        actionsRow.style.gap = '8px';
        actionsRow.style.flexWrap = 'wrap';
        actionsRow.style.paddingTop = '2px';

        if (shareButtonEl) actionsRow.appendChild(shareButtonEl);
        if (visibilityToggleButtonEl) actionsRow.appendChild(visibilityToggleButtonEl);
        if (openDetailButtonEl) actionsRow.appendChild(openDetailButtonEl);

        if (actionsRow.children.length > 0) {
            wrap.appendChild(actionsRow);
        }

        return wrap;
    };

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
            emptyState.innerHTML = '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span><p style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--on-surface);">' + formatI18nText('detail_empty_title', '첫 순간이 트리를 깨워요') + '</p><p style="font-size:0.9rem;opacity:0.78;line-height:1.6;">' + formatI18nText('detail_empty_desc', '왼쪽의 "새 순간 이어가기"로 첫 장면을 심으면, 이 패널이 현재 순간 허브로 바뀝니다.') + '</p></div>';
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

    const updateSidebarStatus = () => {
        const treeTitleEl = document.getElementById('sidebarTreeTitle');
        const momentCountEl = document.getElementById('sidebarMomentCount');
        const flowSummaryEl = document.getElementById('sidebarFlowSummary');
        const hintEl = document.getElementById('sidebarSelectionHint');
        const currentTreeData = getCurrentTreeData();
        const selectedNodeId = getSelectedNodeId();
        const treeState = getTreeState();
        const count = treeState.totalMomentCount;
        const selected = treeState.treeMemories.find(m => m.id === selectedNodeId);

        if (treeTitleEl) {
            treeTitleEl.textContent = resolveTreeTitleText(currentTreeData?.title);
        }
        if (momentCountEl) {
            momentCountEl.textContent = treeState.hasMoments
                ? formatI18nText('sidebar_moment_count', `순간 ${count}개가 이어지고 있어요`, { count })
                : formatI18nText('sidebar_moment_count_empty', '아직 이어진 순간이 없어요');
        }
        if (flowSummaryEl) {
            flowSummaryEl.textContent = selected?.title
                ? formatI18nText('sidebar_flow_summary_selected', `지금은 "${selected.title}" 순간에 마음이 머물러 있어요.`, { title: selected.title })
                : treeState.hasMoments
                    ? formatI18nText('sidebar_flow_summary_connected', `${count}개의 순간이 하나의 러브트리로 차곡차곡 이어지고 있어요.`, { count })
                    : formatI18nText('sidebar_flow_summary_empty', '첫 기억이 심어지면 이곳에 감정의 흐름이 차곡차곡 쌓여요.');
        }
        if (hintEl) {
            const currentSelectionLabel = i18n('sidebar_current_selection') || '현재 선택';
            const firstMomentHint = i18n('sidebar_first_moment_hint') || '첫 순간을 추가해 트리를 시작해 보세요.';
            hintEl.textContent = selected?.title
                ? `${currentSelectionLabel}: ${selected.title}`
                : firstMomentHint;
            hintEl.style.fontStyle = 'italic';
            hintEl.style.color = 'var(--on-surface-variant)';
        }

        const addMemoryBtnLabel = document.getElementById('addMemoryBtnLabel');
        const addMemoryEyebrow = document.getElementById('addMemoryEyebrow');
        const addMemoryIntro = document.getElementById('addMemoryIntro');
        const isEmptyTree = !treeState.hasMoments;

        if (addMemoryBtnLabel) {
            addMemoryBtnLabel.textContent = isEmptyTree
                ? i18n('editor_add_first_memory')
                : i18n('editor_add_next_memory');
        }
        if (addMemoryEyebrow) {
            addMemoryEyebrow.textContent = isEmptyTree
                ? i18n('editor_add_memory_eyebrow')
                : i18n('editor_add_memory_eyebrow');
        }
        if (addMemoryIntro) {
            addMemoryIntro.textContent = isEmptyTree
                ? i18n('editor_empty_tree_hint')
                : i18n('editor_next_memory_hint');
        }
    };

    const updateDetailPanel = (data) => {
        const currentTree = getCurrentTreeData() || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');
        const visibility = currentTree.visibility || 'public';
        const isPublic = visibility === 'public';
        const visIcon = isPublic ? 'public' : 'lock';
        const visLabel = isPublic ? i18n('visibility_public') : i18n('visibility_private');
        const visInfo = isPublic
            ? formatI18nText('editor_tree_public_info', '이 트리 전체가 공개되어 있어요. 링크가 있는 사람은 감상할 수 있습니다.')
            : formatI18nText('editor_tree_private_info', '이 트리 전체는 비공개예요. 지금은 나만 볼 수 있습니다.');
        const visStyle = isPublic
            ? 'background:rgba(76,175,80,0.1);color:#4caf50;border:1px solid rgba(76,175,80,0.25);'
            : 'background:rgba(158,158,158,0.1);color:#757575;border:1px solid rgba(158,158,158,0.25);';
        const displayTreeTitle = resolveTreeTitleText(currentTree.title);
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
        const noteEl = detailPanel.querySelector('.diary-note');
        const memoryActions = detailPanel.querySelector('.memory-actions');

        const localBadgeText = localSaveMode ? (i18n('local_save_badge') || '로컬 저장') : '';
        const countForLabel = treeState.totalMomentCount;
        const treeCountLabel = treeState.hasMoments
            ? formatI18nText('editor_tree_status_count', `{count}개의 순간이 이 트리 안에서 이어지고 있어요.`, { count: countForLabel })
            : formatI18nText('editor_tree_status_empty', '아직 첫 순간을 기다리고 있어요.');

        if (treeMetaMount) {
            treeMetaMount.innerHTML = '';
            let shareBtn = null;
            let visibilityToggleBtn = null;
            let openDetailBtn = null;

            if (!isEmptyState && data?.id) {
                shareBtn = createShareTreeButton({
                    shareLabel: i18n('share_link') || '링크 복사'
                });
                visibilityToggleBtn = createVisibilityToggleButton({ isPublic });
                openDetailBtn = createOpenDetailButton();
            }

            treeMetaMount.appendChild(createTreeMetaBlock({
                displayTreeTitle,
                visIcon,
                visLabel,
                visInfo,
                visStyle,
                countLabel: localBadgeText ? `${treeCountLabel} · ${localBadgeText}` : treeCountLabel,
                shareButtonEl: shareBtn,
                visibilityToggleButtonEl: visibilityToggleBtn,
                openDetailButtonEl: openDetailBtn
            }));

            bindShareButton({
                btn: shareBtn,
                data,
                treeId,
                i18n,
                showToast
            });
            bindVisibilityToggleButton({
                btn: visibilityToggleBtn,
                isPublic,
                showToast
            });
            bindOpenDetailButton(openDetailBtn);
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

            if (!isEmptyState && typeof updateSelectedMemoryFields === 'function') {
                const editBtn = document.createElement('button');
                editBtn.className = 'memory-edit-button';
                editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">edit</span>' + formatI18nText('editMemoryTitle', '제목 수정');

                editBtn.onclick = () => {
                    titleContainer.innerHTML = '';

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = data.title || '';

                    const actions = document.createElement('div');
                    actions.className = 'memory-edit-actions';

                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'btn-save';
                    saveBtn.textContent = formatI18nText('saveMemoryTitle', '저장');

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn-cancel';
                    cancelBtn.textContent = formatI18nText('cancelMemoryTitle', '취소');

                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'memory-edit-error';

                    actions.appendChild(cancelBtn);
                    actions.appendChild(saveBtn);

                    const wrap = document.createElement('div');
                    wrap.style.width = '100%';
                    wrap.appendChild(input);
                    wrap.appendChild(errorMsg);
                    wrap.appendChild(actions);
                    titleContainer.appendChild(wrap);

                    input.focus();

                    const endEdit = () => { updateDetailPanel(data); };

                    const saveEdit = async () => {
                        const newTitle = input.value.trim();
                        if (!newTitle) {
                            errorMsg.textContent = formatI18nText('memoryTitleRequired', '순간 제목을 입력해 주세요');
                            return;
                        }
                        errorMsg.textContent = '';
                        saveBtn.disabled = true;
                        cancelBtn.disabled = true;
                        if (await updateSelectedMemoryFields({ title: newTitle })) {
                            if (showToast) showToast(formatI18nText('memoryUpdateSaved', '순간을 수정했어요.'), 'success');
                            endEdit();
                        } else {
                            if (showToast) showToast(formatI18nText('memoryUpdateFailed', '순간을 수정하지 못했어요.'), 'error');
                            saveBtn.disabled = false;
                            cancelBtn.disabled = false;
                        }
                    };

                    cancelBtn.onclick = endEdit;
                    saveBtn.onclick = saveEdit;

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
                    });
                };
                titleContainer.appendChild(editBtn);
            }

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
            memoBody.style.lineHeight = '1.7';
            memoBody.style.fontSize = '0.95rem';
            memoBody.style.color = 'var(--on-surface)';
            memoBody.style.whiteSpace = 'pre-line';
            memoBody.textContent = isEmptyState
                ? getMemoFallbackText({ isEmptyState: true })
                : (data.memo || formatI18nText('emptyMemoryNote', '아직 메모가 남겨지지 않았어요'));
            memoContainer.appendChild(memoBody);

            if (!isEmptyState && typeof updateSelectedMemoryFields === 'function') {
                const editBtn = document.createElement('button');
                editBtn.className = 'memory-edit-button';
                editBtn.style.marginTop = '8px';
                editBtn.style.marginLeft = '0';
                editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">edit</span>' + formatI18nText('editMemoryNote', '메모 수정');
                editBtn.onclick = () => {
                    memoContainer.innerHTML = '';

                    const textarea = document.createElement('textarea');
                    textarea.className = 'memory-edit-textarea';
                    textarea.value = data.memo || '';

                    const hintDiv = document.createElement('div');
                    hintDiv.className = 'memory-edit-hint';
                    hintDiv.textContent = formatI18nText('noteSaveHint', 'Ctrl+Enter로 저장할 수 있어요.');

                    const actions = document.createElement('div');
                    actions.className = 'memory-edit-actions';

                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'btn-save';
                    saveBtn.textContent = formatI18nText('saveMemoryNote', '메모 저장');

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn-cancel';
                    cancelBtn.textContent = formatI18nText('cancelMemoryNote', '취소');

                    actions.appendChild(cancelBtn);
                    actions.appendChild(saveBtn);

                    memoContainer.appendChild(textarea);
                    memoContainer.appendChild(hintDiv);
                    memoContainer.appendChild(actions);

                    textarea.focus();

                    const endEdit = () => { updateDetailPanel(data); };

                    const saveEdit = async () => {
                        const newMemo = textarea.value.trim();
                        saveBtn.disabled = true;
                        cancelBtn.disabled = true;
                        if (await updateSelectedMemoryFields({ memo: newMemo })) {
                            if (showToast) showToast(formatI18nText('memoryUpdateSaved', '순간을 수정했어요.'), 'success');
                            endEdit();
                        } else {
                            if (showToast) showToast(formatI18nText('memoryUpdateFailed', '순간을 수정하지 못했어요.'), 'error');
                            saveBtn.disabled = false;
                            cancelBtn.disabled = false;
                        }
                    };

                    cancelBtn.onclick = endEdit;
                    saveBtn.onclick = saveEdit;

                    textarea.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
                    });
                };
                memoContainer.appendChild(editBtn);
            }

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
