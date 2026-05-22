(function() {
    /**
     * Clears all memory nodes and empty tree messages from the canvas.
     */
    function clearCanvasNodes(canvas) {
        if (!canvas) return;
        canvas.querySelectorAll('.memory-node').forEach((node) => node.remove());
        canvas.querySelectorAll('#emptyTreeMessage').forEach((el) => el.remove());
    }

    /**
     * Clears the growth affordance and branch ports.
     */
    function clearGrowthAffordances(growthAffordance, branchPorts) {
        if (growthAffordance && typeof growthAffordance.clearGrowthAffordance === 'function') {
            growthAffordance.clearGrowthAffordance();
        }
        if (branchPorts && typeof branchPorts.clearPorts === 'function') {
            branchPorts.clearPorts();
        }
    }

    /**
     * Renders the growth affordance and branch ports for a specific memory.
     */
    function renderAffordancesForMemory(mem, deps) {
        if (!mem) return;
        const {
            growthAffordance,
            branchPorts,
            getTreeMemories,
            canonicalRootId,
            isRootMemory
        } = deps;

        const drawableMemories = getTreeMemories().filter((node) => !isRootMemory(node, canonicalRootId));
        
        clearGrowthAffordances(growthAffordance, branchPorts);

        if (growthAffordance && typeof growthAffordance.renderGrowthAffordance === 'function') {
            growthAffordance.renderGrowthAffordance(mem, {
                isFirstStep: drawableMemories.length <= 1,
                isStartMoment: mem.parentId === canonicalRootId
            });
        }

        if (branchPorts) {
            if (typeof branchPorts.renderPortsForNode === 'function') {
                branchPorts.renderPortsForNode(mem);
            }
            if (typeof branchPorts.showPortsForMemory === 'function') {
                branchPorts.showPortsForMemory(mem);
            }
        }
    }

    /**
     * Creates a node element by delegating to canvasNode.
     */
    function createNodeElement(mem, pos, canvasNode, options) {
        if (!canvasNode || typeof canvasNode.createNodeElement !== 'function') {
            throw new Error("LoveBudEditorCanvasNode.createNodeElement is required");
        }
        return canvasNode.createNodeElement(mem, pos, options);
    }

    /**
     * Attaches node info to the element and appends it to the canvas.
     */
    function attachNodeInfo(canvas, nodeEl, mem, canvasNode) {
        if (canvasNode && typeof canvasNode.appendNodeInfo === 'function') {
            canvasNode.appendNodeInfo(nodeEl, mem);
        }
        if (canvas) {
            canvas.appendChild(nodeEl);
        }
    }

    window.LoveBudEditorCanvasRenderer = {
        clearCanvasNodes,
        clearGrowthAffordances,
        renderAffordancesForMemory,
        createNodeElement,
        attachNodeInfo
    };
})();
