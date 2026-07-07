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
        canEdit,
        reportSaveOutcome
    } = deps;

    let isEditMode = false;
    let isInlineMemorySaveInFlight = false;
    let isMemoryEditSaveInFlight = false;

    // ── Edit-form CTA busy state helpers ─────────────────────────────────
    // Uses textContent only. Never touches innerHTML/outerHTML/insertAdjacentHTML.
    const _saveEditBtnOriginalLabel = { value: null };

    const setEditFormBusy = (busy) => {
        const saveBtn = document.getElementById('saveEditBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');
        const deleteBtn = document.getElementById('deleteMemoryBtn');
        const editMode = document.getElementById('detailEditMode');

        if (busy) {
            if (saveBtn) {
                if (_saveEditBtnOriginalLabel.value === null) {
                    _saveEditBtnOriginalLabel.value = saveBtn.textContent;
                }
                saveBtn.disabled = true;
                saveBtn.textContent = formatI18nText('save_saving', '저장 중...');
            }
            if (cancelBtn) cancelBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
            if (editMode) editMode.setAttribute('aria-busy', 'true');
        } else {
            if (saveBtn) {
                saveBtn.disabled = false;
                if (_saveEditBtnOriginalLabel.value !== null) {
                    saveBtn.textContent = _saveEditBtnOriginalLabel.value;
                    _saveEditBtnOriginalLabel.value = null;
                }
            }
            if (cancelBtn) cancelBtn.disabled = false;
            if (deleteBtn) deleteBtn.disabled = false;
            if (editMode) editMode.removeAttribute('aria-busy');
        }
    };

    const formatI18nText = (key, fallback) => {
        const text = typeof i18n === 'function' ? i18n(key) : '';
        return text && text !== key ? text : fallback;
    };

    const emitSaveOutcome = (outcome, options = {}) => {
        const result = {
            outcome,
            message: options.message || '',
            saveStatus: options.saveStatus || null
        };
        if (typeof reportSaveOutcome === 'function') {
            try {
                reportSaveOutcome(result);
            } catch (error) {
                console.error('[editor] Failed to report save outcome:', error);
            }
        }
        return result;
    };

    const reportNonNetworkSaveOutcome = (outcome, saveStatus, message) => {
        updateSaveStatus(saveStatus, message);
        showToast(message, 'info');
        return emitSaveOutcome(outcome, { message, saveStatus });
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
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) return;
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
        if (canEdit === false) {
            const blockedMessage = formatI18nText('save_blocked_mode', '편집 모드에서만 저장할 수 있어요');
            return reportNonNetworkSaveOutcome('blocked_mode', 'manual_blocked', blockedMessage);
        }
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) {
            const blockedMessage = formatI18nText('save_blocked_mode', '편집 모드에서만 저장할 수 있어요');
            return reportNonNetworkSaveOutcome('blocked_mode', 'manual_blocked', blockedMessage);
        }
        const currentEditingMemory = getCurrentEditingMemory();
        if (!currentEditingMemory) {
            const missingMessage = formatI18nText('save_blocked_missing_memory', '저장할 현재 순간을 찾지 못했어요');
            return reportNonNetworkSaveOutcome('blocked_missing_memory', 'manual_blocked', missingMessage);
        }

        // ── Duplicate-submit guard: block re-entry immediately ───────────
        if (isMemoryEditSaveInFlight) {
            const inFlightMessage = formatI18nText('save_blocked_in_flight', '이미 저장 중이에요. 잠시만 기다려 주세요.');
            return reportNonNetworkSaveOutcome('blocked_in_flight', 'manual_blocked', inFlightMessage);
        }
        isMemoryEditSaveInFlight = true;
        setEditFormBusy(true);

        try {
            if (!currentEditingMemory.id) {
                updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                showToast(formatI18nText('save_failed', '저장 실패'), 'error');
                return emitSaveOutcome('failed', {
                    message: formatI18nText('save_failed', '저장 실패'),
                    saveStatus: 'manual_failed'
                });
            }

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
                updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                return emitSaveOutcome('failed', {
                    message: formatI18nText('save_failed', '저장 실패'),
                    saveStatus: 'manual_failed'
                });
            }

            let startSeconds = null;
            let endSeconds = null;

            if (startHasValue && timeHelper) {
                startSeconds = timeHelper.parseTime(startTimeInput.value.trim());
                if (startSeconds === null) {
                    showToast(formatI18nText('invalid_start_time', '시작 시간을 다시 확인해 주세요.'), 'error');
                    updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                    return emitSaveOutcome('failed', {
                        message: formatI18nText('save_failed', '저장 실패'),
                        saveStatus: 'manual_failed'
                    });
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
                    updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                    return emitSaveOutcome('failed', {
                        message: formatI18nText('save_failed', '저장 실패'),
                        saveStatus: 'manual_failed'
                    });
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
                                updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                                return emitSaveOutcome('failed', {
                                    message: formatI18nText('save_failed', '저장 실패'),
                                    saveStatus: 'manual_failed'
                                });
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
                            updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
                            return emitSaveOutcome('failed', {
                                message: formatI18nText('save_failed', '저장 실패'),
                                saveStatus: 'manual_failed'
                            });
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

            // ── No-change guard: skip API write if nothing changed ───────
            const prevTitle = String(currentEditingMemory.title || '').trim();
            const prevMemo = String(currentEditingMemory.memo || '').trim();
            const prevTags = (currentEditingMemory.emotionTags || []).slice().sort().join(',');
            const prevSourceUrl = getEditableSourceUrl(currentEditingMemory);

            const media = window.LoveBudMedia || {};
            const extractVid = (url) => {
                if (!url || typeof url !== 'string') return null;
                return typeof media.extractYouTubeId === 'function'
                    ? media.extractYouTubeId(url)
                    : ((url.match(/(?:v=|\/|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/) || [])[1] || null);
            };

            const prevVideoId = extractVid(prevSourceUrl);
            const prevSegment = extractYouTubeStartAndEnd(prevSourceUrl);
            const prevStart = (prevSegment.start === null || prevSegment.start === undefined) ? null : Number(prevSegment.start);
            const prevEnd = (prevSegment.end === null || prevSegment.end === undefined) ? null : Number(prevSegment.end);

            const newTitle = titleInput ? titleInput.value.trim() : prevTitle;
            const newMemo = memoInput ? memoInput.value.trim() : prevMemo;
            const newTags = tagsInput ? tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean).slice().sort().join(',') : prevTags;
            const newRawUrl = sourceUrlInput ? sourceUrlInput.value.trim() : prevSourceUrl;
            const newVideoId = extractVid(newRawUrl);
            const newStart = (startSeconds === null || startSeconds === undefined) ? null : Number(startSeconds);
            const newEnd = (endSeconds === null || endSeconds === undefined) ? null : Number(endSeconds);

            let sourceChanged = false;
            if (prevVideoId && newVideoId) {
                // Both are YouTube videos: compare video IDs and normalized segments
                sourceChanged = (prevVideoId !== newVideoId || prevStart !== newStart || prevEnd !== newEnd);
            } else if (!prevVideoId && !newVideoId) {
                // Neither are YouTube videos: compare normalized raw URLs directly
                sourceChanged = (prevSourceUrl !== newRawUrl);
            } else {
                // One is YouTube and the other is not: definitely changed
                sourceChanged = true;
            }

            const hasChange = (
                newTitle !== prevTitle ||
                newMemo !== prevMemo ||
                newTags !== prevTags ||
                sourceChanged
            );

            if (!hasChange) {
                const noChangeMessage = formatI18nText('save_no_change', '변경된 내용이 없어요');
                return reportNonNetworkSaveOutcome('no_change', 'manual_nochange', noChangeMessage);
            }

            const savingMessage = formatI18nText('save_saving', '저장 중...');
            updateSaveStatus('manual_saving', savingMessage);
            emitSaveOutcome('saving', {
                message: savingMessage,
                saveStatus: 'manual_saving'
            });

            if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                const savedMemory = await window.apiClient.updateMemory(currentEditingMemory.id, payload);
                const savedPatch = savedMemory && typeof savedMemory === 'object' ? savedMemory : {};

                // Validate response: must be a memory record with matching ID
                const responseId = savedPatch.id || savedPatch.memoryId || null;
                if (!responseId || String(responseId) !== String(currentEditingMemory.id)) {
                    throw new Error('Invalid server response: missing or mismatched memory ID');
                }

                // Validate changed fields are acknowledged in the response
                const payloadVideoId = (function extractId(url) {
                    if (!url || typeof url !== 'string') return null;
                    const m = url.match(/(?:v=|[\/]|youtu[.]be[\/]|embed[\/]|shorts[\/])([0-9A-Za-z_-]{11})/);
                    return m ? m[1] : null;
                })(payload.sourceUrl);
                const responseVideoId = (function extractId(url) {
                    if (!url || typeof url !== 'string') return null;
                    const m = url.match(/(?:v=|[\/]|youtu[.]be[\/]|embed[\/]|shorts[\/])([0-9A-Za-z_-]{11})/);
                    return m ? m[1] : null;
                })(savedPatch.sourceUrl);

                // If the user changed the source URL, verify the response acknowledges it
                if (payloadVideoId && payload.sourceUrl !== getEditableSourceUrl(currentEditingMemory)) {
                    if (!responseVideoId) {
                        throw new Error('Server response is missing video reference');
                    }
                    if (responseVideoId !== payloadVideoId) {
                        throw new Error('Server response contains stale video reference');
                    }
                }

                // If the user changed title, verify the response acknowledges it
                if (payload.title !== undefined && currentEditingMemory.title !== undefined &&
                    payload.title !== currentEditingMemory.title &&
                    String(savedPatch.title || '').trim() !== String(payload.title).trim()) {
                    throw new Error('Server response does not reflect updated title');
                }

                // If the user changed memo, verify the response acknowledges it
                if (payload.memo !== undefined && currentEditingMemory.memo !== undefined &&
                    payload.memo !== currentEditingMemory.memo &&
                    String(savedPatch.memo || '').trim() !== String(payload.memo).trim()) {
                    throw new Error('Server response does not reflect updated memo');
                }

                // If the user changed tags, verify the response acknowledges it
                if (payload.emotionTags !== undefined && currentEditingMemory.emotionTags !== undefined &&
                    JSON.stringify(payload.emotionTags) !== JSON.stringify(currentEditingMemory.emotionTags) &&
                    JSON.stringify((savedPatch.emotionTags || []).sort()) !== JSON.stringify((payload.emotionTags || []).sort())) {
                    throw new Error('Server response does not reflect updated emotion tags');
                }

                // Priority: server response > payload > current memory
                const prioritizedPatch = {
                    ...currentEditingMemory,
                    ...payload,
                    ...savedPatch
                };

                if (savedPatch.sourceUrl !== undefined) prioritizedPatch.sourceUrl = savedPatch.sourceUrl;
                if (savedPatch.thumbnail !== undefined) prioritizedPatch.thumbnail = savedPatch.thumbnail;
                if (savedPatch.sourceType !== undefined) prioritizedPatch.sourceType = savedPatch.sourceType;

                const nextEditingMemory = prioritizedPatch;

                const nextMemories = getTreeMemories().slice();
                const memIndex = nextMemories.findIndex((m) => m.id === currentEditingMemory.id);
                if (memIndex >= 0) {
                    nextMemories[memIndex] = { ...nextMemories[memIndex], ...nextEditingMemory };
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
                    window.LoveBudCache.set('memories_' + treeId, nextMemories, 2 * 60 * 1000);
                }

                // ── Confirmed success: update state and close edit mode ──
                setCurrentEditingMemory(nextEditingMemory);
                exitEditMode();
                updateDetailPanel(nextEditingMemory);
                updateSidebarStatus();
                if (typeof rerenderCanvas === 'function') rerenderCanvas();

                updateSaveStatus('manual_saved', i18n('save_saved'));
                showToast(i18n('memory_updated') || '순간을 수정했어요', 'success');
                return emitSaveOutcome('saved', {
                    message: formatI18nText('save_saved', '저장됨'),
                    saveStatus: 'manual_saved'
                });
            } else {
                throw new Error('updateMemory not available');
            }
        } catch (error) {
            // Do not expose raw provider/API error text to user
            console.error('[editor] Failed to update memory:', error);
            updateSaveStatus('manual_failed', formatI18nText('save_failed', '저장 실패'));
            showToast(formatI18nText('update_failed', '순간 수정에 실패했어요'), 'error');
            return emitSaveOutcome('failed', {
                message: formatI18nText('save_failed', '저장 실패'),
                saveStatus: 'manual_failed'
            });
        } finally {
            isMemoryEditSaveInFlight = false;
            setEditFormBusy(false);
        }
    };

    const updateSelectedMemoryFields = async (updates) => {
        if (canEdit === false) return false;
        const currentEditingMemory = getCurrentEditingMemory();
        const selectedNodeId = getSelectedNodeId() || currentEditingMemory?.id;
        if (!selectedNodeId) {
            updateSaveStatus('auto_failed', i18n('save_failed'));
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
            updateSaveStatus('auto_failed', i18n('save_failed'));
            return false;
        }

        const localSaveMode = typeof isLocalSaveMode === 'function' ? isLocalSaveMode() : false;
        let savedMemory = null;

        updateSaveStatus('auto_saving', i18n('save_saving'));
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
            updateSaveStatus('auto_failed', i18n('save_failed'));
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
        updateSaveStatus('auto_saved', i18n('save_saved'));
        return true;
    };

    const deleteMemory = async () => {
        if (canEdit === false) return;
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) return;
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
                window.LoveBudCache.set('memories_' + treeId, nextMemories, 2 * 60 * 1000);
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

    // ---- Confirmed-response guard for disconnect ----
    const disconnectMemory = async (childId) => {
        if (canEdit === false) return false;
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) return false;
        if (!childId) return false;

        var memories = getTreeMemories().slice();
        var idx = memories.findIndex(function(m) { return String(m.id) === String(childId); });
        if (idx === -1) return false;

        var mem = memories[idx];
        var canonicalRootId = typeof getCanonicalRootId === 'function'
            ? getCanonicalRootId()
            : 'root';

        if (
            (typeof isRootMemory === 'function' && isRootMemory(mem, canonicalRootId)) ||
            String(mem.id) === String(canonicalRootId) ||
            mem.id === 'root' ||
            mem.parentId === 'root' ||
            mem.parentId === '' ||
            String(mem.parentId) === String(mem.id) ||
            mem.parentId === null ||
            mem.parentId === undefined
        ) {
            return false;
        }

        updateSaveStatus('checkpoint_saving', formatI18nText('save_saving', '저장 중...'));

        try {
            var apiResult = null;
            if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                apiResult = await window.apiClient.updateMemory(childId, { parentId: null });
            } else {
                throw new Error('updateMemory not available');
            }

            // CONFIRMED RESPONSE GUARD: only proceed if server confirms parentId === null
            if (!apiResult || typeof apiResult !== 'object' ||
                !Object.prototype.hasOwnProperty.call(apiResult, 'parentId') ||
                apiResult.parentId !== null) {
                // Failure: response missing parentId or parentId is not null
                updateSaveStatus('checkpoint_failed', formatI18nText('save_failed', '저장 실패'));
                showToast(formatI18nText('disconnect_failed', '연결 해제에 실패했어요'), 'error');
                return false;
            }

            // Success: build nextMemory from CONFIRMED server response
            var nextMemory = Object.assign({}, mem, apiResult);
            memories[idx] = nextMemory;
            setTreeMemories(memories);

            var treeData = getCurrentTreeData();
            if (treeData && Array.isArray(treeData.memories)) {
                var dataIdx = treeData.memories.findIndex(function(m) { return String(m.id) === String(childId); });
                if (dataIdx !== -1) {
                    treeData.memories[dataIdx] = nextMemory;
                }
            }

            if (window.LoveBudCache) {
                var cacheKey = 'memories_' + (treeData && treeData.id ? treeData.id : 'default');
                window.LoveBudCache.set(cacheKey, memories, 2 * 60 * 1000);
            }

            if (typeof rerenderCanvas === 'function') rerenderCanvas();
            if (typeof updateSidebarStatus === 'function') updateSidebarStatus();
            if (typeof updateDetailPanel === 'function') updateDetailPanel(nextMemory);
            updateSaveStatus('checkpoint_saved', formatI18nText('save_saved', '저장 완료'));
            showToast(formatI18nText('disconnect_success', '연결을 해제했어요'), 'success');
            return true;
        } catch (error) {
            console.error('[editor] Failed to disconnect memory:', error);
            updateSaveStatus('checkpoint_failed', formatI18nText('save_failed', '저장 실패'));
            showToast(formatI18nText('disconnect_failed', '연결 해제에 실패했어요'), 'error');
            return false;
        }
    };

    function isDescendant(memories, sourceId, targetId) {
        var visited = {};
        var currentId = targetId;
        while (currentId) {
            if (String(currentId) === String(sourceId)) return true;
            if (visited[String(currentId)]) return false;
            visited[String(currentId)] = true;
            var mem = memories.find(function (m) { return String(m.id) === String(currentId); });
            if (!mem || !mem.parentId) break;
            currentId = mem.parentId;
        }
        return false;
    }

    // ---- Confirmed-response guard for connect ----
    const connectMemory = async (sourceId, targetId) => {
        if (canEdit === false) return false;
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) return false;
        if (!sourceId || !targetId) return false;

        var validation = validateConnectCandidate(sourceId, targetId);
        if (!validation.ok) {
            var msgs = {
                source_is_root: formatI18nText('connect_root_blocked', '루트 순간은 연결할 수 없어요'),
                target_is_root: formatI18nText('connect_root_blocked', '루트 순간은 연결할 수 없어요'),
                self_connection: formatI18nText('connect_self_blocked', '같은 순간으로 연결할 수 없어요'),
                already_connected: formatI18nText('connect_already_connected', '이미 연결된 순간입니다'),
                target_is_descendant: formatI18nText('connect_cycle_blocked', '하위 순간을 부모로 연결할 수 없어요'),
                target_chain_missing_parent: formatI18nText('connect_chain_broken', '연결 구조를 확인할 수 없습니다'),
                target_chain_loop: formatI18nText('connect_chain_broken', '연결 구조를 확인할 수 없습니다')
            };
            if (msgs[validation.reason]) {
                showToast(msgs[validation.reason], 'error');
            }
            return false;
        }

        var memories = getTreeMemories().slice();
        var srcIdx = memories.findIndex(function (m) { return String(m.id) === String(sourceId); });
        if (srcIdx === -1) return false;

        var sourceMem = memories[srcIdx];
        updateSaveStatus('checkpoint_saving', formatI18nText('save_saving', '저장 중...'));

        try {
            var apiResult = null;
            if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                apiResult = await window.apiClient.updateMemory(sourceId, { parentId: targetId });
            } else {
                throw new Error('updateMemory not available');
            }

            // CONFIRMED RESPONSE GUARD: only proceed if server confirms parentId === targetId
            if (!apiResult || typeof apiResult !== 'object' ||
                !Object.prototype.hasOwnProperty.call(apiResult, 'parentId') ||
                String(apiResult.parentId) !== String(targetId)) {
                // Failure: response missing parentId or parentId doesn't match target
                updateSaveStatus('checkpoint_failed', formatI18nText('save_failed', '저장 실패'));
                showToast(formatI18nText('connect_failed', '연결에 실패했어요'), 'error');
                return false;
            }

            // Success: build nextMemory from CONFIRMED server response
            var nextMemory = Object.assign({}, sourceMem, apiResult);
            memories[srcIdx] = nextMemory;
            setTreeMemories(memories);

            var treeData = getCurrentTreeData();
            if (treeData && Array.isArray(treeData.memories)) {
                var dataIdx = treeData.memories.findIndex(function (m) { return String(m.id) === String(sourceId); });
                if (dataIdx !== -1) {
                    treeData.memories[dataIdx] = nextMemory;
                }
            }

            if (window.LoveBudCache) {
                var cacheKey = 'memories_' + (treeData && treeData.id ? treeData.id : 'default');
                window.LoveBudCache.set(cacheKey, memories, 2 * 60 * 1000);
            }

            if (typeof rerenderCanvas === 'function') rerenderCanvas();
            if (typeof updateSidebarStatus === 'function') updateSidebarStatus();
            if (typeof updateDetailPanel === 'function') updateDetailPanel(nextMemory);
            updateSaveStatus('checkpoint_saved', formatI18nText('save_saved', '저장 완료'));
            showToast(formatI18nText('connect_success', '순간을 연결했어요'), 'success');
            return true;
        } catch (error) {
            console.error('[editor] Failed to connect memory:', error);
            updateSaveStatus('checkpoint_failed', formatI18nText('save_failed', '저장 실패'));
            showToast(formatI18nText('connect_failed', '연결에 실패했어요'), 'error');
            return false;
        }
    };

    function validateConnectCandidate(sourceId, targetId) {
        if (canEdit === false) return { ok: false, reason: 'canEdit_false' };
        var mode = window.LoveBudEditorInteractionMode;
        if (mode && !mode.isEditMode()) return { ok: false, reason: 'not_edit_mode' };
        if (!sourceId || !targetId) return { ok: false, reason: 'missing_ids' };
        if (String(sourceId) === String(targetId)) return { ok: false, reason: 'self_connection' };

        var memories = getTreeMemories().slice();
        var srcIdx = memories.findIndex(function (m) { return String(m.id) === String(sourceId); });
        var tgtIdx = memories.findIndex(function (m) { return String(m.id) === String(targetId); });
        if (srcIdx === -1) return { ok: false, reason: 'source_not_found' };
        if (tgtIdx === -1) return { ok: false, reason: 'target_not_found' };

        var sourceMem = memories[srcIdx];
        var targetMem = memories[tgtIdx];
        var canonicalRootId = typeof getCanonicalRootId === 'function' ? getCanonicalRootId() : 'root';

        if (
            (typeof isRootMemory === 'function' && isRootMemory(sourceMem, canonicalRootId)) ||
            String(sourceMem.id) === String(canonicalRootId)
        ) {
            return { ok: false, reason: 'source_is_root' };
        }
        if (
            (typeof isRootMemory === 'function' && isRootMemory(targetMem, canonicalRootId)) ||
            String(targetMem.id) === String(canonicalRootId)
        ) {
            return { ok: false, reason: 'target_is_root' };
        }

        if (String(sourceMem.parentId) === String(targetId)) {
            return { ok: false, reason: 'already_connected' };
        }

        if (isDescendant(memories, sourceId, targetId)) {
            return { ok: false, reason: 'target_is_descendant' };
        }

        var chainVisited = {};
        var chainId = targetId;
        while (chainId) {
            if (chainVisited[String(chainId)]) {
                return { ok: false, reason: 'target_chain_loop' };
            }
            chainVisited[String(chainId)] = true;
            var mem = memories.find(function (m) { return String(m.id) === String(chainId); });
            if (!mem) {
                return { ok: false, reason: 'target_chain_missing_parent' };
            }
            if (!mem.parentId) break;
            chainId = mem.parentId;
        }

        return { ok: true };
    }

    return {
        enterEditMode,
        exitEditMode,
        saveMemoryEdit,
        updateSelectedMemoryFields,
        deleteMemory,
        disconnectMemory,
        connectMemory,
        validateConnectCandidate,
        getCurrentEditingMemory,
        setCurrentEditingMemory,
        isEditMode: () => isEditMode
    };
}

window.createEditorMemoryActions = createEditorMemoryActions;
