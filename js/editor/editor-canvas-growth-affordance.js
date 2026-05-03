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
        AFFORDANCE_OFFSET_X,
        AFFORDANCE_OFFSET_Y,
        AFFORDANCE_CARD_HALF
    } = constants;

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
        const edgePadding = 28;
        const minCenterX = AFFORDANCE_CARD_HALF + edgePadding;
        const maxCenterX = metrics.width - AFFORDANCE_CARD_HALF - edgePadding;
        const hasRightRoom = anchorPos.x + NODE_HALF + AFFORDANCE_CARD_HALF + edgePadding <= metrics.width;
        const hasLeftRoom = anchorPos.x - NODE_HALF - AFFORDANCE_CARD_HALF - edgePadding >= 0;
        const shouldPlaceLeft = !hasRightRoom && hasLeftRoom;

        return {
            x: Math.max(
                minCenterX,
                Math.min(
                    shouldPlaceLeft ? anchorPos.x - AFFORDANCE_OFFSET_X : anchorPos.x + AFFORDANCE_OFFSET_X,
                    maxCenterX
                )
            ),
            y: Math.max(110, Math.min(anchorPos.y - AFFORDANCE_OFFSET_Y, metrics.height - 80)),
            side: shouldPlaceLeft ? 'left' : 'right'
        };
    }

    function drawGrowthAffordanceBranch(startPos, endPos, side) {
        const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
        const tension = side === 'left' ? 0.55 : 0.45;
        const cp1x = startPos.x + ((endPos.x - startPos.x) * tension);
        const cp1y = Math.min(startPos.y, endPos.y) - 18;
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
        wrap.style.left = `${affPos.x - AFFORDANCE_CARD_HALF}px`;
        wrap.style.top = `${affPos.y - 30}px`;
        wrap.style.zIndex = '4';
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

        const titleEl = documentRef.createElement('span');
        titleEl.textContent = labelText;
        titleEl.style.fontSize = '13px';
        titleEl.style.fontWeight = '700';
        titleEl.style.color = 'var(--on-surface)';
        titleEl.style.lineHeight = '1.25';

        textWrap.appendChild(titleEl);

        if (helperText) {
            const hintEl = documentRef.createElement('span');
            hintEl.textContent = helperText;
            hintEl.style.fontSize = '11px';
            hintEl.style.fontWeight = '600';
            hintEl.style.color = 'var(--on-surface-variant)';
            hintEl.style.lineHeight = '1.25';
            hintEl.style.opacity = '0.82';
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

        drawGrowthAffordanceBranch(
            {
                x: anchorPos.x + (affPos.side === 'left' ? (-NODE_HALF + 2) : (NODE_HALF - 2)),
                y: anchorPos.y + 4
            },
            {
                x: affPos.x + (affPos.side === 'left' ? 72 : -72),
                y: affPos.y
            },
            affPos.side
        );
        canvas.appendChild(wrap);
    }

    function renderGrowthAffordance(anchorMem, options) {
        if (!anchorMem) return;
        const opts = options || {};
        const labelText = opts.labelText || (i18n('editor_add_memory') || '새 순간 이어가기');
        const helperText = opts.isFirstStep
            ? ''
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
