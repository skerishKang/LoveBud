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
        showToast
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

    const createShareTreeButton = ({ visStyle, shareLabel }) => {
        const btn = document.createElement('button');
        btn.id = 'shareTreeBtn';
        btn.type = 'button';
        btn.style.cssText = `${visStyle}font-size:12px;padding:8px 12px;border-radius:999px;cursor:pointer;border:none;font-weight:700;display:flex;align-items:center;gap:6px;white-space:nowrap;`;
        btn.appendChild(createInlineIcon('content_copy', '14px'));
        btn.appendChild(document.createTextNode(shareLabel));
        return btn;
    };

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

    const createTreeMetaBlock = ({
        displayTreeTitle,
        visIcon,
        visLabel,
        visInfo,
        visStyle,
        countLabel,
        shareButtonEl = null
    }) => {
        const wrap = document.createElement('div');
        wrap.style.padding = '16px 18px';
        wrap.style.borderRadius = '18px';
        wrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,246,244,0.96))';
        wrap.style.boxShadow = '0 10px 26px rgba(75, 64, 57, 0.06)';
        wrap.style.border = '1px solid rgba(144,73,81,0.08)';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '12px';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.justifyContent = 'space-between';
        topRow.style.gap = '10px';
        topRow.style.flexWrap = 'wrap';

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.flexDirection = 'column';
        titleWrap.style.gap = '6px';

        titleWrap.appendChild(createTextBlock('div', displayTreeTitle, {
            fontSize: '15px',
            fontWeight: '800',
            color: 'var(--on-surface)',
            lineHeight: '1.45'
        }));

        titleWrap.appendChild(createTextBlock('div', countLabel, {
            fontSize: '12px',
            color: 'var(--on-surface-variant)',
            lineHeight: '1.6'
        }));

        const visBadge = document.createElement('span');
        visBadge.style.cssText = `${visStyle}padding:5px 10px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;`;
        visBadge.appendChild(createInlineIcon(visIcon, '12px'));
        visBadge.appendChild(document.createTextNode(visLabel));

        topRow.appendChild(titleWrap);
        topRow.appendChild(visBadge);

        const infoRow = document.createElement('div');
        infoRow.style.display = 'flex';
        infoRow.style.alignItems = 'center';
        infoRow.style.justifyContent = 'space-between';
        infoRow.style.gap = '10px';
        infoRow.style.flexWrap = 'wrap';

        infoRow.appendChild(createTextBlock('div', visInfo, {
            fontSize: '12px',
            color: 'var(--on-surface-variant)',
            lineHeight: '1.7',
            flex: '1 1 220px'
        }));

        if (shareButtonEl) {
            infoRow.appendChild(shareButtonEl);
        }

        wrap.appendChild(topRow);
        wrap.appendChild(infoRow);
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
        const treeMemories = getTreeMemories();
        const canonicalRootId = getCanonicalRootId();
        const count = treeMemories.filter(m => !isRootMemory(m, canonicalRootId)).length;
        const selected = treeMemories.find(m => m.id === selectedNodeId);

        if (treeTitleEl) {
            treeTitleEl.textContent = resolveTreeTitleText(currentTreeData?.title);
        }
        if (momentCountEl) {
            momentCountEl.textContent = formatI18nText('sidebar_moment_count', `순간 ${count}개가 이어지고 있어요`, { count });
        }
        if (flowSummaryEl) {
            flowSummaryEl.textContent = selected?.title
                ? formatI18nText('sidebar_flow_summary_selected', `지금은 "${selected.title}" 순간에 마음이 머물러 있어요.`, { title: selected.title })
                : count > 0
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
    };

    const updateDetailPanel = (data) => {
        const currentTree = getCurrentTreeData() || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');
        const visibility = currentTree.visibility || 'public';
        const isPublic = visibility === 'public';
        const visIcon = isPublic ? 'public' : 'lock';
        const visLabel = isPublic ? i18n('visibility_public') : i18n('visibility_private');
        const visInfo = isPublic
            ? formatI18nText('share_info', '링크가 있는 사람은 이 트리를 볼 수 있습니다')
            : formatI18nText('private_info', '나만 볼 수 있는 트리입니다');
        const visStyle = isPublic
            ? 'background:rgba(76,175,80,0.1);color:#4caf50;border:1px solid rgba(76,175,80,0.25);'
            : 'background:rgba(158,158,158,0.1);color:#757575;border:1px solid rgba(158,158,158,0.25);';
        const displayTreeTitle = resolveTreeTitleText(currentTree.title);
        const canonicalRootId = getCanonicalRootId();
        const isEmptyState = !!data?.isNewTree;
        const isRootSelected = !isEmptyState && isRootMemory(data, canonicalRootId);
        const localSaveMode = getLocalSaveMode();
        const realMemoriesCount = getTreeMemories().filter(m => !isRootMemory(m, canonicalRootId)).length;

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
        const treeCountLabel = realMemoriesCount > 0
            ? formatI18nText('editor_tree_status_count', `{count}개의 순간이 이 트리 안에서 이어지고 있어요.`, { count: realMemoriesCount })
            : formatI18nText('editor_tree_status_empty', '아직 첫 순간을 기다리고 있어요.');

        if (treeMetaMount) {
            treeMetaMount.innerHTML = '';
            let shareBtn = null;
            if (isPublic && !isEmptyState && data?.id) {
                shareBtn = createShareTreeButton({
                    visStyle,
                    shareLabel: i18n('share_link') || '링크 복사'
                });
            }

            treeMetaMount.appendChild(createTreeMetaBlock({
                displayTreeTitle,
                visIcon,
                visLabel,
                visInfo,
                visStyle,
                countLabel: localBadgeText ? `${treeCountLabel} · ${localBadgeText}` : treeCountLabel,
                shareButtonEl: shareBtn
            }));

            bindShareButton({
                btn: shareBtn,
                data,
                treeId,
                i18n,
                showToast
            });
        }

        if (badgeEl) {
            badgeEl.textContent = isEmptyState
                ? formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요')
                : isRootSelected
                    ? formatI18nText('start_moment', '시작 순간')
                    : formatI18nText('selected_moment', '선택된 순간');
        }

        if (titleEl) {
            titleEl.textContent = isEmptyState
                ? formatI18nText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요')
                : (data.title || formatI18nText('editor_current_moment_title', '지금 마음이 머문 장면'));
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
            if (!isEmptyState && Array.isArray(data.emotionTags)) {
                data.emotionTags.forEach((tag) => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag tag-primary';
                    tagEl.textContent = tag;
                    tagsContainer.appendChild(tagEl);
                });
            }
        }

        if (noteEl) {
            noteEl.innerHTML = '';

            const memoBody = document.createElement('div');
            memoBody.style.lineHeight = '1.7';
            memoBody.style.fontSize = '0.95rem';
            memoBody.style.color = 'var(--on-surface)';
            memoBody.textContent = isEmptyState
                ? formatI18nText('empty_tree_memo', '아직 비어 있는 자리예요. 첫 순간을 심으면 이 트리가 당신의 흐름으로 자라나기 시작해요.')
                : (data.memo || '');
            noteEl.appendChild(memoBody);

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

    return {
        setDetailEmptyState,
        updateFocusSelectedBtn,
        updateSidebarStatus,
        updateDetailPanel
    };
}

window.createEditorDetailUI = createEditorDetailUI;
