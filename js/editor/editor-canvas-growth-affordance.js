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
     * Returns position (center of tip) and side ('right'|'left'|'below'|'above').
     */
    function getPlusTipPosition(anchorPos) {
        const metrics = getMetrics();
        const viewportWidth = Math.max(canvas.clientWidth || metrics.width, 320);
        const viewportHeight = Math.max(canvas.clientHeight || metrics.height, 320);

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

        // Score each side based on available space and preference
        const sides = [];

        // Right: tip to the right of the node
        if (spaceRight >= needed) {
            const tipX = nodeRight + GAP_FROM_NODE + TIP_HALF;
            const tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            sides.push({ x: tipX, y: tipY, side: 'right', score: spaceRight * 1.0 });
        }

        // Left: tip to the left of the node
        if (spaceLeft >= needed) {
            const tipX = nodeLeft - GAP_FROM_NODE - TIP_HALF;
            const tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            sides.push({ x: tipX, y: tipY, side: 'left', score: spaceLeft * 0.85 });
        }

        // Below: tip below the node
        if (spaceBelow >= needed) {
            const tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            const tipY = nodeBottom + GAP_FROM_NODE + TIP_HALF;
            sides.push({ x: tipX, y: tipY, side: 'below', score: spaceBelow * 0.7 });
        }

        // Above: tip above the node
        if (spaceAbove >= needed) {
            const tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            const tipY = nodeTop - GAP_FROM_NODE - TIP_HALF;
            sides.push({ x: tipX, y: tipY, side: 'above', score: spaceAbove * 0.6 });
        }

        // If any side works, pick the best-scoring one
        if (sides.length) {
            sides.sort((a, b) => b.score - a.score);
            return sides[0];
        }

        // Fallback: place to the right or left, no gap check
        const preferRight = anchorPos.x < viewportWidth * 0.5;
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
        const tipPos = getPlusTipPosition(anchorPos);

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
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
            button.style.background = 'rgba(144, 73, 81, 0.92)';
            tooltip.style.opacity = '0';
        });
        button.addEventListener('focus', () => {
            button.style.transform = 'scale(1.15)';
            button.style.boxShadow = '0 0 0 3px rgba(144, 73, 81, 0.3), 0 5px 16px rgba(144, 73, 81, 0.35)';
            button.style.background = 'rgba(144, 73, 81, 1)';
            tooltip.style.opacity = '1';
        });
        button.addEventListener('blur', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
            button.style.background = 'rgba(144, 73, 81, 0.92)';
            tooltip.style.opacity = '0';
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
