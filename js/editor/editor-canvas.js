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
    const canvasLayout = window.LoveBudEditorCanvasLayout || {};
    const canvasNode = window.LoveBudEditorCanvasNode || {};
    const canvasInteraction = window.LoveBudEditorCanvasInteraction || {};
    const canvasViewport = window.LoveBudEditorCanvasViewport || {};
    const canvasEdges = window.createEditorCanvasEdges({ svg, canvasViewport });

    let savedFreePositions = null;
    let storedFreePositions = null;

    function loadStoredLayout() {
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
        try {
            const raw = localStorage.getItem(layoutModeStorageKey);
            if (raw === 'structured' || raw === 'free') return raw;
        } catch (e) {}
        return 'free';
    }

    function persistLayoutMode(mode) {
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
        if (viewportState.layoutMode === 'structured') {
            return window.EditorCanvasGeometry.getStructuredWorldPosition(
                mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics
            );
        }
        return window.EditorCanvasGeometry.getWorldPosition(mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics);
    }

    function calcPosition(mem) {
        const world = getWorldPosition(mem);
        if (typeof canvasViewport.projectWorldPosition === 'function') {
            return canvasViewport.projectWorldPosition(world, viewportState);
        }
        return { x: world.x + viewportState.offsetX, y: world.y + viewportState.offsetY };
    }

    function persistStoredPositions() {
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
        if (typeof canvasViewport.getFitViewport !== 'function') return;
        const nextViewport = canvasViewport.getFitViewport({
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            getWorldPosition,
            getMetrics,
            viewportState
        });
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

    function isNodeWithinSafeViewport(pos) {
        const metrics = getMetrics();
        const padding = 96;
        return pos.x >= padding && pos.x <= metrics.width - padding && pos.y >= padding && pos.y <= metrics.height - padding;
    }

    function keepSelectionVisible() {
        const selectedId = document.querySelector('.memory-node.selected')?.dataset?.memoryId;
        if (selectedId) {
            const target = getTreeMemories().find((memory) => memory.id === selectedId);
            if (target) {
                const currentPos = calcPosition(target);
                if (!isNodeWithinSafeViewport(currentPos)) {
                    focusNodeById(selectedId);
                    return;
                }
                initCanvas();
                return;
            }
        }
        recenterViewport();
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

    function bindNodeDrag(nodeEl, mem) {
        nodeEl.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
        let touchStartPoint = null;

        const selectMemoryNode = () => {
            onNodeClick(nodeEl, mem);
        };

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
        if (!selectedNodeId) return;
        const selectedEl = document.querySelector(`.memory-node[data-memory-id=\"${selectedNodeId}\"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
    }

    function clearGrowthAffordance() {
        growthAffordance.clearGrowthAffordance();
    }

    const initCanvas = () => {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const selectedNodeId = document.querySelector('.memory-node.selected')?.dataset?.memoryId || null;
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

        canvas.querySelectorAll('.memory-node').forEach((node) => node.remove());
        canvas.querySelectorAll('#emptyTreeMessage').forEach((el) => el.remove());
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
            const selectedMem = selectedNodeId
                ? treeMemories.find((m) => m.id === selectedNodeId)
                : createInitialMemory();
            if (selectedMem) {
                updateDetailPanel(selectedMem);
                reapplySelection(selectedMem.id);
                growthAffordance.renderGrowthAffordance(selectedMem, {
                    isFirstStep: drawableMemories.length <= 1
                });
            }
        }

        bindCanvasPan();
        bindViewportControls();
        bindResizeHandling();
        bindLayoutModeToggle();
        viewportState.initialized = true;
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
                initCanvas,
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
        viewportState.offsetX = Math.round(metrics.width * 0.5 - (world.x * scale));
        viewportState.offsetY = Math.round(metrics.height * 0.38 - (world.y * scale));
        initCanvas();
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
                initCanvas
            });
            persistStoredPositions();
            return;
        }

        const treeMemories = getTreeMemories();
        if (!treeMemories.length) {
            viewportState.offsetX = 0;
            viewportState.offsetY = 0;
            viewportState.scale = 1;
            initCanvas();
            persistStoredPositions();
            return;
        }

        const points = treeMemories.map((mem) => getWorldPosition(mem));
        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));
        const metrics = getMetrics();

        viewportState.offsetX = Math.round(metrics.width * 0.5 - ((minX + maxX) / 2));
        viewportState.offsetY = Math.round(metrics.height * 0.38 - ((minY + maxY) / 2));
        initCanvas();
        persistStoredPositions();
    }

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
                const selectedId = document.querySelector('.memory-node.selected')?.dataset?.memoryId;
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
        const toggleBtn = document.getElementById('layoutModeToggleBtn');
        if (!toggleBtn) return;
        if (toggleBtn.dataset.layoutBound) return;

        toggleBtn.addEventListener('click', () => {
            toggleLayoutMode();
        });

        toggleBtn.dataset.layoutBound = '1';
    }

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
                showMovedToast: () => {
                    const toast = document.getElementById('movedToast');
                    if (toast) {
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 3000);
                    }
                }
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
                initCanvas
            });
            persistStoredPositions();
            return;
        }

        const oldScale = viewportState.scale || 1;
        const newScale = factor >= 1 ? Math.min(1.5, oldScale + 0.25) : Math.max(0.2, oldScale - 0.25);
        if (newScale === oldScale) return;
        viewportState.scale = newScale;
        initCanvas();
        persistStoredPositions();
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
        calcPosition,
        drawBranch,
        drawNode,
        initCanvas,
        focusNodeById,
        recenterViewport,
        setLayoutMode,
        getWorldPosition,
        get viewportState() { return viewportState; }
    };
}

window.createEditorCanvas = createEditorCanvas;
