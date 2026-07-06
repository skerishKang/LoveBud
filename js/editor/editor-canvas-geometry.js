(function () {
    const ROOT_RIGHT_GUTTER = 300;
    const ROOT_BOTTOM_GUTTER = 180;
    const NODE_WIDTH = 108;
    const NODE_HALF = Math.round(NODE_WIDTH / 2);
    const AFFORDANCE_OFFSET_X = 168;
    const AFFORDANCE_OFFSET_Y = 10;
    const AFFORDANCE_CARD_HALF = 108;

    /** Structured layout constants */
    const STRUCTURED_ROOT_Y_FRAC = 0.62;
    const STRUCTURED_VERTICAL_SPACING = 160;
    const STRUCTURED_SIBLING_SPACING = 120;
    const STRUCTURED_LEVEL_SPREAD = 1.4;

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

    function distributeAngles(count, baseAngle) {
        if (baseAngle === undefined) baseAngle = -10;
        if (count <= 0) return [baseAngle];
        if (count === 1) return [baseAngle];
        const totalSpread = Math.min(220, Math.max(90, (count - 1) * 36));
        const startAngle = baseAngle - totalSpread / 2;
        return Array.from({ length: count }, (_, i) => startAngle + (totalSpread * i / (count - 1)));
    }

    /**
     * Returns true only when the stored position has meaningful, non-zero
     * coordinates.  An object like {x:0, y:0} is truthy in JS but placing
     * every un-positioned node at world (0,0) causes them all to collapse
     * to the same screen point.
     */
    function hasValidStoredPosition(pos) {
        if (!pos) return false;
        var x = Number(pos.x);
        var y = Number(pos.y);
        return isFinite(x) && isFinite(y) && (x !== 0 || y !== 0);
    }

    function getWorldPosition(mem, viewportState, getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot) {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const readMetrics = typeof getMetricsSnapshot === 'function'
            ? getMetricsSnapshot
            : () => getMetrics({ clientWidth: 0, clientHeight: 0 });

        function recurse(node, visited) {
            if (visited === undefined) visited = new Set();
            const metrics = readMetrics();
            if (!node) {
                return getRootBasePosition(metrics);
            }

            // Only trust stored position when coords are genuinely non-zero.
            // A stored {x:0, y:0} is truthy but invalid — it causes every
            // un-positioned node to stack at the same screen location.
            if (hasValidStoredPosition(viewportState.positions[node.id])) {
                return {
                    x: Number(viewportState.positions[node.id].x),
                    y: Number(viewportState.positions[node.id].y)
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
            const siblings = treeMemories.filter(function(memory) {
                return (memory.parentId || canonicalRootId) === parentId && !isRootMemory(memory, canonicalRootId);
            });
            const idx = Math.max(0, siblings.findIndex(function(memory) { return memory.id === node.id; }));
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

            const parent = treeMemories.find(function(memory) { return memory.id === parentId; });
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

    /**
     * Structured layout: vertical tree hierarchy.
     * Root at bottom-center, children branching upward.
     * Ignores stored positions — pure topology-based layout.
     */
    function getStructuredWorldPosition(mem, getCanonicalRootId, getTreeMemories, isRootMemory, getMetricsSnapshot) {
        const canonicalRootId = getCanonicalRootId();
        const treeMemories = getTreeMemories();
        const readMetrics = typeof getMetricsSnapshot === 'function'
            ? getMetricsSnapshot
            : () => getMetrics({ clientWidth: 0, clientHeight: 0 });

        const rootMemory = treeMemories.find(function(m) { return isRootMemory(m, canonicalRootId); });

        // Checks if a parentId references a missing/unplaceable parent (rootless detection)
        function isAbsentParent(parentId) {
            if (!parentId || parentId === canonicalRootId) return true;
            return !treeMemories.some(function(m) { return m.id === parentId; });
        }

        function getDepth(node, visited) {
            if (visited === undefined) visited = new Set();
            if (!node) return 0;
            if (rootMemory && isRootMemory(node, canonicalRootId)) return 0;
            if (!rootMemory && isAbsentParent(node.parentId)) return 1; // Direct child of virtual root is at depth 1
            if (visited.has(node.id)) return 0;
            visited.add(node.id);
            const parentId = node.parentId || canonicalRootId;
            const parent = treeMemories.find(function(m) { return m.id === parentId; });
            return 1 + getDepth(parent, visited);
        }

        function getSubtreeWidth(node, visited) {
            if (visited === undefined) visited = new Set();
            if (!node) return 1;
            if (visited.has(node.id)) return 1;
            visited.add(node.id);
            const children = treeMemories.filter(function(m) {
                const pid = m.parentId || canonicalRootId;
                if (rootMemory) {
                    return pid === node.id && !isRootMemory(m, canonicalRootId);
                } else {
                    return pid === node.id;
                }
            });
            if (children.length === 0) return 1;
            return children.reduce(function(sum, child) { return sum + getSubtreeWidth(child, visited); }, 0);
        }

        function computePosition(node, depth, offsetX, parentWidth, siblingIdx, siblingCount, visited) {
            if (visited === undefined) visited = new Set();
            const metrics = readMetrics();
            if (!node || visited.has(node.id)) {
                return { x: metrics.width / 2, y: getRootY(metrics) };
            }
            visited.add(node.id);

            const isRoot = rootMemory && isRootMemory(node, canonicalRootId);
            const y = isRoot
                ? getRootY(metrics)
                : getRootY(metrics) - depth * STRUCTURED_VERTICAL_SPACING;

            let x;
            if (isRoot) {
                x = metrics.width / 2;
            } else {
                const slotWidth = parentWidth / siblingCount;
                x = offsetX + slotWidth * (siblingIdx + 0.5);
            }

            x = Math.max(NODE_WIDTH, Math.min(x, metrics.width - NODE_WIDTH));

            return { x: Math.round(x), y: Math.round(y) };
        }

        function getRootY(metrics) {
            return Math.round(Math.min(metrics.height * STRUCTURED_ROOT_Y_FRAC, metrics.height - ROOT_BOTTOM_GUTTER));
        }

        const structuredPositions = new Map();
        const allVisited = new Set();

        function placeSubtree(node, depth, offsetX, parentWidth, sIdx, sCount) {
            if (!node || allVisited.has(node.id)) return;
            allVisited.add(node.id);

            const pos = computePosition(node, depth, offsetX, parentWidth, sIdx, sCount);
            structuredPositions.set(node.id, pos);

            const children = treeMemories.filter(function(m) {
                const pid = m.parentId || canonicalRootId;
                if (rootMemory) {
                    return pid === node.id && !isRootMemory(m, canonicalRootId);
                } else {
                    return pid === node.id;
                }
            });

            if (children.length === 0) return;

            const totalSubWidth = children.reduce(function(sum, child) {
                return sum + getSubtreeWidth(child, new Set());
            }, 0);

            let childOffsetX = pos.x - (totalSubWidth * STRUCTURED_SIBLING_SPACING) / 2;
            children.forEach(function(child) {
                const childWidth = getSubtreeWidth(child, new Set());
                const childSlotWidth = childWidth * STRUCTURED_SIBLING_SPACING;
                placeSubtree(child, depth + 1, childOffsetX, childSlotWidth, 0, 1);
                childOffsetX += childSlotWidth;
            });
        }

        if (rootMemory) {
            // Rooted tree behavior preserved
            const rootPos = computePosition(rootMemory, 0, 0, 0, 0, 1);
            structuredPositions.set(rootMemory.id, rootPos);

            const rootChildren = treeMemories.filter(function(m) {
                const pid = m.parentId || canonicalRootId;
                return pid === rootMemory.id && !isRootMemory(m, canonicalRootId);
            });

            if (rootChildren.length > 0) {
                const totalWidth = rootChildren.reduce(function(sum, child) {
                    return sum + getSubtreeWidth(child, new Set());
                }, 0);
                let offsetX = rootPos.x - (totalWidth * STRUCTURED_SIBLING_SPACING) / 2;
                rootChildren.forEach(function(child) {
                    const childWidth = getSubtreeWidth(child, new Set());
                    const slotWidth = childWidth * STRUCTURED_SIBLING_SPACING;
                    placeSubtree(child, 1, offsetX, slotWidth, 0, 1);
                    offsetX += slotWidth;
                });
            }
        } else {
            // Rootless tree behavior: group virtual-root children
            const virtualRootChildren = treeMemories.filter(function(m) {
                return isAbsentParent(m.parentId);
            });

            if (virtualRootChildren.length > 0) {
                const metrics = readMetrics();
                const totalWidth = virtualRootChildren.reduce(function(sum, child) {
                    return sum + getSubtreeWidth(child, new Set());
                }, 0);
                // Center the entire structured layout based on virtual root children width
                const centerX = metrics.width / 2;
                let offsetX = centerX - (totalWidth * STRUCTURED_SIBLING_SPACING) / 2;
                virtualRootChildren.forEach(function(child) {
                    const childWidth = getSubtreeWidth(child, new Set());
                    const slotWidth = childWidth * STRUCTURED_SIBLING_SPACING;
                    placeSubtree(child, 1, offsetX, slotWidth, 0, 1);
                    offsetX += slotWidth;
                });
            }
        }

        if (structuredPositions.has(mem.id)) {
            return structuredPositions.get(mem.id);
        }

        const depth = getDepth(mem);
        const metrics = readMetrics();
        return {
            x: Math.round(metrics.width / 2),
            y: Math.round(getRootY(metrics) - depth * STRUCTURED_VERTICAL_SPACING)
        };
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
        getStructuredWorldPosition,
        calcPosition
    };
})();
