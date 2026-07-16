function makeMomentReactionsController(deps) {
    const {
        getElementById,
        apiClient,
        showToast,
        i18n
    } = deps;

    let currentMemoryId = null;
    let selectionEpoch = 0;
    let socialState = 'hidden';
    let likeCountKnown = false;
    let commentCountKnown = false;
    let likeCountValue = null;
    let commentCountValue = null;
    let isSubmitting = false;

    function getControls() {
        return {
            card: getElementById('momentReactionsCard'),
            likeBtn: getElementById('momentReactionLikeButton'),
            likeCount: getElementById('momentReactionLikeValue'),
            commentBtn: getElementById('momentReactionCommentStatus'),
            commentCount: getElementById('momentReactionCommentValue'),
            errorEl: getElementById('momentReactionWriteError')
        };
    }

    function setError(message) {
        const { errorEl } = getControls();
        if (!errorEl) return;
        errorEl.textContent = message || '';
        errorEl.style.display = message ? '' : 'none';
    }

    function formatCount(value, known) {
        if (!known || value === null || value === undefined) return '⋯';
        return String(value);
    }

    function syncAriaPressed(likeBtn, reacted) {
        if (!likeBtn) return;
        likeBtn.dataset.reacted = reacted ? 'true' : 'false';
        likeBtn.setAttribute('aria-pressed', reacted ? 'true' : 'false');
        const likeIcon = likeBtn.querySelector('.editor-reaction-like-icon');
        if (likeIcon) likeIcon.textContent = reacted ? '❤️' : '🤍';
    }

    function setInteractiveEnabled(enabled) {
        const { likeBtn, commentBtn } = getControls();
        const canUse = !!enabled && !isSubmitting;
        if (likeBtn) {
            likeBtn.disabled = !canUse;
            if (canUse) likeBtn.removeAttribute('aria-disabled');
            else likeBtn.setAttribute('aria-disabled', 'true');
        }
        if (commentBtn) {
            commentBtn.disabled = !canUse;
            if (canUse) commentBtn.removeAttribute('aria-disabled');
            else commentBtn.setAttribute('aria-disabled', 'true');
        }
    }

    function applySocialState(nextState) {
        socialState = nextState;
        const { card } = getControls();
        if (card) {
            card.dataset.socialState = nextState;
            card.style.display = nextState === 'hidden' ? 'none' : '';
            // Never mark owner social as public/read-only.
            if (card.classList && typeof card.classList.remove === 'function') {
                card.classList.remove('is-read-only');
                card.classList.remove('is-public-readonly');
            }
            if (typeof card.removeAttribute === 'function') {
                card.removeAttribute('data-read-only-summary');
            }
            if (card.dataset) {
                delete card.dataset.readOnlySummary;
            }
        }

        if (nextState === 'loading') {
            setInteractiveEnabled(false);
        } else if (nextState === 'ready') {
            setInteractiveEnabled(true);
        } else if (nextState === 'submitting') {
            setInteractiveEnabled(false);
        } else if (nextState === 'error') {
            // Keep controls usable after a non-fatal summary error when counts remain unknown.
            setInteractiveEnabled(true);
        } else if (nextState === 'hidden') {
            setInteractiveEnabled(false);
        }
    }

    function paintCounts() {
        const { likeCount, commentCount } = getControls();
        if (likeCount) likeCount.textContent = formatCount(likeCountValue, likeCountKnown);
        if (commentCount) commentCount.textContent = formatCount(commentCountValue, commentCountKnown);
    }

    function resetUnknownCounts() {
        likeCountKnown = false;
        commentCountKnown = false;
        likeCountValue = null;
        commentCountValue = null;
        paintCounts();
    }

    function hideReactionsCard() {
        selectionEpoch += 1;
        currentMemoryId = null;
        isSubmitting = false;
        const { likeBtn, commentBtn } = getControls();
        if (likeBtn) likeBtn.onclick = null;
        if (commentBtn && commentBtn.dataset.ownerToggleBound === '1') {
            // keep bound once; state is gated by disabled/selection epoch
        }
        setError('');
        resetUnknownCounts();
        applySocialState('hidden');
    }

    return {
        update({ data, canonicalRootId, isRootMemoryFn }) {
            const { card, likeBtn, likeCount, commentCount, commentBtn } = getControls();
            if (!card || !likeBtn || !likeCount || !commentCount) return;

            if (!data?.id || (typeof isRootMemoryFn === 'function' && isRootMemoryFn(data, canonicalRootId))) {
                hideReactionsCard();
                return;
            }

            const memoryId = String(data.id);
            selectionEpoch += 1;
            const requestEpoch = selectionEpoch;
            const requestMemoryId = memoryId;
            currentMemoryId = requestMemoryId;
            isSubmitting = false;
            setError('');
            resetUnknownCounts();
            syncAriaPressed(likeBtn, false);
            applySocialState('loading');

            if (apiClient?.fetchReactionSummary) {
                apiClient.fetchReactionSummary(requestMemoryId)
                    .then((summary) => {
                        if (currentMemoryId !== requestMemoryId || selectionEpoch !== requestEpoch) return;
                        if (!summary || typeof summary !== 'object') {
                            applySocialState('error');
                            return;
                        }

                        const rawLike = summary.like_count ?? summary.likeCount;
                        const rawComment = summary.comment_count ?? summary.commentCount;
                        if (typeof rawLike === 'number' && Number.isFinite(rawLike) && rawLike >= 0) {
                            likeCountKnown = true;
                            likeCountValue = Math.floor(rawLike);
                        }
                        if (typeof rawComment === 'number' && Number.isFinite(rawComment) && rawComment >= 0) {
                            commentCountKnown = true;
                            commentCountValue = Math.floor(rawComment);
                        }
                        paintCounts();

                        const userReacted = summary.user_reacted ?? summary.userReacted ?? false;
                        syncAriaPressed(likeBtn, !!userReacted);
                        applySocialState('ready');
                    })
                    .catch(() => {
                        if (currentMemoryId !== requestMemoryId || selectionEpoch !== requestEpoch) return;
                        // Do not fabricate authoritative zeros on failure.
                        paintCounts();
                        applySocialState('error');
                    });
            } else {
                applySocialState('error');
            }

            const boundMemoryId = requestMemoryId;
            const boundEpoch = requestEpoch;

            likeBtn.onclick = async (event) => {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (currentMemoryId !== boundMemoryId || selectionEpoch !== boundEpoch) return;
                if (isSubmitting || likeBtn.disabled) return;
                if (!apiClient || typeof apiClient.toggleReaction !== 'function') {
                    setError(i18n('reaction_failed') || '반응을 저장하지 못했어요.');
                    return;
                }

                const wasReacted = likeBtn.dataset.reacted === 'true';
                const prevKnown = likeCountKnown;
                const prevCount = likeCountValue;
                const nextReacted = !wasReacted;
                const optimisticCount = nextReacted
                    ? (prevKnown ? prevCount + 1 : 1)
                    : Math.max(0, (prevKnown ? prevCount : 1) - 1);

                isSubmitting = true;
                applySocialState('submitting');
                syncAriaPressed(likeBtn, nextReacted);
                likeCountKnown = true;
                likeCountValue = optimisticCount;
                paintCounts();
                setError('');

                try {
                    const result = await apiClient.toggleReaction(boundMemoryId, 'like');
                    if (currentMemoryId !== boundMemoryId || selectionEpoch !== boundEpoch) return;
                    if (result && typeof result === 'object') {
                        const serverLike = result.like_count ?? result.likeCount;
                        if (typeof serverLike === 'number' && Number.isFinite(serverLike) && serverLike >= 0) {
                            likeCountKnown = true;
                            likeCountValue = Math.floor(serverLike);
                        }
                        const serverReacted = result.user_reacted ?? result.userReacted ?? nextReacted;
                        syncAriaPressed(likeBtn, !!serverReacted);
                        paintCounts();
                    }
                    isSubmitting = false;
                    applySocialState('ready');
                } catch (e) {
                    if (currentMemoryId !== boundMemoryId || selectionEpoch !== boundEpoch) return;
                    syncAriaPressed(likeBtn, wasReacted);
                    likeCountKnown = prevKnown;
                    likeCountValue = prevCount;
                    paintCounts();
                    isSubmitting = false;
                    applySocialState('ready');
                    setError(i18n('reaction_failed') || '반응을 저장하지 못했어요.');
                    if (typeof showToast === 'function') {
                        showToast(i18n('reaction_failed') || '반응을 저장하지 못했어요.', 'error');
                    }
                }
            };

            if (commentBtn && commentBtn.dataset.ownerToggleBound !== '1') {
                commentBtn.dataset.ownerToggleBound = '1';
                commentBtn.addEventListener('click', (event) => {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    if (commentBtn.disabled) return;
                    const panel = getElementById('momentCommentsPanel');
                    if (!panel) return;
                    const nextOpen = panel.hidden;
                    panel.hidden = !nextOpen;
                    commentBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                    if (nextOpen) {
                        const input = getElementById('momentCommentInput');
                        if (input && typeof input.focus === 'function') {
                            input.focus({ preventScroll: true });
                        }
                    }
                });
            }
        },

        hide() {
            hideReactionsCard();
        }
    };
}

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

    // Shared sanitizer for legacy localization key display
    const sanitizeMomentTitle = (value, fallback) => {
        const classifier = window.LoveBudTreeWorkspaceClassifier;
        if (classifier && typeof classifier.sanitizeDisplayTitle === 'function') {
            return classifier.sanitizeDisplayTitle(value, fallback);
        }
        return value || fallback || '';
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
    const commentsController = typeof window.createEditorMomentCommentsController === 'function'
        ? window.createEditorMomentCommentsController()
        : null;

    const momentReactionsController = makeMomentReactionsController({
        getElementById: (id) => document.getElementById(id),
        apiClient: window.apiClient,
        showToast: showToast,
        i18n: i18n
    });

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

    /**
     * Build a stable embed identity string from memory data.
     * Used to compare player identity when reselecting the same moment.
     * Combines the normalized source URL with the canonical embed URL
     * so that any change in source, video ID, timestamps, or time-range
     * fields produces a different identity.
     * Format: "normalizedSourceUrl||canonicalEmbedUrl"
     */
    const buildEmbedIdentity = (data) => {
        if (!data) return '';
        var sourceUrl = getMemoryPlaybackUrl(data);
        var embedUrl = buildYouTubeEmbedUrl(data);
        if (!sourceUrl && !embedUrl) return '';
        return (sourceUrl || '') + '||' + (embedUrl || '');
    };

    /**
     * Determine whether an existing inline player should be preserved.
     * Returns true only when ALL conditions hold:
     *   1. The existing player has a recorded memory ID.
     *   2. That ID matches the incoming data.id.
     *   3. The existing player has a recorded embed identity.
     *   4. That identity matches the incoming data's embed identity.
     *   5. The existing player is still attached to the DOM.
     */
    const shouldPreservePlayer = (data, existingPlayer) => {
        if (!data || !existingPlayer || !existingPlayer.parentNode) return false;
        var memId = existingPlayer.dataset.editorDetailMemoryId;
        var embedId = existingPlayer.dataset.editorDetailEmbedIdentity;
        if (!memId || !embedId) return false;
        if (String(memId) !== String(data.id)) return false;
        var currentEmbedId = buildEmbedIdentity(data);
        if (!currentEmbedId) return false;
        return embedId === currentEmbedId;
    };

    const buildInlinePlayerElement = (data) => {
        const youtubeEmbedUrl = buildYouTubeEmbedUrl(data);
        if (youtubeEmbedUrl) {
            const iframe = document.createElement('iframe');
            iframe.dataset.editorDetailPlayer = '1';
            iframe.dataset.editorDetailMemoryId = (data && data.id) || '';
            iframe.dataset.editorDetailEmbedIdentity = buildEmbedIdentity(data);
            iframe.className = 'detail-video-player';
            iframe.src = youtubeEmbedUrl;
            iframe.title = data && data.title
                ? sanitizeMomentTitle(data.title, formatI18nText('selected_moment_video', '선택된 순간 영상'))
                : formatI18nText('selected_moment_video', '선택된 순간 영상');
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
        };
    };

    const resetDetailViewState = () => {
        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            // #3562: right rail is selected-moment scope only.
            headerEl.textContent = formatI18nText('editor_selected_moment_heading', '선택한 순간');
        }

        clearDetailMedia();

        // Tree-scope mount lives in the left rail; do not clear it when resetting
        // selected-moment presentation. Controllers re-render tree meta by tree id.

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

        if (isEmpty) {
            resetDetailViewState();
            momentReactionsController.hide();
        }

        if (emptyState) emptyState.style.display = isEmpty ? 'block' : 'none';
        if (viewMode) viewMode.style.display = isEmpty ? 'none' : 'grid';
        if (editMode) editMode.style.display = 'none';
        if (actions) actions.style.display = isEmpty ? 'none' : 'flex';
        if (indicator && isEmpty) indicator.style.display = 'none';
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
            // #3562: right rail title is selected-moment scope only.
            headerEl.textContent = formatI18nText('editor_selected_moment_heading', '선택한 순간');
        }

        const badgeEl = document.getElementById('detailCurrentMomentBadge');
        const titleEl = document.getElementById('detailCurrentMomentTitle');
        const hintEl = document.getElementById('detailCurrentMomentHint');
        // Left-rail tree-scope mount (stable id). Not inside selected-moment panel.
        const treeMetaMount = document.getElementById('detailTreeMetaMount');
        const imgEl = detailPanel.querySelector('.detail-video img');
        const mediaWrap = detailPanel.querySelector('.detail-video');
        const memoryActions = detailPanel.querySelector('.memory-actions');
        const atlasPreviewMount = document.getElementById('detailAtlasPreviewMount');

        // #3562: tree-scope updates independently of selected-moment presence.
        // Empty/no-selection must still populate left-rail title/status/owner actions.
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

        if (isEmptyState) {
            if (commentsController) commentsController.hide();
            if (badgeEl) badgeEl.textContent = formatI18nText('waiting_first_moment', '첫 순간을 기다리고 있어요');
            if (titleEl) titleEl.textContent = formatI18nText('editor_current_moment_empty_title', '이 트리의 첫 장면을 심어 보세요');
            if (hintEl) {
                hintEl.textContent = '';
                hintEl.hidden = true;
            }
            const slotDom = window.LoveBudAppreciationSlotDom;
            if (slotDom && typeof slotDom.createAppreciationSlotDomRenderer === 'function') {
                slotDom.createAppreciationSlotDomRenderer({
                    ids: {
                        title: 'detailCurrentMomentTitle',
                        date: 'detailDateText',
                        dateGroup: 'detailDateGroup',
                        tags: 'detailTags',
                        tagsGroup: 'detailTagsGroup',
                        knowledgeList: 'detailOwnerKnowledgeList',
                        knowledgeGroup: 'detailOwnerKnowledgeGroup',
                        knowledgeItemClass: 'editor-owner-knowledge-item',
                        memo: 'detailMemo',
                        memoGroup: 'detailMemoGroup'
                    }
                }).reset();
            }
            if (atlasPreviewPanel && atlasPreviewMount) atlasPreviewPanel.render(atlasPreviewMount, null);
            setDetailEmptyState(true);
            updateFocusSelectedBtn();
            return;
        }

        setDetailEmptyState(false);

        if (badgeEl) {
            badgeEl.textContent = isRootSelected
                ? formatI18nText('start_moment', '시작 순간')
                : formatI18nText('selected_moment', '선택된 순간');
        }

        if (hintEl) {
            hintEl.textContent = '';
            hintEl.hidden = true;
        }

        if (imgEl) {
            // Preserve active inline player when reselecting the same moment
            // with the same effective embed. This avoids killing YouTube playback.
            const existingPlayer = mediaWrap ? mediaWrap.querySelector('[data-editor-detail-player="1"]') : null;
            const sameSelectionPreserved = existingPlayer && shouldPreservePlayer(data, existingPlayer);

            if (!sameSelectionPreserved) {
                clearDetailPlayer(mediaWrap);
            }
            // #2817 regression follow-up: editor must NOT auto-play YouTube
            // when a moment is selected. Selection only renders the static
            // thumbnail + play button; buildInlinePlayerElement() is reserved
            // for the explicit play action inside bindDetailMediaPlayback().
            // Viewer/read-only keeps the immediate-iframe behavior (see
            // js/viewer/public-viewer-detail-ui.js).
            const thumbnail = resolveMemoryThumbnail(data);
            if (thumbnail) {
                imgEl.src = thumbnail;
                imgEl.alt = sanitizeMomentTitle(data.title, '순간 이미지');
                imgEl.style.display = sameSelectionPreserved ? 'none' : '';
                const overlay = mediaWrap ? mediaWrap.querySelector('.memory-preview-overlay') : null;
                if (overlay) overlay.hidden = sameSelectionPreserved ? true : false;
                if (mediaWrap) mediaWrap.style.display = '';
                bindDetailMediaPlayback(data, mediaWrap);
            } else {
                if (!sameSelectionPreserved) clearDetailMedia();
            }
        }

        const editorComposer = window.LoveBudEditorAppreciationComposer;
        const slotDom = window.LoveBudAppreciationSlotDom;

        if (
            editorComposer &&
            typeof editorComposer.composeEditorAppreciationPresentation === 'function' &&
            slotDom &&
            typeof slotDom.createAppreciationSlotDomRenderer === 'function'
        ) {
            const appreciationRenderer = slotDom.createAppreciationSlotDomRenderer({
                ids: {
                    title: 'detailCurrentMomentTitle',
                    date: 'detailDateText',
                    dateGroup: 'detailDateGroup',
                    tags: 'detailTags',
                    tagsGroup: 'detailTagsGroup',
                    knowledgeList: 'detailOwnerKnowledgeList',
                    knowledgeGroup: 'detailOwnerKnowledgeGroup',
                    knowledgeItemClass: 'editor-owner-knowledge-item',
                    memo: 'detailMemo',
                    memoGroup: 'detailMemoGroup'
                }
            });
            const canOwnerEdit = canEdit !== false;
            const presentation = editorComposer.composeEditorAppreciationPresentation(data, {
                isPublicRoute: false,
                isOwner: true,
                canEdit: canOwnerEdit,
                canSwitchMode: canOwnerEdit,
                canReact: true,
                canComment: true,
                canContinue: false,
                canConnect: false,
                canDelete: false
            });
            appreciationRenderer.render(presentation);

            const detailMemo = document.getElementById('detailMemo');
            if (detailMemo && (isRootSelected || data.parentId)) {
                const memoHint = document.createElement('div');
                memoHint.style.marginTop = '12px';
                memoHint.style.fontSize = '12px';
                memoHint.style.lineHeight = '1.65';

                if (isRootSelected) {
                    memoHint.style.color = 'var(--primary)';
                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.style.fontSize = '14px';
                    icon.style.verticalAlign = 'middle';
                    icon.style.marginRight = '4px';
                    icon.textContent = 'star';
                    memoHint.appendChild(icon);
                    memoHint.appendChild(
                        document.createTextNode(
                            formatI18nText('root_moment_hint', '이 순간은 현재 트리의 시작점입니다')
                        )
                    );
                } else if (data.parentId) {
                    memoHint.style.paddingTop = '12px';
                    memoHint.style.borderTop = '1px solid var(--outline-variant)';
                }
                detailMemo.appendChild(memoHint);
            }
        }

        // Knowledge authoring UI is edit-mode only (mount lives in edit template).
        const entitySearchMount = document.getElementById('detailEntitySearchMount');
        if (entitySearchMount) {
            const entitySearchUI = window.LoveBudEditorKnowledgeLinkUI;
            if (entitySearchUI && typeof entitySearchUI.renderEntitySearch === 'function') {
                if (!entitySearchMount.dataset.entitySearchInitialized) {
                    entitySearchUI.renderEntitySearch(entitySearchMount, null, null);
                    entitySearchMount.dataset.entitySearchInitialized = '1';
                }
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
                momentReactionsController.hide();
            } else {
                momentReactionsController.update({
                    data,
                    canonicalRootId,
                    isRootMemoryFn: isRootMemory
                });
            }
        }

        if (commentsController) {
            if (isEmptyState || !data?.id || isRootMemory(data, canonicalRootId)) {
                commentsController.hide();
            } else {
                commentsController.update({ memoryId: data.id, treeId, data });
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
    window.makeMomentReactionsController = makeMomentReactionsController;
}
