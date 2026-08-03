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
        editorDebugLog,
        convergenceObserver
    } = deps;

    let apiCreatePromise = null;

    function getConvergenceCore() {
        if (typeof window.LoveBudWriteReadConvergenceCore !== 'object' || window.LoveBudWriteReadConvergenceCore === null) return null;
        if (typeof window.LoveBudWriteReadConvergenceCore.createConvergenceCore !== 'function') return null;
        return window.LoveBudWriteReadConvergenceCore;
    }

    function getTaxonomy() {
        if (typeof window.LoveBudReliabilitySentinelTaxonomy !== 'object' || window.LoveBudReliabilitySentinelTaxonomy === null) return null;
        return window.LoveBudReliabilitySentinelTaxonomy;
    }

    // #3852 — page-level bounded release authority (pages/editor.html registers
    // window.LoveBudReleaseManifestAuthority). The synchronous getCurrent()/
    // getState() are used by the save runtime; the async whenReady() seam is
    // used by monitoring so the first save is observed even while the manifest
    // is still PENDING.
    function getReleaseAuthority() {
        try {
            const authority = window.LoveBudReleaseManifestAuthority;
            if (!authority || typeof authority.getCurrent !== 'function') return null;
            if (typeof authority.getState !== 'function') return null;
            if (typeof authority.whenReady !== 'function') return null;
            return authority;
        } catch (e) {
            return null;
        }
    }

    function getReleaseState() {
        try {
            const authority = getReleaseAuthority();
            if (!authority) return 'UNAVAILABLE';
            return authority.getState();
        } catch (e) {
            return 'UNAVAILABLE';
        }
    }

    // READY -> 40-char lowercase hex; PENDING/UNAVAILABLE -> null. Never blocks.
    function getCurrentReleaseSha() {
        try {
            if (getReleaseState() !== 'READY') return null;
            const authority = getReleaseAuthority();
            if (!authority) return null;
            const state = authority.getCurrent();
            if (!state || state.ok !== true || typeof state.releaseSha !== 'string') return null;
            return /^[0-9a-f]{40}$/.test(state.releaseSha) ? state.releaseSha : null;
        } catch (e) {
            return null;
        }
    }

    // #3852 — the canonical reread authority is resolved inside the save runtime
    // from the existing editor data-loader, so the real caller (editor-memory-form.js)
    // no longer needs to inject releaseSha/canonicalReread.
    function resolveCanonicalReread() {
        try {
            const loader = window.LoveBudEditorDataLoader;
            if (!loader || typeof loader.createCanonicalReread !== 'function') return null;
            return loader.createCanonicalReread({
                treeId: treeId,
                apiClient: window.apiClient,
                normalizeMemory: normalizeMemory
            });
        } catch (e) {
            return null;
        }
    }

    // #3852 — exactly-once API write. The real API promise is created once and
    // shared by the UI path and the convergence monitoring path, so the core
    // observes the actual transport outcome and can never issue a second write.
    function dispatchApiCreateOnce(payload) {
        if (apiCreatePromise) return apiCreatePromise;
        const client = window.apiClient;
        if (!client || typeof client.createMemory !== 'function') {
            apiCreatePromise = Promise.reject(new Error('createMemory API not available'));
            return apiCreatePromise;
        }
        apiCreatePromise = client.createMemory(payload).then(function (createdMemory) {
            return { createdMemory: createdMemory, useApi: true };
        });
        return apiCreatePromise;
    }

    // Fire-and-observe monitoring. Starts synchronously at the creation of the
    // single API write promise so the core records REQUEST_DISPATCHED BEFORE
    // the transport settles — the first save is always observed, even when the
    // release manifest is still PENDING. The UI save result never awaits this
    // task, the canonical reread, the observer, or the final summary.
    function monitorCreateConvergence(apiPromise) {
        try {
            const coreFactory = getConvergenceCore();
            const taxonomy = getTaxonomy();
            if (!coreFactory || !taxonomy) return null;
            const authority = getReleaseAuthority();
            if (!authority) return null;
            const canonicalReread = resolveCanonicalReread();
            if (!canonicalReread || typeof canonicalReread !== 'function') return null;

            // A terminal UNAVAILABLE release state (no manifest, HTTP error, or
            // already-settled failure) safe-skips with zero observer events.
            if (getReleaseState() === 'UNAVAILABLE') return null;

            const releaseSha = getCurrentReleaseSha();
            const convergence = coreFactory.createConvergenceCore({
                createMemory: function () { return apiPromise; },
                canonicalReread: canonicalReread,
                taxonomy: taxonomy,
                releaseSha: releaseSha,
                releaseReadiness: releaseSha
                    ? null
                    : function () { return authority.whenReady(); },
                observer: typeof convergenceObserver === 'function' ? convergenceObserver : null
            });
            // converge() records REQUEST_DISPATCHED synchronously before its first
            // await, so this call precedes any API settlement. The acknowledgement
            // is derived from the shared apiPromise; a plain record payload keeps
            // the dispatch-contract validation intact.
            return convergence.converge({});
        } catch (e) {
            editorDebugLog('[editor] Convergence monitoring unavailable');
            return null;
        }
    }

    async function createMemoryWithFallback(newMemoryData) {
        apiCreatePromise = null;
        const apiPromise = dispatchApiCreateOnce(newMemoryData);
        // Start convergence monitoring at dispatch time — before the UI awaits
        // the shared API promise — so REQUEST_DISPATCHED precedes settlement.
        // The returned task is fire-and-observe and never blocks the save.
        const monitoringTask = monitorCreateConvergence(apiPromise);
        let createdMemory = null;
        let useApi = false;
        try {
            const apiResult = await apiPromise;
            createdMemory = apiResult.createdMemory;
            useApi = apiResult.useApi;
            setLocalSaveMode(false);
            editorDebugLog('[editor] API createMemory success');
        } catch (e) {
            console.warn('[editor] API createMemory failed, using local save');
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
        const result = { createdMemory, useApi };
        if (monitoringTask && typeof monitoringTask.catch === 'function') {
            // Sanitized guard: never a raw error, stack, identity, or payload.
            monitoringTask.catch(() => editorDebugLog('[editor] Convergence monitoring unavailable'));
        }
        return result;
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
