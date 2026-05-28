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

    function initPublicCanvas() {
        var params = new URLSearchParams(window.location.search);
        var treeId = params.get('treeId');
        if (!treeId) {
            var errEl = document.createElement('div');
            errEl.style.cssText = 'padding:2rem;text-align:center;font-size:1.2rem;';
            errEl.textContent = 'treeId parameter required. Usage: ?treeId=<id>';
            document.body.appendChild(errEl);
            return;
        }

        // Apply editor-readonly class for CSS hiding of mutation controls
        document.body.classList.add('editor-readonly');
        document.body.classList.remove('editor-preload');

        var bridge = window.LoveBudPublicCanvasBridge;
        if (!bridge || typeof bridge.loadPublicTreeData !== 'function') {
            console.error('[public-canvas] Bridge not loaded');
            return;
        }

        bridge.loadPublicTreeData(treeId).then(function(result) {
            var tree = result.tree;
            var memories = result.memories;

            // Normalize to canvas shape
            var normalized = bridge.normalizeForCanvas(tree, memories);
            console.log('[public-canvas] Loaded tree:', normalized.treeData.id, 'memories:', normalized.treeMemories.length);

            // Wait for all required modules
            var maxWait = 100;
            var waitInterval = 50;

            function waitForModules(attempt) {
                if (attempt >= maxWait) {
                    console.error('[public-canvas] Timeout waiting for editor modules');
                    return;
                }

                var canvasEntry = window.LoveBudPublicViewerCanvasEntry;
                var canvasReady = canvasEntry && typeof canvasEntry.isCanvasRuntimeReady === 'function'
                    ? canvasEntry.isCanvasRuntimeReady()
                    : typeof window.createEditorCanvas === 'function';
                var detailReady = canvasEntry && typeof canvasEntry.isDetailRuntimeReady === 'function'
                    ? canvasEntry.isDetailRuntimeReady()
                    : typeof window.createPublicViewerDetailUI === 'function';

                if (canvasReady && detailReady) {
                    startCanvas();
                    return;
                }
                setTimeout(function() { waitForModules(attempt + 1); }, waitInterval);
            }

            function startCanvas() {
                var canvas = document.getElementById('canvasArea');
                var svg = document.getElementById('canvasSvg');
                var detailPanel = document.getElementById('detailPanel');

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
                var updateCanvasEmptyGuide = function() {
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

                // Initially select first non-root memory or first memory
                var selectedNodeId = canonicalRootId;
                var currentEditingMemory = null;

                // Initialize detail UI

                var detailUI = window.createPublicViewerDetailUI({
                    detailPanel: detailPanel,
                    i18n: function(k) { return k; },
                    resolveTreeTitleText: publicCanvasConfig.resolveTreeTitleText,
                    resolveHintText: publicCanvasConfig.resolveHintText,
                    resolveInfoText: publicCanvasConfig.resolveInfoText,
                    resolveMemoryThumbnail: publicCanvasConfig.resolveMemoryThumbnail,
                    escapeHtml: escapeHtml,
                    isRootMemory: isRootMemory,
                    getCanonicalRootId: function() { return canonicalRootId; },
                    getSelectedNodeId: function() { return selectedNodeId; },
                    getTreeMemories: publicCanvasConfig.getTreeMemories,
                    getCurrentTreeData: publicCanvasConfig.getCurrentTreeData,
                    getLocalSaveMode: readOnlyActions.getLocalSaveMode,
                    showToast: readOnlyActions.showToast,
                    updateTreeVisibility: readOnlyActions.noopAsync,
                    openCurrentMomentDetail: readOnlyActions.noop,
                    focusSelectedMoment: readOnlyActions.noop,
                    updateSelectedMemoryFields: readOnlyActions.noopFalseAsync
                });

                var setDetailEmptyState = detailUI.setDetailEmptyState;
                var updateFocusSelectedBtn = detailUI.updateFocusSelectedBtn;
                var updateSidebarStatus = detailUI.updateSidebarStatus;
                var updateDetailPanel = detailUI.updateDetailPanel;

                // Select first memory
                var firstSelectable = findFirstSelectableMemory();
                if (firstSelectable) {
                    selectedNodeId = firstSelectable.id;
                    currentEditingMemory = firstSelectable;
                }

                // Create canvas instance
                var editorCanvas = window.createEditorCanvas({
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
                    onNodeClick: function(el, data) {
                        if (!data) return;
                        selectedNodeId = data.id;
                        currentEditingMemory = data;
                        document.querySelectorAll('.memory-node').forEach(function(n) { n.classList.remove('selected'); });
                        if (el) el.classList.add('selected');
                        updateDetailPanel(data);
                        updateFocusSelectedBtn();
                        setDetailEmptyState(false);
                        if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                            editorCanvas.updateAffordance();
                        }
                    },
                    openAddMoment: readOnlyActions.noop,
                    canEdit: false
                });

                // Store instance
                if (canvas) canvas.__editorCanvasInstance = editorCanvas;
                window.LoveBudEditor = window.LoveBudEditor || {};
                window.LoveBudEditor.canEdit = false;

                // Initialize canvas
                if (editorCanvas && typeof editorCanvas.initCanvas === 'function') {
                    editorCanvas.initCanvas();
                }

                updateCanvasEmptyGuide();
                updateSidebarStatus();

                // Select first memory in detail panel
                if (currentEditingMemory) {
                    updateDetailPanel(currentEditingMemory);
                    setDetailEmptyState(false);
                }

                console.log('[public-canvas] Canvas initialized successfully');

                // Auto-enable compact mode on narrow viewports (toolbar labels would overflow)
                var compactMql = window.matchMedia('(max-width: 480px)');
                function updateToolbarCompact(e) {
                    var tb = document.querySelector('.editor-canvas-toolbar');
                    if (!tb) return;
                    tb.classList.toggle('is-compact', e.matches);
                }
                updateToolbarCompact(compactMql);
                compactMql.addEventListener('change', updateToolbarCompact);
            }

            waitForModules(0);
        }).catch(function(error) {
            console.error('[public-canvas] Load failed:', error);
            var container = document.getElementById('canvasArea');
            if (container) {
                container.textContent = '';
                container.appendChild(createLoadFailureState(error && error.message));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPublicCanvas);
    } else {
        initPublicCanvas();
    }
})();
