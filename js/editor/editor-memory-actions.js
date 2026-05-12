function createEditorMemoryActions(deps) {
    const {
        i18n,
        updateSaveStatus,
        updateDetailPanel,
        updateSidebarStatus,
        showToast,
        getCurrentEditingMemory,
        setCurrentEditingMemory,
        getTreeMemories,
        setTreeMemories,
        getSelectedNodeId,
        setSelectedNodeId,
        getCanonicalRootId,
        isRootMemory,
        findRootMemory,
        detailPanel,
        svg,
        calcPosition,
        setDetailEmptyState,
        rerenderCanvas,
        getCurrentTreeData,
        isLocalSaveMode
    } = deps;

    let isEditMode = false;
    let isInlineMemorySaveInFlight = false;

    const formatI18nText = (key, fallback) => {
        const text = typeof i18n === 'function' ? i18n(key) : '';
        return text && text !== key ? text : fallback;
    };

    const getEditableSourceUrl = (memory) => String(memory?.sourceUrl || '').trim();

    const resolveSourceUpdate = (rawUrl) => {
        const value = String(rawUrl || '').trim();
        if (!value) {
            return {
                sourceUrl: '',
                sourceType: 'other',
                thumbnail: '',
                source: ''
            };
        }

        const media = window.LoveBudMedia || {};
        const videoId = typeof media.extractYouTubeId === 'function'
            ? media.extractYouTubeId(value)
            : ((value.match(/(?:v=|\/|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/) || [])[1] || '');

        if (!videoId) {
            return null;
        }

        const embedUrl = typeof media.getEmbedUrl === 'function'
            ? media.getEmbedUrl(value, 'youtube')
            : `https://www.youtube.com/embed/${videoId}`;
        const thumbnailUrl = typeof media.getThumbnailUrl === 'function'
            ? media.getThumbnailUrl(value, 'youtube', 'mqdefault')
            : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        return {
            sourceUrl: embedUrl || value,
            sourceType: 'youtube',
            thumbnail: thumbnailUrl || '',
            source: 'YouTube'
        };
    };

    const ensureSourceUrlEditField = () => {
        const editMode = document.getElementById('detailEditMode');
        const memoGroup = document.getElementById('editMemoInput')?.closest('.editor-form-stack');
        if (!editMode || !memoGroup) return null;

        let field = document.getElementById('editSourceUrlGroup');
        if (!field) {
            field = document.createElement('div');
            field.id = 'editSourceUrlGroup';
            field.className = 'editor-form-stack editor-form-stack-compact editor-source-url-edit-group';
            field.style.marginTop = '12px';
            field.innerHTML = `
                <label id="editSourceUrlLabel" for="editSourceUrlInput" class="editor-form-label">${formatI18nText('editor_source_url_label', '영상 또는 출처 링크')}</label>
                <input type="text" id="editSourceUrlInput" class="editor-form-input" placeholder="https://www.youtube.com/watch?v=...">
                <p id="editSourceUrlHint" class="editor-form-help editor-source-url-edit-hint">${formatI18nText('editor_source_url_hint', 'YouTube 링크를 바꾸면 저장 후 대표 이미지도 함께 갱신됩니다.')}</p>
            `;
            editMode.insertBefore(field, memoGroup);
        }

        return document.getElementById('editSourceUrlInput');
    };

    const enterEditMode = () => {
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;
        isEditMode = true;

        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');

        if (viewMode) viewMode.style.display = 'none';
        if (editMode) editMode.style.display = 'block';

        const titleInput = document.getElementById('editTitleInput');
        const sourceUrlInput = ensureSourceUrlEditField();
        const memoInput = document.getElementById('editMemoInput');
        const tagsInput = document.getElementById('editTagsInput');

        if (titleInput) {
            titleInput.value = currentEditingMemory.title || '';
            setTimeout(() => titleInput.focus(), 0);
        }
        if (sourceUrlInput) sourceUrlInput.value = getEditableSourceUrl(currentEditingMemory);
        if (memoInput) memoInput.value = currentEditingMemory.memo || '';
        if (tagsInput) tagsInput.value = (currentEditingMemory.emotionTags || []).join(', ');
    };

    const exitEditMode = () => {
        isEditMode = false;
        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');
        if (viewMode) viewMode.style.display = 'block';
        if (editMode) editMode.style.display = 'none';
    };

    const saveMemoryEdit = async () => {
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;

        const titleInput = document.getElementById('editTitleInput');
        const sourceUrlInput = document.getElementById('editSourceUrlInput');
        const memoInput = document.getElementById('editMemoInput');
        const tagsInput = document.getElementById('editTagsInput');

        const payload = {
            title: titleInput ? titleInput.value.trim() : currentEditingMemory.title,
            memo: memoInput ? memoInput.value.trim() : currentEditingMemory.memo,
            emotionTags: tagsInput ? tagsInput.value.split(',').map((t) => t.trim()).filter((t) => t) : currentEditingMemory.emotionTags
        };

        if (sourceUrlInput) {
            const rawSourceUrl = sourceUrlInput.value.trim();
            const previousSourceUrl = getEditableSourceUrl(currentEditingMemory);
            if (rawSourceUrl !== previousSourceUrl) {
                const sourceUpdate = resolveSourceUpdate(rawSourceUrl);
                if (!sourceUpdate) {
                    showToast(formatI18nText('invalid_youtube_unsupported', 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.'), 'error');
                    updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
                    return;
                }
                Object.assign(payload, sourceUpdate);
            }
        }

        updateSaveStatus('saving', i18n('save_saving'));

        try {
            if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                const savedMemory = await window.apiClient.updateMemory(currentEditingMemory.id, payload);
                const savedPatch = savedMemory && typeof savedMemory === 'object' ? savedMemory : {};
                
                // Priority: server response > payload > current memory
                // This ensures sourceUrl/thumbnail from server normalization is used
                const prioritizedPatch = {
                    ...currentEditingMemory,
                    ...payload,
                    ...savedPatch
                };
                
                // Explicitly ensure source fields come from server response
                if (savedPatch.sourceUrl !== undefined) {
                    prioritizedPatch.sourceUrl = savedPatch.sourceUrl;
                }
                if (savedPatch.thumbnail !== undefined) {
                    prioritizedPatch.thumbnail = savedPatch.thumbnail;
                }
                if (savedPatch.sourceType !== undefined) {
                    prioritizedPatch.sourceType = savedPatch.sourceType;
                }
                
                const nextEditingMemory = prioritizedPatch;

                const nextMemories = getTreeMemories().slice();
                const memIndex = nextMemories.findIndex((m) => m.id === currentEditingMemory.id);
                if (memIndex >= 0) {
                    nextMemories[memIndex] = {
                        ...nextMemories[memIndex],
                        ...nextEditingMemory
                    };
                    setTreeMemories(nextMemories);
                }

                const currentTreeData = getCurrentTreeData();
                if (currentTreeData && Array.isArray(currentTreeData.memories)) {
                    const dataIndex = currentTreeData.memories.findIndex((m) => m.id === currentEditingMemory.id);
                    if (dataIndex !== -1) {
                        currentTreeData.memories[dataIndex] = {
                            ...currentTreeData.memories[dataIndex],
                            ...nextEditingMemory
                        };
                    }
                }

                if (window.LoveBudCache) {
                    const treeId = (currentTreeData && currentTreeData.id) || nextEditingMemory.treeId || 'default';
                    const cacheKey = 'memories_' + treeId;
                    window.LoveBudCache.set(cacheKey, nextMemories, 2 * 60 * 1000);
                }

                setCurrentEditingMemory(nextEditingMemory);
                exitEditMode();
                updateDetailPanel(nextEditingMemory);
                updateSidebarStatus();
                if (typeof rerenderCanvas === 'function') rerenderCanvas();

                updateSaveStatus('saved', i18n('save_saved'));
                showToast(i18n('memory_updated') || '순간을 수정했어요', 'success');
            } else {
                throw new Error('updateMemory not available');
            }
        } catch (error) {
            console.error('[editor] Failed to update memory:', error);
            updateSaveStatus('failed', i18n('save_failed'));
            showToast(i18n('update_failed') || '순간 수정에 실패했어요', 'error');
        }
    };

    const updateSelectedMemoryFields = async (updates) => {
        const currentEditingMemory = getCurrentEditingMemory();
        const selectedNodeId = getSelectedNodeId() || currentEditingMemory?.id;
        if (!selectedNodeId) {
            updateSaveStatus('failed', i18n('save_failed'));
            return false;
        }
        if (isInlineMemorySaveInFlight) return false;

        const allowedUpdates = {};
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'title')) allowedUpdates.title = updates.title;
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'memo')) allowedUpdates.memo = updates.memo;
        if (Object.keys(allowedUpdates).length === 0) return false;

        const memories = Array.isArray(getTreeMemories()) ? getTreeMemories().slice() : [];
        const idx = memories.findIndex(m => m.id === selectedNodeId);
        if (idx === -1) {
            updateSaveStatus('failed', i18n('save_failed'));
            return false;
        }

        const localSaveMode = typeof isLocalSaveMode === 'function' ? isLocalSaveMode() : false;
        let savedMemory = null;

        updateSaveStatus('saving', i18n('save_saving'));
        isInlineMemorySaveInFlight = true;
        try {
            if (!localSaveMode) {
                if (!window.apiClient || typeof window.apiClient.updateMemory !== 'function') {
                    throw new Error('updateMemory not available');
                }
                savedMemory = await window.apiClient.updateMemory(selectedNodeId, allowedUpdates);
            }
        } catch (error) {
            console.error('[editor] Failed to update selected memory:', error);
            updateSaveStatus('failed', i18n('save_failed'));
            return false;
        } finally {
            isInlineMemorySaveInFlight = false;
        }

        const nextMemory = {
            ...memories[idx],
            ...allowedUpdates,
            ...(savedMemory && typeof savedMemory === 'object' ? savedMemory : {})
        };
        memories[idx] = nextMemory;
        setTreeMemories(memories);

        const currentTreeData = getCurrentTreeData();
        if (currentTreeData && currentTreeData.memories) {
            const dataIdx = currentTreeData.memories.findIndex(m => m.id === selectedNodeId);
            if (dataIdx !== -1) {
                currentTreeData.memories[dataIdx] = {
                    ...currentTreeData.memories[dataIdx],
                    ...nextMemory
                };
            }
        }

        if (window.LoveBudCache) {
            const treeId = (currentTreeData && currentTreeData.id) || nextMemory.treeId || 'default';
            const cacheKey = 'memories_' + treeId;
            window.LoveBudCache.set(cacheKey, memories, 2 * 60 * 1000);
        }

        if (currentEditingMemory && currentEditingMemory.id === selectedNodeId) {
            const updatedMemory = { ...currentEditingMemory, ...nextMemory };
            setCurrentEditingMemory(updatedMemory);
            if (typeof updateDetailPanel === 'function') updateDetailPanel(updatedMemory);
        } else if (typeof updateDetailPanel === 'function') {
            updateDetailPanel(nextMemory);
        }

        if (typeof rerenderCanvas === 'function') rerenderCanvas();
        if (typeof updateSidebarStatus === 'function') updateSidebarStatus();
        updateSaveStatus('saved', i18n('save_saved'));
        return true;
    };

    const deleteMemory = async () => {
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;

        if (!confirm(i18n('delete_confirm') || '이 순간을 삭제할까요?')) {
            return;
        }

        try {
            if (window.apiClient && typeof window.apiClient.deleteMemory === 'function') {
                await window.apiClient.deleteMemory(currentEditingMemory.id);

                const nextMemories = getTreeMemories().filter((m) => m.id !== currentEditingMemory.id);
                setTreeMemories(nextMemories);
                setCurrentEditingMemory(null);
                exitEditMode();

                const rootMem = findRootMemory(nextMemories);
                const nextSelection = rootMem || nextMemories[0] || null;
                if (nextSelection) {
                    setSelectedNodeId(nextSelection.id);
                    updateDetailPanel(nextSelection);
                    setCurrentEditingMemory(nextSelection);
                    setDetailEmptyState(false);
                } else {
                    setSelectedNodeId(null);
                    setDetailEmptyState(true);
                }

                updateSidebarStatus();
                if (typeof rerenderCanvas === 'function') rerenderCanvas();
                showToast(i18n('memory_deleted') || '순간을 삭제했어요', 'success');
            } else {
                throw new Error('deleteMemory not available');
            }
        } catch (error) {
            console.error('[editor] Failed to delete memory:', error);
            showToast(i18n('delete_failed') || '순간 삭제에 실패했어요', 'error');
        }
    };

    return {
        enterEditMode,
        exitEditMode,
        saveMemoryEdit,
        updateSelectedMemoryFields,
        deleteMemory,
        getCurrentEditingMemory,
        setCurrentEditingMemory,
        isEditMode: () => isEditMode
    };
}

window.createEditorMemoryActions = createEditorMemoryActions;
