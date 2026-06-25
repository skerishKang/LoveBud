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

    function isPublicRuntimeReady() {
        return isCanvasRuntimeReady() && isDetailRuntimeReady();
    }

    function setupPublicRoute(ctx) {
        var options = ctx || {};
        var loc = options.location || globalObject.location || {};
        var doc = options.document || globalObject.document;
        var body = options.body || (doc && doc.body) || null;
        var params = new globalObject.URLSearchParams(loc.search || '');
        var treeId = params.get('treeId');

        if (body && body.classList) {
            body.classList.add('editor-readonly');
            body.classList.remove('editor-preload');
        }

        return {
            treeId: treeId
        };
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

        function resolveExistingMemoryId(candidateId) {
            if (!candidateId) return null;
            return memories.some(function(memory) {
                return memory && memory.id === candidateId;
            }) ? candidateId : null;
        }

        function getCanonicalRootId() {
            var candidate;
            if (typeof rootUtils.getCanonicalRootId === 'function') {
                candidate = rootUtils.getCanonicalRootId(memories);
            } else {
                var roots = memories.filter(function(memory) {
                    return memory.parentId === null || memory.parentId === undefined;
                });
                candidate = roots.length === 0 ? null : roots.sort(function(a, b) {
                    return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;
                })[0].id;
            }
            return resolveExistingMemoryId(candidate);
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

    function createCanvasOptions(ctx) {
        var options = ctx || {};
        var publicCanvasConfig = options.publicCanvasConfig || {};
        var readOnlyActions = options.readOnlyActions || {};

        return {
            canvas: options.canvas,
            svg: options.svg,
            getTreeMemories: publicCanvasConfig.getTreeMemories,
            getCanonicalRootId: options.getCanonicalRootId,
            isRootMemory: options.isRootMemory,
            resolveMemoryThumbnail: publicCanvasConfig.resolveMemoryThumbnail,
            updateDetailPanel: options.updateDetailPanel,
            setDetailEmptyState: options.setDetailEmptyState,
            updateFocusSelectedBtn: options.updateFocusSelectedBtn,
            createInitialMemory: options.createInitialMemory,
            onNodeClick: options.onNodeClick,
            openAddMoment: readOnlyActions.noop,
            canEdit: false
        };
    }

    function createLoadFailureState(message) {
        var doc = globalObject.document;
        if (!doc || typeof doc.createElement !== 'function') return null;

        var errState = doc.createElement('div');
        var icon = doc.createElement('span');
        var title = doc.createElement('h2');
        var description = doc.createElement('p');

        errState.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;';

        icon.className = 'material-symbols-outlined';
        icon.style.cssText = 'font-size:48px;color:var(--error);margin-bottom:16px;';
        icon.textContent = 'error_outline';

        title.style.cssText = 'margin:0 0 8px;';
        title.textContent = '트리를 불러올 수 없어요';

        description.style.cssText = 'margin:0;color:var(--on-surface-variant);';
        description.textContent = message || 'Public endpoint returned an error';

        errState.appendChild(icon);
        errState.appendChild(title);
        errState.appendChild(description);
        return errState;
    }

    function createMissingRouteState() {
        var doc = globalObject.document;
        if (!doc || typeof doc.createElement !== 'function') return null;

        var errEl = doc.createElement('div');
        errEl.style.cssText = 'padding:2rem;text-align:center;font-size:1.2rem;';
        errEl.textContent = 'treeId parameter required. Usage: ?treeId=<id>';
        return errEl;
    }

    function installPublicEditorReadOnlyState(canvas, editorCanvas) {
        if (canvas) canvas.__editorCanvasInstance = editorCanvas;
        globalObject.LoveBudEditor = globalObject.LoveBudEditor || {};
        globalObject.LoveBudEditor.canEdit = false;
        return globalObject.LoveBudEditor;
    }

    function runPublicPostInitRefresh(ctx) {
        var options = ctx || {};
        var selectionState = options.selectionState || {};

        if (typeof options.updateCanvasEmptyGuide === 'function') {
            options.updateCanvasEmptyGuide();
        }

        if (typeof options.updateSidebarStatus === 'function') {
            options.updateSidebarStatus();
        }

        var currentEditingMemory = typeof selectionState.getCurrentEditingMemory === 'function'
            ? selectionState.getCurrentEditingMemory()
            : null;

        if (currentEditingMemory) {
            if (typeof options.updateDetailPanel === 'function') {
                options.updateDetailPanel(currentEditingMemory);
            }
            if (typeof options.setDetailEmptyState === 'function') {
                options.setDetailEmptyState(false);
            }
        }

        return currentEditingMemory || null;
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

    function getPublicCanvasBridge() {
        var bridge = globalObject.LoveBudPublicCanvasBridge;
        if (!bridge || typeof bridge.loadPublicTreeData !== 'function') {
            return null;
        }
        return bridge;
    }

    function normalizePublicCanvasData(bridge, tree, memories) {
        if (!bridge || typeof bridge.normalizeForCanvas !== 'function') {
            return null;
        }
        return bridge.normalizeForCanvas(tree, memories);
    }

    function appendPublicLoadFailureState(container, error) {
        if (!container) return false;
        container.textContent = '';
        var errEl = createLoadFailureState(error && error.message);
        if (errEl) {
            container.appendChild(errEl);
            return true;
        }
        return false;
    }

    globalObject.LoveBudPublicViewerCanvasEntry = Object.freeze({
        getCanvasRuntime: getCanvasRuntime,
        hasCanvasRuntime: hasCanvasRuntime,
        isCanvasRuntimeReady: isCanvasRuntimeReady,
        isDetailRuntimeReady: isDetailRuntimeReady,
        isPublicRuntimeReady: isPublicRuntimeReady,
        setupPublicRoute: setupPublicRoute,
        installPublicMetrics: installPublicMetrics,
        installPublicViewportProfile: installPublicViewportProfile,
        createReadOnlyActions: createReadOnlyActions,
        createMemorySelectors: createMemorySelectors,
        createPublicCanvasConfig: createPublicCanvasConfig,
        createSelectionState: createSelectionState,
        createDetailUIOptions: createDetailUIOptions,
        createCanvasOptions: createCanvasOptions,
        createLoadFailureState: createLoadFailureState,
        createMissingRouteState: createMissingRouteState,
        installPublicEditorReadOnlyState: installPublicEditorReadOnlyState,
        runPublicPostInitRefresh: runPublicPostInitRefresh,
        createEmptyGuideUpdater: createEmptyGuideUpdater,
        installToolbarCompactMode: installToolbarCompactMode,
        getBoundaryState: getBoundaryState,
        getPublicCanvasBridge: getPublicCanvasBridge,
        normalizePublicCanvasData: normalizePublicCanvasData,
        appendPublicLoadFailureState: appendPublicLoadFailureState
    });
})();
