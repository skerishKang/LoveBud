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
        updateSelectedMemoryFields,
        canEdit,
        openRenameTree
    } = deps;

    const formatI18nText = (key, fallback, replacements) => {
        let text = i18n(key) || fallback;
        if (!text || text === key) text = fallback;
        if (replacements && typeof replacements === 'object') {
            Object.keys(replacements).forEach((name) => {
                text = text.replace(new RegExp(`\{${name}\}`, 'g'), String(replacements[name] ?? ''));
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

    const createEditorMemoryAtlasPreviewPanel = window.createEditorMemoryAtlasPreviewPanel;
    const atlasPreviewPanel = typeof createEditorMemoryAtlasPreviewPanel === 'function'
        ? createEditorMemoryAtlasPreviewPanel({})
        : null;

    const treeMetaBoundary = window.createEditorDetailTreeMetaBoundary({
        i18n,
        formatI18nText,
        resolveTreeTitleText,
        createInlineIcon,
        showToast,
        openCurrentMomentDetail,
        canEdit,
        openRenameTree,
        updateTreeVisibility,
        updateDetailPanel: () => updateDetailPanel
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

    const clearDetailPlayer = (mediaWrap) => {
        const wrap = mediaWrap || detailPanel.querySelector('.detail-video');
        if (!wrap) return;
        const existingPlayer = wrap.querySelector('[data-editor-detail-player="1"]');
        if (existingPlayer) existingPlayer.remove();
        wrap.classList.remove('is-playing');
        const overlay = wrap.querySelector('.memory-preview-overlay');
        if (overlay) overlay.hidden = false;
        const imgEl = wrap.querySelector('img');
        if (imgEl) imgEl.style.display = '';
    };

    const clearDetailMedia = () => {
        const mediaWrap = detailPanel.querySelector('.detail-video');
        const imgEl = detailPanel.querySelector('.detail-video img');
        clearDetailPlayer(mediaWrap);
        if (imgEl) {
            imgEl.removeAttribute('src');
            imgEl.src = '';
            imgEl.alt = '';
        }
        if (mediaWrap) mediaWrap.style.display = 'none';
    };

    const getMemoryPlaybackUrl = (data) => {
        if (!data) return '';
        return String(
            data.sourceUrl ||
            data.source_url ||
            data.videoUrl ||
            data.video_url ||
            data.url ||
            data.linkUrl ||
            data.link_url ||
            ''
        ).trim();
    };

    const getYouTubeVideoId = (rawUrl) => {
        if (!rawUrl) return '';
        const mediaHelper = window.LoveBudMedia;
        if (mediaHelper && typeof mediaHelper.extractYouTubeId === 'function') {
            return mediaHelper.extractYouTubeId(rawUrl) || '';
        }
        try {
            const url = new URL(rawUrl, window.location.origin);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') {
                return url.pathname.split('/').filter(Boolean)[0] || '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
                if (url.pathname.startsWith('/embed/')) return url.pathname.split('/').filter(Boolean)[1] || '';
                if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/').filter(Boolean)[1] || '';
                return url.searchParams.get('v') || '';
            }
        } catch (error) {}
        return '';
    };

    const buildYouTubeEmbedUrl = (data) => {
        const rawUrl = getMemoryPlaybackUrl(data);
        const videoId = getYouTubeVideoId(rawUrl);
        if (!videoId) return '';

        const mediaHelper = window.LoveBudMedia;
        let startSeconds = null;
        let endSeconds = null;

        let startValue = data && (data.startTime || data.start_time || data.startSeconds || data.start_seconds);
        let endValue = data && (data.endTime || data.end_time || data.endSeconds || data.end_seconds);

        if (mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
            if (startValue !== undefined && startValue !== null) {
                startSeconds = mediaHelper.parseYouTubeTimeToSeconds(startValue);
            }
            if (endValue !== undefined && endValue !== null) {
                endSeconds = mediaHelper.parseYouTubeTimeToSeconds(endValue);
            }
        }

        try {
            const parsed = new URL(rawUrl);
            if (startSeconds === null) {
                const urlStart = parsed.searchParams.get('start') || parsed.searchParams.get('t');
                if (urlStart && mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
                    startSeconds = mediaHelper.parseYouTubeTimeToSeconds(urlStart);
                } else if (urlStart) {
                    startSeconds = Number(urlStart);
                }
            }
            if (endSeconds === null) {
                const urlEnd = parsed.searchParams.get('end');
                if (urlEnd && mediaHelper && typeof mediaHelper.parseYouTubeTimeToSeconds === 'function') {
                    endSeconds = mediaHelper.parseYouTubeTimeToSeconds(urlEnd);
                } else if (urlEnd) {
                    endSeconds = Number(urlEnd);
                }
            }
        } catch (e) {}

        const params = new URLSearchParams();
        params.set('autoplay', '1');
        params.set('rel', '0');

        if (Number.isFinite(startSeconds) && startSeconds > 0) {
            params.set('start', String(Math.floor(startSeconds)));
        }
        if (Number.isFinite(endSeconds) && endSeconds > 0) {
            params.set('end', String(Math.floor(endSeconds)));
        }

        return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?' + params.toString();
    };

    const buildInlinePlayerElement = (data) => {
        const youtubeEmbedUrl = buildYouTubeEmbedUrl(data);
        if (youtubeEmbedUrl) {
            const iframe = document.createElement('iframe');
            iframe.dataset.editorDetailPlayer = '1';
            iframe.className = 'detail-video-player';
            iframe.src = youtubeEmbedUrl;
            iframe.title = data && data.title ? data.title : formatI18nText('selected_moment_video', '선택된 순간 영상');
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            return iframe;
        }
        return null;
    };

    const bindDetailMediaPlayback = (data, mediaWrap) => {
        if (!mediaWrap) return;
        const playBtn = mediaWrap.querySelector('.play-btn');
        if (!playBtn) return;
        playBtn.hidden = false;
        playBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const player = buildInlinePlayerElement(data);
            if (!player) {
                if (showToast) showToast(formatI18nText('moment_inline_player_unavailable', '재생 가능한 영상 링크가 없어요.'), 'warn');
                return;
            }
            clearDetailPlayer(mediaWrap);
            const imgEl = mediaWrap.querySelector('img');
            const overlay = mediaWrap.querySelector('.memory-preview-overlay');
            if (imgEl) imgEl.style.display = 'none';
            if (overlay) overlay.hidden = true;
            mediaWrap.classList.add('is-playing');
            mediaWrap.appendChild(player);
            if (typeof player.play === 'function') {
                player.play().catch(() => {});
            }
        };
    };

    const resetDetailViewState = () => {
        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = formatI18nText('editor_current_hub_heading', '현재 순간 허브');
        }

        clearDetailMedia();

        const treeMetaMount = document.getElementById('detailTreeMetaMount');
        if (treeMetaMount) treeMetaMount.innerHTML = '';

        const atlasPreviewMount = document.getElementById('detailAtlasPreviewMount');
        if (atlasPreviewMount) {
            atlasPreviewMount.textContent = '';
            atlasPreviewMount.hidden = true;
        }

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
        const atlasPreviewMount = document.getElementById('detailAtlasPreviewMount');

        if (isEmptyState) {
            if (badgeEl) badgeEl.textContent = formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요');
            if (titleEl) titleEl.textContent = formatI18nText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요');
            if (hintEl) {
                hintEl.textContent = '';
                hintEl.hidden = true;
            }
            if (atlasPreviewPanel && atlasPreviewMount) atlasPreviewPanel.render(atlasPreviewMount, null);
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
            clearDetailPlayer(mediaWrap);
            // #2817 regression follow-up: editor must NOT auto-play YouTube
            // when a moment is selected. Selection only renders the static
            // thumbnail + play button; buildInlinePlayerElement() is reserved
            // for the explicit play action inside bindDetailMediaPlayback().
            // Viewer/read-only keeps the immediate-iframe behavior (see
            // js/viewer/public-viewer-detail-ui.js).
            const thumbnail = resolveMemoryThumbnail(data);
            if (thumbnail) {
                imgEl.src = thumbnail;
                imgEl.alt = data.title || '';
                imgEl.style.display = '';
                const overlay = mediaWrap ? mediaWrap.querySelector('.memory-preview-overlay') : null;
                if (overlay) overlay.hidden = false;
                if (mediaWrap) mediaWrap.style.display = '';
                bindDetailMediaPlayback(data, mediaWrap);
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

        const showAtlasPreview = (() => {
            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get('atlasPreview') === '1' || params.get('debugAtlas') === '1') return true;
                if (localStorage.getItem('debugAtlas') === 'true' || localStorage.getItem('atlasPreview') === 'true') return true;
            } catch (e) {}
            return false;
        })();

        if (atlasPreviewPanel && atlasPreviewMount) {
            if (showAtlasPreview) {
                const treeState = getTreeState();
                atlasPreviewPanel.render(atlasPreviewMount, data, {
                    treeMemories: treeState.treeMemories
                });
            } else {
                atlasPreviewMount.replaceChildren();
                atlasPreviewMount.hidden = true;
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

if (typeof window !== 'undefined') {
    window.createEditorDetailUI = createEditorDetailUI;
}
