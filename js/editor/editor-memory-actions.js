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

    const enterEditMode = () => {
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;
        isEditMode = true;

        const viewMode = document.getElementById('detailViewMode');
        const editMode = document.getElementById('detailEditMode');

        if (viewMode) viewMode.style.display = 'none';
        if (editMode) editMode.style.display = 'block';

        const titleInput = document.getElementById('editTitleInput');
        const memoInput = document.getElementById('editMemoInput');
        const tagsInput = document.getElementById('editTagsInput');

        if (titleInput) {
            titleInput.value = currentEditingMemory.title || '';
            setTimeout(() => titleInput.focus(), 0);
        }
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
        const memoInput = document.getElementById('editMemoInput');
        const tagsInput = document.getElementById('editTagsInput');

        const payload = {
            title: titleInput ? titleInput.value.trim() : currentEditingMemory.title,
            memo: memoInput ? memoInput.value.trim() : currentEditingMemory.memo,
            emotionTags: tagsInput ? tagsInput.value.split(',').map((t) => t.trim()).filter((t) => t) : currentEditingMemory.emotionTags
        };

        updateSaveStatus('saving', i18n('save_saving'));

        try {
            if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                await window.apiClient.updateMemory(currentEditingMemory.id, payload);

                const nextMemories = getTreeMemories().slice();
                const memIndex = nextMemories.findIndex((m) => m.id === currentEditingMemory.id);
                if (memIndex >= 0) {
                    nextMemories[memIndex] = { ...nextMemories[memIndex], ...payload };
                    setTreeMemories(nextMemories);
                }

                const nextEditingMemory = { ...currentEditingMemory, ...payload };
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
        const selectedNodeId = getSelectedNodeId();
        if (!selectedNodeId) return false;
        const allowedUpdates = {};
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'title')) allowedUpdates.title = updates.title;
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'memo')) allowedUpdates.memo = updates.memo;
        if (Object.keys(allowedUpdates).length === 0) return false;

        const memories = getTreeMemories();
        const idx = memories.findIndex(m => m.id === selectedNodeId);
        if (idx === -1) return false;

        if (window.apiClient && typeof window.apiClient.updateMemory === 'function' && !isLocalSaveMode()) {
            updateSaveStatus('saving', i18n('save_saving'));
            try {
                await window.apiClient.updateMemory(selectedNodeId, allowedUpdates);
            } catch (error) {
                console.error('[editor] Failed to update selected memory:', error);
                updateSaveStatus('failed', i18n('save_failed'));
                return false;
            }
        }

        if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'title')) memories[idx].title = allowedUpdates.title;
        if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'memo')) memories[idx].memo = allowedUpdates.memo;

        const currentTreeData = getCurrentTreeData();
        if (currentTreeData && currentTreeData.memories) {
            const dataIdx = currentTreeData.memories.findIndex(m => m.id === selectedNodeId);
            if (dataIdx !== -1) {
                if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'title')) currentTreeData.memories[dataIdx].title = allowedUpdates.title;
                if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'memo')) currentTreeData.memories[dataIdx].memo = allowedUpdates.memo;
            }
        }

        if (window.LoveBudCache) {
            const treeId = (currentTreeData && currentTreeData.id) ? currentTreeData.id : 'default';
            const cacheKey = 'memories_' + treeId;
            window.LoveBudCache.set(cacheKey, memories, 2 * 60 * 1000);
        }

        const currentEditingMemory = getCurrentEditingMemory();
        if (currentEditingMemory && currentEditingMemory.id === selectedNodeId) {
            const updatedMemory = { ...currentEditingMemory };
            if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'title')) updatedMemory.title = allowedUpdates.title;
            if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'memo')) updatedMemory.memo = allowedUpdates.memo;
            setCurrentEditingMemory(updatedMemory);
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
