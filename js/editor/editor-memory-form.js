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
        drawNode,
        drawBranch,
        calcPosition,
        updateSidebarStatus,
        updateFocusSelectedBtn,
        setDetailEmptyState,
        selectNode,
        treeMemories,
        setCachedMemories,
        rerenderCanvas,
        focusNodeById,
        canEdit
    } = deps;

    const modeHelper = window.LoveBudEditorMemoryFormMode;
    const previewHelper = window.LoveBudEditorMemoryFormPreview;
    const timeHelper = window.LoveBudEditorMemoryFormTime;
    const payloadHelper = window.LoveBudEditorMemoryFormPayload;

    function isEditorDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_EDITOR_DEBUG === true;
    }

    function editorDebugLog() {
        if (!isEditorDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    let isFormOpen = false;
    let escHandler = null;
    let outsideClickHandler = null;
    let previewInputHandler = null;
    let startTimeInputHandler = null;
    let endTimeInputHandler = null;
    let userHasEditedStartTime = false;
    let userHasEditedTitle = false;
    let currentInputMode = 'link';
    let _addMemoryInvoker = null;

    const refs = {
        addMemoryForm: document.getElementById('addMemoryForm'),
        urlInput: document.getElementById('memoryUrlInput'),
        titleInput: document.getElementById('memoryTitleInput'),
        memoInput: document.getElementById('memoryMemoInput'),
        urlField: document.getElementById('memoryUrlField'),
        modeLinkBtn: document.getElementById('memoryModeLinkBtn'),
        modeTextBtn: document.getElementById('memoryModeTextBtn'),
        supportNoteText: document.getElementById('memoryFormSupportNoteText'),
        startTimeField: document.getElementById('memoryStartTimeField'),
        videoSegmentGrid: document.getElementById('memoryVideoSegmentGrid'),
        startTimeInput: document.getElementById('memoryStartTimeInput'),
        startTimeHint: document.getElementById('memoryStartTimeHint'),
        endTimeInput: document.getElementById('memoryEndTimeInput'),
        canvasEmptyGuide: document.getElementById('canvasEmptyGuide'),
        canvasTopbar: document.querySelector('.editor-canvas-topbar'),
        formEyebrow: document.getElementById('addMemoryFormEyebrow'),
        formTitle: document.getElementById('addMemoryFormTitle'),
        formIntro: document.getElementById('addMemoryFormIntro'),
        urlLabel: document.getElementById('memoryUrlLabel'),
        titleLabel: document.getElementById('memoryTitleLabel'),
        tagsInput: document.getElementById('memoryTagsInput'),
        tagsLabel: document.getElementById('memoryTagsLabel'),
        memoLabel: document.getElementById('memoryMemoLabel'),
        confirmBtn: document.getElementById('confirmAddMemory'),
        preview: document.getElementById('memoryLinkPreview'),
        thumb: document.getElementById('memoryPreviewThumb'),
        thumbWrap: document.querySelector('#memoryLinkPreview .memory-link-preview__thumb-wrap'),
        playIcon: document.querySelector('#memoryLinkPreview .memory-link-preview__play-icon'),
        previewBody: document.querySelector('#memoryLinkPreview .memory-link-preview__body'),
        badge: document.getElementById('memoryPreviewBadge'),
        previewTitle: document.getElementById('memoryPreviewTitle'),
        previewHint: document.getElementById('memoryPreviewHint')
    };

    function getFormInputs() {
        return [
            refs.urlInput,
            refs.startTimeInput,
            refs.endTimeInput,
            refs.titleInput,
            refs.tagsInput,
            refs.memoInput
        ].filter(Boolean);
    }

    function setText(el, text) {
        if (el) el.textContent = text;
    }

    function applyFormOpenStyles() {
        const form = refs.addMemoryForm;
        if (!form) return;
        form.style.display = 'block';
        form.classList.add('is-open');
    }

    function setEmptyGuideSuppressed(isSuppressed) {
        const canvasArea = refs.addMemoryForm?.closest('.canvas-area');
        if (canvasArea) canvasArea.classList.toggle('is-memory-form-open', isSuppressed);
        if (refs.canvasTopbar) {
            if (isSuppressed) {
                refs.canvasTopbar.dataset.previousAriaHidden = refs.canvasTopbar.getAttribute('aria-hidden') || '';
                refs.canvasTopbar.setAttribute('aria-hidden', 'true');
            } else {
                const previousTopbarAriaHidden = refs.canvasTopbar.dataset.previousAriaHidden;
                if (previousTopbarAriaHidden) {
                    refs.canvasTopbar.setAttribute('aria-hidden', previousTopbarAriaHidden);
                } else {
                    refs.canvasTopbar.removeAttribute('aria-hidden');
                }
                delete refs.canvasTopbar.dataset.previousAriaHidden;
            }
        }
        if (!refs.canvasEmptyGuide) return;
        refs.canvasEmptyGuide.classList.toggle('editor-canvas-empty-guide-form-suppressed', isSuppressed);
        if (isSuppressed) {
            refs.canvasEmptyGuide.dataset.previousAriaHidden = refs.canvasEmptyGuide.getAttribute('aria-hidden') || '';
            refs.canvasEmptyGuide.setAttribute('aria-hidden', 'true');
            return;
        }
        const previousAriaHidden = refs.canvasEmptyGuide.dataset.previousAriaHidden;
        if (previousAriaHidden) {
            refs.canvasEmptyGuide.setAttribute('aria-hidden', previousAriaHidden);
        } else {
            refs.canvasEmptyGuide.removeAttribute('aria-hidden');
        }
        delete refs.canvasEmptyGuide.dataset.previousAriaHidden;
    }

    function hideLinkPreview() {
        if (previewHelper && typeof previewHelper.hide === 'function') {
            previewHelper.hide(refs);
        }
    }

    function updatePreview(isFirstMoment) {
        if (previewHelper && typeof previewHelper.update === 'function') {
            previewHelper.update({
                currentInputMode,
                refs,
                i18n,
                isFirstMoment,
                userHasEditedTitle,
                userHasEditedStartTime
            });
        }
    }

    function setInputMode(mode, isFirstMoment) {
        if (modeHelper && typeof modeHelper.setInputMode === 'function') {
            currentInputMode = modeHelper.setInputMode({
                mode,
                isFirstMoment,
                refs,
                i18n,
                hidePreview: hideLinkPreview
            });
            return;
        }
        currentInputMode = mode === 'text' ? 'text' : 'link';
    }

    const focusTrap = (e) => {
        if (!isFormOpen) return;
        const formInputs = getFormInputs();
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

    function restoreFocusToInvoker() {
        var invoker = _addMemoryInvoker;
        _addMemoryInvoker = null;
        if (!invoker) return;
        // Safe guard: must be connected, not disabled, not hidden, not aria-hidden, visible
        if (typeof invoker.isConnected !== 'undefined' && !invoker.isConnected) return;
        if (invoker.disabled === true) return;
        if (invoker.hidden === true) return;
        if (invoker.getAttribute && invoker.getAttribute('aria-hidden') === 'true') return;
        if (typeof invoker.offsetParent === 'undefined' || invoker.offsetParent === null) {
            // offsetParent null for disconnected or display:none elements — safe guard
            return;
        }
        if (typeof invoker.focus !== 'function') return;
        requestAnimationFrame(function () {
            if (isFormOpen) return;
            try { invoker.focus(); } catch (e) { /* no-op */ }
        });
    }

    function resetFormValues() {
        if (refs.urlInput) refs.urlInput.value = '';
        if (refs.startTimeInput) refs.startTimeInput.value = '';
        if (refs.endTimeInput) refs.endTimeInput.value = '';
        if (refs.titleInput) refs.titleInput.value = '';
        if (refs.tagsInput) refs.tagsInput.value = '';
        if (refs.memoInput) refs.memoInput.value = '';
        userHasEditedStartTime = false;
        userHasEditedTitle = false;
        hideLinkPreview();
    }

    function applyOpenCopy(isFirstMoment) {
        setText(refs.formEyebrow, isFirstMoment
            ? (i18n('editor_add_first_memory') || '첫 순간 심기')
            : (i18n('editor_add_next_memory') || '새 순간 이어가기'));
        setText(refs.formTitle, isFirstMoment
            ? (i18n('editor_add_first_memory_title') || '이 트리의 첫 순간을 심어볼까요?')
            : (i18n('editor_add_next_memory_title') || '어떤 순간이 이어졌나요?'));
        setText(refs.urlLabel, i18n('editor_youtube_link') || 'YouTube 장면 링크');
        setText(refs.titleLabel, i18n('editor_memory_title') || '순간 제목');
        setText(refs.tagsLabel, i18n('editor_edit_tag_label') || '감정 태그 (쉼표로 구분)');
        if (refs.tagsInput) {
            refs.tagsInput.placeholder = i18n('editor_edit_tag_placeholder') || '#감동, #행복, #그리움';
        }
        setText(refs.memoLabel, i18n('editor_memory_memo_optional') || '감정 메모');
    }

    function bindPreviewEvents(isFirstMoment) {
        if (refs.urlInput) {
            if (previewInputHandler) refs.urlInput.removeEventListener('input', previewInputHandler);
            previewInputHandler = () => {
                const url = refs.urlInput.value.trim();
                if (timeHelper && typeof timeHelper.autofillStartFromUrl === 'function') {
                    timeHelper.autofillStartFromUrl({
                        rawUrl: url,
                        startTimeInput: refs.startTimeInput,
                        userHasEditedStartTime
                    });
                }
                updatePreview(isFirstMoment);
            };
            refs.urlInput.addEventListener('input', previewInputHandler);
        }

        if (refs.startTimeInput) {
            if (startTimeInputHandler) refs.startTimeInput.removeEventListener('input', startTimeInputHandler);
            startTimeInputHandler = () => {
                userHasEditedStartTime = true;
                updatePreview(isFirstMoment);
            };
            refs.startTimeInput.addEventListener('input', startTimeInputHandler);
        }

        if (refs.endTimeInput) {
            if (endTimeInputHandler) refs.endTimeInput.removeEventListener('input', endTimeInputHandler);
            endTimeInputHandler = () => updatePreview(isFirstMoment);
            refs.endTimeInput.addEventListener('input', endTimeInputHandler);
        }

        if (refs.titleInput) {
            refs.titleInput.addEventListener('input', function() {
                userHasEditedTitle = true;
            }, { once: true });
        }
    }

    const showAddMemoryForm = () => {
        if (canEdit === false) return;
        const form = refs.addMemoryForm;
        if (!form) return;

        // Capture invoker before form opens
        if (!isFormOpen) {
            var active = document.activeElement;
            if (active && active !== document.body && active !== document.documentElement) {
                // Only capture if the active element is not inside the form itself
                if (!form.contains(active)) {
                    if (active.disabled !== true && active.hidden !== true) {
                        _addMemoryInvoker = active;
                    }
                }
            }
        }

        resetFormValues();
        applyFormOpenStyles();
        setEmptyGuideSuppressed(true);
        isFormOpen = true;

        const memories = getTreeMemories();
        const isFirstMoment = !memories || memories.length === 0;

        applyOpenCopy(isFirstMoment);
        setInputMode('link', isFirstMoment);

        if (refs.modeLinkBtn) refs.modeLinkBtn.onclick = () => setInputMode('link', isFirstMoment);
        if (refs.modeTextBtn) refs.modeTextBtn.onclick = () => setInputMode('text', isFirstMoment);

        document.addEventListener('keydown', focusTrap);
        if (refs.urlInput) refs.urlInput.focus();

        escHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                hideAddMemoryForm();
            }
        };
        document.addEventListener('keydown', escHandler);

        outsideClickHandler = (e) => {
            const target = e.target;
            if (form.contains(target)) return;
            if (target.closest('#addMemoryBtn')) return;
            if (target.closest('.memory-add-affordance')) return;
            if (target.closest('#detailEmptyStartBtn')) return;
            hideAddMemoryForm();
        };
        setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);

        bindPreviewEvents(isFirstMoment);
    };

    const hideAddMemoryForm = function(options) {
        var opts = options || {};
        var shouldRestore = opts.restoreFocus !== false;
        var form = refs.addMemoryForm;
        if (!form) return;
        form.style.display = 'none';
        form.classList.remove('is-open');
        setEmptyGuideSuppressed(false);
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
        if (refs.urlInput && previewInputHandler) refs.urlInput.removeEventListener('input', previewInputHandler);
        if (refs.startTimeInput && startTimeInputHandler) refs.startTimeInput.removeEventListener('input', startTimeInputHandler);
        if (refs.endTimeInput && endTimeInputHandler) refs.endTimeInput.removeEventListener('input', endTimeInputHandler);

        if (shouldRestore) {
            restoreFocusToInvoker();
        }
    };

    const saveRuntime = window.LoveBudEditorMemoryFormSave({
        i18n,
        treeId,
        updateSaveStatus,
        showToast,
        nextMemoryId,
        normalizeMemory,
        getTreeMemories,
        setTreeMemories,
        setLocalSaveMode,
        drawNode,
        drawBranch,
        calcPosition,
        updateSidebarStatus,
        updateFocusSelectedBtn,
        setDetailEmptyState,
        selectNode,
        treeMemories,
        setCachedMemories,
        rerenderCanvas,
        focusNodeById,
        getCanonicalRootId,
        editorDebugLog
    });

    const addMemoryFromForm = async () => {
        if (canEdit === false) return;
        if (!payloadHelper || typeof payloadHelper.buildMemoryPayload !== 'function') {
            console.error('[editor] memory form payload helper is not loaded');
            showToast(i18n('save_failed') || '저장 준비에 실패했어요. 페이지를 새로고침해 주세요.', 'error');
            return;
        }

        const rawUrl = refs?.urlInput ? refs.urlInput.value.trim() : '';
        const payloadResult = payloadHelper.buildMemoryPayload({
            refs,
            currentInputMode,
            userHasEditedStartTime,
            i18n,
            treeId,
            getYouTubeInputErrorMessage,
            getTreeMemories,
            resolveParentIdForCreate,
            getSelectedNodeId,
            getCanonicalRootId
        });

        if (!payloadResult.ok) {
            showToast(payloadResult.message, payloadResult.level || 'warn');
            return;
        }

        updateSaveStatus('saving', i18n('save_saving'));
        hideAddMemoryForm({ restoreFocus: false });

        const enrichedPayload = await saveRuntime.enrichPayloadChannelMetadata(payloadResult.data, rawUrl);
        const { createdMemory, useApi } = await saveRuntime.createMemoryWithFallback(enrichedPayload);
        saveRuntime.commitMemoryToTree(createdMemory, useApi);
        restoreFocusToInvoker();
    };

    const addMemoryFromScoutPayload = async (payload, draft) => {
        if (canEdit === false) return;

        // Switch to text mode - Scout payload is text-based, not YouTube link
        currentInputMode = 'text';

        // Reset form values first
        resetFormValues();

        // Populate form fields from Scout payload
        // Keep urlInput empty - existing link mode expects YouTube URLs
        if (refs.urlInput) refs.urlInput.value = '';

        // Set title
        const title = payload.title || (draft && draft.excerpt ? draft.excerpt.slice(0, 50) : '') || 'Scout moment';
        if (refs.titleInput) refs.titleInput.value = title;

        // Build memo with attribution
        let memoParts = [];
        if (draft && draft.memo) memoParts.push(draft.memo);
        if (payload.sourceUrl) memoParts.push(`Source: ${payload.sourceUrl}`);
        if (draft && draft.emotionTags && draft.emotionTags.length > 0) {
            memoParts.push(`Tags: ${draft.emotionTags.join(', ')}`);
        }
        memoParts.push('Saved via LoveBud Scout');
        const fullMemo = memoParts.join('\n\n');
        if (refs.memoInput) refs.memoInput.value = fullMemo;

        // Show form and submit via existing flow
        const form = refs.addMemoryForm;
        if (!form) return;
        applyFormOpenStyles();
        setEmptyGuideSuppressed(true);
        isFormOpen = true;

        // No preview for Scout - hide link preview
        hideLinkPreview();

        // Submit using the existing addMemoryFromForm logic
        await addMemoryFromForm();
    };

    return {
        showAddMemoryForm,
        hideAddMemoryForm,
        addMemoryFromForm,
        addMemoryFromScoutPayload,
        isFormOpen: () => isFormOpen,
        enrichPayloadChannelMetadata: saveRuntime.enrichPayloadChannelMetadata
    };

}

window.createEditorMemoryForm = createEditorMemoryForm;
