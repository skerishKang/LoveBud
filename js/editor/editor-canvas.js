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

    // Extracted Helpers (Modularization via Global Objects)
    const utils = window.LoveBudEditorCanvasUtils || {};
    const layoutStorage = window.LoveBudEditorCanvasLayoutStorage || {};
    const panzoomUtils = window.LoveBudEditorCanvasPanzoom || {};
    const selectionUtils = window.LoveBudEditorCanvasSelection || {};
    const renderUtils = window.LoveBudEditorCanvasRenderer || {};

    let savedFreePositions = null;
    let storedFreePositions = null;
    let hoverAffordanceTimer = null;
    let hoverAffordanceMemoryId = null;

    const storageUtils = window.LoveBudEditorCanvasLayoutStorage || {};

    function loadStoredLayout() {
        return storageUtils.loadStoredLayout(treeId, layoutStorageKey, canvasLayout);
    }

    function loadLayoutMode() {
        return storageUtils.loadLayoutMode(layoutModeStorageKey);
    }

    function persistLayoutMode(mode) {
        return storageUtils.persistLayoutMode(mode, layoutModeStorageKey);
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
        return utils.getWorldPosition(mem, {
            layoutMode: viewportState.layoutMode,
            viewportState,
            getCanonicalRootId,
            getTreeMemories,
            isRootMemory,
            getMetrics
        });
    }

    function calcPosition(mem) {
        return utils.calcPosition(mem, {
            getWorldPosition,
            canvasViewport,
            viewportState
        });
    }

    function persistStoredPositions() {
        storageUtils.persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout);
    }

    function fitViewportToTree() {
        panzoomUtils.fitViewportToTree({
            panzoomUtils,
            canvasViewport,
            viewportState,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics
        });
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

        document.body.classList.remove('layout-structured');
        document.body.classList.add('layout-free');
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

        document.body.classList.remove('layout-free');
        document.body.classList.add('layout-structured');
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
        const toggleBtn = document.getElementById('layoutModeToggleBtn');
        const toggleLabel = document.getElementById('layoutModeToggleLabel');
        const toggleIcon = document.getElementById('layoutModeToggleIcon');
        if (!toggleBtn) return;
        const isStructured = viewportState.layoutMode === 'structured';
        toggleBtn.classList.toggle('is-active', isStructured);
        if (toggleLabel) {
            toggleLabel.textContent = isStructured
                ? (i18n('editor_layout_structured') || '정리된 트리')
                : (i18n('editor_layout_free') || '자유 배치');
        }
        if (toggleIcon) {
            toggleIcon.textContent = isStructured ? 'account_tree' : 'auto_awesome';
        }
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
        return utils.isNodeWithinSafeViewport(pos, getMetrics);
    }

    function keepSelectionVisible() {
        selectionUtils.keepSelectionVisible({
            selectionUtils,
            getTreeMemories,
            calcPosition,
            isNodeWithinSafeViewport,
            focusNodeById,
            initCanvas,
            recenterViewport
        });
    }

    function bindResizeHandling() {
        if (viewportState.resizeBound) return;
        viewportState.resizeBound = true;

        window.addEventListener('resize', () => {
            if (viewportState.resizeTimer) {
                clearTimeout(viewportState.resizeTimer);
            }
            viewportState.resizeTimer = setTimeout(() => {
                keepSelectionVisible();
                persistStoredPositions();
            }, 120);
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
        renderUtils.renderAffordancesForMemory(mem, {
            growthAffordance,
            branchPorts,
            getTreeMemories,
            canonicalRootId,
            isRootMemory,
            clearGrowthAffordance
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
        canvasInteraction.bindNodeDrag({
            nodeEl,
            mem,
            viewportState,
            canvasInteraction,
            getWorldPosition,
            renderAffordanceForHoveredMemory,
            onNodeClick,
            NODE_TAP_SELECT_THRESHOLD
        });
    }

    function createNodeElement(mem, pos) {
        return renderUtils.createNodeElement(mem, pos, canvasNode, {
            resolveMemoryThumbnail,
            NODE_HALF,
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
        return renderUtils.drawNode(mem, {
            calcPosition,
            createNodeElement,
            attachNodeInfo,
            attachNodeBehavior
        });
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
        return utils.findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);
    }

    function scheduleRender() {
        if (viewportState.rafScheduled) return;
        viewportState.rafScheduled = true;
        viewportState.rafFrame = requestAnimationFrame(() => {
            viewportState.rafScheduled = false;
            initCanvas();
        });
    }

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

            renderUtils.clearCanvasNodes(canvas);
            clearBranches();
            clearGrowthAffordance();

            setDetailEmptyState(!hasVisibleNodes);
            updateFocusSelectedBtn();

            if (shouldRenderRootNode) {
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
        } catch (error) {
            console.error(`[editor-canvas] initCanvas failed to render nodes. Context: treeId=${treeId}, layoutMode=${viewportState.layoutMode}, selectedNodeId=${selectedNodeId}`, error);
            if (typeof setDetailEmptyState === 'function') {
                setDetailEmptyState(true);
            }
        }
    };

    function focusNodeById(nodeId) {
        panzoomUtils.focusNodeById(nodeId, {
            viewportState,
            canvasViewport,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            reapplySelection,
            persistStoredPositions
        });
    }

    function recenterViewport() {
        panzoomUtils.recenterViewport({
            viewportState,
            canvasViewport,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            persistStoredPositions
        });
    }

    function bindViewportControls() {
        panzoomUtils.bindControls ? panzoomUtils.bindControls({
            viewportState,
            focusNodeById,
            recenterViewport,
            zoomBy
        }) : (function() {
            if (viewportState.controlsBound) return;
            viewportState.controlsBound = true;

            const focusBtn = document.getElementById('focusSelectedBtn');
            const recenterBtn = document.getElementById('recenterCanvasBtn');
            const zoomInBtn = document.getElementById('zoomInCanvasBtn');
            const zoomOutBtn = document.getElementById('zoomOutCanvasBtn');

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
        })();
    }

    function bindLayoutModeToggle() {
        const toggleBtn = document.getElementById('layoutModeToggleBtn');
        if (!toggleBtn) return;
        if (toggleBtn.dataset.layoutBound) return;

        toggleBtn.addEventListener('click', () => {
            toggleLayoutMode();
        });

        toggleBtn.dataset.layoutBound = '1';
    }

    function bindCompactModeToggle() {
        const toggleBtn = document.getElementById('compactModeToggleBtn');
        const toolbar = document.querySelector('.editor-canvas-toolbar');
        if (!toggleBtn || !toolbar) return;
        if (toggleBtn.dataset.compactBound) return;

        // Restore saved preference
        var saved = localStorage.getItem('lovebud_toolbar_compact');
        if (saved === 'true') {
            toolbar.classList.add('is-compact');
            var icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = 'unfold_less';
        }

        toggleBtn.addEventListener('click', function() {
            var isCompact = toolbar.classList.toggle('is-compact');
            var icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isCompact ? 'unfold_less' : 'unfold_more';
            }
            try {
                localStorage.setItem('lovebud_toolbar_compact', isCompact);
            } catch (e) {}
        });

        toggleBtn.dataset.compactBound = '1';
    }

    function bindCanvasPan() {
        canvasInteraction.bind({
            canvas,
            viewportState,
            scheduleRender,
            persistStoredPositions,
            initCanvas,
            getWorldPosition,
            getDragTargetElement: (id) => document.querySelector(`.memory-node[data-memory-id="${id}"]`),
            showMovedToast: () => {
                const toast = document.getElementById('movedToast');
                if (toast) {
                    toast.style.display = 'block';
                    setTimeout(() => { toast.style.display = 'none'; }, 3000);
                }
            }
        });
    }

    function zoomBy(factor) {
        panzoomUtils.zoomBy(factor, {
            viewportState,
            canvasViewport,
            getMetrics,
            panzoomUtils,
            scheduleRender,
            persistStoredPositions
        });
    }

    function addNodePosition(memoryId, pos) {
        if (!memoryId || !pos) return;
        viewportState.positions[memoryId] = pos;
    }

    requestAnimationFrame(() => {
        if (viewportState.layoutMode === 'structured') {
            document.body.classList.add('layout-structured');
        } else {
            document.body.classList.add('layout-free');
        }
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

window.createEditorCanvas = createEditorCanvas;
