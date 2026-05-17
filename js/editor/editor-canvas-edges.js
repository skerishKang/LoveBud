(function () {
    function createEditorCanvasEdges(options) {
        const {
            svg,
            canvasViewport = {}
        } = options || {};

        const NODE_HALF = 54;
        const CLEARANCE = NODE_HALF * 0.6;

        const clearBranches = () => {
            svg.querySelectorAll('.branch-line').forEach((line) => line.remove());
        };

        /**
         * Compute auto-routing bezier curve between two node centers.
         * Determines best "exit" direction from each node to create
         * smooth, non-overlapping branch lines.
         */
        function computeAutoRoute(startPos, endPos) {
            var dx = endPos.x - startPos.x;
            var dy = endPos.y - startPos.y;
            var absDx = Math.abs(dx);
            var absDy = Math.abs(dy);

            // Determine exit direction from source node
            var srcDirX = 0, srcDirY = 0;
            if (absDx > absDy) {
                // Horizontal predominance
                srcDirX = dx > 0 ? 1 : -1;
                srcDirY = 0;
            } else {
                // Vertical predominance
                srcDirX = 0;
                srcDirY = dy > 0 ? 1 : -1;
            }

            // Determine approach direction to target node
            var tgtDirX = -srcDirX;
            var tgtDirY = -srcDirY;

            // Control points: exit from source, approach to target
            var cp1x = startPos.x + srcDirX * CLEARANCE;
            var cp1y = startPos.y + srcDirY * CLEARANCE;
            var cp2x = endPos.x + tgtDirX * CLEARANCE;
            var cp2y = endPos.y + tgtDirY * CLEARANCE;

            // If nodes are close, use a smoother blend
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < NODE_HALF * 3) {
                cp1x = startPos.x + dx * 0.35;
                cp1y = startPos.y + dy * 0.35;
                cp2x = endPos.x - dx * 0.35;
                cp2y = endPos.y - dy * 0.35;
            }

            return {
                d: 'M ' + startPos.x + ',' + startPos.y +
                    ' C ' + cp1x + ',' + cp1y + ' ' +
                    cp2x + ',' + cp2y + ' ' +
                    endPos.x + ',' + endPos.y,
                cp1x: cp1x, cp1y: cp1y,
                cp2x: cp2x, cp2y: cp2y
            };
        }

        /**
         * Draw a branch line with auto-routing.
         * If canvasViewport.drawBranch exists, delegates to it.
         * Otherwise uses cubic bezier auto-routing.
         */
        const drawBranch = (startPos, endPos, routeInfo) => {
            if (typeof canvasViewport.drawBranch === 'function') {
                canvasViewport.drawBranch(svg, startPos, endPos);
                return;
            }

            var route;
            if (routeInfo && routeInfo.d) {
                route = routeInfo;
            } else {
                route = computeAutoRoute(startPos, endPos);
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', route.d);
            path.setAttribute('class', 'branch-line');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'var(--secondary)');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('opacity', '0.5');
            svg.appendChild(path);
        };

        const drawBranchForMemory = (node, context) => {
            const {
                treeMemories = [],
                canonicalRootId,
                calcPosition
            } = context || {};

            if (!node || typeof calcPosition !== 'function') return;

            const parentId = node.parentId || canonicalRootId;
            const parent = treeMemories.find((memory) => memory.id === parentId);

            // Skip branch if parent is the hidden canonical root — prevents orphan
            // "tail" lines from invisible root to the first visible memory
            if (parent && parent.id !== canonicalRootId) {
                drawBranch(calcPosition(parent), calcPosition(node));
            }
        };

        return {
            clearBranches,
            drawBranch,
            drawBranchForMemory
        };
    }

    window.createEditorCanvasEdges = createEditorCanvasEdges;
})();
