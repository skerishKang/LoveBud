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
    const canvasLayout = window.LoveBudEditorCanvasLayout || {};
    const canvasNode = window.LoveBudEditorCanvasNode || {};
    const canvasInteraction = window.LoveBudEditorCanvasInteraction || {};
    const canvasInteractionHelpers = window.LoveBudEditorCanvasInteractionHelpers || {};
    const canvasViewport = window.LoveBudEditorCanvasViewport || {};
    const canvasLayoutHelpers = window.LoveBudEditorCanvasLayoutHelpers || {};
    const canvasEdges = window.createEditorCanvasEdges({ svg, canvasViewport });

function loadStoredLayout() {
        if (typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            const initialState = store.createInitialViewportState();
            return {
                positions: initialState.positions,
                offsetX: initialState.offsetX,
                offsetY: initialState.offsetY
            };
        }

        try {
            const raw = localStorage.getItem(layoutStorageKey);
            if (!raw || raw === 'null') return { positions: {}, offsetX: 0, offsetY: 0 };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return { positions: {}, offsetX: 0, offsetY: 0 };
            return {
                positions: (parsed.positions && typeof parsed.positions === 'object') ? parsed.positions : {},
                offsetX: typeof parsed.offsetX === 'number' ? parsed.offsetX : 0,
                offsetY: typeof parsed.offsetY === 'number' ? parsed.offsetY : 0
            };
        } catch (e) {
            return { positions: {}, offsetX: 0, offsetY: 0 };
        }
    }

    const storedLayout = loadStoredLayout();

    const viewportState = {
        offsetX: storedLayout.offsetX,
        offsetY: storedLayout.offsetY,
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
        rafFrame: null
    };
    const { NODE_HALF, AFFORDANCE_OFFSET_X, AFFORDANCE_OFFSET_Y, AFFORDANCE_CARD_HALF } = window.EditorCanvasGeometry;

    function getMetrics() {
        return window.EditorCanvasGeometry.getMetrics(canvas);
    }

    function getRootBasePosition() {
        return window.EditorCanvasGeometry.getRootBasePosition(getMetrics());
    }

    function getRadiusL1() {
        return window.EditorCanvasGeometry.getRadiusL1(getMetrics());
    }

    function getRadiusL2() {
        return window.EditorCanvasGeometry.getRadiusL2(getMetrics());
    }

    function distributeAngles(count, baseAngle = -10) {
        return window.EditorCanvasGeometry.distributeAngles(count, baseAngle);
    }

    function getWorldPosition(mem) {
        return window.EditorCanvasGeometry.getWorldPosition(mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetrics);
    }

    function calcPosition(mem) {
        return window.EditorCanvasGeometry.calcPosition(mem, viewportState, getWorldPosition);
    }

    function persistStoredPositions() {
        if (typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            store.persist(viewportState);
            return;
        }

        try {
            localStorage.setItem(layoutStorageKey, JSON.stringify({
                positions: viewportState.positions,
                offsetX: viewportState.offsetX,
                offsetY: viewportState.offsetY
            }));
        } catch (e) {}
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

    const { drawBranch } = canvasEdges;
    const NODE_TAP_SELECT_THRESHOLD = 8;

    function bindNodeDrag(nodeEl, mem) {
        nodeEl.style.cursor = 'grab';
        let touchStartPoint = null;

        const selectMemoryNode = () => {
            onNodeClick(nodeEl, mem);
        };

        nodeEl.addEventListener('mousedown', (e) => {
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

    function hideNodeSkeleton(img, skeleton) {
        img.classList.add('loaded');
        skeleton.style.display = 'none';
    }

    function handleNodeImageError(img, skeleton) {
        const currentSrc = img.getAttribute('src') || '';
        if (currentSrc.includes('/hqdefault.jpg')) {
            img.src = currentSrc.replace('/hqdefault.jpg', '/mqdefault.jpg');
            return;
        }
        if (currentSrc.includes('/mqdefault.jpg')) {
            img.src = currentSrc.replace('/mqdefault.jpg', '/default.jpg');
            return;
        }
        img.style.display = 'none';
        skeleton.classList.add('error');
        skeleton.textContent = '♪';
    }

    function createNodeImageSection(mem) {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'node-img-wrapper';
        const skeleton = document.createElement('div');
        skeleton.className = 'node-skeleton';
        imgWrapper.appendChild(skeleton);
        const img = document.createElement('img');
        img.src = resolveMemoryThumbnail(mem);
        img.alt = mem.title || '';
        img.draggable = false;
        img.addEventListener('dragstart', (e) => e.preventDefault());
        img.onload = () => hideNodeSkeleton(img, skeleton);
        img.onerror = () => handleNodeImageError(img, skeleton);
        if (img.complete) {
            hideNodeSkeleton(img, skeleton);
        }
        imgWrapper.appendChild(img);
        return imgWrapper;
    }

    function createNodeCard(mem) {
        const card = document.createElement('div');
        card.className = 'node-card';
        const imgWrapper = createNodeImageSection(mem);
        card.appendChild(imgWrapper);
        return card;
    }

    function applyNodePosition(nodeEl, pos, mem) {
        nodeEl.style.left = `${pos.x - NODE_HALF}px`;
        nodeEl.style.top = `${pos.y - NODE_HALF}px`;
        nodeEl.style.animationDelay = mem.delay || '0s';
    }

    function setupNodeElement(nodeEl, mem) {
        nodeEl.className = 'memory-node floating-node';
        nodeEl.dataset.memoryId = mem.id;
        nodeEl.draggable = false;
        nodeEl.tabIndex = 0;
        nodeEl.setAttribute('role', 'button');
        nodeEl.setAttribute('aria-label', mem.title ? `${mem.title} 선택` : '순간 선택');
        nodeEl.style.touchAction = 'none';
    }

    function createNodeElement(mem, pos) {
        const nodeEl = document.createElement('div');
        setupNodeElement(nodeEl, mem);
        applyNodePosition(nodeEl, pos, mem);
        nodeEl.appendChild(createNodeCard(mem));
        return nodeEl;
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
        const selectedEl = document.querySelector(`.memory-node[data-memory-id="${selectedNodeId}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
    }

    function clearGrowthAffordance() {
        growthAffordance.clearGrowthAffordance();
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
        svg.querySelectorAll('.branch-line').forEach((line) => line.remove());
        clearGrowthAffordance();

        setDetailEmptyState(!hasVisibleNodes);
        updateFocusSelectedBtn();

        if (shouldRenderRootNode) {
            drawNode(rootMemory);
        }

        drawableMemories.forEach((node) => {
            drawNode(node);
            const parentId = node.parentId || canonicalRootId;
            const parent = treeMemories.find((m) => m.id === parentId);
            if (parent) {
                drawBranch(calcPosition(parent), calcPosition(node));
            }
        });

        if (hasVisibleNodes) {
            const selectedMem = selectedNodeId
                ? treeMemories.find((m) => m.id === selectedNodeId)
                : createInitialMemory();
            if (selectedMem) {
                updateDetailPanel(selectedMem);
                reapplySelection(selectedMem.id);
                renderGrowthAffordance(selectedMem, {
                    isFirstStep: drawableMemories.length <= 1
                });
            }
        }

        bindCanvasPan();
        bindViewportControls();
        bindResizeHandling();
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
            return;
        }

        if (!nodeId) return;
        const treeMemories = getTreeMemories();
        const target = treeMemories.find((m) => m.id === nodeId);
        if (!target) return;

        const world = getWorldPosition(target);
        const metrics = getMetrics();
        viewportState.offsetX = Math.round(metrics.width * 0.5 - world.x);
        viewportState.offsetY = Math.round(metrics.height * 0.38 - world.y);
        initCanvas();
        reapplySelection(nodeId);
    }

    function recenterViewport() {
        if (typeof canvasViewport.recenterViewport === 'function') {
            canvasViewport.recenterViewport({
                getTreeMemories,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas
            });
            return;
        }

        const treeMemories = getTreeMemories();
        if (!treeMemories.length) {
            viewportState.offsetX = 0;
            viewportState.offsetY = 0;
            initCanvas();
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
    }

    function bindViewportControls() {
        if (typeof canvasViewport.bindControls === 'function') {
            canvasViewport.bindControls({
                viewportState,
                focusNodeById,
                recenterViewport
            });
            return;
        }

        if (viewportState.controlsBound) return;
        viewportState.controlsBound = true;

        const focusBtn = document.getElementById('focusSelectedBtn');
        const recenterBtn = document.getElementById('recenterCanvasBtn');

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
    }

    const bindCanvasPan = () => {
        if (typeof canvasInteraction.bind === 'function') {
            canvasInteraction.bind({
                canvas,
                viewportState,
                scheduleRender: scheduleInitCanvas,
                persistStoredPositions,
                initCanvas,
                getWorldPosition,
                getDragTargetElement: (draggedId) => document.querySelector(`.memory-node[data-memory-id="${draggedId}"]`),
                showMovedToast: () => {
                    if (window.LoveBudUI?.showToast) {
                        window.LoveBudUI.showToast(i18n('node_position_adjusted') || '순간 위치를 조정했습니다', 'success', 1800);
                    }
                }
            });
            return;
        }

        canvasInteractionHelpers.bindFallbackCanvasPan({
            canvas,
            viewportState,
            scheduleInitCanvas,
            persistStoredPositions,
            initCanvas,
            i18n
        });
    };

function scheduleInitCanvas() {
        if (viewportState.rafScheduled) return;
        viewportState.rafScheduled = true;
        viewportState.rafFrame = requestAnimationFrame(() => {
            viewportState.rafScheduled = false;
            viewportState.rafFrame = null;
            initCanvas();
        });
    }

    return {
        calcPosition,
        drawBranch,
        drawNode,
        initCanvas,
        bindCanvasPan,
        viewportState,
        focusNodeById,
        recenterViewport,
        keepSelectionVisible
    };
}

window.createEditorCanvas = createEditorCanvas;
