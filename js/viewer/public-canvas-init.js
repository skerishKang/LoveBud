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

            // Wait for all required modules
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
                if (canvasEntry && typeof canvasEntry.installPublicMetrics === 'function') {
                    canvasEntry.installPublicMetrics(canvas);
                }
                if (canvasEntry && typeof canvasEntry.installPublicViewportProfile === 'function') {
                    canvasEntry.installPublicViewportProfile();
                }

                // Delegate public canvas config helpers to entry wrapper
                var publicCanvasConfig = canvasEntry && typeof canvasEntry.createPublicCanvasConfig === 'function'
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

                // Set up empty guide UI
                var updateCanvasEmptyGuide = canvasEntry && typeof canvasEntry.createEmptyGuideUpdater === 'function'
                    ? canvasEntry.createEmptyGuideUpdater(normalized.treeMemories)
                    : function() {
                        var guide = document.getElementById('canvasEmptyGuide');
                        if (!guide) return;
                        var hasMoments = normalized.treeMemories.length > 0;
                        guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
                    };

                // Resolve root helpers via entry wrapper with fallback
                var rootUtils = window.LoveBudEditorUtils || {};
                var memorySelectors = canvasEntry && typeof canvasEntry.createMemorySelectors === 'function'
                    ? canvasEntry.createMemorySelectors(normalized.treeMemories)
                    : null;

                var getCanonicalRootId = memorySelectors && typeof memorySelectors.getCanonicalRootId === 'function'
                    ? function() { return memorySelectors.getCanonicalRootId(); }
                    : function() {
                        if (typeof rootUtils.getCanonicalRootId === 'function') {
                            return rootUtils.getCanonicalRootId(normalized.treeMemories);
                        }
                        var roots = normalized.treeMemories.filter(function(m) { return m.parentId === null || m.parentId === undefined; });
                        if (roots.length === 0) return 'root';
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
                        var nonRoot = normalized.treeMemories.filter(function(m) { return !isRootMemory(m, canonicalRootId); });
                        return nonRoot.length > 0 ? nonRoot[0] : normalized.treeMemories[0] || null;
                    };

                // Delegate read-only/no-op actions to entry wrapper
                var readOnlyActions = canvasEntry && typeof canvasEntry.createReadOnlyActions === 'function'
                    ? canvasEntry.createReadOnlyActions()
                    : {
                        noop: function() {},
                        noopAsync: function() { return Promise.resolve(); },
                        noopFalseAsync: function() { return Promise.resolve(false); },
                        getLocalSaveMode: function() { return false; },
                        showToast: function(msg) { console.log('[public-canvas]', msg); }
                    };

                // Delegate selection state to entry wrapper with fallback
                var selectionState = canvasEntry && typeof canvasEntry.createSelectionState === 'function'
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

                // Delegate detail UI options to entry wrapper with fallback
                var detailUIOptions = canvasEntry && typeof canvasEntry.createDetailUIOptions === 'function'
                    ? canvasEntry.createDetailUIOptions({
                        detailPanel: detailPanel,
                        i18n: function(k) { return k; },
                        publicCanvasConfig: publicCanvasConfig,
                        readOnlyActions: readOnlyActions,
                        selectionState: selectionState,
                        escapeHtml: escapeHtml,
                        isRootMemory: isRootMemory,
                        getCanonicalRootId: function() { return canonicalRootId; }
                    })
                    : {
                        detailPanel: detailPanel,
                        i18n: function(k) { return k; },
                        resolveTreeTitleText: publicCanvasConfig.resolveTreeTitleText,
                        resolveHintText: publicCanvasConfig.resolveHintText,
                        resolveInfoText: publicCanvasConfig.resolveInfoText,
                        resolveMemoryThumbnail: publicCanvasConfig.resolveMemoryThumbnail,
                        escapeHtml: escapeHtml,
                        isRootMemory: isRootMemory,
                        getCanonicalRootId: function() { return canonicalRootId; },
                        getSelectedNodeId: selectionState.getSelectedNodeId,
                        getTreeMemories: publicCanvasConfig.getTreeMemories,
                        getCurrentTreeData: publicCanvasConfig.getCurrentTreeData,
                        getLocalSaveMode: readOnlyActions.getLocalSaveMode,
                        showToast: readOnlyActions.showToast,
                        updateTreeVisibility: readOnlyActions.noopAsync,
                        openCurrentMomentDetail: readOnlyActions.noop,
                        focusSelectedMoment: readOnlyActions.noop,
                        updateSelectedMemoryFields: readOnlyActions.noopFalseAsync
                    };

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
                var onPublicCanvasNodeClick = function(el, data) {
                    if (!data) return;
                    selectionState.selectMemory(data);
                    document.querySelectorAll('.memory-node').forEach(function(n) { n.classList.remove('selected'); });
                    if (el) el.classList.add('selected');
                    updateDetailPanel(data);
                    updateFocusSelectedBtn();
                    setDetailEmptyState(false);
                    if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                        editorCanvas.updateAffordance();
                    }
                };

                var canvasOptions = canvasEntry && typeof canvasEntry.createCanvasOptions === 'function'
                    ? canvasEntry.createCanvasOptions({
                        canvas: canvas,
                        svg: svg,
                        publicCanvasConfig: publicCanvasConfig,
                        readOnlyActions: readOnlyActions,
                        getCanonicalRootId: function() { return canonicalRootId; },
                        isRootMemory: isRootMemory,
                        updateDetailPanel: updateDetailPanel,
                        setDetailEmptyState: setDetailEmptyState,
                        updateFocusSelectedBtn: updateFocusSelectedBtn,
                        createInitialMemory: function() {
                            return publicCanvasConfig.createInitialMemory(canonicalRootId);
                        },
                        onNodeClick: onPublicCanvasNodeClick
                    })
                    : {
                        canvas: canvas,
                        svg: svg,
                        getTreeMemories: publicCanvasConfig.getTreeMemories,
                        getCanonicalRootId: function() { return canonicalRootId; },
                        isRootMemory: isRootMemory,
                        resolveMemoryThumbnail: publicCanvasConfig.resolveMemoryThumbnail,
                        updateDetailPanel: updateDetailPanel,
                        setDetailEmptyState: setDetailEmptyState,
                        updateFocusSelectedBtn: updateFocusSelectedBtn,
                        createInitialMemory: function() {
                            return publicCanvasConfig.createInitialMemory(canonicalRootId);
                        },
                        onNodeClick: onPublicCanvasNodeClick,
                        openAddMoment: readOnlyActions.noop,
                        canEdit: false
                    };

                var editorCanvas = createPublicEditorCanvas(canvasOptions);

                // Store instance and public read-only editor state
                if (canvasEntry && typeof canvasEntry.installPublicEditorReadOnlyState === 'function') {
                    canvasEntry.installPublicEditorReadOnlyState(canvas, editorCanvas);
                } else {
                    if (canvas) canvas.__editorCanvasInstance = editorCanvas;
                    window.LoveBudEditor = window.LoveBudEditor || {};
                    window.LoveBudEditor.canEdit = false;
                }

                // Initialize canvas
                if (editorCanvas && typeof editorCanvas.initCanvas === 'function') {
                    editorCanvas.initCanvas();
                }

                // Refresh public canvas UI after initialization
                if (canvasEntry && typeof canvasEntry.runPublicPostInitRefresh === 'function') {
                    canvasEntry.runPublicPostInitRefresh({
                        updateCanvasEmptyGuide: updateCanvasEmptyGuide,
                        updateSidebarStatus: updateSidebarStatus,
                        selectionState: selectionState,
                        updateDetailPanel: updateDetailPanel,
                        setDetailEmptyState: setDetailEmptyState
                    });
                } else {
                    updateCanvasEmptyGuide();
                    updateSidebarStatus();

                    var currentEditingMemory = selectionState.getCurrentEditingMemory();
                    if (currentEditingMemory) {
                        updateDetailPanel(currentEditingMemory);
                        setDetailEmptyState(false);
                    }
                }

                console.log('[public-canvas] Canvas initialized successfully');

                // Auto-enable compact mode on narrow viewports (toolbar labels would overflow)
                if (canvasEntry && typeof canvasEntry.installToolbarCompactMode === 'function') {
                    canvasEntry.installToolbarCompactMode();
                } else {
                    var compactMql = window.matchMedia('(max-width: 480px)');
                    function updateToolbarCompact(e) {
                        var tb = document.querySelector('.editor-canvas-toolbar');
                        if (!tb) return;
                        tb.classList.toggle('is-compact', e.matches);
                    }
                    updateToolbarCompact(compactMql);
                    compactMql.addEventListener('change', updateToolbarCompact);
                }
            }

            waitForModules(0);
        }).catch(function(error) {
            console.error('[public-canvas] Load failed:', error);
            var container = document.getElementById('canvasArea');
            appendPublicLoadFailureState(container, error);
        });
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
