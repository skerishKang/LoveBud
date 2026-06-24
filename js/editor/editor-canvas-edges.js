(function () {
    function isConnectionEditAllowed(canEdit) {
        if (canEdit === false) return false;
        var mode = window.LoveBudEditorInteractionMode;
        return !!mode &&
            typeof mode.isEditMode === 'function' &&
            mode.isEditMode();
    }

    function createEditorCanvasEdges(options) {
        const {
            svg,
            canvasViewport = {},
            canEdit
        } = options || {};

        const NODE_HALF = 54;
        const CLEARANCE = NODE_HALF * 0.6;

        let selectedEdgeChildId = null;
        let onSelectEdge = null;

        const clearBranches = () => {
            svg.querySelectorAll('.branch-line').forEach((line) => line.remove());
        };

        function computeAutoRoute(startPos, endPos) {
            var dx = endPos.x - startPos.x;
            var dy = endPos.y - startPos.y;
            var absDx = Math.abs(dx);
            var absDy = Math.abs(dy);

            var srcDirX = 0, srcDirY = 0;
            if (absDx > absDy) {
                srcDirX = dx > 0 ? 1 : -1;
                srcDirY = 0;
            } else {
                srcDirX = 0;
                srcDirY = dy > 0 ? 1 : -1;
            }

            var tgtDirX = -srcDirX;
            var tgtDirY = -srcDirY;

            var cp1x = startPos.x + srcDirX * CLEARANCE;
            var cp1y = startPos.y + srcDirY * CLEARANCE;
            var cp2x = endPos.x + tgtDirX * CLEARANCE;
            var cp2y = endPos.y + tgtDirY * CLEARANCE;

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

        const drawBranch = (startPos, endPos, routeInfo) => {
            if (typeof canvasViewport.drawBranch === 'function') {
                return canvasViewport.drawBranch(svg, startPos, endPos);
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
            return path;
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

            if (parent && parent.id !== canonicalRootId) {
                var path = drawBranch(calcPosition(parent), calcPosition(node));
                if (!path) return;
                path.setAttribute('data-edge-child-id', String(node.id));

                path.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var childId = this.getAttribute('data-edge-child-id');
                    if (!childId) return;
                    if (!isConnectionEditAllowed(canEdit)) return;
                    if (typeof onSelectEdge === 'function') {
                        onSelectEdge(childId, this);
                    }
                });
            }
        };

        function selectEdge(childId) {
            clearSelection();
            selectedEdgeChildId = childId;
            svg.querySelectorAll('.branch-line').forEach(function (p) {
                if (p.getAttribute('data-edge-child-id') === childId) {
                    p.classList.add('is-selected');
                }
            });
        }

        function clearSelection() {
            selectedEdgeChildId = null;
            svg.querySelectorAll('.branch-line.is-selected').forEach(function (p) {
                p.classList.remove('is-selected');
            });
        }

        function getSelectedEdgeChildId() {
            return selectedEdgeChildId;
        }

        function setOnSelectEdge(fn) {
            onSelectEdge = fn;
        }

        return {
            clearBranches,
            drawBranch,
            drawBranchForMemory,
            selectEdge,
            clearSelection,
            getSelectedEdgeChildId,
            setOnSelectEdge
        };
    }

    window.createEditorCanvasEdges = createEditorCanvasEdges;
})();
