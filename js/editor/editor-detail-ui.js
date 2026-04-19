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
            emptyState.innerHTML = '<div style="text-align:center;padding:40px 24px;color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:48px;opacity:0.4;margin-bottom:16px;display:block;">sentiment_satisfied</span><p style="font-size:1rem;font-weight:600;margin-bottom:8px;color:var(--on-surface);">아직 추가된 순간이 없어요</p><p style="font-size:0.9rem;opacity:0.7;line-height:1.5;">왼쪽 아래의 \'순간 추가\' 버튼으로 첫 기록을 남겨보세요.</p></div>';
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
    };

    const updateFocusSelectedBtn = () => {
        const btn = document.getElementById('focusSelectedBtn');
        if (!btn) return;

        const hasSelection = !!getSelectedNodeId();
        btn.disabled = !hasSelection;
        btn.style.opacity = hasSelection ? '1' : '0.5';
        btn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
    };

    const updateSidebarStatus = () => {
        const treeTitleEl = document.getElementById('sidebarTreeTitle');
        const momentCountEl = document.getElementById('sidebarMomentCount');
        const hintEl = document.getElementById('sidebarSelectionHint');
        const currentTreeData = getCurrentTreeData();
        const selectedNodeId = getSelectedNodeId();
        const treeMemories = getTreeMemories();
        const canonicalRootId = getCanonicalRootId();

        if (treeTitleEl) {
            treeTitleEl.textContent = resolveTreeTitleText(currentTreeData?.title);
        }
        if (momentCountEl) {
            const count = treeMemories.filter(m => !isRootMemory(m, canonicalRootId)).length;
            momentCountEl.textContent = `순간 ${count}개`;
        }
        if (hintEl) {
            const selected = treeMemories.find(m => m.id === selectedNodeId);
            hintEl.textContent = selected?.title
                ? `현재 선택: ${selected.title}`
                : '첫 순간을 추가해 트리를 시작해 보세요.';
            hintEl.style.fontStyle = 'italic';
            hintEl.style.color = 'var(--on-surface-variant)';
        }
    };

    const updateDetailPanel = (data) => {
        const currentTree = getCurrentTreeData() || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('tree');
        const visibility = currentTree.visibility || 'private';
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
            const localBadge = localSaveMode
                ? `<span style="font-size:11px;padding:2px 8px;background:rgba(239,108,0,0.1);color:#ef6c00;border-radius:99px;font-weight:600;margin-left:8px;">${i18n('local_save_badge') || '로컬 저장'}</span>`
                : '';

            const treeMetaHtml = `
                <div style="margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--surface-container);display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--on-surface-variant);text-transform:uppercase;">
                        ${i18n('current_tree') || '현재 트리'}
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <div style="font-size:14px;font-weight:700;color:var(--on-surface);">${escapeHtml(displayTreeTitle)}</div>
                        <span style="${visStyle}padding:4px 10px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;font-size:12px;">
                            <span class="material-symbols-outlined" style="font-size:12px;">${escapeHtml(visIcon)}</span>
                            ${escapeHtml(visLabel)}
                        </span>
                    </div>
                    <div style="font-size:11px;color:var(--on-surface-variant);">${escapeHtml(visInfo)}</div>
                </div>
            `;

            let shareBtn = '';
            if (isPublic && !isEmptyState && data?.id) {
                shareBtn = `<button id="shareTreeBtn" style="${visStyle}font-size:12px;padding:6px 12px;border-radius:99px;cursor:pointer;border:none;font-weight:600;display:flex;align-items:center;gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>
                    ${i18n('share_link')}
                </button>`;
            }

            if (isEmptyState) {
                headerEl.innerHTML = `
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <span style="font-size:1.4rem;line-height:1.2;font-weight:900;letter-spacing:-0.03em;color:var(--on-surface);">${i18n('waiting_first_moment') || '첫 순간을 기다리고 있어요'}${localBadge}</span>
                        </div>
                        <div style="font-size:13px;color:var(--on-surface-variant);line-height:1.5;">
                            ${resolveHintText(i18n('empty_panel_hint_short'), 'empty_panel_hint_short', '첫 영상을 추가하면 여기에 표시됩니다.')}
                        </div>
                        ${treeMetaHtml}
                    </div>
                `;
            } else {
                const sectionLabel = isRootSelected ? (i18n('start_moment') || '시작 순간') : (i18n('selected_moment') || '선택된 순간');
                const basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

                headerEl.innerHTML = `
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--primary);text-transform:uppercase;">
                            ${sectionLabel}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
                            <span style="font-size:1.4rem;line-height:1.2;font-weight:900;letter-spacing:-0.03em;color:var(--on-surface);">${escapeHtml(data.title || '')}${localBadge}</span>
                            ${shareBtn}
                        </div>
                        ${treeMetaHtml}
                    </div>
                `;

                if (isPublic && data?.id) {
                    setTimeout(() => {
                        const btn = document.getElementById('shareTreeBtn');
                        if (btn) {
                            btn.addEventListener('click', () => {
                                const shareUrl = window.location.origin + '/' + basePath + 'detail.html?id=' + data.id + '&tree=' + treeId;
                                navigator.clipboard?.writeText(shareUrl).then(() => {
                                    showToast(i18n('copied_link') || '링크가 복사되었습니다', 'success');
                                }).catch(() => {
                                    showToast('링크 복사에 실패했습니다', 'error');
                                });
                            });
                        }
                    }, 100);
                }
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
                ? i18n('empty_tree_memo') || '트리가 아직 비어 있습니다. "순간 추가" 버튼으로 첫 순간을 기록해보세요.'
                : (data.memo || '');
            noteEl.appendChild(memoBody);

            if (!isEmptyState) {
                const hintEl = document.createElement('div');
                hintEl.style.marginTop = '12px';
                hintEl.style.fontSize = '12px';

                if (isRootSelected) {
                    hintEl.style.color = 'var(--primary)';
                    hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">star</span> ${i18n('root_moment_hint') || '이 순간은 현재 트리의 시작점입니다'}`;
                } else if (data.parentId) {
                    hintEl.style.paddingTop = '12px';
                    hintEl.style.borderTop = '1px solid var(--outline-variant)';
                    hintEl.style.color = 'var(--on-surface-variant)';
                    hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">account_tree</span> ${i18n('path_moment_hint') || '이 순간은 감정 경로 안에 연결되어 있습니다'}`;
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
