import * as utils from './editor-canvas-utils.js';
import * as panzoomUtils from './editor-canvas-panzoom.js';
import * as selectionUtils from './editor-canvas-selection.js';
import * as renderUtils from './editor-canvas-renderer.js';
import * as uiHelpers from './editor-canvas-ui-helpers.js';

function createEditorCanvas(deps) {
    const {
        canvas,
        svg,
        getTreeMemories,
        getCanonicalRootId,
        isRootMemory,
        resolveMemoryThumbnail,
        updateDetailPanel,
        setDetailEmptyState,
        updateFocusSelectedBtn,
        createInitialMemory,
        onNodeClick,
        openAddMoment,
        canEdit
    } = deps;

    const i18n = window.t || function(key) { return key; };
    const treeId = (window.currentTreeData && window.currentTreeData.id)
        || new URLSearchParams(window.location.search).get('treeId')
        || 'default';
    const layoutStorageKey = 'lovebud_tree_layout_v2_' + treeId;
    const layoutModeStorageKey = 'lovebud_tree_layout_mode_' + treeId;
    // External Module Delegates (Legacy Global Dependencies)
    const canvasLayout = window.LoveBudEditorCanvasLayout || {};
    const canvasNode = window.LoveBudEditorCanvasNode || {};
    const canvasInteraction = window.LoveBudEditorCanvasInteraction || {};
    const canvasViewport = window.LoveBudEditorCanvasViewport || {};
    const canvasEdges = window.createEditorCanvasEdges({ svg, canvasViewport });

    const layoutStorage = window.LoveBudEditorCanvasLayoutStorage || {};
    const layoutTransition = window.LoveBudEditorCanvasLayoutTransition || {};

    let savedFreePositions = null;
    let storedFreePositions = null;
    let hoverAffordanceTimer = null;
    let hoverAffordanceMemoryId = null;

    const storageUtils = window.LoveBudEditorCanvasLayoutStorage || {};

    function loadStoredLayout() {
        if (typeof storageUtils.loadStoredLayout === 'function') {
            return storageUtils.loadStoredLayout(treeId, layoutStorageKey, canvasLayout);
        }
        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            const initialState = store.createInitialViewportState();
            return {
                positions: initialState.positions,
                offsetX: initialState.offsetX,
                offsetY: initialState.offsetY,
                scale: initialState.scale
            };
        }
        return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
    }

    function loadLayoutMode() {
        if (typeof storageUtils.loadLayoutMode === 'function') {
            return storageUtils.loadLayoutMode(layoutModeStorageKey);
        }
        return 'free';
    }

    function persistLayoutMode(mode) {
        if (canEdit === false) return;
        if (typeof storageUtils.persistLayoutMode === 'function') {
            return storageUtils.persistLayoutMode(mode, layoutModeStorageKey, canEdit);
        }
    }

    const storedLayout = loadStoredLayout();
    storedFreePositions = { ...(storedLayout.positions || {}) };

    const hasNonDefaultOffset = storedLayout.offsetX !== 0 || storedLayout.offsetY !== 0;
    const hasStoredViewportOffset = hasNonDefaultOffset || (storedLayout.scale !== undefined && storedLayout.scale !== 1);
    const viewportState = {
        offsetX: storedLayout.offsetX,
        offsetY: storedLayout.offsetY,
        scale: storedLayout.scale || 1,
        hasStoredViewportOffset: !!hasStoredViewportOffset,
        initialized: false,
        isPanning: false,
        startX: 0,
        startY: 0,
        isDraggingNode: false,
        dragNodeId: null,
        dragStartClientX: 0,
        dragStartClientY: 0,
        dragStartWorldX: 0,
        dragStartWorldY: 0,
        dragMoved: false,
        controlsBound: false,
        globalsBound: false,
        resizeBound: false,
        resizeTimer: null,
        positions: storedLayout.positions,
        rafScheduled: false,
        rafFrame: null,
        layoutMode: loadLayoutMode()
    };
    const { NODE_HALF, AFFORDANCE_OFFSET_X, AFFORDANCE_OFFSET_Y, AFFORDANCE_CARD_HALF } = window.EditorCanvasGeometry;

    function getMetrics() {
        return window.EditorCanvasGeometry.getMetrics(canvas);
    }

    function getWorldPosition(mem) {
        if (typeof utils.getWorldPosition === 'function') {
            return utils.getWorldPosition(mem, {
                layoutMode: viewportState.layoutMode,
                viewportState,
                getCanonicalRootId,
                getTreeMemories,
                isRootMemory,
                getMetrics
            });
        }
        // Fallback
        if (viewportState.layoutMode === 'structured') {
            return window.EditorCanvasGeometry.getStructuredWorldPosition(
                mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics
            );
        }
        return window.EditorCanvasGeometry.getWorldPosition(mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics);
    }

    function calcPosition(mem) {
        if (typeof utils.calcPosition === 'function') {
            return utils.calcPosition(mem, {
                getWorldPosition: getWorldPosition,
                canvasViewport,
                viewportState
            });
        }
        // Fallback
        const world = getWorldPosition(mem);
        if (typeof canvasViewport.projectWorldPosition === 'function') {
            return canvasViewport.projectWorldPosition(world, viewportState);
        }
        return { x: world.x + viewportState.offsetX, y: world.y + viewportState.offsetY };
    }

    function persistStoredPositions() {
        if (canEdit === false) return;
        if (typeof storageUtils.persistStoredPositions === 'function') {
            return storageUtils.persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit);
        }
        if (viewportState.layoutMode === 'structured') return;

        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            store.persist(viewportState);
        }
    }

    function fitViewportToTree() {
        let nextViewport = null;
        if (typeof panzoomUtils.getFitViewportIfAvailable === 'function') {
            nextViewport = panzoomUtils.getFitViewportIfAvailable(canvasViewport, {
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState
            });
        } else if (typeof canvasViewport.getFitViewport === 'function') {
            nextViewport = canvasViewport.getFitViewport({
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState
            });
        }
        
        if (!nextViewport) return;
        if (typeof canvasViewport.applyViewport === 'function') {
            canvasViewport.applyViewport(viewportState, nextViewport, true);
            return;
        }
        viewportState.scale = nextViewport.scale || viewportState.scale || 1;
        viewportState.offsetX = nextViewport.offsetX;
        viewportState.offsetY = nextViewport.offsetY;
    }

    function switchToFreeMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.switchToFreeMode(); }
    }

    function switchToStructuredMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.switchToStructuredMode(); }
    }

    function setLayoutMode(mode) {
        if (layoutModeSwitcher) { layoutModeSwitcher.setLayoutMode(mode); }
    }

    function toggleLayoutMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.toggleLayoutMode(); }
    }

    function updateLayoutToggleUI() {
        (typeof layoutTransition.updateLayoutToggleUI === 'function'
            ? layoutTransition.updateLayoutToggleUI
            : uiHelpers.updateLayoutToggleUI)(viewportState.layoutMode, i18n);
    }

    const growthAffordance = window.createEditorCanvasGrowthAffordance({
        canvas,
        svg,
        documentRef: document,
        getMetrics,
        calcPosition,
        openAddMoment,
        i18n,
        constants: {
            NODE_HALF,
            AFFORDANCE_OFFSET_X,
            AFFORDANCE_OFFSET_Y,
            AFFORDANCE_CARD_HALF
        },
        canEdit
    });

    const branchPorts = window.createEditorCanvasBranchPorts({
        canvas,
        svg,
        documentRef: document,
        calcPosition,
        openAddMoment,
        getTreeMemories,
        getCanonicalRootId,
        isRootMemory,
        i18n,
        constants: {
            NODE_HALF
        }
    });

    function isNodeWithinSafeViewport(pos) {
        if (typeof utils.isNodeWithinSafeViewport === 'function') {
            return utils.isNodeWithinSafeViewport(pos, getMetrics);
        }
        // Fallback
        const metrics = getMetrics();
        const padding = 96;
        return pos.x >= padding && pos.x <= metrics.width - padding && pos.y >= padding && pos.y <= metrics.height - padding;
    }

    function keepSelectionVisible() {
        const selectedId = selectionUtils.getSelectedMemoryId(document);
        const target = selectionUtils.getSelectedMemory(document, getTreeMemories());

        if (selectedId && target) {
            const currentPos = calcPosition(target);
            if (!isNodeWithinSafeViewport(currentPos)) {
                focusNodeById(selectedId);
                return;
            }
            initCanvas();
            return;
        }
        recenterViewport();
    }

    function bindResizeHandling() {
        uiHelpers.bindResizeHandling(viewportState, () => {
            keepSelectionVisible();
            persistStoredPositions();
        });
    }

    const requireCanvasEdgeMethod = (name) => {
        if (typeof canvasEdges[name] !== 'function') {
            throw new Error(`LoveBudEditorCanvasEdges.${name} is required`);
        }
        return canvasEdges[name];
    };
    const drawBranch = requireCanvasEdgeMethod('drawBranch');
    const clearBranches = requireCanvasEdgeMethod('clearBranches');
    const drawBranchForMemory = requireCanvasEdgeMethod('drawBranchForMemory');
    const NODE_TAP_SELECT_THRESHOLD = 8;
    const AFFORDANCE_LOCK_CLASS = 'affordance-interaction-locked';

    function renderAffordanceForMemory(mem) {
        if (!mem) return;
        renderUtils.renderAffordancesForMemory(mem, {
            growthAffordance,
            branchPorts,
            getTreeMemories,
            canonicalRootId: getCanonicalRootId(),
            isRootMemory
        });
    }

    function renderAffordanceForHoveredMemory(mem) {
        if (!mem || viewportState.isDraggingNode || viewportState.isPanning) return;
        if (canvas.classList.contains(AFFORDANCE_LOCK_CLASS)) return;
        if (hoverAffordanceMemoryId === mem.id) return;
        if (hoverAffordanceTimer) clearTimeout(hoverAffordanceTimer);
        hoverAffordanceMemoryId = mem.id;
        hoverAffordanceTimer = setTimeout(() => {
            if (canvas.classList.contains(AFFORDANCE_LOCK_CLASS)) return;
            renderAffordanceForMemory(mem);
        }, 45);
    }

    function bindNodeDrag(nodeEl, mem) {
        nodeEl.style.cursor = canEdit !== false && viewportState.layoutMode === 'structured' ? 'default' : 'grab';

        const selectMemoryNode = () => {
            onNodeClick(nodeEl, mem);
        };

        uiHelpers.bindNodeHoverAffordance(nodeEl, mem, renderAffordanceForHoveredMemory);

        if (canEdit !== false) {
            uiHelpers.bindNodeDragStart(nodeEl, () => viewportState.layoutMode, (e) => {
                if (typeof canvasInteraction.beginNodeDrag === 'function') {
                    canvasInteraction.beginNodeDrag(e, nodeEl, mem, viewportState, getWorldPosition, canEdit);
                    return;
                }

                if (e.button !== 0) return;
                if (e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();

                const startWorld = getWorldPosition(mem);
                viewportState.isDraggingNode = true;
                viewportState.dragNodeId = mem.id;
                viewportState.dragStartClientX = e.clientX;
                viewportState.dragStartClientY = e.clientY;
                viewportState.dragStartWorldX = startWorld.x;
                viewportState.dragStartWorldY = startWorld.y;
                viewportState.dragMoved = false;
                nodeEl.style.cursor = 'grabbing';
            });
        }

        uiHelpers.bindNodePointerSelection(nodeEl, {
            onSelect: selectMemoryNode,
            onHover: renderAffordanceForHoveredMemory,
            mem: mem,
            tapThreshold: NODE_TAP_SELECT_THRESHOLD
        });

        uiHelpers.bindNodeControlShortcuts(nodeEl, selectMemoryNode);
    }

    function createNodeElement(mem, pos) {
        return renderUtils.createNodeElement(mem, pos, canvasNode, {
            resolveMemoryThumbnail: resolveMemoryThumbnail,
            NODE_HALF: NODE_HALF,
            scale: viewportState.scale || 1
        });
    }

    function attachNodeInfo(nodeEl, mem) {
        renderUtils.attachNodeInfo(canvas, nodeEl, mem, canvasNode);
    }

    function attachNodeBehavior(nodeEl, mem) {
        bindNodeDrag(nodeEl, mem);
    }

    const drawNode = (mem) => {
        const pos = calcPosition(mem);
        const nodeEl = createNodeElement(mem, pos);
        attachNodeInfo(nodeEl, mem);
        attachNodeBehavior(nodeEl, mem);
        return nodeEl;
    };

    function reapplySelection(selectedNodeId) {
        selectionUtils.reapplySelection(selectedNodeId, document, {
            renderAffordanceForMemory,
            getTreeMemories
        });
    }

    function clearGrowthAffordance() {
        hoverAffordanceMemoryId = null;
        if (hoverAffordanceTimer) {
            clearTimeout(hoverAffordanceTimer);
            hoverAffordanceTimer = null;
        }

        renderUtils.clearGrowthAffordances(growthAffordance, branchPorts);
    }

    function openAddMomentFromCanvas() {
        growthAffordance.openAddMomentFromCanvas();
    }

    function getGrowthAffordancePosition(anchorPos) {
        return growthAffordance.getGrowthAffordancePosition(anchorPos);
    }

    function drawGrowthAffordanceBranch(startPos, endPos, side) {
        growthAffordance.drawGrowthAffordanceBranch(startPos, endPos, side);
    }

    function createGrowthAffordanceElement(anchorMem, labelText, helperText) {
        growthAffordance.createGrowthAffordanceElement(anchorMem, labelText, helperText);
    }

    function renderGrowthAffordance(anchorMem, options) {
        growthAffordance.renderGrowthAffordance(anchorMem, options);
    }

    function updateAffordance() {
        const selectedMem = selectionUtils.getSelectedMemory(document, getTreeMemories());
        renderAffordanceForMemory(selectedMem);
    }

    function findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId) {
        if (typeof utils.findInitialVisibleMemory === 'function') {
            return utils.findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);
        }
        // Fallback
        const rootMemory = treeMemories.find(function(m) {
            return m && (m.parentId === null || m.parentId === undefined);
        });
        if (rootMemory) {
            var firstChild = drawableMemories.find(function(m) {
                return m && m.parentId === rootMemory.id;
            });
            if (firstChild) return firstChild;
        }
        return drawableMemories[0] || null;
    }

    let _rafPending = false;
    function scheduleRender() {
        if (_rafPending) return;
        _rafPending = true;
        requestAnimationFrame(() => {
            _rafPending = false;
            initCanvas();
        });
    }

    /**
     * DOM RENDER ORCHESTRATION BOUNDARY
     * High-risk regression point:
     * - Do NOT move DOM creation/deletion loop outside this module.
     * - Preserve render ordering to prevent duplicate nodes.
     * - Preserve affordance and detail panel synchronization.
     * - Ensure `hasVisibleNodes` check controls Empty State rendering.
     */
    const initCanvas = () => {
        let selectedNodeId = null;
        try {
            const canonicalRootId = getCanonicalRootId();
            const treeMemories = getTreeMemories();
            selectedNodeId = selectionUtils.getSelectedMemoryId(document);

            const drawableMemories = treeMemories.filter((node) => !isRootMemory(node, canonicalRootId));
            const rootMemory = treeMemories.find((node) => isRootMemory(node, canonicalRootId)) || null;
            const shouldRenderRootNode = drawableMemories.length === 0 && !!rootMemory;
            const hasVisibleNodes = drawableMemories.length > 0 || shouldRenderRootNode;

            console.log(`[editor-canvas] Drawable nodes: ${drawableMemories.length}, Root found: ${!!rootMemory}, hasVisibleNodes: ${hasVisibleNodes}`);

            if (hasVisibleNodes && typeof canvasViewport.prepareInitialViewport === 'function') {
                canvasViewport.prepareInitialViewport({
                    getTreeMemories,
                    getCanonicalRootId,
                    isRootMemory,
                    getWorldPosition,
                    getMetrics,
                    viewportState
                });
            }
            canvas.style.backgroundPosition = `${viewportState.offsetX}px ${viewportState.offsetY}px`;

            if (typeof renderUtils.clearCanvasNodes === 'function') {
                renderUtils.clearCanvasNodes(canvas);
            } else {
                // Fallback
                canvas.querySelectorAll('.memory-node').forEach((node) => node.remove());
                canvas.querySelectorAll('#emptyTreeMessage').forEach((el) => el.remove());
            }
            clearBranches();
            clearGrowthAffordance();

            setDetailEmptyState(!hasVisibleNodes);
            updateFocusSelectedBtn();

            if (shouldRenderRootNode) {
                console.log(`[editor-canvas] Drawing root node: ${rootMemory.id}`);
                drawNode(rootMemory);
            }

            drawableMemories.forEach((node) => {
                drawNode(node);
                drawBranchForMemory(node, {
                    treeMemories,
                    canonicalRootId,
                    calcPosition
                });
            });

            if (hasVisibleNodes) {
                let selectedMem = selectedNodeId
                    ? treeMemories.find((m) => m.id === selectedNodeId)
                    : createInitialMemory();

                // Skip root if found; show first visible child of hidden root instead
                if (!selectedMem || isRootMemory(selectedMem, canonicalRootId)) {
                    selectedMem = findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);
                }

                if (selectedMem) {
                    console.log(`[editor-canvas] Reapplying selection: ${selectedMem.id}`);
                    reapplySelection(selectedMem.id);

                    const selectedEl = document.querySelector(`.memory-node[data-memory-id="${selectedMem.id}"]`);
                    if (selectedEl && typeof onNodeClick === 'function') {
                        onNodeClick(selectedEl, selectedMem);
                    } else {
                        updateDetailPanel(selectedMem);
                        renderAffordanceForMemory(selectedMem);
                    }
                }
            }

            bindCanvasPan();
            bindViewportControls();
            bindResizeHandling();
            bindLayoutModeToggle();
            // Bind compact mode toggle
            bindCompactModeToggle();
            viewportState.initialized = true;
            console.log(`[editor-canvas] initCanvas complete. Nodes rendered: ${document.querySelectorAll('.memory-node').length}`);
        } catch (error) {
            console.error(`[editor-canvas] initCanvas failed to render nodes. Context: treeId=${treeId}, layoutMode=${viewportState.layoutMode}, selectedNodeId=${selectedNodeId}`, error);
            if (typeof setDetailEmptyState === 'function') {
                setDetailEmptyState(true);
            }
        }
    };

    const layoutModeSwitcher = typeof layoutTransition.createLayoutModeSwitcher === 'function'
        ? layoutTransition.createLayoutModeSwitcher({
            viewportState,
            loadStoredLayout,
            persistLayoutMode,
            persistStoredPositions,
            fitViewportToTree,
            initCanvas,
            updateLayoutToggleUI,
            getSavedFreePositions: () => savedFreePositions,
            setSavedFreePositions: (value) => { savedFreePositions = value; },
            getStoredFreePositions: () => storedFreePositions,
            setStoredFreePositions: (value) => { storedFreePositions = value; }
        })
        : null;

    function focusNodeById(nodeId) {
        if (typeof canvasViewport.focusNodeById === 'function') {
            canvasViewport.focusNodeById({
                nodeId,
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas: scheduleRender,
                reapplySelection
            });
            persistStoredPositions();
            return;
        }

        if (typeof panzoomUtils.focusNodeByIdFallback === 'function') {
            panzoomUtils.focusNodeByIdFallback({
                nodeId,
                getTreeMemories,
                getWorldPosition,
                getMetrics,
                viewportState,
                scheduleRender,
                reapplySelection,
                persistStoredPositions
            });
        }
    }

    function recenterViewport() {
        if (typeof canvasViewport.recenterViewport === 'function') {
            canvasViewport.recenterViewport({
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }

        if (typeof panzoomUtils.recenterViewportFallback === 'function') {
            panzoomUtils.recenterViewportFallback({
                getTreeMemories,
                getWorldPosition,
                getMetrics,
                viewportState,
                scheduleRender,
                persistStoredPositions
            });
        }
    }

    /**
     * EVENT LIFECYCLE BOUNDARY
     * High-risk regression point:
     * - Do NOT move global listener bindings outside this module.
     * - Ensure `viewportState.controlsBound` correctly prevents duplicate bindings.
     */
    function bindViewportControls() {
        if (typeof canvasViewport.bindControls === 'function') {
            canvasViewport.bindControls({
                viewportState,
                focusNodeById,
                recenterViewport,
                zoomBy
            });
            return;
        }

        if (typeof uiHelpers.bindViewportControlsFallback === 'function') {
            uiHelpers.bindViewportControlsFallback({
                viewportState,
                getSelectedMemoryId: () => selectionUtils.getSelectedMemoryId(document),
                focusNodeById,
                recenterViewport,
                zoomBy
            });
        }
    }

    function bindLayoutModeToggle() {
        uiHelpers.bindLayoutModeToggle(toggleLayoutMode);
    }

    /**
     * Bind the compact/detail mode toggle for the canvas toolbar.
     * Toggles .is-compact class on .editor-canvas-toolbar and swaps the toggle icon.
     * Preference is persisted in localStorage.
     */
    function bindCompactModeToggle() {
        uiHelpers.bindCompactModeToggle();
    }

    /**
     * EVENT LIFECYCLE BOUNDARY
     * High-risk regression point:
     * - Do NOT extract pan state mutations without passing viewportState by reference.
     * - Ensure `viewportState.globalsBound` is strictly respected to avoid ghost dragging.
     */
    function bindCanvasPan() {
        if (typeof canvasInteraction.bind === 'function') {
            canvasInteraction.bind({
                canvas,
                viewportState,
                scheduleRender: () => { if (viewportState.layoutMode === 'free') initCanvas(); },
                persistStoredPositions,
                initCanvas,
                getWorldPosition,
                getDragTargetElement: (id) => document.querySelector(`.memory-node[data-memory-id=\"${id}\"]`),
                showMovedToast: uiHelpers.showMovedToast
            });
            return;
        }

        if (viewportState.globalsBound) return;
        viewportState.globalsBound = true;

        canvas.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';

        canvas.addEventListener('mousedown', (event) => {
            if (!uiHelpers.shouldStartCanvasPan(event)) return;
            if (viewportState.layoutMode === 'structured') return;

            viewportState.isPanning = true;
            viewportState.startX = event.clientX;
            viewportState.startY = event.clientY;
            canvas.classList.add('panning');
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (event) => {
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const dx = event.clientX - viewportState.dragStartClientX;
                const dy = event.clientY - viewportState.dragStartClientY;
                if (uiHelpers.hasExceededNodeDragThreshold(dx, dy)) {
                    viewportState.dragMoved = true;
                }
                if (!viewportState.dragMoved) return;
                const scale = viewportState.scale || 1;
                viewportState.positions[viewportState.dragNodeId] = {
                    x: Math.round(viewportState.dragStartWorldX + (dx / scale)),
                    y: Math.round(viewportState.dragStartWorldY + (dy / scale))
                };
                initCanvas();
                return;
            }

            if (!viewportState.isPanning) return;
            const dx = event.clientX - viewportState.startX;
            const dy = event.clientY - viewportState.startY;
            viewportState.startX = event.clientX;
            viewportState.startY = event.clientY;
            viewportState.offsetX += dx;
            viewportState.offsetY += dy;
            uiHelpers.updateCanvasPanBackgroundPosition(canvas, viewportState.offsetX, viewportState.offsetY);
        });

        window.addEventListener('mouseup', () => {
            let shouldRender = false;
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const draggedId = viewportState.dragNodeId;
                const moved = viewportState.dragMoved;
                viewportState.isDraggingNode = false;
                viewportState.dragNodeId = null;
                viewportState.dragMoved = false;
                const draggedEl = uiHelpers.resetDraggedNodeCursor(document, draggedId);
                if (draggedEl && moved) {
                    draggedEl.dataset.suppressClick = '1';
                    shouldRender = true;
                    uiHelpers.showMovedToast();
                }
            }

            if (viewportState.isPanning) {
                shouldRender = true;
            }
            viewportState.isPanning = false;
            uiHelpers.resetCanvasPanUI(canvas, viewportState.layoutMode);
            if (shouldRender) {
                persistStoredPositions();
                initCanvas();
            }
        });
    }

    function zoomBy(factor) {
        if (typeof canvasViewport.zoomBy === 'function') {
            canvasViewport.zoomBy({
                factor,
                viewportState,
                getMetrics,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }

        if (typeof panzoomUtils.zoomByFallback === 'function') {
            panzoomUtils.zoomByFallback({
                factor,
                viewportState,
                scheduleRender,
                persistStoredPositions
            });
        }
    }

    function addNodePosition(memoryId, pos) {
        if (!memoryId || !pos) return;
        viewportState.positions[memoryId] = pos;
    }

    requestAnimationFrame(() => {
        (typeof layoutTransition.applyLayoutModeClasses === 'function'
            ? layoutTransition.applyLayoutModeClasses
            : uiHelpers.applyLayoutModeClasses)(viewportState.layoutMode);
        updateLayoutToggleUI();
    });

    return {
        addNodePosition,
        calcPosition,
        drawBranch,
        drawNode,
        initCanvas,
        focusNodeById,
        recenterViewport,
        setLayoutMode,
        updateAffordance,
        getWorldPosition,
        get viewportState() { return viewportState; },
        persistStoredPositions
    };
}

// Bridge to window for legacy editor.js compatibility
window.createEditorCanvas = createEditorCanvas;
window.LoveBudEditorCanvas = {
    createEditorCanvas,
    initCanvas: () => {
        const instance = document.querySelector('#canvasArea')?.__editorCanvasInstance;
        if (instance) instance.initCanvas();
    }
};

// Global Editor Bridge for legacy/external triggers (Refs #1495)
window.LoveBudEditor = {
    initCanvas: () => window.LoveBudEditorCanvas.initCanvas(),
    refresh: () => window.LoveBudEditorCanvas.initCanvas(),
    render: () => window.LoveBudEditorCanvas.initCanvas()
};

/**
 * SELF-INITIALIZATION GUARD
 * If this module loads AFTER editor.js has already attempted to start,
 * and we have data ready in the global window, trigger a re-render.
 */
(function() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        if (window.currentTreeMemories && window.currentTreeMemories.length > 0) {
            console.log('[editor-canvas] Late module load detected with existing data. Triggering bridge init...');
            setTimeout(() => window.LoveBudEditorCanvas.initCanvas(), 100);
        }
    }
})();
