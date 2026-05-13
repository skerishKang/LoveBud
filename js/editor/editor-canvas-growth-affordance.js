function createEditorCanvasGrowthAffordance(deps) {
    const {
        canvas,
        svg,
        documentRef,
        getMetrics,
        calcPosition,
        openAddMoment,
        i18n,
        constants
    } = deps;

    const {
        NODE_HALF
    } = constants;
    const TIP_SIZE = 36;
    const TIP_HALF = TIP_SIZE / 2;
    const GAP_FROM_NODE = 10;
    const CONNECTOR_PEAK_GAP = 6;

    function clamp(value, min, max) {
        if (max < min) return min;
        return Math.max(min, Math.min(value, max));
    }

    function clearGrowthAffordance() {
        canvas.querySelectorAll('.memory-add-affordance').forEach((el) => el.remove());
        svg.querySelectorAll('.branch-line-affordance').forEach((el) => el.remove());
        // Remove any affordance tooltip that might be visible
        documentRef.querySelectorAll('.affordance-tooltip').forEach((el) => el.remove());
    }

    function openAddMomentFromCanvas() {
        if (typeof openAddMoment === 'function') {
            openAddMoment();
            return;
        }

        const addBtn = documentRef.getElementById('addMemoryBtn');
        if (addBtn) {
            addBtn.click();
        }
    }

    /**
     * Determine the best placement for the compact + tip.
     * Considers viewport boundaries AND existing node positions
     * to avoid occluding other nodes in both structured and free layouts.
     * Returns position (center of tip) and side ('right'|'left'|'below'|'above').
     */
    function getPlusTipPosition(anchorPos, anchorMem) {
        const metrics = getMetrics();
        const viewportWidth = Math.max(canvas.clientWidth || metrics.width, 320);
        const viewportHeight = Math.max(canvas.clientHeight || metrics.height, 320);
        const tipRadius = TIP_HALF;
        const anchorNodeId = anchorMem && anchorMem.id;

        // Collect positions of all OTHER memory nodes currently on canvas
        // to avoid overlapping them (exclude the anchor node itself)
        var nodeRects = [];
        try {
            var allNodes = canvas.querySelectorAll('.memory-node');
            for (var i = 0; i < allNodes.length; i++) {
                var el = allNodes[i];
                // Skip the anchor node — tip is intentionally placed adjacent to it
                if (anchorNodeId && el.dataset && el.dataset.memoryId === anchorNodeId) continue;
                var left = parseFloat(el.style.left) || 0;
                var top = parseFloat(el.style.top) || 0;
                var w = parseFloat(el.style.width) || (NODE_HALF * 2);
                var h = parseFloat(el.style.height) || (NODE_HALF * 2);
                nodeRects.push({
                    left: left,
                    right: left + w,
                    top: top,
                    bottom: top + h,
                    width: w,
                    height: h
                });
            }
        } catch (_) { /* silently fall through */ }

        /**
         * Check if a candidate tip (at center x,y with given side)
         * overlaps with any existing node rect.
         */
        function overlapsNodes(tipX, tipY, side) {
            // Define the tip bounding box
            var tLeft = tipX - tipRadius;
            var tRight = tipX + tipRadius;
            var tTop = tipY - tipRadius;
            var tBottom = tipY + tipRadius;

            // Expand by a small guard gap
            var guard = 12;
            tLeft -= guard;
            tRight += guard;
            tTop -= guard;
            tBottom += guard;

            // Also check tooltip extent on the relevant side
            var tooltipWidthEstimate = 140;
            var tooltipHeightEstimate = 26;
            var tooltipGap = 6;
            switch (side) {
                case 'right':
                    tRight = Math.max(tRight, tipX + tipRadius + tooltipGap + tooltipWidthEstimate);
                    break;
                case 'left':
                    tLeft = Math.min(tLeft, tipX - tipRadius - tooltipGap - tooltipWidthEstimate);
                    break;
                case 'below':
                    tBottom = Math.max(tBottom, tipY + tipRadius + tooltipGap + tooltipHeightEstimate);
                    break;
                case 'above':
                    tTop = Math.min(tTop, tipY - tipRadius - tooltipGap - tooltipHeightEstimate);
                    break;
            }

            // Check against all node rects
            for (var j = 0; j < nodeRects.length; j++) {
                var nr = nodeRects[j];
                if (tLeft < nr.right && tRight > nr.left && tTop < nr.bottom && tBottom > nr.top) {
                    return true; // Overlap detected
                }
            }
            return false;
        }

        const nodeLeft = anchorPos.x - NODE_HALF;
        const nodeRight = anchorPos.x + NODE_HALF;
        const nodeTop = anchorPos.y - NODE_HALF;
        const nodeBottom = anchorPos.y + NODE_HALF;

        // Calculate available space on each side
        const spaceRight = viewportWidth - nodeRight;
        const spaceLeft = nodeLeft;
        const spaceBelow = viewportHeight - nodeBottom;
        const spaceAbove = nodeTop;

        // Minimum space needed for tip + gap
        const needed = TIP_SIZE + GAP_FROM_NODE + CONNECTOR_PEAK_GAP;

        // Score each side based on available space, preference, and node occlusion
        var sides = [];

        function evaluateSide(side, tipX, tipY, rawScore) {
            var occlusion = overlapsNodes(tipX, tipY, side);
            // Heavily penalize sides that occlude other nodes
            var score = occlusion ? rawScore * 0.1 : rawScore;
            sides.push({ x: tipX, y: tipY, side: side, score: score });
        }

        // Right: tip to the right of the node
        if (spaceRight >= needed) {
            var tipX = nodeRight + GAP_FROM_NODE + TIP_HALF;
            var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            evaluateSide('right', tipX, tipY, spaceRight * 1.0);
        }

        // Left: tip to the left of the node
        if (spaceLeft >= needed) {
            var tipX = nodeLeft - GAP_FROM_NODE - TIP_HALF;
            var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            evaluateSide('left', tipX, tipY, spaceLeft * 0.85);
        }

        // Below: tip below the node
        if (spaceBelow >= needed) {
            var tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            var tipY = nodeBottom + GAP_FROM_NODE + TIP_HALF;
            evaluateSide('below', tipX, tipY, spaceBelow * 0.7);
        }

        // Above: tip above the node
        if (spaceAbove >= needed) {
            var tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            var tipY = nodeTop - GAP_FROM_NODE - TIP_HALF;
            evaluateSide('above', tipX, tipY, spaceAbove * 0.6);
        }

        // If no non-occluded side was found with full space, try any feasible fallback
        if (!sides.length) {
            // Even if space is tight, attempt placement with lower score
            var fallbacks = [];

            // Try right with tight fit
            if (spaceRight > TIP_HALF + 8) {
                var tipX = clamp(nodeRight + 4 + TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                var occ = overlapsNodes(tipX, tipY, 'right');
                fallbacks.push({ x: tipX, y: tipY, side: 'right', score: occ ? 5 : 50 });
            }
            // Try left with tight fit
            if (spaceLeft > TIP_HALF + 8) {
                var tipX = clamp(nodeLeft - 4 - TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                var occ = overlapsNodes(tipX, tipY, 'left');
                fallbacks.push({ x: tipX, y: tipY, side: 'left', score: occ ? 4 : 40 });
            }
            // Try below with tight fit
            if (spaceBelow > TIP_HALF + 8) {
                var tipX = clamp(anchorPos.x, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(nodeBottom + 4 + TIP_HALF, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                var occ = overlapsNodes(tipX, tipY, 'below');
                fallbacks.push({ x: tipX, y: tipY, side: 'below', score: occ ? 3 : 30 });
            }
            // Try above with tight fit
            if (spaceAbove > TIP_HALF + 8) {
                var tipX = clamp(anchorPos.x, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(nodeTop - 4 - TIP_HALF, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                var occ = overlapsNodes(tipX, tipY, 'above');
                fallbacks.push({ x: tipX, y: tipY, side: 'above', score: occ ? 2 : 20 });
            }

            if (fallbacks.length) {
                fallbacks.sort(function (a, b) { return b.score - a.score; });
                return fallbacks[0];
            }
        }

        // If any side works, pick the best-scoring one (prefer non-occluded)
        if (sides.length) {
            sides.sort(function (a, b) { return b.score - a.score; });
            return sides[0];
        }

        // Ultimate fallback: place to the right or left, clamped to viewport
        var preferRight = anchorPos.x < viewportWidth * 0.5;
        if (preferRight) {
            return {
                x: clamp(nodeRight + GAP_FROM_NODE + TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8),
                y: clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20),
                side: 'right'
            };
        }
        return {
            x: clamp(nodeLeft - GAP_FROM_NODE - TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8),
            y: clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20),
            side: 'left'
        };
    }

    function drawConnectorLine(anchorPos, tipPos, side) {
        const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Start from node edge toward the tip
        let startX, startY;
        switch (side) {
            case 'right':
                startX = anchorPos.x + NODE_HALF;
                startY = anchorPos.y;
                break;
            case 'left':
                startX = anchorPos.x - NODE_HALF;
                startY = anchorPos.y;
                break;
            case 'below':
                startX = anchorPos.x;
                startY = anchorPos.y + NODE_HALF;
                break;
            case 'above':
                startX = anchorPos.x;
                startY = anchorPos.y - NODE_HALF;
                break;
            default:
                startX = anchorPos.x + NODE_HALF;
                startY = anchorPos.y;
        }

        // End point is near the tip circle edge
        const endX = tipPos.x - (side === 'left' ? TIP_HALF : side === 'right' ? -TIP_HALF : 0);
        const endY = tipPos.y - (side === 'above' ? TIP_HALF : side === 'below' ? -TIP_HALF : 0);

        // Simple smooth quadratic bezier
        const cpX = (startX + endX) / 2;
        const cpY = (startY + endY) / 2;
        const d = `M ${startX},${startY} Q ${cpX},${cpY} ${endX},${endY}`;

        path.setAttribute('d', d);
        path.setAttribute('class', 'branch-line branch-line-affordance');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(144, 73, 81, 0.35)');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-dasharray', '4 5');
        path.setAttribute('opacity', '0.85');
        svg.appendChild(path);
    }

    function createPlusTipElement(anchorMem, labelText) {
        const anchorPos = calcPosition(anchorMem);
        const tipPos = getPlusTipPosition(anchorPos, anchorMem);

        // Create the + button
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'memory-add-affordance';
        button.setAttribute('aria-label', labelText);
        button.setAttribute('title', labelText);
        button.style.position = 'absolute';
        button.style.left = `${tipPos.x - TIP_HALF}px`;
        button.style.top = `${tipPos.y - TIP_HALF}px`;
        button.style.width = `${TIP_SIZE}px`;
        button.style.height = `${TIP_SIZE}px`;
        button.style.borderRadius = '50%';
        button.style.border = 'none';
        button.style.background = 'rgba(144, 73, 81, 0.92)';
        button.style.color = '#fff';
        button.style.fontSize = '20px';
        button.style.fontWeight = '700';
        button.style.lineHeight = '1';
        button.style.cursor = 'pointer';
        button.style.zIndex = '5';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
        button.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease';
        button.textContent = '+';

        // Tooltip element (hidden by default)
        const tooltip = documentRef.createElement('span');
        tooltip.className = 'affordance-tooltip';
        tooltip.textContent = labelText;
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.style.position = 'absolute';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.fontSize = '12px';
        tooltip.style.fontWeight = '600';
        tooltip.style.color = '#fff';
        tooltip.style.background = 'rgba(60, 50, 45, 0.92)';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.15s ease';
        tooltip.style.zIndex = '6';

        // Generate unique ID for aria-describedby linkage
        var tooltipId = 'aff-tip-' + (anchorMem ? anchorMem.id : '0');
        tooltip.setAttribute('id', tooltipId);

        // Link button to tooltip for screen reader announcement
        button.setAttribute('aria-describedby', tooltipId);

        // Position tooltip based on tip side
        const tooltipGap = 6;
        switch (tipPos.side) {
            case 'right':
                tooltip.style.left = `${TIP_HALF + tooltipGap}px`;
                tooltip.style.top = '50%';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'left':
                tooltip.style.right = `${TIP_HALF + tooltipGap}px`;
                tooltip.style.top = '50%';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'below':
                tooltip.style.left = '50%';
                tooltip.style.top = `${TIP_HALF + tooltipGap}px`;
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'above':
                tooltip.style.left = '50%';
                tooltip.style.bottom = `${TIP_HALF + tooltipGap}px`;
                tooltip.style.transform = 'translateX(-50%)';
                break;
        }

        button.appendChild(tooltip);

        // Hover/focus show tooltip
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.15)';
            button.style.boxShadow = '0 5px 16px rgba(144, 73, 81, 0.35)';
            button.style.background = 'rgba(144, 73, 81, 1)';
            tooltip.style.opacity = '1';
            tooltip.setAttribute('aria-hidden', 'false');
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
            button.style.background = 'rgba(144, 73, 81, 0.92)';
            tooltip.style.opacity = '0';
            tooltip.setAttribute('aria-hidden', 'true');
        });
        button.addEventListener('focus', () => {
            button.style.transform = 'scale(1.15)';
            button.style.boxShadow = '0 0 0 3px rgba(144, 73, 81, 0.3), 0 5px 16px rgba(144, 73, 81, 0.35)';
            button.style.background = 'rgba(144, 73, 81, 1)';
            tooltip.style.opacity = '1';
            tooltip.setAttribute('aria-hidden', 'false');
        });
        button.addEventListener('blur', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
            button.style.background = 'rgba(144, 73, 81, 0.92)';
            tooltip.style.opacity = '0';
            tooltip.setAttribute('aria-hidden', 'true');
        });

        // Click/tap action
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Brief scale pulse for feedback
            button.style.transform = 'scale(0.9)';
            setTimeout(() => {
                button.style.transform = 'scale(1.15)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 100);
            }, 80);
            openAddMomentFromCanvas();
        });

        // Prevent pan when interacting
        ['mousedown', 'pointerdown', 'touchstart'].forEach((eventName) => {
            button.addEventListener(eventName, (e) => {
                e.stopPropagation();
            });
        });

        // Keyboard support
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                openAddMomentFromCanvas();
            }
        });

        // Draw connector line
        drawConnectorLine(anchorPos, tipPos, tipPos.side);

        canvas.appendChild(button);
    }

    function renderGrowthAffordance(anchorMem, options) {
        if (!anchorMem) return;
        const opts = options || {};
        const labelText = opts.labelText || (i18n('editor_add_memory') || '새 순간 이어가기');

        createPlusTipElement(anchorMem, labelText);
    }

    return {
        clearGrowthAffordance,
        openAddMomentFromCanvas,
        getGrowthAffordancePosition: getPlusTipPosition,
        drawGrowthAffordanceBranch: drawConnectorLine,
        createGrowthAffordanceElement: createPlusTipElement,
        renderGrowthAffordance
    };
}

window.createEditorCanvasGrowthAffordance = createEditorCanvasGrowthAffordance;
