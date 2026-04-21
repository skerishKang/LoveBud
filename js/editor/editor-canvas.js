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

    const ROOT_RIGHT_GUTTER = 300;
    const ROOT_BOTTOM_GUTTER = 180;
    const NODE_WIDTH = 108;
    const NODE_HALF = Math.round(NODE_WIDTH / 2);
    const AFFORDANCE_OFFSET_X = 168;
    const AFFORDANCE_OFFSET_Y = 10;
    const AFFORDANCE_CARD_HALF = 108;

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

    function getMetrics() {
        return {
            width: Math.max(canvas.clientWidth || 0, 720),
            height: Math.max(canvas.clientHeight || 0, 520)
        };
    }

    function getRootBasePosition() {
        const metrics = getMetrics();
        return {
            x: Math.max(360, Math.min(Math.round(metrics.width * 0.42), metrics.width - ROOT_RIGHT_GUTTER)),
            y: Math.max(260, Math.min(Math.round(metrics.height * 0.48), metrics.height - ROOT_BOTTOM_GUTTER))
        };
    }

    function getRadiusL1() {
        const metrics = getMetrics();
        return Math.max(180, Math.min(250, Math.round(metrics.width * 0.20)));
    }

    function getRadiusL2() {
        const metrics = getMetrics();
        return Math.max(130, Math.min(190, Math.round(metrics.width * 0.14)));
    }

    function distributeAngles(count, baseAngle = -10) {
        if (count <= 0) return [baseAngle];
        if (count === 1) return [baseAngle];

        const totalSpread = Math.min(220, Math.max(90, (count - 1) * 36));
        const startAngle = baseAngle - totalSpread / 2;

        return Array.from({ length: count }, (_, i) => {
            return startAngle + (totalSpread * i / (count - 1));
        });
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
            return {
                x: rootBase.x + radius * Math.cos(angle * Math.PI / 180),
                y: rootBase.y + radius * Math.sin(angle * Math.PI / 180)
            };
        }

        const parent = treeMemories.find((m) => m.id === parentId);
        const parentPos = parent ? getWorldPosition(parent, visited) : getRootBasePosition();
        const childAngles = distributeAngles(count, 0);
        const childAngle = childAngles[idx] !== undefined ? childAngles[idx] : 0;
        const radius = getRadiusL2();

        return {
            x: parentPos.x + radius * Math.cos(childAngle * Math.PI / 180),
            y: parentPos.y + radius * Math.sin(childAngle * Math.PI / 180)
        };
    }

    const calcPosition = (mem) => {
        const world = getWorldPosition(mem);
        return {
            x: world.x + viewportState.offsetX,
            y: world.y + viewportState.offsetY
        };
    };

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

    const drawBranch = (startPos, endPos) => {
        if (typeof canvasViewport.drawBranch === 'function') {
            canvasViewport.drawBranch(svg, startPos, endPos);
            return;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
        const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
        path.setAttribute('d', d);
        path.setAttribute('class', 'branch-line');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--secondary)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('opacity', '0.5');
        svg.appendChild(path);
    };

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
        canvas.querySelectorAll('.memory-add-affordance').forEach((el) => el.remove());
        svg.querySelectorAll('.branch-line-affordance').forEach((el) => el.remove());
    }

    function openAddMomentFromCanvas() {
        if (typeof openAddMoment === 'function') {
            openAddMoment();
            return;
        }

        const addBtn = document.getElementById('addMemoryBtn');
        if (addBtn) {
            addBtn.click();
        }
    }

    function getGrowthAffordancePosition(anchorPos) {
        const metrics = getMetrics();
        const edgePadding = 28;
        const minCenterX = AFFORDANCE_CARD_HALF + edgePadding;
        const maxCenterX = metrics.width - AFFORDANCE_CARD_HALF - edgePadding;
        const hasRightRoom = anchorPos.x + NODE_HALF + AFFORDANCE_CARD_HALF + edgePadding <= metrics.width;
        const hasLeftRoom = anchorPos.x - NODE_HALF - AFFORDANCE_CARD_HALF - edgePadding >= 0;
        const shouldPlaceLeft = !hasRightRoom && hasLeftRoom;

        return {
            x: Math.max(
                minCenterX,
                Math.min(
                    shouldPlaceLeft ? anchorPos.x - AFFORDANCE_OFFSET_X : anchorPos.x + AFFORDANCE_OFFSET_X,
                    maxCenterX
                )
            ),
            y: Math.max(110, Math.min(anchorPos.y - AFFORDANCE_OFFSET_Y, metrics.height - 80)),
            side: shouldPlaceLeft ? 'left' : 'right'
        };
    }

    function drawGrowthAffordanceBranch(startPos, endPos, side) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const tension = side === 'left' ? 0.55 : 0.45;
        const cp1x = startPos.x + ((endPos.x - startPos.x) * tension);
        const cp1y = Math.min(startPos.y, endPos.y) - 18;
        const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${cp1y} ${endPos.x},${endPos.y}`;
        path.setAttribute('d', d);
        path.setAttribute('class', 'branch-line branch-line-affordance');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(144, 73, 81, 0.42)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-dasharray', '6 7');
        path.setAttribute('opacity', '0.95');
        svg.appendChild(path);
    }

    function createGrowthAffordanceElement(anchorMem, labelText, helperText) {
        const anchorPos = calcPosition(anchorMem);
        const affPos = getGrowthAffordancePosition(anchorPos);
        const wrap = document.createElement('button');
        wrap.type = 'button';
        wrap.className = 'memory-add-affordance';
        wrap.setAttribute('aria-label', labelText);
        wrap.style.position = 'absolute';
        wrap.style.left = `${affPos.x - AFFORDANCE_CARD_HALF}px`;
        wrap.style.top = `${affPos.y - 30}px`;
        wrap.style.zIndex = '4';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';
        wrap.style.padding = '10px 14px 10px 10px';
        wrap.style.border = '1px solid rgba(144, 73, 81, 0.18)';
        wrap.style.borderRadius = '999px';
        wrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,246,244,0.96))';
        wrap.style.boxShadow = '0 12px 28px rgba(75, 64, 57, 0.10)';
        wrap.style.cursor = 'pointer';
        wrap.style.backdropFilter = 'blur(8px)';
        wrap.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease';

        const plusBubble = document.createElement('span');
        plusBubble.textContent = '+';
        plusBubble.style.width = '32px';
        plusBubble.style.height = '32px';
        plusBubble.style.borderRadius = '50%';
        plusBubble.style.display = 'inline-flex';
        plusBubble.style.alignItems = 'center';
        plusBubble.style.justifyContent = 'center';
        plusBubble.style.background = 'linear-gradient(180deg, rgba(144, 73, 81, 1), rgba(144, 73, 81, 0.88))';
        plusBubble.style.color = '#fff';
        plusBubble.style.fontSize = '18px';
        plusBubble.style.fontWeight = '700';
        plusBubble.style.flex = '0 0 auto';
        plusBubble.style.boxShadow = '0 6px 14px rgba(144, 73, 81, 0.22)';

        const textWrap = document.createElement('span');
        textWrap.style.display = 'flex';
        textWrap.style.flexDirection = 'column';
        textWrap.style.alignItems = 'flex-start';
        textWrap.style.gap = helperText ? '1px' : '0';

        const titleEl = document.createElement('span');
        titleEl.textContent = labelText;
        titleEl.style.fontSize = '13px';
        titleEl.style.fontWeight = '700';
        titleEl.style.color = 'var(--on-surface)';
        titleEl.style.lineHeight = '1.25';

        textWrap.appendChild(titleEl);

        if (helperText) {
            const hintEl = document.createElement('span');
            hintEl.textContent = helperText;
            hintEl.style.fontSize = '11px';
            hintEl.style.fontWeight = '600';
            hintEl.style.color = 'var(--on-surface-variant)';
            hintEl.style.lineHeight = '1.25';
            hintEl.style.opacity = '0.82';
            textWrap.appendChild(hintEl);
        }

        wrap.appendChild(plusBubble);
        wrap.appendChild(textWrap);

        wrap.addEventListener('mouseenter', () => {
            wrap.style.transform = 'translateY(-2px)';
            wrap.style.boxShadow = '0 16px 30px rgba(144, 73, 81, 0.16)';
        });
        wrap.addEventListener('mouseleave', () => {
            wrap.style.transform = 'translateY(0)';
            wrap.style.boxShadow = '0 12px 28px rgba(75, 64, 57, 0.10)';
        });
        wrap.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddMomentFromCanvas();
        });

        drawGrowthAffordanceBranch(
            {
                x: anchorPos.x + (affPos.side === 'left' ? (-NODE_HALF + 2) : (NODE_HALF - 2)),
                y: anchorPos.y + 4
            },
            {
                x: affPos.x + (affPos.side === 'left' ? 72 : -72),
                y: affPos.y
            },
            affPos.side
        );
        canvas.appendChild(wrap);
    }

    function renderGrowthAffordance(anchorMem, options) {
        if (!anchorMem) return;
        const opts = options || {};
        const labelText = opts.labelText || (i18n('editor_add_memory') || '새 순간 이어가기');
        const helperText = opts.isFirstStep
            ? ''
            : (opts.helperText || i18n('growth_continue_hint') || '선택한 순간 뒤로 감정이 이어져요');

        createGrowthAffordanceElement(anchorMem, labelText, helperText);
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
            const currentFrame = viewportState.rafFrame;
            if (currentFrame) {
                cancelAnimationFrame(currentFrame);
                viewportState.rafFrame = null;
                viewportState.rafScheduled = false;
            }

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
                    if (window.LoveBudUI?.showToast) {
                        window.LoveBudUI.showToast(i18n('node_position_adjusted') || '순간 위치를 조정했습니다', 'success', 1800);
                    }
                }
            }

            viewportState.isPanning = false;
            canvas.classList.remove('panning');
            canvas.style.cursor = 'grab';
            persistStoredPositions();
            initCanvas();
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
