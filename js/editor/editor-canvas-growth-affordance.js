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
    const BUBBLE_WIDTH = 210;
    const BUBBLE_HEIGHT = 42;
    const BUBBLE_GAP = 8;

    function clamp(value, min, max) {
        if (max < min) return min;
        return Math.max(min, Math.min(value, max));
    }

    function clearGrowthAffordance() {
        canvas.querySelectorAll('.memory-add-affordance').forEach((el) => el.remove());
        svg.querySelectorAll('.branch-line-affordance').forEach((el) => el.remove());
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

    function getPlusTipPosition(anchorPos, anchorMem) {
        const metrics = getMetrics();
        const viewportWidth = Math.max(canvas.clientWidth || metrics.width, 320);
        const viewportHeight = Math.max(canvas.clientHeight || metrics.height, 320);
        const tipRadius = TIP_HALF;
        const anchorNodeId = anchorMem && anchorMem.id;

        var nodeRects = [];
        try {
            var allNodes = canvas.querySelectorAll('.memory-node');
            for (var i = 0; i < allNodes.length; i++) {
                var el = allNodes[i];
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
        } catch (_) {}

        function getBubbleRect(tipX, tipY, side) {
            switch (side) {
                case 'right':
                    return {
                        left: tipX + TIP_HALF + BUBBLE_GAP,
                        right: tipX + TIP_HALF + BUBBLE_GAP + BUBBLE_WIDTH,
                        top: tipY - (BUBBLE_HEIGHT / 2),
                        bottom: tipY + (BUBBLE_HEIGHT / 2)
                    };
                case 'left':
                    return {
                        left: tipX - TIP_HALF - BUBBLE_GAP - BUBBLE_WIDTH,
                        right: tipX - TIP_HALF - BUBBLE_GAP,
                        top: tipY - (BUBBLE_HEIGHT / 2),
                        bottom: tipY + (BUBBLE_HEIGHT / 2)
                    };
                case 'below':
                    return {
                        left: tipX - (BUBBLE_WIDTH / 2),
                        right: tipX + (BUBBLE_WIDTH / 2),
                        top: tipY + TIP_HALF + BUBBLE_GAP,
                        bottom: tipY + TIP_HALF + BUBBLE_GAP + BUBBLE_HEIGHT
                    };
                case 'above':
                    return {
                        left: tipX - (BUBBLE_WIDTH / 2),
                        right: tipX + (BUBBLE_WIDTH / 2),
                        top: tipY - TIP_HALF - BUBBLE_GAP - BUBBLE_HEIGHT,
                        bottom: tipY - TIP_HALF - BUBBLE_GAP
                    };
                default:
                    return {
                        left: tipX + TIP_HALF + BUBBLE_GAP,
                        right: tipX + TIP_HALF + BUBBLE_GAP + BUBBLE_WIDTH,
                        top: tipY - (BUBBLE_HEIGHT / 2),
                        bottom: tipY + (BUBBLE_HEIGHT / 2)
                    };
            }
        }

        function isRectInViewport(rect) {
            return rect.left >= 8 && rect.right <= viewportWidth - 8 && rect.top >= 8 && rect.bottom <= viewportHeight - 8;
        }

        function overlapsNodes(tipX, tipY, side) {
            var tLeft = tipX - tipRadius - 12;
            var tRight = tipX + tipRadius + 12;
            var tTop = tipY - tipRadius - 12;
            var tBottom = tipY + tipRadius + 12;
            var bubbleRect = getBubbleRect(tipX, tipY, side);
            tLeft = Math.min(tLeft, bubbleRect.left);
            tRight = Math.max(tRight, bubbleRect.right);
            tTop = Math.min(tTop, bubbleRect.top);
            tBottom = Math.max(tBottom, bubbleRect.bottom);

            for (var j = 0; j < nodeRects.length; j++) {
                var nr = nodeRects[j];
                if (tLeft < nr.right && tRight > nr.left && tTop < nr.bottom && tBottom > nr.top) {
                    return true;
                }
            }
            return false;
        }

        const nodeLeft = anchorPos.x - NODE_HALF;
        const nodeRight = anchorPos.x + NODE_HALF;
        const nodeTop = anchorPos.y - NODE_HALF;
        const nodeBottom = anchorPos.y + NODE_HALF;
        const spaceRight = viewportWidth - nodeRight;
        const spaceLeft = nodeLeft;
        const spaceBelow = viewportHeight - nodeBottom;
        const spaceAbove = nodeTop;
        const needed = TIP_SIZE + GAP_FROM_NODE + CONNECTOR_PEAK_GAP;
        var sides = [];

        function evaluateSide(side, tipX, tipY, rawScore) {
            var bubbleRect = getBubbleRect(tipX, tipY, side);
            var outOfViewport = !isRectInViewport(bubbleRect);
            var occlusion = overlapsNodes(tipX, tipY, side);
            var score = rawScore;
            if (outOfViewport) score *= 0.2;
            if (occlusion) score *= 0.1;
            sides.push({ x: tipX, y: tipY, side: side, score: score });
        }

        if (spaceRight >= needed) {
            var tipX = nodeRight + GAP_FROM_NODE + TIP_HALF;
            var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            evaluateSide('right', tipX, tipY, spaceRight * 1.0);
        }

        if (spaceLeft >= needed) {
            var tipX = nodeLeft - GAP_FROM_NODE - TIP_HALF;
            var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
            evaluateSide('left', tipX, tipY, spaceLeft * 0.85);
        }

        if (spaceBelow >= needed) {
            var tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            var tipY = nodeBottom + GAP_FROM_NODE + TIP_HALF;
            evaluateSide('below', tipX, tipY, spaceBelow * 0.7);
        }

        if (spaceAbove >= needed) {
            var tipX = clamp(anchorPos.x, TIP_HALF + 20, viewportWidth - TIP_HALF - 20);
            var tipY = nodeTop - GAP_FROM_NODE - TIP_HALF;
            evaluateSide('above', tipX, tipY, spaceAbove * 0.6);
        }

        if (!sides.length) {
            var fallbacks = [];
            if (spaceRight > TIP_HALF + 8) {
                var tipX = clamp(nodeRight + 4 + TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                fallbacks.push({ x: tipX, y: tipY, side: 'right', score: overlapsNodes(tipX, tipY, 'right') ? 5 : 50 });
            }
            if (spaceLeft > TIP_HALF + 8) {
                var tipX = clamp(nodeLeft - 4 - TIP_HALF, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(anchorPos.y, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                fallbacks.push({ x: tipX, y: tipY, side: 'left', score: overlapsNodes(tipX, tipY, 'left') ? 4 : 40 });
            }
            if (spaceBelow > TIP_HALF + 8) {
                var tipX = clamp(anchorPos.x, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(nodeBottom + 4 + TIP_HALF, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                fallbacks.push({ x: tipX, y: tipY, side: 'below', score: overlapsNodes(tipX, tipY, 'below') ? 3 : 30 });
            }
            if (spaceAbove > TIP_HALF + 8) {
                var tipX = clamp(anchorPos.x, TIP_HALF + 8, viewportWidth - TIP_HALF - 8);
                var tipY = clamp(nodeTop - 4 - TIP_HALF, TIP_HALF + 20, viewportHeight - TIP_HALF - 20);
                fallbacks.push({ x: tipX, y: tipY, side: 'above', score: overlapsNodes(tipX, tipY, 'above') ? 2 : 20 });
            }

            if (fallbacks.length) {
                fallbacks.sort(function (a, b) { return b.score - a.score; });
                return fallbacks[0];
            }
        }

        if (sides.length) {
            sides.sort(function (a, b) { return b.score - a.score; });
            return sides[0];
        }

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

        const endX = tipPos.x - (side === 'left' ? TIP_HALF : side === 'right' ? -TIP_HALF : 0);
        const endY = tipPos.y - (side === 'above' ? TIP_HALF : side === 'below' ? -TIP_HALF : 0);
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

    function positionBubble(bubble, tipPos) {
        if (tipPos.side === 'right') {
            bubble.style.left = `${TIP_SIZE + BUBBLE_GAP}px`;
            bubble.style.top = '50%';
            bubble.style.transform = 'translateY(-50%) scale(0.96)';
            bubble.style.transformOrigin = 'left center';
            return;
        }
        if (tipPos.side === 'left') {
            bubble.style.right = `${TIP_SIZE + BUBBLE_GAP}px`;
            bubble.style.top = '50%';
            bubble.style.transform = 'translateY(-50%) scale(0.96)';
            bubble.style.transformOrigin = 'right center';
            return;
        }
        if (tipPos.side === 'below') {
            bubble.style.left = '50%';
            bubble.style.top = `${TIP_SIZE + BUBBLE_GAP}px`;
            bubble.style.transform = 'translateX(-50%) scale(0.96)';
            bubble.style.transformOrigin = 'top center';
            return;
        }
        bubble.style.left = '50%';
        bubble.style.bottom = `${TIP_SIZE + BUBBLE_GAP}px`;
        bubble.style.transform = 'translateX(-50%) scale(0.96)';
        bubble.style.transformOrigin = 'bottom center';
    }

    function createPlusTipElement(anchorMem, labelText, helperText) {
        const anchorPos = calcPosition(anchorMem);
        const tipPos = getPlusTipPosition(anchorPos, anchorMem);
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'memory-add-affordance affordance-tooltip-bubble';
        button.setAttribute('aria-label', labelText);
        button.style.position = 'absolute';
        button.style.left = `${tipPos.x - TIP_HALF}px`;
        button.style.top = `${tipPos.y - TIP_HALF}px`;
        button.style.width = `${TIP_SIZE}px`;
        button.style.height = `${TIP_SIZE}px`;
        button.style.borderRadius = '50%';
        button.style.border = 'none';
        button.style.background = 'rgba(144, 73, 81, 0.92)';
        button.style.color = '#fff';
        button.style.cursor = 'pointer';
        button.style.zIndex = '5';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.boxSizing = 'border-box';
        button.style.padding = '0';
        button.style.gap = '10px';
        button.style.overflow = 'hidden';
        button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
        button.style.transition = 'width 0.16s ease, border-radius 0.16s ease, background 0.16s ease, box-shadow 0.16s ease, padding 0.16s ease';

        const plusIcon = documentRef.createElement('span');
        plusIcon.setAttribute('aria-hidden', 'true');
        plusIcon.textContent = '+';
        plusIcon.style.width = '28px';
        plusIcon.style.height = '28px';
        plusIcon.style.borderRadius = '50%';
        plusIcon.style.display = 'inline-flex';
        plusIcon.style.alignItems = 'center';
        plusIcon.style.justifyContent = 'center';
        plusIcon.style.background = 'linear-gradient(180deg, rgba(144, 73, 81, 1), rgba(144, 73, 81, 0.88))';
        plusIcon.style.color = '#fff';
        plusIcon.style.fontSize = '17px';
        plusIcon.style.fontWeight = '700';
        plusIcon.style.flex = '0 0 auto';
        plusIcon.style.boxShadow = '0 6px 14px rgba(144, 73, 81, 0.22)';
        button.appendChild(plusIcon);

        const textWrap = documentRef.createElement('span');
        textWrap.className = 'affordance-tip-text';
        textWrap.style.display = 'none';
        textWrap.style.flexDirection = 'column';
        textWrap.style.alignItems = 'flex-start';
        textWrap.style.minWidth = '0';

        const titleEl = documentRef.createElement('span');
        titleEl.textContent = labelText;
        titleEl.style.fontSize = '13px';
        titleEl.style.fontWeight = '700';
        titleEl.style.color = 'var(--on-surface)';
        titleEl.style.lineHeight = '1.25';
        titleEl.style.whiteSpace = 'normal';
        textWrap.appendChild(titleEl);

        if (helperText) {
            const hintEl = documentRef.createElement('span');
            hintEl.textContent = helperText;
            hintEl.style.fontSize = '11px';
            hintEl.style.fontWeight = '600';
            hintEl.style.color = 'var(--on-surface-variant)';
            hintEl.style.lineHeight = '1.25';
            hintEl.style.opacity = '0.82';
            hintEl.style.whiteSpace = 'normal';
            textWrap.appendChild(hintEl);
        }

        button.appendChild(textWrap);

        let bubbleExpanded = false;

        function showBubble() {
            if (bubbleExpanded) return;
            bubbleExpanded = true;
            button.style.width = `${BUBBLE_WIDTH}px`;
            button.style.borderRadius = '999px';
            button.style.justifyContent = 'flex-start';
            button.style.padding = '8px 14px 8px 8px';
            button.style.border = '1px solid rgba(144, 73, 81, 0.18)';
            button.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,246,244,0.96))';
            button.style.boxShadow = '0 12px 28px rgba(75, 64, 57, 0.13)';
            button.style.backdropFilter = 'blur(8px)';
            textWrap.style.display = 'flex';
            textWrap.style.gap = '1px';
            button.setAttribute('aria-expanded', 'true');
        }

        function hideBubble() {
            if (!bubbleExpanded) return;
            bubbleExpanded = false;
            button.style.width = `${TIP_SIZE}px`;
            button.style.borderRadius = '50%';
            button.style.justifyContent = 'center';
            button.style.padding = '0';
            button.style.border = 'none';
            button.style.background = 'rgba(144, 73, 81, 0.92)';
            button.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.25)';
            button.style.backdropFilter = 'none';
            textWrap.style.display = 'none';
            textWrap.style.gap = '0';
            button.setAttribute('aria-expanded', 'false');
        }

        button.addEventListener('mouseenter', showBubble);
        button.addEventListener('mouseleave', hideBubble);
        button.addEventListener('focus', showBubble);
        button.addEventListener('blur', hideBubble);
        button.addEventListener('touchstart', showBubble, { passive: true });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddMomentFromCanvas();
        });

        ['mousedown', 'pointerdown', 'touchstart'].forEach((eventName) => {
            button.addEventListener(eventName, (e) => {
                e.stopPropagation();
            });
        });

        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                openAddMomentFromCanvas();
            }
            if (e.key === 'Escape') {
                hideBubble();
                button.blur();
            }
        });

        drawConnectorLine(anchorPos, tipPos, tipPos.side);
        canvas.appendChild(button);
    }

    function renderGrowthAffordance(anchorMem, options) {
        if (!anchorMem) return;
        const opts = options || {};
        const labelText = opts.labelText || (i18n('editor_add_memory') || '새 순간 이어가기');
        const isFirstStep = opts.isFirstStep;
        const helperText = opts.helperText
            || (isFirstStep
                ? (i18n('growth_first_step_hint') || '첫 순간에서 이어지는 감정을 기록해보세요')
                : (i18n('growth_continue_hint') || '선택한 순간 뒤로 감정이 이어져요'))
            || '';

        createPlusTipElement(anchorMem, labelText, helperText);
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
