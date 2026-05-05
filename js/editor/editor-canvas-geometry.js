(function () {
    const ROOT_RIGHT_GUTTER = 300;
    const ROOT_BOTTOM_GUTTER = 180;
    const NODE_WIDTH = 108;
    const NODE_HALF = Math.round(NODE_WIDTH / 2);
    const AFFORDANCE_OFFSET_X = 168;
    const AFFORDANCE_OFFSET_Y = 10;
    const AFFORDANCE_CARD_HALF = 108;

    function getMetrics(canvas) {
        return {
            width: Math.max(canvas.clientWidth || 0, 720),
            height: Math.max(canvas.clientHeight || 0, 520)
        };
    }

    function getRootBasePosition(metrics) {
        return {
            x: Math.max(360, Math.min(Math.round(metrics.width * 0.42), metrics.width - ROOT_RIGHT_GUTTER)),
            y: Math.max(260, Math.min(Math.round(metrics.height * 0.48), metrics.height - ROOT_BOTTOM_GUTTER))
        };
    }

    function getRadiusL1(metrics) {
        return Math.max(180, Math.min(250, Math.round(metrics.width * 0.20)));
    }

    function getRadiusL2(metrics) {
        return Math.max(130, Math.min(190, Math.round(metrics.width * 0.14)));
    }

    function distributeAngles(count, baseAngle = -10) {
        if (count <= 0) return [baseAngle];
        if (count === 1) return [baseAngle];
        const totalSpread = Math.min(220, Math.max(90, (count - 1) * 36));
        const startAngle = baseAngle - totalSpread / 2;
        return Array.from({ length: count }, (_, i) => startAngle + (totalSpread * i / (count - 1)));
    }

    function getWorldPosition(mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot) {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const readMetrics = typeof getMetricsSnapshot === 'function'
            ? getMetricsSnapshot
            : () => getMetrics({ clientWidth: 0, clientHeight: 0 });

        function recurse(node, visited = new Set()) {
            const metrics = readMetrics();
            if (!node) {
                return getRootBasePosition(metrics);
            }

            if (viewportState.positions[node.id]) {
                return {
                    x: Number(viewportState.positions[node.id].x) || 0,
                    y: Number(viewportState.positions[node.id].y) || 0
                };
            }

            if (isRootMemory(node, canonicalRootId)) {
                return getRootBasePosition(metrics);
            }

            if (visited.has(node.id)) {
                return getRootBasePosition(metrics);
            }
            visited.add(node.id);

            const parentId = node.parentId || canonicalRootId;
            const siblings = treeMemories.filter((memory) => (
                (memory.parentId || canonicalRootId) === parentId && !isRootMemory(memory, canonicalRootId)
            ));
            const idx = Math.max(0, siblings.findIndex((memory) => memory.id === node.id));
            const count = Math.max(1, siblings.length);

            if (parentId === canonicalRootId) {
                const angles = distributeAngles(count, -10);
                const angle = angles[idx] !== undefined ? angles[idx] : -10;
                const rootBase = getRootBasePosition(metrics);
                const radius = getRadiusL1(metrics);
                return {
                    x: rootBase.x + radius * Math.cos(angle * Math.PI / 180),
                    y: rootBase.y + radius * Math.sin(angle * Math.PI / 180)
                };
            }

            const parent = treeMemories.find((memory) => memory.id === parentId);
            const parentPos = parent ? recurse(parent, visited) : getRootBasePosition(metrics);
            const childAngles = distributeAngles(count, 0);
            const childAngle = childAngles[idx] !== undefined ? childAngles[idx] : 0;
            const radius = getRadiusL2(metrics);

            return {
                x: parentPos.x + radius * Math.cos(childAngle * Math.PI / 180),
                y: parentPos.y + radius * Math.sin(childAngle * Math.PI / 180)
            };
        }

        return recurse(mem);
    }

    function calcPosition(mem, viewportState, getWorldPosFn) {
        const world = getWorldPosFn(mem);
        return { x: world.x + viewportState.offsetX, y: world.y + viewportState.offsetY };
    }

    window.EditorCanvasGeometry = {
        ROOT_RIGHT_GUTTER,
        ROOT_BOTTOM_GUTTER,
        NODE_WIDTH,
        NODE_HALF,
        AFFORDANCE_OFFSET_X,
        AFFORDANCE_OFFSET_Y,
        AFFORDANCE_CARD_HALF,
        getMetrics,
        getRootBasePosition,
        getRadiusL1,
        getRadiusL2,
        distributeAngles,
        getWorldPosition,
        calcPosition
    };
})();
