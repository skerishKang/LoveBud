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
        onNodeClick
    } = deps;

    const treeId = (window.currentTreeData && window.currentTreeData.id)
        || new URLSearchParams(window.location.search).get('treeId')
        || 'default';
    const layoutStorageKey = 'lovebud_tree_layout_' + treeId;

    const viewportState = {
        offsetX: 0,
        offsetY: 0,
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
        positions: loadStoredPositions()
    };

    const ROOT_RIGHT_GUTTER = 260;
    const ROOT_BOTTOM_GUTTER = 180;
    const NODE_WIDTH = 108;
    const NODE_HALF = Math.round(NODE_WIDTH / 2);

    function loadStoredPositions() {
        try {
            const raw = localStorage.getItem(layoutStorageKey);
            if (!raw || raw === 'null') return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function persistStoredPositions() {
        try {
            localStorage.setItem(layoutStorageKey, JSON.stringify(viewportState.positions));
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
            x: Math.max(260, Math.min(Math.round(metrics.width * 0.32), metrics.width - ROOT_RIGHT_GUTTER)),
            y: Math.max(240, Math.min(Math.round(metrics.height * 0.48), metrics.height - ROOT_BOTTOM_GUTTER))
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

    const drawBranch = (startPos, endPos) => {
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
        nodeEl.addEventListener('mousedown', (e) => {
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

    const drawNode = (mem) => {
        const pos = calcPosition(mem);
        const nodeEl = document.createElement('div');
        nodeEl.className = 'memory-node floating-node';
        nodeEl.dataset.memoryId = mem.id;
        nodeEl.style.left = `${pos.x - NODE_HALF}px`;
        nodeEl.style.top = `${pos.y - NODE_HALF}px`;
        nodeEl.style.animationDelay = mem.delay || '0s';

        const card = document.createElement('div');
        card.className = 'node-card';

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'node-img-wrapper';
        imgWrapper.style.position = 'relative';

        const skeleton = document.createElement('div');
        skeleton.className = 'node-skeleton';
        imgWrapper.appendChild(skeleton);

        const img = document.createElement('img');
        img.src = resolveMemoryThumbnail(mem);
        img.alt = mem.title || '';

        img.onload = () => {
            img.classList.add('loaded');
            skeleton.style.display = 'none';
        };

        img.onerror = () => {
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
        };

        if (img.complete) {
            img.classList.add('loaded');
            skeleton.style.display = 'none';
        }

        imgWrapper.appendChild(img);
        card.appendChild(imgWrapper);

        const infoLabel = document.createElement('div');
        infoLabel.className = 'node-info-label';

        const titleEl = document.createElement('p');
        titleEl.className = 'node-title';
        titleEl.textContent = mem.title || '';

        const dateEl = document.createElement('p');
        dateEl.className = 'node-date';
        dateEl.textContent = mem.timestamp || '';

        infoLabel.appendChild(titleEl);
        infoLabel.appendChild(dateEl);
        nodeEl.appendChild(card);
        nodeEl.appendChild(infoLabel);
        bindNodeDrag(nodeEl, mem);
        canvas.appendChild(nodeEl);

        return nodeEl;
    };

    function reapplySelection(selectedNodeId) {
        if (!selectedNodeId) return;
        const selectedEl = document.querySelector(`.memory-node[data-memory-id="${selectedNodeId}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
    }

    const initCanvas = () => {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const selectedNodeId = document.querySelector('.memory-node.selected')?.dataset?.memoryId || null;

        canvas.querySelectorAll('.memory-node').forEach((node) => node.remove());
        canvas.querySelectorAll('#emptyTreeMessage').forEach((el) => el.remove());
        svg.querySelectorAll('.branch-line').forEach((line) => line.remove());

        const hasMoments = treeMemories.length > 0;
        setDetailEmptyState(!hasMoments);
        updateFocusSelectedBtn();

        treeMemories.forEach((node) => {
            if (isRootMemory(node, canonicalRootId)) return;
            drawNode(node);
            const parentId = node.parentId || canonicalRootId;
            const parent = treeMemories.find((m) => m.id === parentId);
            if (parent) {
                drawBranch(calcPosition(parent), calcPosition(node));
            }
        });

        if (hasMoments) {
            const selectedMem = selectedNodeId
                ? treeMemories.find((m) => m.id === selectedNodeId)
                : createInitialMemory();
            if (selectedMem) {
                updateDetailPanel(selectedMem);
                reapplySelection(selectedMem.id);
            }
        }

        bindCanvasPan();
        bindViewportControls();
        viewportState.initialized = true;
    };

    function focusNodeById(nodeId) {
        if (!nodeId) return;
        const treeMemories = getTreeMemories();
        const target = treeMemories.find((m) => m.id === nodeId);
        if (!target) return;

        const world = getWorldPosition(target);
        const metrics = getMetrics();
        viewportState.offsetX = Math.round(metrics.width * 0.45 - world.x);
        viewportState.offsetY = Math.round(metrics.height * 0.42 - world.y);
        initCanvas();
        reapplySelection(nodeId);
    }

    function recenterViewport() {
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

        viewportState.offsetX = Math.round(metrics.width * 0.45 - ((minX + maxX) / 2));
        viewportState.offsetY = Math.round(metrics.height * 0.42 - ((minY + maxY) / 2));
        initCanvas();
    }

    function bindViewportControls() {
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
        if (viewportState.globalsBound) return;
        viewportState.globalsBound = true;

        canvas.addEventListener('mousedown', (e) => {
            if (e.target.closest('.memory-node') || e.target.closest('#addMemoryForm')) return;
            viewportState.isPanning = true;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            canvas.classList.add('panning');
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
                persistStoredPositions();
                initCanvas();
                reapplySelection(viewportState.dragNodeId);
                return;
            }

            if (!viewportState.isPanning) return;
            const dx = e.clientX - viewportState.startX;
            const dy = e.clientY - viewportState.startY;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            viewportState.offsetX += dx;
            viewportState.offsetY += dy;
            initCanvas();
        });

        window.addEventListener('mouseup', () => {
            if (viewportState.isDraggingNode && viewportState.dragNodeId) {
                const draggedId = viewportState.dragNodeId;
                const moved = viewportState.dragMoved;
                viewportState.isDraggingNode = false;
                viewportState.dragNodeId = null;
                viewportState.dragMoved = false;
                const draggedEl = document.querySelector(`.memory-node[data-memory-id="${draggedId}"]`);
                if (draggedEl && moved) {
                    draggedEl.dataset.suppressClick = '1';
                    if (window.LoveBudUI?.showToast) {
                        window.LoveBudUI.showToast('순간 위치를 조정했습니다', 'success', 1800);
                    }
                }
            }

            viewportState.isPanning = false;
            canvas.classList.remove('panning');
        });
    };

    return {
        calcPosition,
        drawBranch,
        drawNode,
        initCanvas,
        bindCanvasPan,
        viewportState,
        focusNodeById,
        recenterViewport
    };
}

function injectEditorRenameButton() {
    if (document.getElementById('renameTreeBtn')) return;
    const statusSection = document.querySelector('.editor-status-section');
    const actions = document.querySelector('.editor-sidebar-actions');
    if (!statusSection || !actions) return;

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.id = 'renameTreeBtn';
    renameBtn.className = 'sidebar-btn';
    renameBtn.innerHTML = '<span class="btn-icon">✎</span><span class="btn-label">트리 제목 변경</span>';

    renameBtn.addEventListener('click', async () => {
        const currentTree = window.currentTreeData || {};
        const treeId = currentTree.id || new URLSearchParams(window.location.search).get('treeId');
        if (!treeId) {
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast('트리 정보를 찾을 수 없습니다', 'error', 2500);
            }
            return;
        }

        const currentTitle = currentTree.title || '러브트리';
        const nextTitle = window.prompt('새 트리 제목을 입력해 주세요.', currentTitle);
        if (nextTitle === null) return;
        const trimmed = String(nextTitle || '').trim();
        if (!trimmed || trimmed === currentTitle) return;

        try {
            if (window.apiClient && typeof window.apiClient.updateTree === 'function') {
                await window.apiClient.updateTree(treeId, { title: trimmed });
            }
            window.currentTreeData = {
                ...currentTree,
                title: trimmed
            };
            const titleEl = document.getElementById('sidebarTreeTitle');
            if (titleEl) titleEl.textContent = trimmed;
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast('트리 제목을 변경했습니다', 'success', 2200);
            }
        } catch (error) {
            console.error('[editor] rename tree failed:', error);
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast('트리 제목 변경에 실패했습니다', 'error', 2600);
            }
        }
    });

    actions.insertAdjacentElement('afterend', renameBtn);

    const hintEl = document.getElementById('sidebarSelectionHint');
    if (hintEl && hintEl.textContent && !hintEl.textContent.includes('드래그')) {
        hintEl.textContent += ' · 빈 공간 드래그로 화면 이동, 순간 드래그로 위치 조정';
    }
}

window.createEditorCanvas = createEditorCanvas;
document.addEventListener('DOMContentLoaded', injectEditorRenameButton);
