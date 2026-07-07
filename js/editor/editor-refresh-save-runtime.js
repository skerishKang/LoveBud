(function() {
    'use strict';

    function stop(reportError, message) {
        if (typeof reportError === 'function') {
            reportError(message);
        }
        return { status: 'stopped' };
    }

    function createEditorRefreshSaveRuntime(options) {
        const opts = options || {};
        const {
            log,
            reportError,
            editorDataLoader,
            treeId,
            apiClient,
            normalizeMemory,
            treeMemories,
            getCurrentEditingMemory,
            setCurrentEditingMemory,
            isRootMemory,
            canonicalRootId,
            isDetailEditActive,
            updateDetailPanel,
            updateSidebarStatus,
            initCanvas,
            exposeRefreshMemoriesBridge,
            resolveSaveStatusTimeFormatter,
            editorSaveStatus,
            i18n,
            createSaveStatusOrchestrationFallback,
            saveStatusOrchestrationHelper
        } = opts;

        if (!editorDataLoader || typeof editorDataLoader.createRefreshMemories !== 'function') {
            return stop(reportError, 'LoveBudEditorDataLoader.createRefreshMemories missing');
        }
        if (typeof exposeRefreshMemoriesBridge !== 'function') {
            return stop(reportError, 'LoveBudEditorShellHelpers.exposeRefreshMemoriesBridge missing');
        }
        if (typeof resolveSaveStatusTimeFormatter !== 'function') {
            return stop(reportError, 'LoveBudEditorShellHelpers.resolveSaveStatusTimeFormatter missing');
        }
        if (!editorSaveStatus || typeof editorSaveStatus.formatTimeAgo !== 'function') {
            return stop(reportError, 'LoveBudEditorSaveStatus.formatTimeAgo missing');
        }

        const handleMemoriesUpdated = () => {
            log('Memories updated externally. Rerendering...');
            initCanvas();
            updateSidebarStatus();

            const currentEditingMemory = getCurrentEditingMemory();
            if (currentEditingMemory) {
                const refreshedEditingMemory = treeMemories().find((memory) => memory.id === currentEditingMemory.id);
                if (refreshedEditingMemory && !isRootMemory(refreshedEditingMemory, canonicalRootId)) {
                    const detailEditActive =
                        typeof isDetailEditActive === 'function' && isDetailEditActive();
                    setCurrentEditingMemory(refreshedEditingMemory);
                    if (!detailEditActive) {
                        updateDetailPanel(refreshedEditingMemory);
                    }
                }
            }
        };

        const refreshMemories = editorDataLoader.createRefreshMemories({
            treeId,
            apiClient,
            normalizeMemory,
            onMemoriesUpdated: handleMemoriesUpdated
        });

        exposeRefreshMemoriesBridge({ refreshMemories });

        const formatTimeAgo = resolveSaveStatusTimeFormatter({
            editorSaveStatus
        });

        let createEditorSaveStatusOrchestration = (saveStatusOrchestrationHelper || {}).createEditorSaveStatusOrchestration;

        if (typeof createEditorSaveStatusOrchestration !== 'function') {
            if (typeof createSaveStatusOrchestrationFallback !== 'function') {
                return stop(reportError, 'LoveBudEditorShellHelpers.createSaveStatusOrchestrationFallback missing');
            }

            createEditorSaveStatusOrchestration = createSaveStatusOrchestrationFallback();
        }

        const { saveStatusData, updateSaveStatus } = createEditorSaveStatusOrchestration({
            editorSaveStatus,
            i18n,
            formatTimeAgo
        });

        return {
            status: 'ready',
            refreshMemories,
            saveStatusData,
            updateSaveStatus
        };
    }

    if (typeof window !== 'undefined') {
        window.LoveBudEditorRefreshSaveRuntime = Object.freeze({
            createEditorRefreshSaveRuntime
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createEditorRefreshSaveRuntime
        };
    }
})();
