(function () {
    'use strict';

    var globalObject = window;

    function getCanvasRuntime() {
        return globalObject.LoveBudEditorCanvas
            || globalObject.EditorCanvas
            || globalObject.createEditorCanvas
            || null;
    }

    function hasCanvasRuntime() {
        return Boolean(getCanvasRuntime());
    }

    function isCanvasRuntimeReady() {
        return typeof globalObject.createEditorCanvas === 'function';
    }

    function isDetailRuntimeReady() {
        return typeof globalObject.createPublicViewerDetailUI === 'function';
    }

    function installPublicMetrics(canvas) {
        var geometry = globalObject.EditorCanvasGeometry;
        if (!geometry || typeof geometry.getMetrics !== 'function') return;
        if (geometry.__publicViewMetricsInstalled) return;
        var originalGetMetrics = geometry.getMetrics;
        geometry.getMetrics = function(targetCanvas) {
            var node = targetCanvas || canvas;
            var rect = node && typeof node.getBoundingClientRect === 'function'
                ? node.getBoundingClientRect()
                : null;
            var width = Math.round((rect && rect.width) || (node && node.clientWidth) || globalObject.innerWidth || 0);
            var height = Math.round((rect && rect.height) || (node && node.clientHeight) || globalObject.innerHeight || 0);
            if (width > 0 && height > 0) {
                return {
                    width: Math.max(width, 320),
                    height: Math.max(height, 420)
                };
            }
            return originalGetMetrics(targetCanvas);
        };
        geometry.__publicViewMetricsInstalled = true;
    }

    function installPublicViewportProfile() {
        var viewport = globalObject.LoveBudEditorCanvasViewport;
        if (!viewport || viewport.__publicViewProfileInstalled) return;
        viewport.minScale = Math.max(Number(viewport.minScale) || 0.2, 0.5);
        viewport.zoomLevels = [0.5, 0.75, 1, 1.25, 1.5];
        viewport.readableCenter = { x: 0.5, y: 0.46 };
        viewport.__publicViewProfileInstalled = true;
    }

    function createReadOnlyActions() {
        return {
            noop: function() {},
            noopAsync: function() { return Promise.resolve(); },
            noopFalseAsync: function() { return Promise.resolve(false); },
            getLocalSaveMode: function() { return false; },
            showToast: function(msg) { console.log('[public-canvas]', msg); }
        };
    }

    function createMemorySelectors(treeMemories) {
        var memories = Array.isArray(treeMemories) ? treeMemories : [];
        var rootUtils = globalObject.LoveBudEditorUtils || {};

        function getCanonicalRootId() {
            if (typeof rootUtils.getCanonicalRootId === 'function') {
                return rootUtils.getCanonicalRootId(memories);
            }
            var roots = memories.filter(function(memory) {
                return memory.parentId === null || memory.parentId === undefined;
            });
            if (roots.length === 0) return 'root';
            return roots.sort(function(a, b) {
                return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;
            })[0].id;
        }

        function isRootMemory(memory, rootId) {
            if (typeof rootUtils.isRootMemory === 'function') {
                return rootUtils.isRootMemory(memory, rootId);
            }
            return !!(memory && rootId && memory.id === rootId);
        }

        function findFirstSelectableMemory(rootId) {
            var nonRoot = memories.filter(function(memory) {
                return !isRootMemory(memory, rootId);
            });
            return nonRoot.length > 0 ? nonRoot[0] : memories[0] || null;
        }

        return {
            getCanonicalRootId: getCanonicalRootId,
            isRootMemory: isRootMemory,
            findFirstSelectableMemory: findFirstSelectableMemory
        };
    }

    function createPublicCanvasConfig(normalized) {
        var payload = normalized || {};
        var treeData = payload.treeData || {};
        var treeMemories = Array.isArray(payload.treeMemories) ? payload.treeMemories : [];

        function resolveTreeTitleText() {
            return treeData.title || '러브트리';
        }

        function resolveHintText() {
            return '';
        }

        function resolveInfoText() {
            return '';
        }

        function resolveMemoryThumbnail(memory) {
            return memory && memory.thumbnail ? memory.thumbnail : '';
        }

        function getTreeMemories() {
            return treeMemories;
        }

        function getCurrentTreeData() {
            return globalObject.currentTreeData || {};
        }

        function createInitialMemory(rootId) {
            return { id: rootId, title: treeData.title || '러브트리', parentId: null };
        }

        return {
            resolveTreeTitleText: resolveTreeTitleText,
            resolveHintText: resolveHintText,
            resolveInfoText: resolveInfoText,
            resolveMemoryThumbnail: resolveMemoryThumbnail,
            getTreeMemories: getTreeMemories,
            getCurrentTreeData: getCurrentTreeData,
            createInitialMemory: createInitialMemory
        };
    }

    function createSelectionState(initialSelectedNodeId) {
        var selectedNodeId = initialSelectedNodeId || null;
        var currentEditingMemory = null;

        function getSelectedNodeId() {
            return selectedNodeId;
        }

        function setSelectedNodeId(nextSelectedNodeId) {
            selectedNodeId = nextSelectedNodeId || null;
            return selectedNodeId;
        }

        function getCurrentEditingMemory() {
            return currentEditingMemory;
        }

        function setCurrentEditingMemory(memory) {
            currentEditingMemory = memory || null;
            return currentEditingMemory;
        }

        function selectMemory(memory) {
            currentEditingMemory = memory || null;
            selectedNodeId = memory && memory.id ? memory.id : selectedNodeId;
            return currentEditingMemory;
        }

        return {
            getSelectedNodeId: getSelectedNodeId,
            setSelectedNodeId: setSelectedNodeId,
            getCurrentEditingMemory: getCurrentEditingMemory,
            setCurrentEditingMemory: setCurrentEditingMemory,
            selectMemory: selectMemory
        };
    }

    function createDetailUIOptions(ctx) {
        var options = ctx || {};
        var cfg = options.publicCanvasConfig || {};
        var roa = options.readOnlyActions || {};
        var sel = options.selectionState || {};

        return {
            detailPanel: options.detailPanel,
            i18n: options.i18n,
            resolveTreeTitleText: cfg.resolveTreeTitleText,
            resolveHintText: cfg.resolveHintText,
            resolveInfoText: cfg.resolveInfoText,
            resolveMemoryThumbnail: cfg.resolveMemoryThumbnail,
            escapeHtml: options.escapeHtml,
            isRootMemory: options.isRootMemory,
            getCanonicalRootId: options.getCanonicalRootId,
            getSelectedNodeId: sel.getSelectedNodeId,
            getTreeMemories: cfg.getTreeMemories,
            getCurrentTreeData: cfg.getCurrentTreeData,
            getLocalSaveMode: roa.getLocalSaveMode,
            showToast: roa.showToast,
            updateTreeVisibility: roa.noopAsync,
            openCurrentMomentDetail: roa.noop,
            focusSelectedMoment: roa.noop,
            updateSelectedMemoryFields: roa.noopFalseAsync
        };
    }

    function createEmptyGuideUpdater(treeMemories) {
        var memories = Array.isArray(treeMemories) ? treeMemories : [];

        return function updateCanvasEmptyGuide() {
            var doc = globalObject.document;
            var guide = doc && typeof doc.getElementById === 'function'
                ? doc.getElementById('canvasEmptyGuide')
                : null;
            if (!guide) return;
            var hasMoments = memories.length > 0;
            guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
        };
    }

    function installToolbarCompactMode() {
        var mql = globalObject.matchMedia
            ? globalObject.matchMedia('(max-width: 480px)')
            : null;

        function updateToolbarCompact(eventOrQuery) {
            var doc = globalObject.document;
            var toolbar = doc && typeof doc.querySelector === 'function'
                ? doc.querySelector('.editor-canvas-toolbar')
                : null;
            if (!toolbar || !eventOrQuery) return;
            toolbar.classList.toggle('is-compact', Boolean(eventOrQuery.matches));
        }

        if (!mql) return;
        updateToolbarCompact(mql);

        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', updateToolbarCompact);
        } else if (typeof mql.addListener === 'function') {
            mql.addListener(updateToolbarCompact);
        }
    }

    function getBoundaryState() {
        return {
            hasCanvasRuntime: hasCanvasRuntime(),
            hasDetailRuntime: isDetailRuntimeReady(),
            hasPublicCanvasBridge: Boolean(globalObject.LoveBudPublicCanvasBridge),
            hasPublicCanvasInit: Boolean(globalObject.LoveBudPublicCanvasInit)
        };
    }

    globalObject.LoveBudPublicViewerCanvasEntry = Object.freeze({
        getCanvasRuntime: getCanvasRuntime,
        hasCanvasRuntime: hasCanvasRuntime,
        isCanvasRuntimeReady: isCanvasRuntimeReady,
        isDetailRuntimeReady: isDetailRuntimeReady,
        installPublicMetrics: installPublicMetrics,
        installPublicViewportProfile: installPublicViewportProfile,
        createReadOnlyActions: createReadOnlyActions,
        createMemorySelectors: createMemorySelectors,
        createPublicCanvasConfig: createPublicCanvasConfig,
        createSelectionState: createSelectionState,
        createDetailUIOptions: createDetailUIOptions,
        createEmptyGuideUpdater: createEmptyGuideUpdater,
        installToolbarCompactMode: installToolbarCompactMode,
        getBoundaryState: getBoundaryState
    });
})();
