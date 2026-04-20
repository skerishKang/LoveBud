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

    const createTreeMetaBlock = ({
        displayTreeTitle,
        visIcon,
        visLabel,
        visInfo,
        visStyle,
        i18n
    }) => {
        const wrap = document.createElement('div');
        wrap.style.marginTop = '10px';
        wrap.style.padding = '12px 14px';
        wrap.style.borderRadius = '12px';
        wrap.style.background = 'var(--surface-container)';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '8px';

        wrap.appendChild(createTextBlock('div', i18n('current_tree') || '현재 트리', {
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '.06em',
            color: 'var(--on-surface-variant)',
            textTransform: 'uppercase'
        }));

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.justifyContent = 'space-between';
        topRow.style.gap = '8px';
        topRow.style.flexWrap = 'wrap';

        const titleEl = document.createElement('div');
        titleEl.className = 'tree-title-text';
        titleEl.style.fontSize = '14px';
        titleEl.style.fontWeight = '700';
        titleEl.style.color = 'var(--on-surface)';
        titleEl.textContent = displayTreeTitle;

        const visBadge = document.createElement('span');
        visBadge.style.cssText = `${visStyle}padding:4px 10px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;font-size:12px;`;
        visBadge.appendChild(createInlineIcon(visIcon, '12px'));
        visBadge.appendChild(document.createTextNode(visLabel));

        topRow.appendChild(titleEl);
        topRow.appendChild(visBadge);

        wrap.appendChild(topRow);
        wrap.appendChild(createTextBlock('div', visInfo, {
            fontSize: '11px',
            color: 'var(--on-surface-variant)'
        }));

        return wrap;
    };

    const createHeaderTitleRow = ({ titleText, localBadgeText, shareButtonEl = null }) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.justifyContent = 'space-between';

        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';
        left.style.flexWrap = 'wrap';

        const title = document.createElement('span');
        title.style.fontSize = '1.4rem';
        title.style.lineHeight = '1.2';
        title.style.fontWeight = '900';
        title.style.letterSpacing = '-0.03em';
        title.style.color = 'var(--on-surface)';
        title.textContent = titleText || '';

        left.appendChild(title);

        if (localBadgeText) {
            const badge = document.createElement('span');
            badge.style.fontSize = '11px';
            badge.style.padding = '2px 8px';
            badge.style.background = 'rgba(239,108,0,0.1)';
            badge.style.color = '#ef6c00';
            badge.style.borderRadius = '99px';
            badge.style.fontWeight = '600';
            badge.textContent = localBadgeText;
            left.appendChild(badge);
        }

        row.appendChild(left);

        if (shareButtonEl) {
            row.appendChild(shareButtonEl);
        }

        return row;
    };

    const createShareTreeButton = ({ visStyle, shareLabel }) => {
        const btn = document.createElement('button');
        btn.id = 'shareTreeBtn';
        btn.type = 'button';
        btn.style.cssText = `${visStyle}font-size:12px;padding:6px 12px;border-radius:99px;cursor:pointer;border:none;font-weight:600;display:flex;align-items:center;gap:4px;`;
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

    const resetDetailViewState = () => {
        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.innerHTML = '';
        }

        const imgEl = detailPanel.querySelector('.detail-video img');
        if (imgEl) {
            imgEl.removeAttribute('src');
            imgEl.src = '';
            imgEl.alt = '';
        }

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
            emptyState.innerHTML = '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span><p style="font-size:1rem;font-weight:700;margin-bottom:8px;color:var(--on-surface);">' + formatI18nText('detail_empty_title', '첫 순간이 트리를 깨워요') + '</p><p style="font-size:0.9rem;opacity:0.78;line-height:1.6;">' + formatI18nText('detail_empty_desc', '왼쪽 아래의 "순간 추가" 버튼으로 당신의 첫 기억을 심어보세요.') + '</p></div>';
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
            ? resolveInfoText(i18n('share_info'), 'share_info', '링크가 있는 사람은 이 트리를 볼 수 있습니다')
            : resolveInfoText(currentTree.info || i18n('private_info'), 'private_info', '나만 볼 수 있는 트리입니다');
        const visStyle = isPublic
            ? 'background:rgba(76,175,80,0.1);color:#4caf50;border:1px solid rgba(76,175,80,0.3);'
            : 'background:rgba(158,158,158,0.1);color:#757575;border:1px solid rgba(158,158,158,0.3);';
        const displayTreeTitle = resolveTreeTitleText(currentTree.title);
        const canonicalRootId = getCanonicalRootId();
        const isEmptyState = !!data?.isNewTree;
        const isRootSelected = !isEmptyState && isRootMemory(data, canonicalRootId);
        const localSaveMode = getLocalSaveMode();

        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.innerHTML = '';

            const localBadgeText = localSaveMode
                ? (i18n('local_save_badge') || '로컬 저장')
                : '';

            const treeMetaBlock = createTreeMetaBlock({
                displayTreeTitle,
                visIcon,
                visLabel,
                visInfo,
                visStyle,
                i18n
            });

            const headerWrap = document.createElement('div');
            headerWrap.style.display = 'flex';
            headerWrap.style.flexDirection = 'column';
            headerWrap.style.gap = '8px';

            if (isEmptyState) {
                headerWrap.appendChild(createHeaderTitleRow({
                    titleText: formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요'),
                    localBadgeText
                }));

                headerWrap.appendChild(createTextBlock(
                    'div',
                    resolveHintText(i18n('empty_panel_hint_short'), 'empty_panel_hint_short', '첫 순간이 심어지면 여기에 따뜻하게 펼쳐집니다.'),
                    {
                        fontSize: '13px',
                        color: 'var(--on-surface-variant)',
                        lineHeight: '1.6'
                    }
                ));

                headerWrap.appendChild(treeMetaBlock);
                headerEl.appendChild(headerWrap);
            } else {
                const sectionLabel = isRootSelected
                    ? (i18n('start_moment') || '시작 순간')
                    : (i18n('selected_moment') || '선택된 순간');

                const sectionEl = createTextBlock('div', sectionLabel, {
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '.06em',
                    color: 'var(--primary)',
                    textTransform: 'uppercase'
                });

                let shareBtn = null;
                if (isPublic && data?.id) {
                    shareBtn = createShareTreeButton({
                        visStyle,
                        shareLabel: i18n('share_link')
                    });
                }

                headerWrap.appendChild(sectionEl);
                headerWrap.appendChild(createHeaderTitleRow({
                    titleText: data.title || '',
                    localBadgeText,
                    shareButtonEl: shareBtn
                }));
                headerWrap.appendChild(treeMetaBlock);

                headerEl.appendChild(headerWrap);

                bindShareButton({
                    btn: shareBtn,
                    data,
                    treeId,
                    i18n,
                    showToast
                });
            }
        }

        const imgEl = detailPanel.querySelector('.detail-video img');
        if (imgEl) {
            imgEl.src = resolveMemoryThumbnail(data);
        }

        const dateEl = document.getElementById('detailDateText');
        if (dateEl) {
            dateEl.textContent = isEmptyState ? '' : (data?.timestamp || '');
            dateEl.style.fontSize = '0.85rem';
            dateEl.style.color = 'var(--on-surface-variant)';
            dateEl.style.opacity = '0.8';
            dateEl.style.fontWeight = '500';
        }

        const tagsContainer = detailPanel.querySelector('.tags-container');
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

        const noteEl = detailPanel.querySelector('.diary-note');
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
                const hintEl = document.createElement('div');
                hintEl.style.marginTop = '12px';
                hintEl.style.fontSize = '12px';

                if (isRootSelected) {
                    hintEl.style.color = 'var(--primary)';
                    hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">star</span> ${formatI18nText('root_moment_hint', '이 순간은 현재 트리의 시작점입니다')}`;
                } else if (data.parentId) {
                    hintEl.style.paddingTop = '12px';
                    hintEl.style.borderTop = '1px solid var(--outline-variant)';
                    hintEl.style.color = 'var(--on-surface-variant)';
                    hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">account_tree</span> ${formatI18nText('path_moment_hint', '이 순간은 감정 경로 안에 연결되어 있습니다')}`;
                }

                if (hintEl.innerHTML) {
                    noteEl.appendChild(hintEl);
                }
            }
        }

        const memoryActions = detailPanel.querySelector('.memory-actions');
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
