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
    let startTimeInputHandler = null;
    let currentInputMode = 'link';
    let userHasEditedStartTime = false;


    const addMemoryForm = document.getElementById('addMemoryForm');
    const urlInput = document.getElementById('memoryUrlInput');
    const titleInput = document.getElementById('memoryTitleInput');
    const memoInput = document.getElementById('memoryMemoInput');
    const urlField = document.getElementById('memoryUrlField');
    const modeLinkBtn = document.getElementById('memoryModeLinkBtn');
    const modeTextBtn = document.getElementById('memoryModeTextBtn');
    const supportNoteText = document.getElementById('memoryFormSupportNoteText');
    const startTimeField = document.getElementById('memoryStartTimeField');
    const startTimeInput = document.getElementById('memoryStartTimeInput');
    const startTimeHint = document.getElementById('memoryStartTimeHint');


    const formInputs = [urlInput, startTimeInput, titleInput, memoInput].filter(Boolean);

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

    function hideLinkPreview() {
        const preview = document.getElementById('memoryLinkPreview');
        if (preview) {
            preview.classList.add('is-hidden');
            preview.classList.remove('is-enhanced');
        }
    }

    function setInputMode(mode, isFirstMoment) {
        currentInputMode = mode === 'text' ? 'text' : 'link';
        const linkMode = currentInputMode === 'link';

        if (modeLinkBtn) modeLinkBtn.classList.toggle('is-active', linkMode);
        if (modeTextBtn) modeTextBtn.classList.toggle('is-active', !linkMode);
        if (urlField) urlField.classList.toggle('is-deemphasized', !linkMode);
        if (startTimeField) startTimeField.style.display = linkMode ? 'block' : 'none';


        const urlLabel = document.getElementById('memoryUrlLabel');
        const formIntro = document.getElementById('addMemoryFormIntro');
        const confirmBtn = document.getElementById('confirmAddMemory');

        if (urlInput) {
            urlInput.placeholder = linkMode
                ? 'https://www.youtube.com/watch?v=...'
                : (i18n('editor_link_optional_placeholder') || '링크가 있다면 나중에 붙여도 괜찮아요');
        }

        if (urlLabel) {
            urlLabel.textContent = linkMode
                ? (i18n('editor_youtube_link') || 'YouTube 장면 링크')
                : (i18n('editor_optional_link') || '참고 링크 (선택)');
        }

        if (formIntro) {
            if (linkMode) {
                formIntro.textContent = isFirstMoment
                    ? (i18n('editor_add_first_memory_intro') || '링크와 짧은 메모를 남기면 이 장면에서 러브트리가 시작돼요.')
                    : (i18n('editor_add_next_memory_intro') || '현재 마음에서 이어진 장면을 붙여 트리를 더 자라게 해보세요.');
            } else {
                formIntro.textContent = isFirstMoment
                    ? (i18n('editor_add_first_memory_text_intro') || '링크 없이도 제목과 메모만으로 첫 순간을 심을 수 있어요.')
                    : (i18n('editor_add_next_memory_text_intro') || '짧은 제목과 메모만으로도 이어진 순간을 남길 수 있어요.');
            }
        }

        if (supportNoteText) {
            supportNoteText.textContent = linkMode
                ? (i18n('editor_link_mode_help') || '링크가 있으면 대표 장면과 썸네일이 잡혀요. 제목은 자동 제안 후 직접 다듬을 수 있어요.')
                : (i18n('editor_text_mode_help') || '링크가 없어도 제목과 메모만으로 저장할 수 있어요. 카드에는 텍스트형 대표 순간이 표시돼요.');
        }

        if (confirmBtn) {
            if (linkMode) {
                confirmBtn.textContent = isFirstMoment
                    ? (i18n('editor_confirm_add_first') || '첫 순간 심기')
                    : (i18n('editor_confirm_add_next') || '이 순간 이어가기');
            } else {
                confirmBtn.textContent = isFirstMoment
                    ? (i18n('editor_confirm_add_first_text') || '이 마음으로 시작하기')
                    : (i18n('editor_confirm_add_next_text') || '이 메모 이어붙이기');
            }
        }

        if (!linkMode) {
            hideLinkPreview();
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
        if (startTimeInput) startTimeInput.value = '';
        userHasEditedStartTime = false;

        if (titleInput) titleInput.value = '';
        if (memoInput) memoInput.value = '';

        hideLinkPreview();

        applyFormOpenStyles();
        isFormOpen = true;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;

        const formEyebrow = document.getElementById('addMemoryFormEyebrow');
        const formTitle = document.getElementById('addMemoryFormTitle');
        const urlLabel = document.getElementById('memoryUrlLabel');
        const titleLabel = document.getElementById('memoryTitleLabel');
        const memoLabel = document.getElementById('memoryMemoLabel');

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
        if (urlLabel) urlLabel.textContent = i18n('editor_youtube_link') || 'YouTube 장면 링크';
        if (titleLabel) titleLabel.textContent = i18n('editor_memory_title') || '순간 제목';
        if (memoLabel) memoLabel.textContent = i18n('editor_memory_memo_optional') || '감정 메모';

        setInputMode('link', isFirstMoment);

        if (modeLinkBtn) {
            modeLinkBtn.onclick = () => setInputMode('link', isFirstMoment);
        }
        if (modeTextBtn) {
            modeTextBtn.onclick = () => setInputMode('text', isFirstMoment);
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
            if (currentInputMode !== 'link') {
                hideLinkPreview();
                return;
            }

            const previewInner = document.getElementById('memoryLinkPreview');
            if (!previewInner) return;

            const url = urlInput ? urlInput.value.trim() : '';
            let videoId = '';

            if (window.LoveBudMedia?.extractYouTubeId) {
                videoId = window.LoveBudMedia.extractYouTubeId(url) || '';
            }

            if (videoId) {
                previewInner.classList.remove('is-hidden');
                applyPreviewStyles();

                const thumb = document.getElementById('memoryPreviewThumb');
                if (thumb) {
                    thumb.src = window.LoveBudMedia?.getThumbnailUrl(url) || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                }

                if (!userHasEditedTitle && titleInput) {
                    const defaultTitle = isFirstMoment
                        ? (i18n('editor_default_first_title') || '첫 순간')
                        : (i18n('editor_default_next_title') || '이어진 순간');
                    titleInput.value = defaultTitle;
                }

                // 시작 시간 힌트 업데이트
                const hint = document.getElementById('memoryPreviewHint');

                // Fix 3 Policy: userHasEditedStartTime === true 이면 수동 입력값만 우선
                let startSeconds = null;
                if (userHasEditedStartTime) {
                    startSeconds = window.LoveBudMedia?.parseYouTubeTimeToSeconds(startTimeInput?.value);
                } else {
                    startSeconds = window.LoveBudMedia?.extractYouTubeStartSeconds(url);
                }

                const formatted = window.LoveBudMedia?.formatYouTubeStartTime(startSeconds);

                if (hint && formatted) {
                    hint.textContent = `${formatted}부터 재생돼요. 제목과 메모를 다듬어 트리에 심어 주세요.`;
                } else if (hint) {
                    hint.textContent = i18n('editor_preview_hint') || '이 장면을 트리에 심기 전에 제목과 메모를 다듬어 주세요.';
                }

                if (startTimeHint) {
                    startTimeHint.textContent = formatted
                        ? `${formatted}부터 재생돼요. 유튜브 공유에서 “시작 시간”을 체크한 링크도 자동으로 잡혀요.`
                        : '유튜브 공유에서 “시작 시간”을 체크한 링크를 붙이면 자동으로 잡혀요.';
                }
            } else {
                hideLinkPreview();
            }
        };

        if (urlInput) {
            if (previewInputHandler) urlInput.removeEventListener('input', previewInputHandler);
            previewInputHandler = () => {
                const url = urlInput.value.trim();
                if (!userHasEditedStartTime && window.LoveBudMedia) {
                    const fromUrl = window.LoveBudMedia.extractYouTubeStartSeconds(url);
                    if (fromUrl) {
                        startTimeInput.value = window.LoveBudMedia.formatYouTubeStartTime(fromUrl);
                    } else {
                        startTimeInput.value = '';
                    }
                }
                updatePreview();
            };
            urlInput.addEventListener('input', previewInputHandler);
        }

        if (startTimeInput) {
            if (startTimeInputHandler) startTimeInput.removeEventListener('input', startTimeInputHandler);
            startTimeInputHandler = () => {
                userHasEditedStartTime = true;
                updatePreview();
            };
            startTimeInput.addEventListener('input', startTimeInputHandler);
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
        if (urlInput && previewInputHandler) {
            urlInput.removeEventListener('input', previewInputHandler);
        }
        if (startTimeInput && startTimeInputHandler) {
            startTimeInput.removeEventListener('input', startTimeInputHandler);
        }
    };

    const addMemoryFromForm = async () => {
        const rawUrl = urlInput ? urlInput.value.trim() : '';
        const titleValue = titleInput ? titleInput.value.trim() : '';
        const memoValue = memoInput ? memoInput.value.trim() : '';
        const usingLinkMode = currentInputMode === 'link';

        if (usingLinkMode && !rawUrl) {
            showToast(i18n('enter_youtube'), 'warn');
            return;
        }

        if (!usingLinkMode && !titleValue && !memoValue) {
            showToast(i18n('editor_enter_text_moment') || '제목이나 메모를 한 줄 이상 남겨 주세요.', 'warn');
            return;
        }

        let embedUrl = '';
        let thumbnailUrl = '';
        let sourceType = 'other';
        let sourceLabel = '';

        if (rawUrl) {
            let videoId;
            if (window.LoveBudMedia?.extractYouTubeId) {
                videoId = window.LoveBudMedia.extractYouTubeId(rawUrl);
                if (!videoId) {
                    showToast(getYouTubeInputErrorMessage(rawUrl), 'error');
                    return;
                }

                // Fix 3 Policy
                let startSeconds = null;
                if (userHasEditedStartTime) {
                    startSeconds = window.LoveBudMedia.parseYouTubeTimeToSeconds(startTimeInput?.value);
                } else {
                    startSeconds = window.LoveBudMedia.extractYouTubeStartSeconds(rawUrl);
                }

                embedUrl = window.LoveBudMedia.getEmbedUrl(rawUrl, 'youtube', { startSeconds });

                thumbnailUrl = window.LoveBudMedia.getThumbnailUrl(rawUrl, 'youtube', 'mqdefault');
            } else {
                console.warn('[editor] LoveBudMedia not loaded, using fallback YouTube parsing');
                const match = rawUrl.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
                if (!match) {
                    showToast(getYouTubeInputErrorMessage(rawUrl), 'error');
                    return;
                }
                videoId = match[1];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
                thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }
            sourceType = 'youtube';
            sourceLabel = 'YouTube';
        }

        updateSaveStatus('saving', i18n('save_saving'));

        const today = new Date();
        const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;
        const defaultTitle = isFirstMoment
            ? (i18n('editor_default_first_title') || '첫 순간')
            : (i18n('editor_default_next_title') || '이어진 순간');
        const title = titleValue || defaultTitle;

        const newMemoryData = {
            treeId,
            title,
            memo: memoValue || '',
            timestamp: dateStr,
            sourceUrl: embedUrl,
            sourceType,
            emotionTags: [],
            parentId: resolveParentIdForCreate(getSelectedNodeId(), getCanonicalRootId()),
            thumbnail: thumbnailUrl,
            artist: '',
            source: sourceLabel,
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
        const nextMemories = Array.isArray(getTreeMemories()) ? getTreeMemories().slice() : [];
        const exists = nextMemories.some((m) => m.id === normalizedNew?.id);
        if (!exists && normalizedNew) nextMemories.push(normalizedNew);
        setTreeMemories(nextMemories);

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

        if (useApi) {
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
