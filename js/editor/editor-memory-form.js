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
        canvasArea
    } = deps;

    let isFormOpen = false;
    let escHandler = null;
    let outsideClickHandler = null;

    const addMemoryForm = document.getElementById('addMemoryForm');
    const urlInput = document.getElementById('memoryUrlInput');
    const titleInput = document.getElementById('memoryTitleInput');
    const memoInput = document.getElementById('memoryMemoInput');

    const formInputs = [urlInput, titleInput, memoInput];

    const focusTrap = (e) => {
        if (!isFormOpen) return;
        if (e.key !== 'Tab') return;

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
        urlInput.value = '';
        titleInput.value = '';
        memoInput.value = '';
        addMemoryForm.style.display = 'block';
        isFormOpen = true;

        document.addEventListener('keydown', focusTrap);
        urlInput.focus();

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
            hideAddMemoryForm();
        };

        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler, true);
        }, 0);
    };

    const hideAddMemoryForm = () => {
        addMemoryForm.style.display = 'none';
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
        const url = urlInput.value.trim();
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
        const title = titleInput.value.trim() || '새 순간';

        const newMemoryData = {
            treeId,
            title,
            memo: memoInput.value.trim() || '',
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
            console.warn('[editor] API createMemory failed, fallback to mock:', e?.message || e);

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

        const emptyMsg = document.getElementById('emptyTreeMessage');
        if (emptyMsg) {
            emptyMsg.remove();
            console.log('[editor] Removed emptyTreeMessage after first node added');
        }

        drawNode(normalizedMemory);
        const effectiveParentId = normalizedMemory.parentId || getCanonicalRootId();
        const parent = treeMemories().find((m) => m.id === effectiveParentId);
        if (parent) drawBranch(calcPosition(parent), calcPosition(normalizedMemory));

        const el = document.querySelector(`.memory-node[data-memory-id="${normalizedMemory.id}"]`);
        if (el) {
            selectNode(el, normalizedMemory);
            el.classList.add('new-node-highlight');
            setTimeout(() => el.classList.remove('new-node-highlight'), 2000);

            const nodeRect = el.getBoundingClientRect();
            const canvasRect = canvasArea.getBoundingClientRect();
            const scrollX = el.offsetLeft - canvasRect.width / 2 + nodeRect.width / 2;
            const scrollY = el.offsetTop - canvasRect.height / 2 + nodeRect.height / 2;
            canvasArea.scrollTo({
                left: Math.max(0, scrollX),
                top: Math.max(0, scrollY),
                behavior: 'smooth'
            });
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
        addMemoryFromForm
    };
}

window.createEditorMemoryForm = createEditorMemoryForm;
