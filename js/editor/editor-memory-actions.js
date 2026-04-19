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
        calcPosition
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

        if (titleInput) titleInput.value = currentEditingMemory.title || '';
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

                updateSaveStatus('saved', i18n('save_saved'));

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

                const nodeEl = document.querySelector(`.memory-node[data-memory-id="${nextEditingMemory.id}"]`);
                if (nodeEl) {
                    const titleEl = nodeEl.querySelector('.node-title');
                    if (titleEl) titleEl.textContent = payload.title;
                }

                showToast(i18n('memory_updated'), 'success');
            } else {
                throw new Error('updateMemory not available');
            }
        } catch (error) {
            console.error('[editor] Failed to update memory:', error);
            updateSaveStatus('failed', i18n('save_failed'));
            showToast(i18n('update_failed'), 'error');
        }
    };

    const deleteMemory = async () => {
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;

        if (!confirm(i18n('delete_confirm'))) {
            return;
        }

        try {
            if (window.apiClient && typeof window.apiClient.deleteMemory === 'function') {
                await window.apiClient.deleteMemory(currentEditingMemory.id);

                const nextMemories = getTreeMemories().filter((m) => m.id !== currentEditingMemory.id);
                setTreeMemories(nextMemories);

                const nodeEl = document.querySelector(`.memory-node[data-memory-id="${currentEditingMemory.id}"]`);
                if (nodeEl) {
                    const branches = svg.querySelectorAll('.branch-line');
                    const nodePos = calcPosition(currentEditingMemory);
                    branches.forEach((branch) => {
                        const d = branch.getAttribute('d');
                        if (d && d.includes(`${nodePos.x},${nodePos.y}`)) {
                            branch.remove();
                        }
                    });
                    nodeEl.remove();
                }

                setCurrentEditingMemory(null);
                exitEditMode();

                const rootMem = findRootMemory(nextMemories);
                if (rootMem) {
                    setSelectedNodeId(rootMem.id);
                    updateDetailPanel(rootMem);
                } else if (nextMemories.length > 0) {
                    setSelectedNodeId(nextMemories[0].id);
                    updateDetailPanel(nextMemories[0]);
                } else {
                    setSelectedNodeId(getCanonicalRootId());
                    detailPanel.querySelector('h3').innerHTML = i18n('moment_detail') || '순간 상세';
                    const imgEl = detailPanel.querySelector('.detail-video img');
                    if (imgEl) imgEl.src = '';
                }

                updateSidebarStatus();
                showToast(i18n('memory_deleted'), 'success');
            } else {
                throw new Error('deleteMemory not available');
            }
        } catch (error) {
            console.error('[editor] Failed to delete memory:', error);
            showToast(i18n('delete_failed'), 'error');
        }
    };

    return {
        enterEditMode,
        exitEditMode,
        saveMemoryEdit,
        deleteMemory,
        getCurrentEditingMemory,
        setCurrentEditingMemory,
        isEditMode: () => isEditMode
    };
}

window.createEditorMemoryActions = createEditorMemoryActions;
