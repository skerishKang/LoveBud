(function() {
    'use strict';

    var MARKER = 'LoveBudPublicCanvasInitLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec && typeof sec.escapeHtml === 'function') return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createLoadFailureState(message) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.createLoadFailureState === 'function') {
            return canvasEntry.createLoadFailureState(message);
        }

        var errState = document.createElement('div');
        var icon = document.createElement('span');
        var title = document.createElement('h2');
        var description = document.createElement('p');

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
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.createMissingRouteState === 'function') {
            return canvasEntry.createMissingRouteState();
        }

        var errEl = document.createElement('div');
        errEl.style.cssText = 'padding:2rem;text-align:center;font-size:1.2rem;';
        errEl.textContent = 'treeId parameter required. Usage: ?treeId=<id>';
        return errEl;
    }

    function appendMissingRouteState() {
        var errEl = createMissingRouteState();
        if (errEl) {
            document.body.appendChild(errEl);
            return true;
        }
        return false;
    }

    function appendPublicLoadFailureState(container, error) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.appendPublicLoadFailureState === 'function') {
            return canvasEntry.appendPublicLoadFailureState(container, error);
        }

        if (container) {
            container.textContent = '';
            container.appendChild(createLoadFailureState(error && error.message));
            return true;
        }
        return false;
    }

    function handlePublicCanvasLoadFailure(error) {
        console.error('[public-canvas] Load failed:', error);
        var container = document.getElementById('canvasArea');
        appendPublicLoadFailureState(container, error);
    }

    function isPublicRuntimeReady() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.isPublicRuntimeReady === 'function') {
            return canvasEntry.isPublicRuntimeReady();
        }

        var canvasRuntimeReady = canvasEntry && typeof canvasEntry.isCanvasRuntimeReady === 'function'
            ? canvasEntry.isCanvasRuntimeReady()
            : typeof window.createEditorCanvas === 'function';

        var detailRuntimeReady = canvasEntry && typeof canvasEntry.isDetailRuntimeReady === 'function'
            ? canvasEntry.isDetailRuntimeReady()
            : typeof window.createPublicViewerDetailUI === 'function';

        return canvasRuntimeReady && detailRuntimeReady;
    }

    function waitForPublicRuntime(startCanvas) {
        var maxWait = 100;
        var waitInterval = 50;

        function waitForModules(attempt) {
            if (attempt >= maxWait) {
                console.error('[public-canvas] Timeout waiting for editor modules');
                return;
            }

            var runtimeReady = isPublicRuntimeReady();

            if (runtimeReady) {
                startCanvas();
                return;
            }

            setTimeout(function() { waitForModules(attempt + 1); }, waitInterval);
        }

        waitForModules(0);
    }

    function createPublicEditorCanvas(canvasOptions) {
        var adapter = window.LoveBudPublicViewerCanvasAdapter;
        var editorCanvas = adapter && typeof adapter.createPublicViewerCanvas === 'function'
            ? adapter.createPublicViewerCanvas({
                createEditorCanvas: window.createEditorCanvas,
                canvasOptions: canvasOptions
            })
            : null;

        if (!editorCanvas) {
            editorCanvas = window.createEditorCanvas(canvasOptions);
        }

        return editorCanvas;
    }

    function resolvePublicCanvasTargets() {
        return {
            canvas: document.getElementById('canvasArea'),
            svg: document.getElementById('canvasSvg'),
            detailPanel: document.getElementById('detailPanel')
        };
    }

    function installPublicCanvasRuntimeProfile(canvas) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.installPublicMetrics === 'function') {
            canvasEntry.installPublicMetrics(canvas);
        }
        if (canvasEntry && typeof canvasEntry.installPublicViewportProfile === 'function') {
            canvasEntry.installPublicViewportProfile();
        }
    }

    function createPublicCanvasConfig(normalized) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createPublicCanvasConfig === 'function'
            ? canvasEntry.createPublicCanvasConfig(normalized)
            : {
                resolveTreeTitleText: function() { return normalized.treeData.title || '러브트리'; },
                resolveHintText: function() { return ''; },
                resolveInfoText: function() { return ''; },
                resolveMemoryThumbnail: function(mem) { return mem && mem.thumbnail ? mem.thumbnail : ''; },
                getTreeMemories: function() { return normalized.treeMemories; },
                getCurrentTreeData: function() { return window.currentTreeData || {}; },
                createInitialMemory: function(rootId) {
                    return { id: rootId, title: normalized.treeData.title || '러브트리', parentId: null };
                }
            };
    }

    function createPublicCanvasEmptyGuideUpdater(treeMemories) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createEmptyGuideUpdater === 'function'
            ? canvasEntry.createEmptyGuideUpdater(treeMemories)
            : function() {
                var guide = document.getElementById('canvasEmptyGuide');
                if (!guide) return;
                var hasMoments = treeMemories.length > 0;
                guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
            };
    }

    function createPublicCanvasMemoryHelpers(treeMemories) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        var rootUtils = window.LoveBudEditorUtils || {};
        var memorySelectors = canvasEntry && typeof canvasEntry.createMemorySelectors === 'function'
            ? canvasEntry.createMemorySelectors(treeMemories)
            : null;

        function resolveExistingMemoryId(candidateId) {
            if (!candidateId) return null;
            return treeMemories.some(function(m) { return m && m.id === candidateId; }) ? candidateId : null;
        }

        var getCanonicalRootId = memorySelectors && typeof memorySelectors.getCanonicalRootId === 'function'
            ? function() { return memorySelectors.getCanonicalRootId(); }
            : function() {
                if (typeof rootUtils.getCanonicalRootId === 'function') {
                    return resolveExistingMemoryId(rootUtils.getCanonicalRootId(treeMemories));
                }
                var roots = treeMemories.filter(function(m) { return m.parentId === null || m.parentId === undefined; });
                if (roots.length === 0) return null;
                return roots.sort(function(a, b) {
                    return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;
                })[0].id;
            };

        var isRootMemory = memorySelectors && typeof memorySelectors.isRootMemory === 'function'
            ? function(mem, rootId) { return memorySelectors.isRootMemory(mem, rootId); }
            : function(mem, rootId) {
                if (typeof rootUtils.isRootMemory === 'function') {
                    return rootUtils.isRootMemory(mem, rootId);
                }
                return !!(mem && rootId && mem.id === rootId);
            };

        var canonicalRootId = getCanonicalRootId();

        var findFirstSelectableMemory = memorySelectors && typeof memorySelectors.findFirstSelectableMemory === 'function'
            ? function() { return memorySelectors.findFirstSelectableMemory(canonicalRootId); }
            : function() {
                var nonRoot = treeMemories.filter(function(m) { return !isRootMemory(m, canonicalRootId); });
                return nonRoot.length > 0 ? nonRoot[0] : treeMemories[0] || null;
            };

        return {
            getCanonicalRootId: getCanonicalRootId,
            isRootMemory: isRootMemory,
            canonicalRootId: canonicalRootId,
            findFirstSelectableMemory: findFirstSelectableMemory
        };
    }

    function createPublicCanvasReadOnlyActions() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createReadOnlyActions === 'function'
            ? canvasEntry.createReadOnlyActions()
            : {
                noop: function() {},
                noopAsync: function() { return Promise.resolve(); },
                noopFalseAsync: function() { return Promise.resolve(false); },
                getLocalSaveMode: function() { return false; },
                showToast: function(msg) { console.log('[public-canvas]', msg); }
            };
    }

    function createPublicCanvasSelectionState(canonicalRootId) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createSelectionState === 'function'
            ? canvasEntry.createSelectionState(canonicalRootId)
            : (function() {
                var selectedNodeId = canonicalRootId;
                var currentEditingMemory = null;

                return {
                    getSelectedNodeId: function() {
                        return selectedNodeId;
                    },
                    setSelectedNodeId: function(nextSelectedNodeId) {
                        selectedNodeId = nextSelectedNodeId || null;
                        return selectedNodeId;
                    },
                    getCurrentEditingMemory: function() {
                        return currentEditingMemory;
                    },
                    setCurrentEditingMemory: function(memory) {
                        currentEditingMemory = memory || null;
                        return currentEditingMemory;
                    },
                    selectMemory: function(memory) {
                        currentEditingMemory = memory || null;
                        selectedNodeId = memory && memory.id ? memory.id : selectedNodeId;
                        return currentEditingMemory;
                    }
                };
            })();
    }

    function createPublicCanvasDetailUIOptions(ctx) {
        var selectionState = ctx.selectionState;
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createDetailUIOptions === 'function'
            ? canvasEntry.createDetailUIOptions({
                detailPanel: ctx.detailPanel,
                i18n: function(k) { return k; },
                publicCanvasConfig: ctx.publicCanvasConfig,
                readOnlyActions: ctx.readOnlyActions,
                selectionState: ctx.selectionState,
                escapeHtml: ctx.escapeHtml,
                isRootMemory: ctx.isRootMemory,
                getCanonicalRootId: function() { return ctx.canonicalRootId; }
            })
            : {
                detailPanel: ctx.detailPanel,
                i18n: function(k) { return k; },
                resolveTreeTitleText: ctx.publicCanvasConfig.resolveTreeTitleText,
                resolveHintText: ctx.publicCanvasConfig.resolveHintText,
                resolveInfoText: ctx.publicCanvasConfig.resolveInfoText,
                resolveMemoryThumbnail: ctx.publicCanvasConfig.resolveMemoryThumbnail,
                escapeHtml: ctx.escapeHtml,
                isRootMemory: ctx.isRootMemory,
                getCanonicalRootId: function() { return ctx.canonicalRootId; },
                getSelectedNodeId: selectionState.getSelectedNodeId,
                getTreeMemories: ctx.publicCanvasConfig.getTreeMemories,
                getCurrentTreeData: ctx.publicCanvasConfig.getCurrentTreeData,
                getLocalSaveMode: ctx.readOnlyActions.getLocalSaveMode,
                showToast: ctx.readOnlyActions.showToast,
                updateTreeVisibility: ctx.readOnlyActions.noopAsync,
                openCurrentMomentDetail: ctx.readOnlyActions.noop,
                focusSelectedMoment: ctx.readOnlyActions.noop,
                updateSelectedMemoryFields: ctx.readOnlyActions.noopFalseAsync
            };
    }

    function createPublicCanvasOptions(ctx) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.createCanvasOptions === 'function'
            ? canvasEntry.createCanvasOptions({
                canvas: ctx.canvas,
                svg: ctx.svg,
                publicCanvasConfig: ctx.publicCanvasConfig,
                readOnlyActions: ctx.readOnlyActions,
                getCanonicalRootId: function() { return ctx.canonicalRootId; },
                isRootMemory: ctx.isRootMemory,
                updateDetailPanel: ctx.updateDetailPanel,
                setDetailEmptyState: ctx.setDetailEmptyState,
                updateFocusSelectedBtn: ctx.updateFocusSelectedBtn,
                createInitialMemory: function() {
                    return ctx.publicCanvasConfig.createInitialMemory(ctx.canonicalRootId);
                },
                onNodeClick: ctx.onNodeClick
            })
            : {
                canvas: ctx.canvas,
                svg: ctx.svg,
                getTreeMemories: ctx.publicCanvasConfig.getTreeMemories,
                getCanonicalRootId: function() { return ctx.canonicalRootId; },
                isRootMemory: ctx.isRootMemory,
                resolveMemoryThumbnail: ctx.publicCanvasConfig.resolveMemoryThumbnail,
                updateDetailPanel: ctx.updateDetailPanel,
                setDetailEmptyState: ctx.setDetailEmptyState,
                updateFocusSelectedBtn: ctx.updateFocusSelectedBtn,
                createInitialMemory: function() {
                    return ctx.publicCanvasConfig.createInitialMemory(ctx.canonicalRootId);
                },
                onNodeClick: ctx.onNodeClick,
                openAddMoment: ctx.readOnlyActions.noop,
                canEdit: false
            };
    }

    function installPublicCanvasReadOnlyState(canvas, editorCanvas) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.installPublicEditorReadOnlyState === 'function') {
            canvasEntry.installPublicEditorReadOnlyState(canvas, editorCanvas);
            return true;
        }

        if (canvas) canvas.__editorCanvasInstance = editorCanvas;
        window.LoveBudEditor = window.LoveBudEditor || {};
        window.LoveBudEditor.canEdit = false;
        return false;
    }

    function initializePublicEditorCanvas(editorCanvas) {
        if (editorCanvas && typeof editorCanvas.initCanvas === 'function') {
            editorCanvas.initCanvas();
            return true;
        }
        return false;
    }

    function runPublicCanvasPostInitRefresh(ctx) {
        var updateCanvasEmptyGuide = ctx.updateCanvasEmptyGuide;
        var updateSidebarStatus = ctx.updateSidebarStatus;
        var selectionState = ctx.selectionState;
        var updateDetailPanel = ctx.updateDetailPanel;
        var setDetailEmptyState = ctx.setDetailEmptyState;

        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.runPublicPostInitRefresh === 'function') {
            canvasEntry.runPublicPostInitRefresh({
                updateCanvasEmptyGuide: updateCanvasEmptyGuide,
                updateSidebarStatus: updateSidebarStatus,
                selectionState: selectionState,
                updateDetailPanel: updateDetailPanel,
                setDetailEmptyState: setDetailEmptyState
            });
            return true;
        }

        updateCanvasEmptyGuide();
        updateSidebarStatus();

        var currentEditingMemory = selectionState.getCurrentEditingMemory();
        if (currentEditingMemory) {
            updateDetailPanel(currentEditingMemory);
            setDetailEmptyState(false);
        }
        return false;
    }

    function updateOwnerModeUI(selectionState, providedTreeData) {
        var modeGroup = document.getElementById('viewerModeGroup');
        var viewBtn = document.getElementById('viewerModeViewBtn');
        var editBtn = document.getElementById('viewerModeEditBtn');
        if (!modeGroup || !viewBtn || !editBtn) return;
        var treeData = providedTreeData || window.currentTreeData || null;
        var canEdit = treeData && window.LoveBudTreeWorkspacePermission
            ? window.LoveBudTreeWorkspacePermission.resolveTreeWorkspaceCanEdit(treeData)
            : false;
        if (canEdit) {
            modeGroup.style.display = '';
            viewBtn.disabled = true;
            viewBtn.setAttribute('aria-current', 'true');
            editBtn.disabled = false;
            editBtn.removeAttribute('aria-current');
            var handlerKey = '_lovebudEditClick';
            if (!editBtn[handlerKey]) {
                editBtn[handlerKey] = function() {
                    var currentTreeId = treeData && treeData.id;
                    if (!currentTreeId) return;
                    var selectedMemoryId = selectionState && typeof selectionState.getSelectedNodeId === 'function'
                        ? selectionState.getSelectedNodeId()
                        : '';
                    var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
                    var params = 'treeId=' + encodeURIComponent(currentTreeId) + '&mode=edit';
                    if (selectedMemoryId) {
                        params += '&memoryId=' + encodeURIComponent(selectedMemoryId);
                    }
                    window.location.href = window.location.origin + '/' + basePath + 'editor?' + params;
                };
                editBtn.addEventListener('click', editBtn[handlerKey]);
            }
        } else {
            modeGroup.style.display = 'none';
        }
    }
    function installPublicCanvasToolbarCompactMode() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.installToolbarCompactMode === 'function') {
            canvasEntry.installToolbarCompactMode();
            return true;
        }

        var compactMql = window.matchMedia('(max-width: 480px)');

        function updateToolbarCompact(e) {
            var tb = document.querySelector('.editor-canvas-toolbar');
            if (!tb) return;
            tb.classList.toggle('is-compact', e.matches);
        }

        updateToolbarCompact(compactMql);
        compactMql.addEventListener('change', updateToolbarCompact);
        return false;
    }

    function createPublicCanvasNodeClickHandler(ctx) {
        return function(el, data) {
            if (!data) return;
            ctx.selectionState.selectMemory(data);
            document.querySelectorAll('.memory-node').forEach(function(n) { n.classList.remove('selected'); });
            if (el) el.classList.add('selected');
            ctx.updateDetailPanel(data);
            ctx.updateFocusSelectedBtn();
            ctx.setDetailEmptyState(false);

            var editorCanvas = typeof ctx.getEditorCanvas === 'function' ? ctx.getEditorCanvas() : null;
            if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                editorCanvas.updateAffordance();
            }
        };
    }

    function setupPublicRoute() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        if (canvasEntry && typeof canvasEntry.setupPublicRoute === 'function') {
            return canvasEntry.setupPublicRoute();
        }

        var params = new URLSearchParams(window.location.search);
        var treeId = params.get('treeId');
        document.body.classList.add('editor-readonly');
        document.body.classList.remove('editor-preload');
        return { treeId: treeId };
    }

    function isPublicCanvasBridgeReady(bridge) {
        return !!(bridge && typeof bridge.loadPublicTreeData === 'function');
    }

    function extractPublicCanvasResult(result) {
        return {
            tree: result.tree,
            memories: result.memories
        };
    }

    function initPublicCanvas() {
        var routeSetup = setupPublicRoute();
        var treeId = routeSetup && routeSetup.treeId;

        if (!treeId) {
            appendMissingRouteState();
            return;
        }

        var bridge = getPublicCanvasBridge();

        if (!isPublicCanvasBridgeReady(bridge)) {
            console.error('[public-canvas] Bridge not loaded');
            return;
        }

        bridge.loadPublicTreeData(treeId).then(function(result) {
            var publicCanvasResult = extractPublicCanvasResult(result);
            var tree = publicCanvasResult.tree;
            var memories = publicCanvasResult.memories;

            // Normalize to canvas shape
            var normalized = normalizePublicCanvasData(bridge, tree, memories);

            console.log('[public-canvas] Loaded tree:', normalized.treeData.id, 'memories:', normalized.treeMemories.length);


            function startCanvas() {
                var targets = resolvePublicCanvasTargets();
                var canvas = targets.canvas;
                var svg = targets.svg;
                var detailPanel = targets.detailPanel;

                if (!canvas || !svg) {
                    console.error('[public-canvas] Canvas or SVG element not found');
                    return;
                }

                var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
                installPublicCanvasRuntimeProfile(canvas);

                var publicCanvasConfig = createPublicCanvasConfig(normalized);

                var updateCanvasEmptyGuide = createPublicCanvasEmptyGuideUpdater(normalized.treeMemories);

                var memoryHelpers = createPublicCanvasMemoryHelpers(normalized.treeMemories);
                var getCanonicalRootId = memoryHelpers.getCanonicalRootId;
                var isRootMemory = memoryHelpers.isRootMemory;
                var canonicalRootId = memoryHelpers.canonicalRootId;
                var findFirstSelectableMemory = memoryHelpers.findFirstSelectableMemory;

                var readOnlyActions = createPublicCanvasReadOnlyActions();

                var selectionState = createPublicCanvasSelectionState(canonicalRootId);

                var detailUIOptions = createPublicCanvasDetailUIOptions({
                    detailPanel: detailPanel,
                    publicCanvasConfig: publicCanvasConfig,
                    readOnlyActions: readOnlyActions,
                    selectionState: selectionState,
                    escapeHtml: escapeHtml,
                    isRootMemory: isRootMemory,
                    canonicalRootId: canonicalRootId
                });

                var detailUI = window.createPublicViewerDetailUI(detailUIOptions);

                var setDetailEmptyState = detailUI.setDetailEmptyState;
                var updateFocusSelectedBtn = detailUI.updateFocusSelectedBtn;
                var updateSidebarStatus = detailUI.updateSidebarStatus;
                var updateDetailPanel = detailUI.updateDetailPanel;

                // Select first memory
                var firstSelectable = findFirstSelectableMemory();
                if (firstSelectable) {
                    selectionState.selectMemory(firstSelectable);
                }

                // Create canvas instance
                var editorCanvas;
                var onPublicCanvasNodeClick = createPublicCanvasNodeClickHandler({
                    selectionState: selectionState,
                    updateDetailPanel: updateDetailPanel,
                    updateFocusSelectedBtn: updateFocusSelectedBtn,
                    setDetailEmptyState: setDetailEmptyState,
                    getEditorCanvas: function() { return editorCanvas; }
                });

                var canvasOptions = createPublicCanvasOptions({
                    canvas: canvas,
                    svg: svg,
                    publicCanvasConfig: publicCanvasConfig,
                    readOnlyActions: readOnlyActions,
                    canonicalRootId: canonicalRootId,
                    isRootMemory: isRootMemory,
                    updateDetailPanel: updateDetailPanel,
                    setDetailEmptyState: setDetailEmptyState,
                    updateFocusSelectedBtn: updateFocusSelectedBtn,
                    onNodeClick: onPublicCanvasNodeClick
                });

                editorCanvas = createPublicEditorCanvas(canvasOptions);

                installPublicCanvasReadOnlyState(canvas, editorCanvas);

                initializePublicEditorCanvas(editorCanvas);

                runPublicCanvasPostInitRefresh({
                    updateCanvasEmptyGuide: updateCanvasEmptyGuide,
                    updateSidebarStatus: updateSidebarStatus,
                    selectionState: selectionState,
                    updateDetailPanel: updateDetailPanel,
                    setDetailEmptyState: setDetailEmptyState
                });

                console.log('[public-canvas] Canvas initialized successfully');

                installPublicCanvasToolbarCompactMode();

                // Populate viewer sidebar
                var sidebarTitleEl = document.getElementById('viewerSidebarTreeTitle');
                var sidebarSummaryEl = document.getElementById('viewerSidebarSummary');
                var sidebarCountEl = document.getElementById('viewerSidebarMomentCount');
                var treeData = normalized.treeData || {};
                var treeTitle = treeData.title || '러브트리';
                if (sidebarTitleEl) {
                    sidebarTitleEl.textContent = treeTitle;
                }
                var allMemories = normalized.treeMemories || [];
                var nonRootMemories = allMemories.filter(function(m) {
                    return !isRootMemory(m, canonicalRootId);
                });
                var momentCount = nonRootMemories.length;
                if (sidebarCountEl) {
                    sidebarCountEl.textContent = momentCount + '개의 순간';
                }
                if (sidebarSummaryEl) {
                    var treeSummary = treeData.description || treeData.summary || treeData.memo || null;
                    if (!treeSummary && treeData.data) {
                        treeSummary = treeData.data.description || treeData.data.summary || treeData.data.memo || null;
                    }
                    if (treeSummary) {
                        sidebarSummaryEl.innerHTML = '<p class="preview-summary-line">' + escapeHtml(treeSummary) + '</p>';
                        sidebarSummaryEl.style.display = '';
                    } else {
                        sidebarSummaryEl.style.display = 'none';
                    }
                }

                // Show owner mode group if authenticated owner
                updateOwnerModeUI(selectionState, normalized.treeData);
            }

            waitForPublicRuntime(startCanvas);
        }).catch(handlePublicCanvasLoadFailure);
    }

    function getPublicCanvasBridge() {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        return canvasEntry && typeof canvasEntry.getPublicCanvasBridge === 'function'
            ? canvasEntry.getPublicCanvasBridge()
            : window.LoveBudPublicCanvasBridge;
    }

    function normalizePublicCanvasData(bridge, tree, memories) {
        var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
        var normalized =
            canvasEntry && typeof canvasEntry.normalizePublicCanvasData === 'function'
                ? canvasEntry.normalizePublicCanvasData(bridge, tree, memories)
                : bridge.normalizeForCanvas(tree, memories);

        if (!normalized) {
            normalized = bridge.normalizeForCanvas(tree, memories);
        }

        return normalized;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPublicCanvas);
    } else {
        initPublicCanvas();
    }
})();
