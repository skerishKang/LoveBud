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
    const canvasViewport = window.LoveBudEditorCanvasViewport || {};
    const canvasLayoutHelpers = window.LoveBudEditorCanvasLayoutHelpers || {};
    const canvasEdges = window.createEditorCanvasEdges({ svg, canvasViewport });

    const canvasState = window.createEditorCanvasStateBoundary({
        treeId,
        layoutStorageKey,
        canvasLayout
    });
    const viewportState = canvasState.createViewportState();

    const ROOT_RIGHT_GUTTER = 300;
    const ROOT_BOTTOM_GUTTER = 180;
    const NODE_WIDTH = 108;
    const NODE_HALF = Math.round(NODE_WIDTH / 2);
    const AFFORDANCE_OFFSET_X = 168;
    const AFFORDANCE_OFFSET_Y = 10;
    const AFFORDANCE_CARD_HALF = 108;
    const layoutHelperConstants = { ROOT_RIGHT_GUTTER, ROOT_BOTTOM_GUTTER };

    function persistStoredPositions() {
        canvasState.persistStoredPositions(viewportState);
    }

    function getMetrics() {
        return canvasLayoutHelpers.getMetrics(canvas);
    }

    function getRootBasePosition() {
        return canvasLayoutHelpers.getRootBasePosition(getMetrics(), layoutHelperConstants);
    }

    function getRadiusL1() {
        return canvasLayoutHelpers.getRadiusL1(getMetrics());
    }

    function getRadiusL2() {
        return canvasLayoutHelpers.getRadiusL2(getMetrics());
    }

    function distributeAngles(count, baseAngle = -10) {
        return canvasLayoutHelpers.distributeAngles(count, baseAngle);
    }

    function getWorldPosition(mem, visited = new Set()) {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();

        if (!mem) {
            return getRootBasePosition();
        }

        if (viewportState.positions[mem.id]) {
            return {
                x: Number(viewportState.positions[mem.id].x) || 0,
                y: Number(viewportState.positions[mem.id].y) || 0
            };
        }

        if (isRootMemory(mem, canonicalRootId)) {
            return getRootBasePosition();
        }

        if (visited.has(mem.id)) {
            return getRootBasePosition();
        }
        visited.add(mem.id);

        const parentId = mem.parentId || canonicalRootId;
        const siblings = treeMemories.filter((m) => (
            (m.parentId || canonicalRootId) === parentId && !isRootMemory(m, canonicalRootId)
        ));
        const idx = Math.max(0, siblings.findIndex((m) => m.id === mem.id));
        const count = Math.max(1, siblings.length);

        if (parentId === canonicalRootId) {
            const angles = distributeAngles(count, -10);
            const angle = angles[idx] !== undefined ? angles[idx] : -10;
            const rootBase = getRootBasePosition();
            const radius = getRadiusL1();
            return canvasLayoutHelpers.offsetByAngle(rootBase, radius, angle);
        }

        const parent = treeMemories.find((m) => m.id === parentId);
        const parentPos = parent ? getWorldPosition(parent, visited) : getRootBasePosition();
        const childAngles = distributeAngles(count, 0);
        const childAngle = childAngles[idx] !== undefined ? childAngles[idx] : 0;
        const radius = getRadiusL2();

        return canvasLayoutHelpers.offsetByAngle(parentPos, radius, childAngle);
    }

    const calcPosition = (mem) => {
        const world = getWorldPosition(mem);
        return {
            x: world.x + viewportState.offsetX,
            y: world.y + viewportState.offsetY
        };
    };

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
        canvasState.bindResizeHandling({
            viewportState,
            keepSelectionVisible,
            persistStoredPositions
        });
    }

    const { drawBranch } = canvasEdges;

    function bindNodeDrag(nodeEl, mem) {
        nodeEl.style.cursor = 'grab';

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
            if (nodeEl.dataset.suppressClick === '1') {
                nodeEl.dataset.suppressClick = '';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            onNodeClick(nodeEl, mem);
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

        if (viewportState.globalsBound) return;
        viewportState.globalsBound = true;

        canvas.style.cursor = 'grab';
        canvas.style.touchAction = 'none';

        canvas.addEventListener('mousedown', (e) => {
            if (e.target.closest('.memory-node') || e.target.closest('#addMemoryForm') || e.target.closest('.memory-add-affordance')) return;
            viewportState.isPanning = true;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            canvas.classList.add('panning');
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const dx = e.clientX - viewportState.dragStartClientX;
                const dy = e.clientY - viewportState.dragStartClientY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    viewportState.dragMoved = true;
                }
                viewportState.positions[viewportState.dragNodeId] = {
                    x: Math.round(viewportState.dragStartWorldX + dx),
                    y: Math.round(viewportState.dragStartWorldY + dy)
                };
                scheduleInitCanvas();
                return;
            }

            if (!viewportState.isPanning) return;
            const dx = e.clientX - viewportState.startX;
            const dy = e.clientY - viewportState.startY;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            viewportState.offsetX += dx;
            viewportState.offsetY += dy;
            scheduleInitCanvas();
        });

        window.addEventListener('mouseup', () => {
            canvasState.cancelScheduledFrame(viewportState);

            let shouldRender = false;
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const draggedId = viewportState.dragNodeId;
                const moved = viewportState.dragMoved;
                viewportState.isDraggingNode = false;
                viewportState.dragNodeId = null;
                viewportState.dragMoved = false;
                const draggedEl = document.querySelector(`.memory-node[data-memory-id="${draggedId}"]`);
                if (draggedEl && moved) {
                    draggedEl.dataset.suppressClick = '1';
                    draggedEl.style.cursor = 'grab';
                    shouldRender = true;
                    if (window.LoveBudUI?.showToast) {
                        window.LoveBudUI.showToast(i18n('node_position_adjusted') || '순간 위치를 조정했습니다', 'success', 1800);
                    }
                }
            }

            if (viewportState.isPanning) {
                shouldRender = true;
            }
            viewportState.isPanning = false;
            canvas.classList.remove('panning');
            canvas.style.cursor = 'grab';
            if (shouldRender) {
                persistStoredPositions();
                initCanvas();
            }
        });
    };

    function scheduleInitCanvas() {
        canvasState.scheduleRender(viewportState, initCanvas);
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
