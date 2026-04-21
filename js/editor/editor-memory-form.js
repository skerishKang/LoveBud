function createEditorMemoryForm(deps) {
    const {
        i18n,
        treeId,
        getSelectedNodeId,
        getCanonicalRootId,
        resolveParentIdForCreate,
        updateSaveStatus,
        showToast,
        getYouTubeInputErrorMessage,
        nextMemoryId,
        normalizeMemory,
        getTreeMemories,
        setTreeMemories,
        setLocalSaveMode,
        getLocalSaveMode,
        drawNode,
        drawBranch,
        calcPosition,
        updateSidebarStatus,
        updateFocusSelectedBtn,
        setDetailEmptyState,
        selectNode,
        treeMemories,
        setCachedMemories,
        canvasArea,
        rerenderCanvas,
        focusNodeById
    } = deps;

    let isFormOpen = false;
    let escHandler = null;
    let outsideClickHandler = null;
    let previewInputHandler = null;

    const addMemoryForm = document.getElementById('addMemoryForm');
    const urlInput = document.getElementById('memoryUrlInput');
    const titleInput = document.getElementById('memoryTitleInput');
    const memoInput = document.getElementById('memoryMemoInput');

    const formInputs = [urlInput, titleInput, memoInput].filter(Boolean);

    function applyFormOpenStyles() {
        if (!addMemoryForm) return;
        addMemoryForm.style.display = 'block';
        addMemoryForm.classList.add('is-open');
        addMemoryForm.style.position = 'absolute';
        addMemoryForm.style.left = '50%';
        addMemoryForm.style.top = '42px';
        addMemoryForm.style.transform = 'translateX(-50%)';
        addMemoryForm.style.width = 'min(620px, calc(100% - 48px))';
        addMemoryForm.style.maxWidth = '620px';
        addMemoryForm.style.padding = '28px 28px 24px';
        addMemoryForm.style.borderRadius = '30px';
        addMemoryForm.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.985), rgba(250,246,244,0.97))';
        addMemoryForm.style.boxShadow = '0 24px 56px rgba(75,64,57,0.14)';
        addMemoryForm.style.border = '1px solid rgba(144,73,81,0.10)';
        addMemoryForm.style.zIndex = '8';
        addMemoryForm.style.backdropFilter = 'blur(12px)';
    }

    function applyPreviewStyles() {
        const preview = document.getElementById('memoryLinkPreview');
        if (!preview) return;
        preview.classList.add('is-enhanced');
        preview.style.display = 'flex';
        preview.style.alignItems = 'stretch';
        preview.style.gap = '14px';
        preview.style.padding = '14px';
        preview.style.borderRadius = '20px';
        preview.style.background = 'linear-gradient(180deg, rgba(245, 241, 238, 0.98), rgba(255,255,255,0.98))';
        preview.style.border = '1px solid rgba(144,73,81,0.10)';
        preview.style.marginTop = '8px';
        preview.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

        const thumbWrap = preview.querySelector('.memory-link-preview__thumb-wrap');
        if (thumbWrap) {
            thumbWrap.style.position = 'relative';
            thumbWrap.style.width = '136px';
            thumbWrap.style.minWidth = '136px';
            thumbWrap.style.height = '76px';
            thumbWrap.style.borderRadius = '14px';
            thumbWrap.style.overflow = 'hidden';
            thumbWrap.style.background = 'var(--surface-container, #ece9e5)';
            thumbWrap.style.boxShadow = '0 8px 20px rgba(75,64,57,0.08)';
        }

        const thumb = document.getElementById('memoryPreviewThumb');
        if (thumb) {
            thumb.style.width = '100%';
            thumb.style.height = '100%';
            thumb.style.objectFit = 'cover';
        }

        const playIcon = preview.querySelector('.memory-link-preview__play-icon');
        if (playIcon) {
            playIcon.style.position = 'absolute';
            playIcon.style.top = '50%';
            playIcon.style.left = '50%';
            playIcon.style.transform = 'translate(-50%, -50%)';
            playIcon.style.fontSize = '32px';
            playIcon.style.color = '#fff';
            playIcon.style.opacity = '0.92';
            playIcon.style.textShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }

        const body = preview.querySelector('.memory-link-preview__body');
        if (body) {
            body.style.flex = '1';
            body.style.display = 'flex';
            body.style.flexDirection = 'column';
            body.style.gap = '6px';
            body.style.minWidth = '0';
        }

        const badge = document.getElementById('memoryPreviewBadge');
        if (badge) {
            badge.style.display = 'inline-flex';
            badge.style.alignItems = 'center';
            badge.style.padding = '4px 9px';
            badge.style.borderRadius = '999px';
            badge.style.background = 'rgba(144, 73, 81, 0.1)';
            badge.style.color = 'var(--primary, #904951)';
            badge.style.fontSize = '10px';
            badge.style.fontWeight = '700';
            badge.style.letterSpacing = '0.03em';
            badge.style.textTransform = 'uppercase';
            badge.style.width = 'fit-content';
        }

        const title = document.getElementById('memoryPreviewTitle');
        if (title) {
            title.style.fontSize = '0.95rem';
            title.style.fontWeight = '700';
            title.style.color = 'var(--on-surface, #333)';
            title.style.lineHeight = '1.4';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.whiteSpace = 'nowrap';
        }

        const hint = document.getElementById('memoryPreviewHint');
        if (hint) {
            hint.style.fontSize = '0.8rem';
            hint.style.color = 'var(--on-surface-variant, #666)';
            hint.style.lineHeight = '1.6';
            hint.style.margin = '0';
        }
    }

    const focusTrap = (e) => {
        if (!isFormOpen) return;
        if (e.key !== 'Tab' || formInputs.length === 0) return;

        const focused = document.activeElement;
        const lastInput = formInputs[formInputs.length - 1];
        const firstInput = formInputs[0];

        if (e.shiftKey && focused === firstInput) {
            e.preventDefault();
            lastInput.focus();
        } else if (!e.shiftKey && focused === lastInput) {
            e.preventDefault();
            firstInput.focus();
        }
    };

    const showAddMemoryForm = () => {
        if (!addMemoryForm) return;
        if (urlInput) urlInput.value = '';
        if (titleInput) titleInput.value = '';
        if (memoInput) memoInput.value = '';

        const preview = document.getElementById('memoryLinkPreview');
        if (preview) {
            preview.classList.add('is-hidden');
            preview.classList.remove('is-enhanced');
        }

        applyFormOpenStyles();
        isFormOpen = true;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;

        const formEyebrow = document.getElementById('addMemoryFormEyebrow');
        const formTitle = document.getElementById('addMemoryFormTitle');
        const formIntro = document.getElementById('addMemoryFormIntro');
        const urlLabel = document.getElementById('memoryUrlLabel');
        const titleLabel = document.getElementById('memoryTitleLabel');
        const memoLabel = document.getElementById('memoryMemoLabel');
        const confirmBtn = document.getElementById('confirmAddMemory');

        if (formEyebrow) {
            formEyebrow.textContent = isFirstMoment
                ? (i18n('editor_add_first_memory') || '첫 순간 심기')
                : (i18n('editor_add_next_memory') || '새 순간 이어가기');
        }
        if (formTitle) {
            formTitle.textContent = isFirstMoment
                ? (i18n('editor_add_first_memory_title') || '이 트리의 첫 순간을 심어볼까요?')
                : (i18n('editor_add_next_memory_title') || '어떤 순간이 이어졌나요?');
        }
        if (formIntro) {
            formIntro.textContent = isFirstMoment
                ? (i18n('editor_add_first_memory_intro') || '링크와 짧은 메모를 남기면 이 장면에서 러브트리가 시작돼요.')
                : (i18n('editor_add_next_memory_intro') || '현재 마음에서 이어진 장면을 붙여 트리를 더 자라게 해보세요.');
        }
        if (urlLabel) urlLabel.textContent = i18n('editor_youtube_link') || 'YouTube 장면 링크';
        if (titleLabel) titleLabel.textContent = i18n('editor_memory_title') || '순간 제목';
        if (memoLabel) memoLabel.textContent = i18n('editor_memory_memo_optional') || '감정 메모';
        if (confirmBtn) {
            confirmBtn.textContent = isFirstMoment
                ? (i18n('editor_confirm_add_first') || '첫 순간 심기')
                : (i18n('editor_confirm_add_next') || '이 순간 이어가기');
        }

        document.addEventListener('keydown', focusTrap);
        if (urlInput) urlInput.focus();

        escHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                hideAddMemoryForm();
            }
        };
        document.addEventListener('keydown', escHandler);

        outsideClickHandler = (e) => {
            const target = e.target;
            if (addMemoryForm.contains(target)) return;
            if (target.closest('#addMemoryBtn')) return;
            if (target.closest('.memory-add-affordance')) return;
            if (target.closest('#detailEmptyStartBtn')) return;
            hideAddMemoryForm();
        };

        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler, true);
        }, 0);

        let userHasEditedTitle = false;
        if (titleInput) {
            titleInput.addEventListener('input', function() {
                userHasEditedTitle = true;
            }, { once: true });
        }

        const updatePreview = function() {
            const previewInner = document.getElementById('memoryLinkPreview');
            if (!previewInner) return;

            const url = urlInput ? urlInput.value.trim() : '';
            let videoId = '';

            if (window.LoveBudMedia?.extractYouTubeId) {
                videoId = window.LoveBudMedia.extractYouTubeId(url) || '';
            } else {
                try {
                    if (!url) throw new Error('Empty URL');
                    const parsed = new URL(url.trim());
                    const host = parsed.hostname.replace(/^www\./, '');
                    if (host === 'youtu.be') {
                        videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
                    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
                        if (parsed.pathname === '/watch') {
                            videoId = parsed.searchParams.get('v') || '';
                        } else {
                            const parts = parsed.pathname.split('/').filter(Boolean);
                            if (parts[0] === 'shorts' || parts[0] === 'embed') {
                                videoId = parts[1] || '';
                            }
                        }
                    }
                } catch (e) {
                    videoId = '';
                }
            }

            if (videoId) {
                previewInner.classList.remove('is-hidden');
                applyPreviewStyles();

                const thumb = document.getElementById('memoryPreviewThumb');
                if (thumb) {
                    thumb.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                }

                if (!userHasEditedTitle && titleInput) {
                    const defaultTitle = isFirstMoment
                        ? (i18n('editor_default_first_title') || '첫 순간')
                        : (i18n('editor_default_next_title') || '이어진 순간');
                    titleInput.value = defaultTitle;
                }
            } else {
                previewInner.classList.add('is-hidden');
                previewInner.classList.remove('is-enhanced');
            }
        };

        if (urlInput) {
            if (previewInputHandler) urlInput.removeEventListener('input', previewInputHandler);
            previewInputHandler = updatePreview;
            urlInput.addEventListener('input', previewInputHandler);
        }
    };

    const hideAddMemoryForm = () => {
        if (!addMemoryForm) return;
        addMemoryForm.style.display = 'none';
        addMemoryForm.classList.remove('is-open');
        isFormOpen = false;

        document.removeEventListener('keydown', focusTrap);
        if (escHandler) {
            document.removeEventListener('keydown', escHandler);
            escHandler = null;
        }
        if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler, true);
            outsideClickHandler = null;
        }
    };

    const addMemoryFromForm = async () => {
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) {
            showToast(i18n('enter_youtube'), 'warn');
            return;
        }

        let videoId;
        let embedUrl;
        let thumbnailUrl;

        if (window.LoveBudMedia?.extractYouTubeId) {
            videoId = window.LoveBudMedia.extractYouTubeId(url);
            if (!videoId) {
                showToast(getYouTubeInputErrorMessage(url), 'error');
                return;
            }
            embedUrl = window.LoveBudMedia.getEmbedUrl(url, 'youtube');
            thumbnailUrl = window.LoveBudMedia.getThumbnailUrl(url, 'youtube', 'mqdefault');
        } else {
            console.warn('[editor] LoveBudMedia not loaded, using fallback YouTube parsing');
            const match = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
            if (!match) {
                showToast(getYouTubeInputErrorMessage(url), 'error');
                return;
            }
            videoId = match[1];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        }

        updateSaveStatus('saving', i18n('save_saving'));

        const today = new Date();
        const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;
        const defaultTitle = isFirstMoment
            ? (i18n('editor_default_first_title') || '첫 순간')
            : (i18n('editor_default_next_title') || '이어진 순간');
        const title = (titleInput && titleInput.value.trim()) || defaultTitle;

        const newMemoryData = {
            treeId,
            title,
            memo: memoInput ? (memoInput.value.trim() || '') : '',
            timestamp: dateStr,
            sourceUrl: embedUrl,
            sourceType: 'youtube',
            emotionTags: [],
            parentId: resolveParentIdForCreate(getSelectedNodeId(), getCanonicalRootId()),
            thumbnail: thumbnailUrl,
            artist: '',
            source: 'YouTube',
            visibility: 'public'
        };

        hideAddMemoryForm();

        let createdMemory = null;
        let useApi = false;
        try {
            if (window.apiClient && typeof window.apiClient.createMemory === 'function') {
                createdMemory = await window.apiClient.createMemory(newMemoryData);
                useApi = true;
                setLocalSaveMode(false);
                console.log('[editor] API createMemory success:', createdMemory);
            } else {
                throw new Error('createMemory API not available');
            }
        } catch (e) {
            console.warn('[editor] API createMemory failed, using local save:', e?.message || e);

            if (e?.message?.includes('401') || e?.message?.includes('403')) {
                showToast(i18n('no_permission_local'), 'warn');
            } else if (e?.message?.includes('400')) {
                updateSaveStatus('failed', i18n('check_input') || '입력값을 다시 확인해 주세요.');
                showToast(i18n('check_input') || '입력값을 다시 확인해 주세요.', 'error');
            } else {
                showToast(i18n('server_fail_local') || '서버 저장에 실패해 로컬 저장으로 전환합니다.', 'error');
            }
        }

        if (!createdMemory || typeof createdMemory !== 'object') {
            console.log('[editor] Using local fallback memory');
            setLocalSaveMode(true);
            createdMemory = {
                id: nextMemoryId(),
                ...newMemoryData,
                createdAt: dateStr,
                delay: '0.5s'
            };
        }

        const normalizedNew = normalizeMemory(createdMemory);
        let didRefreshFromServer = false;

        try {
            if (useApi && window.apiClient && typeof window.apiClient.getMemoriesByTree === 'function') {
                const refreshed = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(refreshed)) {
                    setTreeMemories(refreshed.map(normalizeMemory).filter(Boolean));
                    didRefreshFromServer = true;
                }
            }

            if (!didRefreshFromServer) {
                const nextMemories = Array.isArray(getTreeMemories()) ? getTreeMemories().slice() : [];
                const exists = nextMemories.some((m) => m.id === normalizedNew?.id);
                if (!exists && normalizedNew) nextMemories.push(normalizedNew);
                setTreeMemories(nextMemories);
            }
        } catch (e) {
            const nextMemories = Array.isArray(getTreeMemories()) ? getTreeMemories().slice() : [];
            const exists = nextMemories.some((m) => m.id === normalizedNew?.id);
            if (!exists && normalizedNew) nextMemories.push(normalizedNew);
            setTreeMemories(nextMemories);
        }

        const normalizedMemory = normalizeMemory(createdMemory);
        if (!normalizedMemory) {
            console.error('[editor] Memory normalization failed');
            updateSaveStatus('failed', i18n('save_failed'));
            return;
        }

        if (typeof rerenderCanvas === 'function') {
            rerenderCanvas();
        } else {
            drawNode(normalizedMemory);
            const effectiveParentId = normalizedMemory.parentId || getCanonicalRootId();
            const parent = treeMemories().find((m) => m.id === effectiveParentId);
            if (parent) drawBranch(calcPosition(parent), calcPosition(normalizedMemory));
        }

        const el = document.querySelector(`.memory-node[data-memory-id="${normalizedMemory.id}"]`);
        if (el) {
            selectNode(el, normalizedMemory);
            el.classList.add('new-node-highlight');
            setTimeout(() => el.classList.remove('new-node-highlight'), 2000);
        }
        if (typeof focusNodeById === 'function') {
            focusNodeById(normalizedMemory.id);
        }

        if (useApi && didRefreshFromServer) {
            updateSaveStatus('saved', i18n('save_saved'));
        } else {
            updateSaveStatus('saved', i18n('save_saved_local') || '로컬 저장됨');
        }

        if (typeof setCachedMemories === 'function' && treeId) {
            setCachedMemories(treeId, getTreeMemories());
            console.log('[editor] 메모리 추가 후 캐시 갱신', getTreeMemories().length, '개');
        }

        updateSidebarStatus();
        updateFocusSelectedBtn();
        setDetailEmptyState(false);
    };

    return {
        showAddMemoryForm,
        hideAddMemoryForm,
        addMemoryFromForm,
        isFormOpen: () => isFormOpen
    };
}

window.createEditorMemoryForm = createEditorMemoryForm;
