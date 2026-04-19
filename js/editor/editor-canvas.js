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

    const viewportState = {
        offsetX: 0,
        offsetY: 0,
        initialized: false,
        isPanning: false,
        startX: 0,
        startY: 0
    };

    const ROOT_X = Math.max(460, Math.round(canvas.clientWidth * 0.42));
    const ROOT_Y = Math.max(420, Math.round(canvas.clientHeight * 0.52));
    const RADIUS_L1 = 320;
    const RADIUS_L2 = 250;
    const NODE_WIDTH = 108;
    const MIN_ANGLE_GAP = 40;

    const FIXED_ANGLES = {
        v1: -60,
        v2: -130,
        v3: 10,
        m2: 130,
        m3: -170,
        m4: 70
    };

    const distributeAngles = (count, baseAngle = -90) => {
        if (count <= 0) return [baseAngle];
        if (count === 1) return [baseAngle];

        const safeCount = Math.max(count - 1, 1);
        const totalSpread = Math.min(300, Math.max(110, safeCount * MIN_ANGLE_GAP));
        const startAngle = baseAngle - totalSpread / 2;

        return Array.from({ length: count }, (_, i) => {
            const ratio = count === 1 ? 0.5 : i / (count - 1);
            return startAngle + totalSpread * ratio;
        });
    };

    const calcPosition = (mem, visited = new Set()) => {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();

        if (isRootMemory(mem, canonicalRootId)) {
            return { x: ROOT_X, y: ROOT_Y };
        }

        if (visited.has(mem.id)) {
            console.warn(`Cycle detected at memory ${mem.id}, falling back to root`);
            return { x: ROOT_X, y: ROOT_Y };
        }
        visited.add(mem.id);

        const parentId = mem.parentId || canonicalRootId;
        if (parentId === mem.id) {
            console.warn(`Self-reference detected for ${mem.id}, using root as parent`);
            return { x: ROOT_X, y: ROOT_Y };
        }

        const siblings = treeMemories.filter((m) => (
            m.parentId === parentId && !isRootMemory(m, canonicalRootId)
        ));
        const idx = siblings.findIndex((m) => m.id === mem.id);
        const count = siblings.length;

        if (parentId === canonicalRootId) {
            let angle;

            if (FIXED_ANGLES[mem.id] !== undefined) {
                angle = FIXED_ANGLES[mem.id];
            } else if (count > 0) {
                const angles = distributeAngles(count, -20);
                angle = angles[idx] !== undefined ? angles[idx] : angles[0];
            } else {
                angle = -20;
            }

            return {
                x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
            };
        }

        const parent = treeMemories.find((m) => m.id === parentId);
        const parentPos = parent ? calcPosition(parent, visited) : { x: ROOT_X, y: ROOT_Y };

        let angle;
        if (count > 0) {
            const angles = distributeAngles(count, 0);
            angle = angles[idx] !== undefined ? angles[idx] : (idx / count) * 360;
        } else {
            angle = 0;
        }

        return {
            x: parentPos.x + RADIUS_L2 * Math.cos(angle * Math.PI / 180),
            y: parentPos.y + RADIUS_L2 * Math.sin(angle * Math.PI / 180)
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

    const drawNode = (mem) => {
        const existingNode = document.querySelector(`.memory-node[data-memory-id="${mem.id}"]`);
        if (existingNode) {
            console.log('[editor] Node already exists, skipping:', mem.id);
            return existingNode;
        }

        const pos = calcPosition(mem);
        const nodeHalf = Math.round(NODE_WIDTH / 2);
        const nodeEl = document.createElement('div');
        nodeEl.className = 'memory-node floating-node';
        nodeEl.dataset.memoryId = mem.id;
        nodeEl.style.left = `${pos.x - nodeHalf}px`;
        nodeEl.style.top = `${pos.y - nodeHalf}px`;
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
        nodeEl.addEventListener('click', () => onNodeClick(nodeEl, mem));
        canvas.appendChild(nodeEl);

        return nodeEl;
    };

    const initCanvas = () => {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();

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
            const selectedMem = createInitialMemory();
            if (selectedMem) {
                updateDetailPanel(selectedMem);
            }
        }
    };

    const bindCanvasPan = ({ getSelectedNodeId, selectNodeById }) => {
        canvas.addEventListener('mousedown', (e) => {
            if (e.target.closest('.memory-node') || e.target.closest('#addMemoryForm')) return;
            viewportState.isPanning = true;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            canvas.classList.add('panning');
        });

        window.addEventListener('mousemove', (e) => {
            if (!viewportState.isPanning) return;
            const dx = e.clientX - viewportState.startX;
            const dy = e.clientY - viewportState.startY;
            viewportState.startX = e.clientX;
            viewportState.startY = e.clientY;
            viewportState.offsetX += dx;
            viewportState.offsetY += dy;
            initCanvas();
            selectNodeById(getSelectedNodeId());
        });

        window.addEventListener('mouseup', () => {
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
        viewportState
    };
}

window.createEditorCanvas = createEditorCanvas;
