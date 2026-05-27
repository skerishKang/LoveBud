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

    function installPublicMetrics(canvas) {
        var geometry = window.EditorCanvasGeometry;
        if (!geometry || typeof geometry.getMetrics !== 'function') return;
        if (geometry.__publicViewMetricsInstalled) return;
        var originalGetMetrics = geometry.getMetrics;
        geometry.getMetrics = function(targetCanvas) {
            var node = targetCanvas || canvas;
            var rect = node && typeof node.getBoundingClientRect === 'function'
                ? node.getBoundingClientRect()
                : null;
            var width = Math.round((rect && rect.width) || (node && node.clientWidth) || window.innerWidth || 0);
            var height = Math.round((rect && rect.height) || (node && node.clientHeight) || window.innerHeight || 0);
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
        var viewport = window.LoveBudEditorCanvasViewport;
        if (!viewport || viewport.__publicViewProfileInstalled) return;
        viewport.minScale = Math.max(Number(viewport.minScale) || 0.2, 0.5);
        viewport.zoomLevels = [0.5, 0.75, 1, 1.25, 1.5];
        viewport.readableCenter = { x: 0.5, y: 0.46 };
        viewport.__publicViewProfileInstalled = true;
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

                var canvasReady = typeof window.createEditorCanvas === 'function';
                var detailReady = typeof window.createPublicViewerDetailUI === 'function';

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

                installPublicMetrics(canvas);
                installPublicViewportProfile();

                // Set up empty guide UI
                var updateCanvasEmptyGuide = function() {
                    var guide = document.getElementById('canvasEmptyGuide');
                    if (!guide) return;
                    var hasMoments = normalized.treeMemories.length > 0;
                    guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
                };

                // Resolve root helpers
                var rootUtils = window.LoveBudEditorUtils || {};
                var getCanonicalRootId = function() {
                    if (typeof rootUtils.getCanonicalRootId === 'function') {
                        return rootUtils.getCanonicalRootId(normalized.treeMemories);
                    }
                    var roots = normalized.treeMemories.filter(function(m) { return m.parentId === null || m.parentId === undefined; });
                    if (roots.length === 0) return 'root';
                    return roots.sort(function(a, b) {
                        return (a.createdAt || '9999') > (b.createdAt || '9999') ? 1 : -1;
                    })[0].id;
                };

                var isRootMemory = function(mem, rootId) {
                    if (typeof rootUtils.isRootMemory === 'function') {
                        return rootUtils.isRootMemory(mem, rootId);
                    }
                    return !!(mem && rootId && mem.id === rootId);
                };

                var canonicalRootId = getCanonicalRootId();

                // Create noop stubs for mutation functions
                var noop = function() {};
                var noopAsync = function() { return Promise.resolve(); };
                var noopFalseAsync = function() { return Promise.resolve(false); };

                // Initially select first non-root memory or first memory
                var selectedNodeId = canonicalRootId;
                var currentEditingMemory = null;

                function findFirstSelectableMemory() {
                    var nonRoot = normalized.treeMemories.filter(function(m) { return !isRootMemory(m, canonicalRootId); });
                    return nonRoot.length > 0 ? nonRoot[0] : normalized.treeMemories[0] || null;
                }

                // Initialize detail UI
                var showToast = function(msg) { console.log('[public-canvas]', msg); };

                var detailUI = window.createPublicViewerDetailUI({
                    detailPanel: detailPanel,
                    i18n: function(k) { return k; },
                    resolveTreeTitleText: function() { return normalized.treeData.title || '러브트리'; },
                    resolveHintText: function() { return ''; },
                    resolveInfoText: function() { return ''; },
                    resolveMemoryThumbnail: function(mem) { return mem && mem.thumbnail ? mem.thumbnail : ''; },
                    escapeHtml: escapeHtml,
                    isRootMemory: isRootMemory,
                    getCanonicalRootId: function() { return canonicalRootId; },
                    getSelectedNodeId: function() { return selectedNodeId; },
                    getTreeMemories: function() { return normalized.treeMemories; },
                    getCurrentTreeData: function() { return window.currentTreeData || {}; },
                    getLocalSaveMode: function() { return false; },
                    showToast: showToast,
                    updateTreeVisibility: noopAsync,
                    openCurrentMomentDetail: noop,
                    focusSelectedMoment: noop,
                    updateSelectedMemoryFields: noopFalseAsync
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
                    getTreeMemories: function() { return normalized.treeMemories; },
                    getCanonicalRootId: function() { return canonicalRootId; },
                    isRootMemory: isRootMemory,
                    resolveMemoryThumbnail: function(mem) { return mem && mem.thumbnail ? mem.thumbnail : ''; },
                    updateDetailPanel: updateDetailPanel,
                    setDetailEmptyState: setDetailEmptyState,
                    updateFocusSelectedBtn: updateFocusSelectedBtn,
                    createInitialMemory: function() {
                        return { id: canonicalRootId, title: normalized.treeData.title || '러브트리', parentId: null };
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
                    openAddMoment: noop,
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
                var errState = document.createElement('div');
                errState.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;';
                errState.innerHTML =
                    '<span class="material-symbols-outlined" style="font-size:48px;color:var(--error);margin-bottom:16px;">error_outline</span>' +
                    '<h2 style="margin:0 0 8px;">' + escapeHtml('트리를 불러올 수 없어요') + '</h2>' +
                    '<p style="margin:0;color:var(--on-surface-variant);">' + escapeHtml(error.message || 'Public endpoint returned an error') + '</p>';
                container.textContent = '';
                container.appendChild(errState);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPublicCanvas);
    } else {
        initPublicCanvas();
    }
})();