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
        NODE_HALF,
        AFFORDANCE_CARD_HALF
    } = constants;
    const AFFORDANCE_SAFE_GAP = 28;
    const AFFORDANCE_EDGE_PADDING = 28;
    const AFFORDANCE_MIN_WIDTH = 174;
    const AFFORDANCE_HEIGHT = 64;

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

    function getGrowthAffordancePosition(anchorPos) {
        const metrics = getMetrics();
        const viewportWidth = Math.max(canvas.clientWidth || metrics.width, 320);
        const viewportHeight = Math.max(canvas.clientHeight || metrics.height, 320);
        const width = Math.min(AFFORDANCE_CARD_HALF * 2, Math.max(AFFORDANCE_MIN_WIDTH, viewportWidth - (AFFORDANCE_EDGE_PADDING * 2)));
        const cardHalf = width / 2;
        const minCenterX = cardHalf + AFFORDANCE_EDGE_PADDING;
        const maxCenterX = viewportWidth - cardHalf - AFFORDANCE_EDGE_PADDING;
        const nodeLeft = anchorPos.x - NODE_HALF;
        const nodeRight = anchorPos.x + NODE_HALF;
        const rightCenterX = nodeRight + AFFORDANCE_SAFE_GAP + cardHalf;
        const leftCenterX = nodeLeft - AFFORDANCE_SAFE_GAP - cardHalf;
        const hasRightRoom = rightCenterX + cardHalf + AFFORDANCE_EDGE_PADDING <= viewportWidth;
        const hasLeftRoom = leftCenterX - cardHalf - AFFORDANCE_EDGE_PADDING >= 0;
        const preferRight = anchorPos.x < viewportWidth * 0.56;
        let side = preferRight
            ? (hasRightRoom ? 'right' : (hasLeftRoom ? 'left' : 'below'))
            : (hasLeftRoom ? 'left' : (hasRightRoom ? 'right' : 'below'));
        let x = side === 'left' ? leftCenterX : rightCenterX;
        let y = clamp(anchorPos.y - 10, 110, viewportHeight - 80);

        if (side === 'below') {
            x = clamp(anchorPos.x, minCenterX, maxCenterX);
            const belowY = anchorPos.y + NODE_HALF + AFFORDANCE_SAFE_GAP + (AFFORDANCE_HEIGHT / 2);
            const aboveY = anchorPos.y - NODE_HALF - AFFORDANCE_SAFE_GAP - (AFFORDANCE_HEIGHT / 2);
            y = belowY + (AFFORDANCE_HEIGHT / 2) + AFFORDANCE_EDGE_PADDING <= viewportHeight
                ? belowY
                : clamp(aboveY, AFFORDANCE_EDGE_PADDING + (AFFORDANCE_HEIGHT / 2), viewportHeight - AFFORDANCE_EDGE_PADDING - (AFFORDANCE_HEIGHT / 2));
            side = belowY + (AFFORDANCE_HEIGHT / 2) + AFFORDANCE_EDGE_PADDING <= viewportHeight ? 'below' : 'above';
        }

        return {
            x: clamp(x, minCenterX, maxCenterX),
            y,
            side,
            width,
            height: AFFORDANCE_HEIGHT,
            cardHalf
        };
    }

    function drawGrowthAffordanceBranch(startPos, endPos, side) {
        const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
        const tension = side === 'left' || side === 'above' ? 0.55 : 0.45;
        const cp1x = startPos.x + ((endPos.x - startPos.x) * tension);
        const cp1y = side === 'below'
            ? Math.max(startPos.y, endPos.y) + 18
            : Math.min(startPos.y, endPos.y) - 18;
        const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${cp1y} ${endPos.x},${endPos.y}`;
        path.setAttribute('d', d);
        path.setAttribute('class', 'branch-line branch-line-affordance');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(144, 73, 81, 0.42)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-dasharray', '6 7');
        path.setAttribute('opacity', '0.95');
        svg.appendChild(path);
    }

    function createGrowthAffordanceElement(anchorMem, labelText, helperText) {
        const anchorPos = calcPosition(anchorMem);
        const affPos = getGrowthAffordancePosition(anchorPos);
        const wrap = documentRef.createElement('button');
        wrap.type = 'button';
        wrap.className = 'memory-add-affordance';
        wrap.setAttribute('aria-label', labelText);
        wrap.style.position = 'absolute';
        wrap.style.left = `${affPos.x - affPos.cardHalf}px`;
        wrap.style.top = `${affPos.y - (affPos.height / 2)}px`;
        wrap.style.zIndex = '4';
        wrap.style.width = `${affPos.width}px`;
        wrap.style.minHeight = `${affPos.height}px`;
        wrap.style.boxSizing = 'border-box';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';
        wrap.style.padding = '10px 14px 10px 10px';
        wrap.style.border = '1px solid rgba(144, 73, 81, 0.18)';
        wrap.style.borderRadius = '999px';
        wrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,246,244,0.96))';
        wrap.style.boxShadow = '0 12px 28px rgba(75, 64, 57, 0.10)';
        wrap.style.cursor = 'pointer';
        wrap.style.backdropFilter = 'blur(8px)';
        wrap.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease';

        const plusBubble = documentRef.createElement('span');
        plusBubble.textContent = '+';
        plusBubble.style.width = '32px';
        plusBubble.style.height = '32px';
        plusBubble.style.borderRadius = '50%';
        plusBubble.style.display = 'inline-flex';
        plusBubble.style.alignItems = 'center';
        plusBubble.style.justifyContent = 'center';
        plusBubble.style.background = 'linear-gradient(180deg, rgba(144, 73, 81, 1), rgba(144, 73, 81, 0.88))';
        plusBubble.style.color = '#fff';
        plusBubble.style.fontSize = '18px';
        plusBubble.style.fontWeight = '700';
        plusBubble.style.flex = '0 0 auto';
        plusBubble.style.boxShadow = '0 6px 14px rgba(144, 73, 81, 0.22)';

        const textWrap = documentRef.createElement('span');
        textWrap.style.display = 'flex';
        textWrap.style.flexDirection = 'column';
        textWrap.style.alignItems = 'flex-start';
        textWrap.style.gap = helperText ? '1px' : '0';
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

        wrap.appendChild(plusBubble);
        wrap.appendChild(textWrap);

        wrap.addEventListener('mouseenter', () => {
            wrap.style.transform = 'translateY(-2px)';
            wrap.style.boxShadow = '0 16px 30px rgba(144, 73, 81, 0.16)';
        });
        wrap.addEventListener('mouseleave', () => {
            wrap.style.transform = 'translateY(0)';
            wrap.style.boxShadow = '0 12px 28px rgba(75, 64, 57, 0.10)';
        });
        wrap.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddMomentFromCanvas();
        });
        ['mousedown', 'pointerdown', 'touchstart'].forEach((eventName) => {
            wrap.addEventListener(eventName, (e) => {
                e.stopPropagation();
            });
        });

        const branchStart = {
            x: anchorPos.x + (affPos.side === 'left' ? (-NODE_HALF + 2) : (affPos.side === 'right' ? (NODE_HALF - 2) : 0)),
            y: anchorPos.y + (affPos.side === 'below' ? (NODE_HALF - 2) : (affPos.side === 'above' ? (-NODE_HALF + 2) : 4))
        };
        const branchEnd = {
            x: affPos.x + (affPos.side === 'left' ? affPos.cardHalf - 36 : (affPos.side === 'right' ? -affPos.cardHalf + 36 : 0)),
            y: affPos.y + (affPos.side === 'below' ? -(affPos.height / 2) : (affPos.side === 'above' ? (affPos.height / 2) : 0))
        };

        drawGrowthAffordanceBranch(
            branchStart,
            branchEnd,
            affPos.side
        );
        canvas.appendChild(wrap);
    }

    function renderGrowthAffordance(anchorMem, options) {
        if (!anchorMem) return;
        const opts = options || {};
        const labelText = opts.labelText || (i18n('editor_add_memory') || '새 순간 이어가기');
        const isFirstStep = opts.isFirstStep;
        const helperText = isFirstStep
            ? (i18n('growth_first_step_hint') || '첫 순간에서 이어지는 감정을 기록해보세요')
            : (opts.helperText || i18n('growth_continue_hint') || '선택한 순간 뒤로 감정이 이어져요');

        createGrowthAffordanceElement(anchorMem, labelText, helperText);
    }

    return {
        clearGrowthAffordance,
        openAddMomentFromCanvas,
        getGrowthAffordancePosition,
        drawGrowthAffordanceBranch,
        createGrowthAffordanceElement,
        renderGrowthAffordance
    };
}

window.createEditorCanvasGrowthAffordance = createEditorCanvasGrowthAffordance;
