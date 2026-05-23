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
        openAddMoment
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

    let savedFreePositions = null;
    let storedFreePositions = null;
    let hoverAffordanceTimer = null;
    let hoverAffordanceMemoryId = null;

    const storageUtils = window.LoveBudEditorCanvasLayoutStorage || {};

    function loadStoredLayout() {
        if (typeof storageUtils.loadStoredLayout === 'function') {
            return storageUtils.loadStoredLayout(treeId, layoutStorageKey, canvasLayout);
        }
        if (typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            const initialState = store.createInitialViewportState();
            return {
                positions: initialState.positions,
                offsetX: initialState.offsetX,
                offsetY: initialState.offsetY,
                scale: initialState.scale
            };
        }

        try {
            const raw = localStorage.getItem(layoutStorageKey);
            if (!raw || raw === 'null') return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
            return {
                positions: (parsed.positions && typeof parsed.positions === 'object') ? parsed.positions : {},
                offsetX: typeof parsed.offsetX === 'number' ? parsed.offsetX : 0,
                offsetY: typeof parsed.offsetY === 'number' ? parsed.offsetY : 0,
                scale: typeof parsed.scale === 'number' ? parsed.scale : 1
            };
        } catch (e) {
            return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
        }
    }

    function loadLayoutMode() {
        if (typeof storageUtils.loadLayoutMode === 'function') {
            return storageUtils.loadLayoutMode(layoutModeStorageKey);
        }
        try {
            const raw = localStorage.getItem(layoutModeStorageKey);
            if (raw === 'structured' || raw === 'free') return raw;
        } catch (e) {}
        return 'free';
    }

    function persistLayoutMode(mode) {
        if (typeof storageUtils.persistLayoutMode === 'function') {
            return storageUtils.persistLayoutMode(mode, layoutModeStorageKey);
        }
        try {
            localStorage.setItem(layoutModeStorageKey, mode);
        } catch (e) {}
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
        if (typeof storageUtils.persistStoredPositions === 'function') {
            return storageUtils.persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout);
        }
        if (viewportState.layoutMode === 'structured') return;

        if (typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            store.persist(viewportState);
            return;
        }

        try {
            localStorage.setItem(layoutStorageKey, JSON.stringify({
                positions: viewportState.positions,
                offsetX: viewportState.offsetX,
                offsetY: viewportState.offsetY,
                scale: viewportState.scale || 1
            }));
        } catch (e) {}
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
        viewportState.layoutMode = 'free';
        persistLayoutMode('free');
        viewportState.initialViewportApplied = false;
        if (savedFreePositions) {
            viewportState.positions = { ...savedFreePositions };
            savedFreePositions = null;
        }
        if (storedFreePositions && Object.keys(viewportState.positions).length === 0) {
            viewportState.positions = { ...storedFreePositions };
        }
        if (Object.keys(viewportState.positions).length === 0) {
            const stored = loadStoredLayout();
            if (stored.positions && Object.keys(stored.positions).length > 0) {
                viewportState.positions = { ...stored.positions };
            }
        }

        fitViewportToTree();

        uiHelpers.applyLayoutModeClasses('free');
        updateLayoutToggleUI();
        initCanvas();
        persistStoredPositions();
    }

    function switchToStructuredMode() {
        savedFreePositions = { ...viewportState.positions };
        viewportState.layoutMode = 'structured';
        viewportState.initialViewportApplied = false;
        persistLayoutMode('structured');

        fitViewportToTree();

        uiHelpers.applyLayoutModeClasses('structured');
        updateLayoutToggleUI();
        initCanvas();
    }

    function setLayoutMode(mode) {
        if (mode === 'structured') {
            switchToStructuredMode();
        } else {
            switchToFreeMode();
        }
    }

    function toggleLayoutMode() {
        if (viewportState.layoutMode === 'structured') {
            switchToFreeMode();
        } else {
            switchToStructuredMode();
        }
    }

    function updateLayoutToggleUI() {
        uiHelpers.updateLayoutToggleUI(viewportState.layoutMode, i18n);
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
        }
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
        const canonicalRootId = getCanonicalRootId();
        
        if (typeof renderUtils.renderAffordancesForMemory === 'function') {
            renderUtils.renderAffordancesForMemory(mem, {
                growthAffordance,
                branchPorts,
                getTreeMemories,
                canonicalRootId,
                isRootMemory
            });
            return;
        }

        // Fallback
        const drawableMemories = getTreeMemories().filter((node) => !isRootMemory(node, canonicalRootId));
        clearGrowthAffordance();
        growthAffordance.renderGrowthAffordance(mem, {
            isFirstStep: drawableMemories.length <= 1,
            isStartMoment: mem.parentId === canonicalRootId
        });
        branchPorts.renderPortsForNode(mem);
        branchPorts.showPortsForMemory(mem);
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
        nodeEl.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
        let touchStartPoint = null;

        const selectMemoryNode = () => {
            onNodeClick(nodeEl, mem);
        };

        nodeEl.addEventListener('mouseenter', () => {
            renderAffordanceForHoveredMemory(mem);
        });
        nodeEl.addEventListener('focusin', () => {
            renderAffordanceForHoveredMemory(mem);
        });

        nodeEl.addEventListener('mousedown', (e) => {
            if (viewportState.layoutMode === 'structured') return;

            if (typeof canvasInteraction.beginNodeDrag === 'function') {
                canvasInteraction.beginNodeDrag(e, nodeEl, mem, viewportState, getWorldPosition);
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

        nodeEl.addEventListener('click', (e) => {
            if (nodeEl.dataset.skipNextClick === '1') {
                nodeEl.dataset.skipNextClick = '';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (nodeEl.dataset.suppressClick === '1') {
                nodeEl.dataset.suppressClick = '';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            selectMemoryNode();
        });

        nodeEl.addEventListener('touchstart', (e) => {
            if (e.target.closest('button')) return;
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) return;
            touchStartPoint = {
                x: touch.clientX,
                y: touch.clientY
            };
            renderAffordanceForHoveredMemory(mem);
        }, { passive: true });

        nodeEl.addEventListener('touchend', (e) => {
            if (!touchStartPoint) return;
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) {
                touchStartPoint = null;
                return;
            }
            const dx = touch.clientX - touchStartPoint.x;
            const dy = touch.clientY - touchStartPoint.y;
            touchStartPoint = null;
            if (Math.abs(dx) > NODE_TAP_SELECT_THRESHOLD || Math.abs(dy) > NODE_TAP_SELECT_THRESHOLD) return;
            e.preventDefault();
            e.stopPropagation();
            nodeEl.dataset.skipNextClick = '1';
            selectMemoryNode();
        }, { passive: false });

        nodeEl.addEventListener('touchcancel', () => {
            touchStartPoint = null;
        });

        nodeEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            selectMemoryNode();
        });
    }

    function createNodeElement(mem, pos) {
        if (typeof renderUtils.createNodeElement === 'function') {
            return renderUtils.createNodeElement(mem, pos, canvasNode, {
                resolveMemoryThumbnail: resolveMemoryThumbnail,
                NODE_HALF: NODE_HALF,
                scale: viewportState.scale || 1
            });
        }
        // Fallback
        if (typeof canvasNode.createNodeElement !== "function") {
            throw new Error("LoveBudEditorCanvasNode.createNodeElement is required");
        }
        return canvasNode.createNodeElement(mem, pos, {
            resolveMemoryThumbnail: resolveMemoryThumbnail,
            NODE_HALF: NODE_HALF,
            scale: viewportState.scale || 1
        });
    }

    function attachNodeInfo(nodeEl, mem) {
        if (typeof renderUtils.attachNodeInfo === 'function') {
            renderUtils.attachNodeInfo(canvas, nodeEl, mem, canvasNode);
            return;
        }
        // Fallback
        if (typeof canvasNode.appendNodeInfo === 'function') {
            canvasNode.appendNodeInfo(nodeEl, mem);
        }
        canvas.appendChild(nodeEl);
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

        if (typeof renderUtils.clearGrowthAffordances === 'function') {
            renderUtils.clearGrowthAffordances(growthAffordance, branchPorts);
            return;
        }

        // Fallback
        if (growthAffordance) growthAffordance.clearGrowthAffordance();
        if (branchPorts) branchPorts.clearPorts();
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

        if (!nodeId) return;
        const treeMemories = getTreeMemories();
        const target = treeMemories.find((m) => m.id === nodeId);
        if (!target) return;

        const world = getWorldPosition(target);
        const metrics = getMetrics();
        const scale = viewportState.scale || 1;
        
        if (typeof panzoomUtils.calculateFocusOffset === 'function') {
            const offset = panzoomUtils.calculateFocusOffset(world.x, world.y, scale, metrics);
            viewportState.offsetX = offset.offsetX;
            viewportState.offsetY = offset.offsetY;
        } else {
            // Fallback
            viewportState.offsetX = Math.round(metrics.width * 0.5 - (world.x * scale));
            viewportState.offsetY = Math.round(metrics.height * 0.38 - (world.y * scale));
        }
        
        scheduleRender();
        reapplySelection(nodeId);
        persistStoredPositions();
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

        const treeMemories = getTreeMemories();
        if (!treeMemories.length) {
            viewportState.offsetX = 0;
            viewportState.offsetY = 0;
            viewportState.scale = 1;
            scheduleRender();
            persistStoredPositions();
            return;
        }

        const points = treeMemories.map((mem) => getWorldPosition(mem));
        const metrics = getMetrics();
        
        if (typeof panzoomUtils.calculateRecenterOffset === 'function') {
            const offset = panzoomUtils.calculateRecenterOffset(points, metrics);
            viewportState.offsetX = offset.offsetX;
            viewportState.offsetY = offset.offsetY;
        } else {
            // Fallback
            const minX = Math.min(...points.map((p) => p.x));
            const maxX = Math.max(...points.map((p) => p.x));
            const minY = Math.min(...points.map((p) => p.y));
            const maxY = Math.max(...points.map((p) => p.y));
            viewportState.offsetX = Math.round(metrics.width * 0.5 - ((minX + maxX) / 2));
            viewportState.offsetY = Math.round(metrics.height * 0.38 - ((minY + maxY) / 2));
        }

        scheduleRender();
        persistStoredPositions();
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

        if (viewportState.controlsBound) return;
        viewportState.controlsBound = true;

        const { focusBtn, recenterBtn, zoomInBtn, zoomOutBtn } = uiHelpers.getViewportControlButtons();

        [focusBtn, recenterBtn, zoomInBtn, zoomOutBtn].forEach((button) => {
            if (!button) return;
            button.addEventListener('mousedown', (event) => { event.stopPropagation(); });
            button.addEventListener('touchstart', (event) => { event.stopPropagation(); }, { passive: true });
        });

        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                const selectedId = selectionUtils.getSelectedMemoryId(document);
                if (selectedId) {
                    focusNodeById(selectedId);
                }
            });
        }

        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => {
                recenterViewport();
            });
        }

        if (zoomInBtn && typeof zoomBy === 'function') {
            zoomInBtn.addEventListener('click', () => { zoomBy(1.01); });
        }

        if (zoomOutBtn && typeof zoomBy === 'function') {
            zoomOutBtn.addEventListener('click', () => { zoomBy(0.99); });
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
            if (
                event.target.closest('.memory-node') ||
                event.target.closest('#addMemoryForm') ||
                event.target.closest('.memory-add-affordance')
            ) {
                return;
            }
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
                if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
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
            canvas.style.backgroundPosition = `${viewportState.offsetX}px ${viewportState.offsetY}px`;
        });

        window.addEventListener('mouseup', () => {
            let shouldRender = false;
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const draggedId = viewportState.dragNodeId;
                const moved = viewportState.dragMoved;
                viewportState.isDraggingNode = false;
                viewportState.dragNodeId = null;
                viewportState.dragMoved = false;
                const draggedEl = document.querySelector(`.memory-node[data-memory-id=\"${draggedId}\"]`);
                if (draggedEl) {
                    draggedEl.style.cursor = 'grab';
                }
                if (draggedEl && moved) {
                    draggedEl.dataset.suppressClick = '1';
                    shouldRender = true;
                    const toast = document.getElementById('movedToast');
                    if (toast) {
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 3000);
                    }
                }
            }

            if (viewportState.isPanning) {
                shouldRender = true;
            }
            viewportState.isPanning = false;
            canvas.classList.remove('panning');
            canvas.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
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

        if (typeof panzoomUtils.calculateZoomScale === 'function') {
            const newScale = panzoomUtils.calculateZoomScale(viewportState.scale, factor);
            if (newScale === viewportState.scale) return;
            viewportState.scale = newScale;
        } else {
            // Fallback
            const oldScale = viewportState.scale || 1;
            const newScale = factor >= 1 ? Math.min(1.5, oldScale + 0.25) : Math.max(0.2, oldScale - 0.25);
            if (newScale === oldScale) return;
            viewportState.scale = newScale;
        }

        scheduleRender();
        persistStoredPositions();
    }

    function addNodePosition(memoryId, pos) {
        if (!memoryId || !pos) return;
        viewportState.positions[memoryId] = pos;
    }

    requestAnimationFrame(() => {
        uiHelpers.applyLayoutModeClasses(viewportState.layoutMode);
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
