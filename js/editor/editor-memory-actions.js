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
        isLocalSaveMode,
        canEdit
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

    const extractYouTubeStartAndEnd = (url) => {
        if (!url || typeof url !== 'string') return { start: null, end: null };
        let start = null;
        let end = null;
        try {
            const parsed = new URL(url.trim());
            const startVal = parsed.searchParams.get('t') || parsed.searchParams.get('start');
            const endVal = parsed.searchParams.get('end');

            const media = window.LoveBudMedia || {};
            if (typeof media.parseYouTubeTimeToSeconds === 'function') {
                start = media.parseYouTubeTimeToSeconds(startVal);
                end = media.parseYouTubeTimeToSeconds(endVal);
            }
        } catch (e) {
            const startMatch = url.match(/[#&?](?:t|start)=([^&#]+)/i);
            const endMatch = url.match(/[#&?]end=([^&#]+)/i);
            const media = window.LoveBudMedia || {};
            if (typeof media.parseYouTubeTimeToSeconds === 'function') {
                if (startMatch) start = media.parseYouTubeTimeToSeconds(decodeURIComponent(startMatch[1]));
                if (endMatch) end = media.parseYouTubeTimeToSeconds(decodeURIComponent(endMatch[1]));
            }
        }
        return { start, end };
    };

    const ensureVideoSegmentGrid = () => {
        const editMode = document.getElementById('detailEditMode');
        const sourceUrlGroup = document.getElementById('editSourceUrlGroup');
        if (!editMode || !sourceUrlGroup) return null;

        let grid = document.getElementById('editVideoSegmentGrid');
        if (!grid) {
            grid = document.createElement('div');
            grid.id = 'editVideoSegmentGrid';
            grid.className = 'editor-video-segment-grid';
            grid.innerHTML = `
                <div class="editor-form-field editor-video-segment-field editor-video-segment-field-start" id="editStartTimeField">
                    <label id="editStartTimeLabel" for="editStartTimeInput" class="editor-form-label">${formatI18nText('editor_video_start_label', '시작')}</label>
                    <input type="text" id="editStartTimeInput" placeholder="${formatI18nText('editor_video_start_placeholder', '예: 1:23')}" class="editor-form-input">
                </div>
                <div class="editor-form-field editor-video-segment-field editor-video-segment-field-end" id="editEndTimeField">
                    <label id="editEndTimeLabel" for="editEndTimeInput" class="editor-form-label">${formatI18nText('editor_video_end_label', '끝')}</label>
                    <input type="text" id="editEndTimeInput" placeholder="${formatI18nText('editor_video_end_placeholder', '선택, 예: 1:45')}" class="editor-form-input">
                </div>
                <p id="editStartTimeHint" class="editor-form-help editor-video-segment-help">${formatI18nText('editor_video_segment_help', '순간의 시작과 끝 시간을 입력하세요.')}</p>
            `;
            sourceUrlGroup.parentNode.insertBefore(grid, sourceUrlGroup.nextSibling);
        }
        return grid;
    };

    const updateEditVideoSegmentGridVisibility = () => {
        const sourceUrlInput = document.getElementById('editSourceUrlInput');
        const grid = document.getElementById('editVideoSegmentGrid');
        if (!sourceUrlInput || !grid) return;

        const timeHelper = window.LoveBudEditorMemoryFormTime;
        if (!timeHelper) {
            grid.classList.add('is-hidden');
            return;
        }

        const value = sourceUrlInput.value.trim();
        const media = window.LoveBudMedia || {};
        const isYoutube = typeof media.extractYouTubeId === 'function'
            ? !!media.extractYouTubeId(value)
            : !!(value.match(/(?:v=|\/|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/));

        grid.classList.toggle('is-hidden', !isYoutube);
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
        if (canEdit === false) return;
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
        if (sourceUrlInput) {
            sourceUrlInput.value = getEditableSourceUrl(currentEditingMemory);

            // Handle Video Segment Grid for Start / End time
            const grid = ensureVideoSegmentGrid();
            const startTimeInput = document.getElementById('editStartTimeInput');
            const endTimeInput = document.getElementById('editEndTimeInput');
            const media = window.LoveBudMedia || {};

            if (startTimeInput && endTimeInput && typeof media.formatYouTubeStartTime === 'function') {
                const parsedTimes = extractYouTubeStartAndEnd(getEditableSourceUrl(currentEditingMemory));
                startTimeInput.value = parsedTimes.start ? media.formatYouTubeStartTime(parsedTimes.start) : '';
                endTimeInput.value = parsedTimes.end ? media.formatYouTubeStartTime(parsedTimes.end) : '';
            }

            if (!sourceUrlInput.dataset.listenerBound) {
                sourceUrlInput.addEventListener('input', () => {
                    updateEditVideoSegmentGridVisibility();
                });
                sourceUrlInput.dataset.listenerBound = 'true';
            }

            updateEditVideoSegmentGridVisibility();
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
        if (canEdit === false) return;
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) return;

        const titleInput = document.getElementById('editTitleInput');
        const sourceUrlInput = document.getElementById('editSourceUrlInput');
        const memoInput = document.getElementById('editMemoInput');
        const tagsInput = document.getElementById('editTagsInput');
        const startTimeInput = document.getElementById('editStartTimeInput');
        const endTimeInput = document.getElementById('editEndTimeInput');
        const timeHelper = window.LoveBudEditorMemoryFormTime;

        const startHasValue = startTimeInput && startTimeInput.value.trim();
        const endHasValue = endTimeInput && endTimeInput.value.trim();

        if ((startHasValue || endHasValue) && !timeHelper) {
            showToast(formatI18nText('time_helper_missing', '시간을 처리하는 도구를 불러오지 못했습니다.'), 'error');
            updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
            return;
        }

        let startSeconds = null;
        let endSeconds = null;

        if (startHasValue && timeHelper) {
            startSeconds = timeHelper.parseTime(startTimeInput.value.trim());
            if (startSeconds === null) {
                showToast(formatI18nText('invalid_start_time', '시작 시간을 다시 확인해 주세요.'), 'error');
                updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
                return;
            }
        }

        if (endHasValue && timeHelper) {
            const endCheck = timeHelper.validateEndTime({
                rawEndTime: endTimeInput.value.trim(),
                startSeconds,
                invalidMessage: formatI18nText('invalid_end_time', '끝 시간을 다시 확인해 주세요.'),
                rangeMessage: formatI18nText('invalid_time_range', '끝 시간은 시작 시간보다 뒤여야 해요.')
            });
            if (!endCheck.ok) {
                showToast(endCheck.message, 'error');
                updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
                return;
            }
            endSeconds = endCheck.endSeconds;
        }

        const payload = {
            title: titleInput ? titleInput.value.trim() : currentEditingMemory.title,
            memo: memoInput ? memoInput.value.trim() : currentEditingMemory.memo,
            emotionTags: tagsInput ? tagsInput.value.split(',').map((t) => t.trim()).filter((t) => t) : currentEditingMemory.emotionTags
        };

        if (sourceUrlInput) {
            const rawSourceUrl = sourceUrlInput.value.trim();
            const previousSourceUrl = getEditableSourceUrl(currentEditingMemory);
            const parsedPrev = extractYouTubeStartAndEnd(previousSourceUrl);
            const prevStart = parsedPrev.start;
            const prevEnd = parsedPrev.end;

            const urlChanged = rawSourceUrl !== previousSourceUrl;
            const startChanged = startSeconds !== prevStart;
            const endChanged = endSeconds !== prevEnd;

            if (urlChanged || startChanged || endChanged) {
                const media = window.LoveBudMedia || {};
                const isYoutube = typeof media.extractYouTubeId === 'function'
                    ? !!media.extractYouTubeId(rawSourceUrl)
                    : !!(rawSourceUrl.match(/(?:v=|\/|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/));

                if (rawSourceUrl) {
                    if (isYoutube) {
                        const sourceUpdate = resolveSourceUpdate(rawSourceUrl);
                        if (!sourceUpdate) {
                            showToast(formatI18nText('invalid_youtube_unsupported', 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.'), 'error');
                            updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
                            return;
                        }

                        let embedUrl = typeof media.getEmbedUrl === 'function'
                            ? media.getEmbedUrl(rawSourceUrl, 'youtube', { startSeconds })
                            : sourceUpdate.sourceUrl;

                        if (embedUrl && endSeconds !== null) {
                            try {
                                const parsedEmbed = new URL(embedUrl);
                                parsedEmbed.searchParams.set('end', String(endSeconds));
                                embedUrl = parsedEmbed.toString();
                            } catch (e) {
                                console.error('Failed to parse embedUrl for setting end parameter', e);
                            }
                        }

                        sourceUpdate.sourceUrl = embedUrl;
                        Object.assign(payload, sourceUpdate);
                    } else {
                        showToast(formatI18nText('invalid_youtube_unsupported', 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.'), 'error');
                        updateSaveStatus('failed', formatI18nText('save_failed', '저장 실패'));
                        return;
                    }
                } else {
                    if (previousSourceUrl) {
                        Object.assign(payload, {
                            sourceUrl: '',
                            sourceType: 'other',
                            thumbnail: '',
                            source: ''
                        });
                    }
                }
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
        if (canEdit === false) return false;
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
        if (canEdit === false) return;
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
