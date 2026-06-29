(function () {
    function createEditorCanvasBranchPorts(deps) {
        const {
            canvas,
            svg,
            documentRef,
            calcPosition,
            openAddMoment,
            getTreeMemories,
            getCanonicalRootId,
            isRootMemory,
            i18n,
            constants
        } = deps;

        const { NODE_HALF } = constants;
        const PORT_SIZE = 18;
        const PORT_HALF = PORT_SIZE / 2;
        const PORT_OFFSET_FRAC = 0.38;

        /**
         * Eight port definitions: [id, side, dx, dy]
         * dx/dy are fractions of NODE_HALF, offset from node center
         */
        var PORT_DEFS = [
            ['up-left',     'up',    -PORT_OFFSET_FRAC, -1],
            ['up-right',    'up',     PORT_OFFSET_FRAC, -1],
            ['down-left',   'down',  -PORT_OFFSET_FRAC,  1],
            ['down-right',  'down',   PORT_OFFSET_FRAC,  1],
            ['left-top',    'left',  -1,  -PORT_OFFSET_FRAC],
            ['left-bottom', 'left',  -1,   PORT_OFFSET_FRAC],
            ['right-top',   'right',  1,  -PORT_OFFSET_FRAC],
            ['right-bottom','right',  1,   PORT_OFFSET_FRAC]
        ];

        var PORT_DIRECTION_LABELS = {
            'up-left': '위쪽 왼쪽',
            'up-right': '위쪽 오른쪽',
            'down-left': '아래쪽 왼쪽',
            'down-right': '아래쪽 오른쪽',
            'left-top': '왼쪽 위',
            'left-bottom': '왼쪽 아래',
            'right-top': '오른쪽 위',
            'right-bottom': '오른쪽 아래'
        };

        function getPortDirectionLabel(port) {
            return PORT_DIRECTION_LABELS[port.id] || port.id || port.side || '브랜치';
        }

        function getAddDirectionAriaLabel(directionLabel) {
            var template = typeof i18n === 'function'
                ? i18n('editor_add_memory_direction')
                : '';
            if (!template || template === 'editor_add_memory_direction') {
                template = '{direction} 방향에 새 순간 추가';
            }
            return String(template).replace('{direction}', directionLabel);
        }

        function getPortPositions(centerX, centerY) {
            var ports = [];
            for (var i = 0; i < PORT_DEFS.length; i++) {
                var def = PORT_DEFS[i];
                ports.push({
                    id: def[0],
                    side: def[1],
                    x: centerX + def[2] * NODE_HALF,
                    y: centerY + def[3] * NODE_HALF
                });
            }
            return ports;
        }

        function clearPorts() {
            canvas.querySelectorAll('.branch-port-handle').forEach(function (el) { el.remove(); });
            svg.querySelectorAll('.branch-port-highlight').forEach(function (el) { el.remove(); });
        }

        function createPortButton(port, mem) {
            var btn = documentRef.createElement('button');
            btn.type = 'button';
            btn.className = 'branch-port-handle';
            btn.dataset.portId = port.id;
            btn.dataset.side = port.side;
            btn.dataset.memoryId = mem.id;

            var directionLabel = getPortDirectionLabel(port);
            btn.setAttribute('aria-label', getAddDirectionAriaLabel(directionLabel));
            btn.setAttribute('title', directionLabel + ' 브랜치');
            btn.tabIndex = -1;
            btn.setAttribute('aria-hidden', 'true');

            // Inline styles for positioning + appearance
            btn.style.position = 'absolute';
            btn.style.left = (port.x - PORT_HALF) + 'px';
            btn.style.top = (port.y - PORT_HALF) + 'px';
            btn.style.width = PORT_SIZE + 'px';
            btn.style.height = PORT_SIZE + 'px';
            btn.style.borderRadius = '50%';
            btn.style.border = '2px solid rgba(144, 73, 81, 0.35)';
            btn.style.background = 'rgba(255, 255, 255, 0.88)';
            btn.style.cursor = 'pointer';
            btn.style.zIndex = '4';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.padding = '0';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '700';
            btn.style.color = 'rgba(144, 73, 81, 0.65)';
            btn.style.lineHeight = '1';
            btn.style.boxShadow = '0 1px 4px rgba(75, 64, 57, 0.08)';
            btn.style.boxSizing = 'border-box';
            btn.style.transition = 'transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, opacity 0.15s ease';
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';

            // Set the + icon
            var iconSpan = documentRef.createElement('span');
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.textContent = '+';
            iconSpan.style.fontSize = '13px';
            iconSpan.style.fontWeight = '700';
            iconSpan.style.color = 'inherit';
            iconSpan.style.lineHeight = '1';
            btn.appendChild(iconSpan);

            // Hover expansion
            btn.addEventListener('mouseenter', function () {
                btn.style.transform = 'scale(1.3)';
                btn.style.background = 'rgba(144, 73, 81, 0.92)';
                btn.style.color = '#fff';
                btn.style.boxShadow = '0 3px 10px rgba(144, 73, 81, 0.30)';
                btn.style.borderColor = 'rgba(144, 73, 81, 0.6)';
            });

            btn.addEventListener('mouseleave', function () {
                btn.style.transform = 'scale(1)';
                btn.style.background = 'rgba(255, 255, 255, 0.88)';
                btn.style.color = 'rgba(144, 73, 81, 0.65)';
                btn.style.boxShadow = '0 1px 4px rgba(75, 64, 57, 0.08)';
                btn.style.borderColor = 'rgba(144, 73, 81, 0.35)';
                // 선택 상태(tabIndex=0)면 저-강도 노출 유지, 비선택이면 완전 숨김
                btn.style.opacity = btn.tabIndex === 0 ? '0.35' : '0';
            });

            // Click → open add-moment
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof openAddMoment === 'function') {
                    openAddMoment();
                } else {
                    var addBtn = documentRef.getElementById('addMemoryBtn');
                    if (addBtn) addBtn.click();
                }
            });

            // Prevent drag/pan from starting on port handles
            btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            btn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });

            btn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof openAddMoment === 'function') {
                        openAddMoment();
                    }
                }
            });

            canvas.appendChild(btn);
            return btn;
        }

        function renderPortsForNode(mem) {
            if (!mem) return;
            var pos = calcPosition(mem);
            var ports = getPortPositions(pos.x, pos.y);
            var buttons = [];
            for (var i = 0; i < ports.length; i++) {
                buttons.push(createPortButton(ports[i], mem));
            }
            return buttons;
        }

        function showPortsForMemory(mem) {
            if (!mem) return;
            var els = canvas.querySelectorAll('.branch-port-handle');
            var targetId = mem.id;

            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.dataset.memoryId === targetId) {
                    // 선택 node: 저-강도 노출, Tab 도달 가능, aria 활성화
                    el.style.opacity = '0.35';
                    el.style.pointerEvents = 'auto';
                    el.tabIndex = 0;
                    el.setAttribute('aria-hidden', 'false');
                }
            }
        }

        function hidePortsForMemory(mem) {
            if (!mem) return;
            var els = canvas.querySelectorAll('.branch-port-handle');
            var targetId = mem.id;

            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.dataset.memoryId === targetId) {
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                    el.tabIndex = -1;
                    el.setAttribute('aria-hidden', 'true');
                }
            }
        }

        function hideAllPorts() {
            var els = canvas.querySelectorAll('.branch-port-handle');
            for (var i = 0; i < els.length; i++) {
                els[i].style.opacity = '0';
                els[i].style.pointerEvents = 'none';
                els[i].tabIndex = -1;
                els[i].setAttribute('aria-hidden', 'true');
            }
        }

        /**
         * Draw a curved branch line FROM a specific port to a target position.
         * Uses cubic bezier for smooth auto-routing.
         */
        function drawBranchFromPort(portDef, fromPos, toPos) {
            var path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
            var side = portDef.side;

            // Determine control point offsets based on port side
            var cpOffsetX = 0, cpOffsetY = 0;
            var exitDist = NODE_HALF * 0.7;

            switch (side) {
                case 'right':
                    cpOffsetX = exitDist;
                    break;
                case 'left':
                    cpOffsetX = -exitDist;
                    break;
                case 'up':
                    cpOffsetY = -exitDist;
                    break;
                case 'down':
                    cpOffsetY = exitDist;
                    break;
            }

            var startX = portDef.x;
            var startY = portDef.y;
            var endX = toPos.x;
            var endY = toPos.y;

            // Control point 1: extended from port direction
            var cp1x = startX + cpOffsetX;
            var cp1y = startY + cpOffsetY;

            // Control point 2: approaching target
            var midX = (startX + endX) / 2;
            var midY = (startY + endY) / 2;
            var cp2x = endX - (endX - midX) * 0.3;
            var cp2y = endY - (endY - midY) * 0.3;

            var d = 'M ' + startX + ',' + startY +
                    ' C ' + cp1x + ',' + cp1y + ' ' +
                    cp2x + ',' + cp2y + ' ' +
                    endX + ',' + endY;

            path.setAttribute('d', d);
            path.setAttribute('class', 'branch-line branch-port-highlight');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'rgba(144, 73, 81, 0.40)');
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-dasharray', '3 4');
            path.setAttribute('opacity', '0.7');
            svg.appendChild(path);
        }

        return {
            clearPorts: clearPorts,
            renderPortsForNode: renderPortsForNode,
            showPortsForMemory: showPortsForMemory,
            hidePortsForMemory: hidePortsForMemory,
            hideAllPorts: hideAllPorts,
            getPortPositions: getPortPositions,
            drawBranchFromPort: drawBranchFromPort
        };
    }

    window.createEditorCanvasBranchPorts = createEditorCanvasBranchPorts;
})();
