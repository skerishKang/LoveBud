import * as utils from './editor-canvas-utils.js';
import * as panzoomUtils from './editor-canvas-panzoom.js';
import * as selectionUtils from './editor-canvas-selection.js?v=20260628-2971-selector-safe-lookup-3';
import * as renderUtils from './editor-canvas-renderer.js';
import * as uiHelpers from './editor-canvas-ui-helpers.js?v=20260628-2971-selector-safe-lookup-3';

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
        openAddMoment,
        canEdit,
        onDisconnectEdge,
        onConnectTargetSelect
    } = deps;

    const i18n = window.t || function(key) { return key; };
    const treeId = (window.currentTreeData && window.currentTreeData.id)
        || new URLSearchParams(window.location.search).get('treeId')
        || 'default';
    const layoutStorageKey = 'lovebud_tree_layout_v2_' + treeId;
    const layoutModeStorageKey = 'lovebud_tree_layout_mode_' + treeId;
    // External Module Delegates (Legacy Global Dependencies)
    const canvasLayout = window.LoveBudEditorCanvasLayout || {};
    const canvasNode = window.LoveBudEditorCanvasNode || {};
    const canvasInteraction = window.LoveBudEditorCanvasInteraction || {};
    const canvasViewport = window.LoveBudEditorCanvasViewport || {};
    const canvasEdges = window.createEditorCanvasEdges({
        svg,
        canvasViewport,
        canEdit
    });

    let selectedEdgeChildId = null;

    canvasEdges.setOnSelectEdge(function(childId) {
        selectedEdgeChildId = childId;
        canvasEdges.selectEdge(childId);
        showEdgeDisconnectButton(childId);
    });

    function clearEdgeSelection() {
        selectedEdgeChildId = null;
        canvasEdges.clearSelection();
        hideEdgeDisconnectButton();
        clearPendingConnect();
    }

    function isConnectionEditAllowed() {
        if (canEdit === false) return false;
        var mode = window.LoveBudEditorInteractionMode;
        return !!mode &&
            typeof mode.isEditMode === 'function' &&
            mode.isEditMode();
    }

    function showEdgeDisconnectButton(childId) {
        if (!isConnectionEditAllowed()) return;
        hideEdgeDisconnectButton();
        var path = svg.querySelector('.branch-line[data-edge-child-id="' + String(childId).replace(/"/g, '\\"') + '"]');
        if (!path) return;
        try {
            var bbox = path.getBBox();
            var midX = bbox.x + bbox.width / 2;
            var midY = bbox.y + bbox.height / 2;
            var btn = document.createElement('button');
            btn.className = 'edge-disconnect-btn';
            btn.id = 'edgeDisconnectBtn';
            btn.setAttribute('aria-label', '연결 해제');
            btn.setAttribute('title', '연결 해제');
            btn.textContent = '\u2715';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                handleDisconnect();
            });
            canvas.appendChild(btn);
            btn.style.left = midX + 'px';
            btn.style.top = midY + 'px';
        } catch(e) {
            console.warn('[editor-canvas] Could not position edge disconnect button:', e);
        }
    }

    function hideEdgeDisconnectButton() {
        var btn = document.getElementById('edgeDisconnectBtn');
        if (btn) btn.remove();
    }

    async function handleDisconnect() {
        var childId = selectedEdgeChildId;
        if (!childId) return;
        if (!isConnectionEditAllowed()) return;

        if (!window.confirm('\uC774 \uC21C\uAC04\uC758 \uC5F0\uACB0\uC744 \uD574\uC81C\uD560\uAE4C\uC694?')) {
            return;
        }

        try {
            if (typeof onDisconnectEdge !== 'function') {
                console.error('[editor-canvas] onDisconnectEdge callback not available');
                return;
            }
            var result = await onDisconnectEdge(childId);
            if (result === true) {
                clearEdgeSelection();
            }
        } catch (error) {
            console.error('[editor-canvas] disconnect edge error:', error);
            clearEdgeSelection();
        }
    }

    const layoutStorage = window.LoveBudEditorCanvasLayoutStorage || {};
    const layoutTransition = window.LoveBudEditorCanvasLayoutTransition || {};

    let savedFreePositions = null;
    let storedFreePositions = null;
    let hoverAffordanceTimer = null;
    let hoverAffordanceMemoryId = null;

    const storageUtils = window.LoveBudEditorCanvasLayoutStorage || {};

    function loadStoredLayout() {
        if (typeof storageUtils.loadStoredLayout === 'function') {
            return storageUtils.loadStoredLayout(treeId, layoutStorageKey, canvasLayout, canEdit === false);
        }
    }

    function loadLayoutMode() {
        if (typeof storageUtils.loadLayoutMode === 'function') {
            return storageUtils.loadLayoutMode(layoutModeStorageKey, canEdit === false);
        }
    }

    function persistLayoutMode(mode) {
        if (canEdit === false) return;
        if (typeof storageUtils.persistLayoutMode === 'function') {
            return storageUtils.persistLayoutMode(mode, layoutModeStorageKey, canEdit);
        }
    }

    const storedLayout = loadStoredLayout();
    storedFreePositions = { ...(storedLayout.positions || {}) };

    const hasNonDefaultOffset = storedLayout.offsetX !== 0 || storedLayout.offsetY !== 0;
    const hasStoredViewportOffset = hasNonDefaultOffset || (storedLayout.scale !== undefined && storedLayout.scale !== 1);
    const viewportState = {
        offsetX: storedLayout.offsetX,
        offsetY: storedLayout.offsetY,
        scale: storedLayout.scale || 1,
        hasStoredViewportOffset: !!hasStoredViewportOffset,
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
        rafFrame: null,
        layoutMode: loadLayoutMode()
    };
    const { NODE_HALF, AFFORDANCE_OFFSET_X, AFFORDANCE_OFFSET_Y, AFFORDANCE_CARD_HALF } = window.EditorCanvasGeometry;

    function getMetrics() {
        return window.EditorCanvasGeometry.getMetrics(canvas);
    }

    function getWorldPosition(mem) {
        return utils.getWorldPosition(mem, {
            layoutMode: viewportState.layoutMode,
            viewportState,
            getCanonicalRootId,
            getTreeMemories,
            isRootMemory,
            getMetrics,
            layoutPolicy: canEdit === false ? 'publicLinearSpine' : undefined
        });
    }

    function calcPosition(mem) {
        return utils.calcPosition(mem, {
            getWorldPosition: getWorldPosition,
            canvasViewport,
            viewportState
        });
    }

    function persistStoredPositions() {
        if (canEdit === false) return;
        if (typeof storageUtils.persistStoredPositions === 'function') {
            return storageUtils.persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit);
        }
    }

    function fitViewportToTree() {
        let nextViewport = null;
        if (typeof panzoomUtils.getFitViewportIfAvailable === 'function') {
            nextViewport = panzoomUtils.getFitViewportIfAvailable(canvasViewport, {
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState
            });
        }
        
        if (!nextViewport) return;
        if (typeof canvasViewport.applyViewport === 'function') {
            canvasViewport.applyViewport(viewportState, nextViewport, true);
            return;
        }
    }

    function switchToFreeMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.switchToFreeMode(); }
    }

    function switchToStructuredMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.switchToStructuredMode(); }
    }

    function setLayoutMode(mode) {
        if (layoutModeSwitcher) { layoutModeSwitcher.setLayoutMode(mode); }
    }

    function toggleLayoutMode() {
        if (layoutModeSwitcher) { layoutModeSwitcher.toggleLayoutMode(); }
    }

    function updateLayoutToggleUI() {
        (typeof layoutTransition.updateLayoutToggleUI === 'function'
            ? layoutTransition.updateLayoutToggleUI
            : uiHelpers.updateLayoutToggleUI)(viewportState.layoutMode, i18n);
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
        },
        canEdit
    });

    const branchPorts = window.createEditorCanvasBranchPorts({
        canvas,
        svg,
        documentRef: document,
        calcPosition,
        openAddMoment,
        getTreeMemories,
        getCanonicalRootId,
        isRootMemory,
        i18n,
        constants: {
            NODE_HALF
        }
    });

    function isNodeWithinSafeViewport(pos) {
        return utils.isNodeWithinSafeViewport(pos, getMetrics);
    }

    function keepSelectionVisible() {
        const selectedId = selectionUtils.getSelectedMemoryId(document);
        const target = selectionUtils.getSelectedMemory(document, getTreeMemories());

        if (selectedId && target) {
            const currentPos = calcPosition(target);
            if (!isNodeWithinSafeViewport(currentPos)) {
                focusNodeById(selectedId);
                return;
            }
            initCanvas();
            return;
        }
        recenterViewport();
    }

    function bindResizeHandling() {
        uiHelpers.bindResizeHandling(viewportState, () => {
            keepSelectionVisible();
            persistStoredPositions();
        });
    }

    const requireCanvasEdgeMethod = (name) => {
        if (typeof canvasEdges[name] !== 'function') {
            throw new Error(`LoveBudEditorCanvasEdges.${name} is required`);
        }
        return canvasEdges[name];
    };
    const drawBranch = requireCanvasEdgeMethod('drawBranch');
    const clearBranches = requireCanvasEdgeMethod('clearBranches');
    const drawBranchForMemory = requireCanvasEdgeMethod('drawBranchForMemory');
    const highlightSelectedFlow = requireCanvasEdgeMethod('highlightSelectedFlow');
    const NODE_TAP_SELECT_THRESHOLD = 8;
    const AFFORDANCE_LOCK_CLASS = 'affordance-interaction-locked';

    function renderAffordanceForMemory(mem) {
        if (!mem) return;
        renderUtils.renderAffordancesForMemory(mem, {
            growthAffordance,
            branchPorts,
            getTreeMemories,
            canonicalRootId: getCanonicalRootId(),
            isRootMemory,
            isEditMode: window.LoveBudEditorInteractionMode ? window.LoveBudEditorInteractionMode.isEditMode : function () { return false; }
        });
    }

    function renderAffordanceForHoveredMemory(mem) {
        if (!mem || viewportState.isDraggingNode || viewportState.isPanning) return;
        if (canvas.classList.contains(AFFORDANCE_LOCK_CLASS)) return;
        if (hoverAffordanceMemoryId === mem.id) return;
        if (hoverAffordanceTimer) clearTimeout(hoverAffordanceTimer);
        hoverAffordanceMemoryId = mem.id;
        hoverAffordanceTimer = setTimeout(() => {
            if (canvas.classList.contains(AFFORDANCE_LOCK_CLASS)) return;
            renderAffordanceForMemory(mem);
        }, 45);
    }

    var pendingConnectState = null;

    function handleConnectTargetSelect(targetMem) {
        if (!pendingConnectState || !targetMem) return;
        if (String(pendingConnectState.sourceId) === String(targetMem.id)) return;
        var targetPos = calcPosition(targetMem);
        if (typeof onConnectTargetSelect === 'function') {
            onConnectTargetSelect(targetMem, targetPos);
        }
    }

    function drawConnectPreview(targetPos) {
        if (!pendingConnectState) return;
        canvasEdges.drawDashedPreview(
            targetPos,
            pendingConnectState.sourcePos
        );
    }

    function setPendingConnect(sourceId, sourcePos) {
        pendingConnectState = { sourceId: sourceId, sourcePos: sourcePos };
    }

    var onPendingConnectCleared = null;

    function setOnPendingConnectCleared(fn) {
        onPendingConnectCleared = fn;
    }

    function clearPendingConnect() {
        pendingConnectState = null;
        canvasEdges.clearDashedPreview();
        if (typeof onPendingConnectCleared === 'function') {
            onPendingConnectCleared();
        }
    }

    function getPendingConnectSourceId() {
        return pendingConnectState ? pendingConnectState.sourceId : null;
    }

    function bindNodeDrag(nodeEl, mem) {
        nodeEl.style.cursor = canEdit !== false && viewportState.layoutMode === 'structured' ? 'default' : 'grab';

        const selectMemoryNode = () => {
            if (pendingConnectState) {
                if (String(pendingConnectState.sourceId) !== String(mem.id)) {
                    handleConnectTargetSelect(mem);
                }
                return;
            }
            onNodeClick(nodeEl, mem);
        };

        const navigateNodeByOffset = (offset) => {
            const canonicalRootId = getCanonicalRootId();
            const orderedMemories = getTreeMemories().filter(function (memory) {
                return !isRootMemory(memory, canonicalRootId);
            });
            if (!orderedMemories.length) return;

            const currentIndex = orderedMemories.findIndex(function (memory) {
                return memory.id === mem.id;
            });
            if (currentIndex === -1) return;

            const nextIndex = currentIndex + offset;
            if (nextIndex < 0 || nextIndex >= orderedMemories.length) return;

            const nextMemory = orderedMemories[nextIndex];
            const nextNodeEl = selectionUtils.findMemoryNodeById(nextMemory.id);
            if (!nextNodeEl) return;

            onNodeClick(nextNodeEl, nextMemory);
            if (typeof nextNodeEl.focus === 'function') {
                nextNodeEl.focus();
            }
        };

        const shouldHandleArrowNavigation = (event) => {
            if (canEdit === false) return false;
            if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) return false;
            if (event.altKey || event.ctrlKey || event.metaKey) return false;

            const target = event.target;
            if (!target || !target.closest || !target.closest('.memory-node')) return false;
            if (target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable]')) return false;
            if (target.closest('#addMemoryForm, .editor-memory-form-modal, .editor-floating-toolbar, .editor-ftb-dropdown, [role="dialog"], .detail-panel')) return false;

            return true;
        };

        uiHelpers.bindNodeHoverAffordance(nodeEl, mem, renderAffordanceForHoveredMemory);

        if (canEdit !== false) {
            uiHelpers.bindNodeDragStart(nodeEl, () => viewportState.layoutMode, (e) => {
                if (typeof canvasInteraction.beginNodeDrag === 'function') {
                    var mode = window.LoveBudEditorInteractionMode;
                    if (mode && !mode.isEditMode()) return;
                    canvasInteraction.beginNodeDrag(e, nodeEl, mem, viewportState, getWorldPosition, canEdit);
                }
            });
        }

        uiHelpers.bindNodePointerSelection(nodeEl, {
            onSelect: selectMemoryNode,
            onHover: renderAffordanceForHoveredMemory,
            mem: mem,
            tapThreshold: NODE_TAP_SELECT_THRESHOLD
        });

        uiHelpers.bindNodeControlShortcuts(nodeEl, selectMemoryNode, {
            onArrowNavigate: navigateNodeByOffset,
            shouldHandleArrowNavigation: shouldHandleArrowNavigation
        });
    }

    function createNodeElement(mem, pos) {
        return renderUtils.createNodeElement(mem, pos, canvasNode, {
            resolveMemoryThumbnail: resolveMemoryThumbnail,
            NODE_HALF: NODE_HALF,
            scale: viewportState.scale || 1
        });
    }

    function attachNodeInfo(nodeEl, mem) {
        renderUtils.attachNodeInfo(canvas, nodeEl, mem, canvasNode);
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
        selectionUtils.reapplySelection(selectedNodeId, document, {
            renderAffordanceForMemory,
            getTreeMemories
        });
    }

    function clearGrowthAffordance() {
        hoverAffordanceMemoryId = null;
        if (hoverAffordanceTimer) {
            clearTimeout(hoverAffordanceTimer);
            hoverAffordanceTimer = null;
        }

        renderUtils.clearGrowthAffordances(growthAffordance, branchPorts);
    }

    function openAddMomentFromCanvas() {
        var mode = window.LoveBudEditorInteractionMode;
        if (!mode || !mode.isEditMode()) return;
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

    function updateAffordance() {
        const selectedMem = selectionUtils.getSelectedMemory(document, getTreeMemories());
        renderAffordanceForMemory(selectedMem);
    }

    function findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId) {
        return utils.findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);
    }

    let _rafPending = false;
    function scheduleRender() {
        if (_rafPending) return;
        _rafPending = true;
        requestAnimationFrame(() => {
            _rafPending = false;
            initCanvas();
        });
    }

    /**
     * DOM RENDER ORCHESTRATION BOUNDARY
     * High-risk regression point:
     * - Do NOT move DOM creation/deletion loop outside this module.
     * - Preserve render ordering to prevent duplicate nodes.
     * - Preserve affordance and detail panel synchronization.
     * - Ensure `hasVisibleNodes` check controls Empty State rendering.
     */
    const initCanvas = () => {
        let selectedNodeId = null;
        try {
            const canonicalRootId = getCanonicalRootId();
            const treeMemories = getTreeMemories();
            selectedNodeId = selectionUtils.getSelectedMemoryId(document);

            const drawableMemories = treeMemories.filter((node) => !isRootMemory(node, canonicalRootId));
            const rootMemory = treeMemories.find((node) => isRootMemory(node, canonicalRootId)) || null;
            const shouldRenderRootNode = drawableMemories.length === 0 && !!rootMemory;
            const hasVisibleNodes = drawableMemories.length > 0 || shouldRenderRootNode;

            console.log(`[editor-canvas] Drawable nodes: ${drawableMemories.length}, Root found: ${!!rootMemory}, hasVisibleNodes: ${hasVisibleNodes}`);

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

            renderUtils.clearCanvasNodes(canvas);
            clearEdgeSelection();
            clearBranches();
            clearGrowthAffordance();

            setDetailEmptyState(!hasVisibleNodes);
            updateFocusSelectedBtn();

            if (shouldRenderRootNode) {
                console.log(`[editor-canvas] Drawing root node: ${rootMemory.id}`);
                drawNode(rootMemory);
            }

            drawableMemories.forEach((node) => {
                drawNode(node);
                drawBranchForMemory(node, {
                    treeMemories,
                    canonicalRootId,
                    calcPosition
                });
            });

            if (hasVisibleNodes) {
                let selectedMem = selectedNodeId
                    ? treeMemories.find((m) => m.id === selectedNodeId)
                    : createInitialMemory();

                // Skip root if found; show first visible child of hidden root instead
                if (!selectedMem || isRootMemory(selectedMem, canonicalRootId)) {
                    selectedMem = findInitialVisibleMemory(drawableMemories, treeMemories, canonicalRootId);
                }

                if (selectedMem) {
                    console.log(`[editor-canvas] Reapplying selection: ${selectedMem.id}`);
                    reapplySelection(selectedMem.id);
                    highlightSelectedFlow(selectedMem.id);

                    const selectedEl = selectionUtils.findMemoryNodeById(selectedMem.id);
                    if (selectedEl && typeof onNodeClick === 'function') {
                        onNodeClick(selectedEl, selectedMem);
                    } else {
                        updateDetailPanel(selectedMem);
                        renderAffordanceForMemory(selectedMem);
                    }
                }
            }

            bindCanvasPan();
            bindViewportControls();
            bindWheelZoom();
            bindResizeHandling();
            bindLayoutModeToggle();
            // Bind compact mode toggle
            bindCompactModeToggle();

            viewportState.initialized = true;
            console.log(`[editor-canvas] initCanvas complete. Nodes rendered: ${document.querySelectorAll('.memory-node').length}`);
        } catch (error) {
            console.error(`[editor-canvas] initCanvas failed to render nodes. Context: treeId=${treeId}, layoutMode=${viewportState.layoutMode}, selectedNodeId=${selectedNodeId}`, error);
            if (typeof setDetailEmptyState === 'function') {
                setDetailEmptyState(true);
            }
        }
    };

    const layoutModeSwitcher = typeof layoutTransition.createLayoutModeSwitcher === 'function'
        ? layoutTransition.createLayoutModeSwitcher({
            viewportState,
            loadStoredLayout,
            persistLayoutMode,
            persistStoredPositions,
            fitViewportToTree,
            initCanvas,
            updateLayoutToggleUI,
            getSavedFreePositions: () => savedFreePositions,
            setSavedFreePositions: (value) => { savedFreePositions = value; },
            getStoredFreePositions: () => storedFreePositions,
            setStoredFreePositions: (value) => { storedFreePositions = value; }
        })
        : null;

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
                initCanvas: scheduleRender,
                reapplySelection,
                findMemoryNodeById: selectionUtils.findMemoryNodeById
            });
            persistStoredPositions();
            return;
        }
    }

    function recenterViewport() {
        if (typeof canvasViewport.recenterViewport === 'function') {
            canvasViewport.recenterViewport({
                getTreeMemories,
                getCanonicalRootId,
                isRootMemory,
                getWorldPosition,
                getMetrics,
                viewportState,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }
    }

    /**
     * EVENT LIFECYCLE BOUNDARY
     * High-risk regression point:
     * - Do NOT move global listener bindings outside this module.
     * - Ensure `viewportState.controlsBound` correctly prevents duplicate bindings.
     */
    function bindViewportControls() {
        if (typeof canvasViewport.bindControls === 'function') {
            canvasViewport.bindControls({
                viewportState,
                focusNodeById,
                recenterViewport,
                zoomBy
            });
            return;
        }
    }

    function bindWheelZoom() {
        if (typeof canvasViewport.bindWheelZoom !== 'function') return;

        function zoomAtPoint(scale, localX, localY) {
            if (typeof canvasViewport.zoomAtPoint !== 'function') return;

            canvasViewport.zoomAtPoint({
                scale,
                localX,
                localY,
                viewportState,
                initCanvas: scheduleRender
            });

            persistStoredPositions();
        }

        canvasViewport.bindWheelZoom({
            viewportState,
            zoomAtPoint
        });
    }

    function bindLayoutModeToggle() {
        uiHelpers.bindLayoutModeToggle(toggleLayoutMode);
    }

    /**
     * Bind the compact/detail mode toggle for the canvas toolbar.
     * Toggles .is-compact class on .editor-canvas-toolbar and swaps the toggle icon.
     * Preference is persisted in localStorage.
     */
    function bindCompactModeToggle() {
        uiHelpers.bindCompactModeToggle();
    }

    /**
     * EVENT LIFECYCLE BOUNDARY
     * High-risk regression point:
     * - Do NOT extract pan state mutations without passing viewportState by reference.
     * - Ensure `viewportState.globalsBound` is strictly respected to avoid ghost dragging.
     */
    function bindCanvasPan() {
        if (typeof canvasInteraction.bind === 'function') {
            canvasInteraction.bind({
                canvas,
                viewportState,
                scheduleRender: () => { if (viewportState.layoutMode === 'free') initCanvas(); },
                persistStoredPositions,
                initCanvas,
                getWorldPosition,
                getDragTargetElement: (id) => selectionUtils.findMemoryNodeById(id),
                showMovedToast: uiHelpers.showMovedToast
            });
        }

        if (!canvas._edgeDeselectBound) {
            canvas._edgeDeselectBound = true;
            canvas.addEventListener('pointerdown', function(e) {
                if (e.target.closest('.memory-node')) return;
                if (e.target.closest('.branch-line')) return;
                if (e.target.closest('.edge-disconnect-btn')) return;
                if (e.target.closest('#addMemoryForm')) return;
                if (e.target.closest('.memory-add-affordance')) return;
                if (selectedEdgeChildId) {
                    clearEdgeSelection();
                }
            });
        }
    }

    function zoomBy(factor) {
        if (typeof canvasViewport.zoomBy === 'function') {
            canvasViewport.zoomBy({
                factor,
                viewportState,
                getMetrics,
                initCanvas: scheduleRender
            });
            persistStoredPositions();
            return;
        }
    }

    function addNodePosition(memoryId, pos) {
        if (!memoryId || !pos) return;
        viewportState.positions[memoryId] = pos;
    }

    requestAnimationFrame(() => {
        (typeof layoutTransition.applyLayoutModeClasses === 'function'
            ? layoutTransition.applyLayoutModeClasses
            : uiHelpers.applyLayoutModeClasses)(viewportState.layoutMode);
        updateLayoutToggleUI();
    });

    return {
        addNodePosition,
        calcPosition,
        drawBranch,
        drawNode,
        initCanvas,
        focusNodeById,
        recenterViewport,
        setLayoutMode,
        updateAffordance,
        clearEdgeSelection,
        clearGrowthAffordance,
        highlightSelectedFlow,
        getWorldPosition,
        get viewportState() { return viewportState; },
        persistStoredPositions,
        setPendingConnect,
        clearPendingConnect,
        getPendingConnectSourceId,
        drawConnectPreview,
        setOnPendingConnectCleared
    };
}

// Bridge to window for legacy editor.js compatibility
window.createEditorCanvas = createEditorCanvas;
window.LoveBudEditorCanvas = {
    createEditorCanvas,
    initCanvas: () => {
        const instance = document.querySelector('#canvasArea')?.__editorCanvasInstance;
        if (instance) instance.initCanvas();
    }
};

// Global Editor Bridge for legacy/external triggers (Refs #1495)
window.LoveBudEditor = {
    initCanvas: () => window.LoveBudEditorCanvas.initCanvas(),
    refresh: () => window.LoveBudEditorCanvas.initCanvas(),
    render: () => window.LoveBudEditorCanvas.initCanvas()
};

/**
 * SELF-INITIALIZATION GUARD
 * If this module loads AFTER editor.js has already attempted to start,
 * and we have data ready in the global window, trigger a re-render.
 */
(function() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        if (window.currentTreeMemories && window.currentTreeMemories.length > 0) {
            console.log('[editor-canvas] Late module load detected with existing data. Triggering bridge init...');
            setTimeout(() => window.LoveBudEditorCanvas.initCanvas(), 100);
        }
    }
})();
