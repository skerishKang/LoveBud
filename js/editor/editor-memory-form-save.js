
function createEditorMemoryFormSave(deps) {
    const {
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
    } = deps;

    async function createMemoryWithFallback(newMemoryData) {
        let createdMemory = null;
        let useApi = false;
        try {
            if (window.apiClient && typeof window.apiClient.createMemory === 'function') {
                createdMemory = await window.apiClient.createMemory(newMemoryData);
                useApi = true;
                setLocalSaveMode(false);
                editorDebugLog('[editor] API createMemory success');
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
            editorDebugLog('[editor] Using local fallback memory');
            setLocalSaveMode(true);
            createdMemory = {
                id: nextMemoryId(),
                ...newMemoryData,
                createdAt: newMemoryData.timestamp,
                delay: '0.5s'
            };
        }
        return { createdMemory, useApi };
    }

    function commitMemoryToTree(createdMemory, useApi) {
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

        var el = null;
        if (window.LoveBudEditorCanvasSelection
            && typeof window.LoveBudEditorCanvasSelection.findMemoryNodeById === 'function') {
            el = window.LoveBudEditorCanvasSelection.findMemoryNodeById(normalizedMemory.id);
        }
        if (el) {
            selectNode(el, normalizedMemory);
            el.classList.add('new-node-highlight');
            setTimeout(() => el.classList.remove('new-node-highlight'), 2000);
        }
        
        const freshCanonicalRootId = window.LoveBudEditorUtils?.getCanonicalRootId
            ? window.LoveBudEditorUtils.getCanonicalRootId(getTreeMemories())
            : getCanonicalRootId();
        const shouldFocusNewMemory = !freshCanonicalRootId || normalizedMemory.id !== freshCanonicalRootId;
        if (shouldFocusNewMemory && typeof focusNodeById === 'function') focusNodeById(normalizedMemory.id);

        updateSaveStatus('saved', useApi ? i18n('save_saved') : (i18n('save_saved_local') || '로컬 저장됨'));

        if (typeof setCachedMemories === 'function' && treeId) {
            setCachedMemories(treeId, getTreeMemories());
            editorDebugLog('[editor] Memory cache refreshed:', getTreeMemories().length);
        }

        updateSidebarStatus();
        updateFocusSelectedBtn();
        setDetailEmptyState(false);
    }

    function shouldEnrichChannelMetadata(payload, rawUrl) {
        if (!payload || payload.sourceType !== 'youtube') return false;
        if (!rawUrl) return false;
        if (payload.channelName && payload.channelUrl) return false;
        return !!(window.apiClient && typeof window.apiClient.getYouTubeOEmbedChannel === 'function');
    }

    async function enrichPayloadChannelMetadata(payload, rawUrl) {
        if (!shouldEnrichChannelMetadata(payload, rawUrl)) return payload;
        try {
            const channel = await window.apiClient.getYouTubeOEmbedChannel(rawUrl);
            if (!channel || !channel.channelName || !channel.channelUrl) return payload;
            return {
                ...payload,
                channelId: payload.channelId || channel.channelId || null,
                channelName: payload.channelName || channel.channelName,
                channelUrl: payload.channelUrl || channel.channelUrl
            };
        } catch (e) {
            editorDebugLog('[editor] YouTube channel enrichment skipped:', e?.message || e);
            return payload;
        }
    }

    return {
        createMemoryWithFallback,
        commitMemoryToTree,
        shouldEnrichChannelMetadata,
        enrichPayloadChannelMetadata
    };
}

window.LoveBudEditorMemoryFormSave = createEditorMemoryFormSave;
