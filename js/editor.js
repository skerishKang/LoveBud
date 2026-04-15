document.addEventListener('DOMContentLoaded', () => {
    // ── 인증 가드: onAuthReady 콜백 기반 ──
    const startEditor = () => {
        const canvas = document.getElementById('canvasArea');
        const svg = document.getElementById('canvasSvg');
        const detailPanel = document.getElementById('detailPanel');
        const addBtn = document.getElementById('addMemoryBtn');

        const tree = getTrees()[0];
        if (!tree) {
            console.warn('Tree data not found.');
            return;
        }
        let selectedNodeId = 'root';

        const treeMemories = () => window.memories.filter(m => m.treeId === tree.id);

        // ── 배치 상수 ──
        const ROOT_X = 400, ROOT_Y = 300;
        const RADIUS_L1 = 250;
        const RADIUS_L2 = 150;

        const FIXED_ANGLES = {
            v1: -60, v2: -130, v3: 10,
            m2: 130, m3: -170, m4: 70
        };

        const calcPosition = (mem, visited = new Set()) => {
            if (mem.id === 'root') return { x: ROOT_X, y: ROOT_Y };

            // 순환 참조 방지
            if (visited.has(mem.id)) {
                console.warn(`Cycle detected at memory ${mem.id}, falling back to root`);
                return { x: ROOT_X, y: ROOT_Y };
            }
            visited.add(mem.id);

            const parentId = mem.parentId || 'root';

            // 자기참조 방지
            if (parentId === mem.id) {
                console.warn(`Self-reference detected for ${mem.id}, using root as parent`);
                return { x: ROOT_X, y: ROOT_Y };
            }

            const siblings = treeMemories().filter(m => m.parentId === parentId && m.id !== 'root');
            const idx = siblings.indexOf(mem);
            const count = siblings.length;

            if (parentId === 'root') {
                let angle = (FIXED_ANGLES[mem.id] !== undefined)
                    ? FIXED_ANGLES[mem.id]
                    : (count > 0 ? (idx / count) * 360 - 90 : -90);
                return {
                    x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                    y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
                };
            }

            const parent = window.memories.find(m => m.id === parentId);
            const parentPos = parent ? calcPosition(parent, visited) : { x: ROOT_X, y: ROOT_Y };
            const angle = count > 0 ? (idx / count) * 360 : 0;
            return {
                x: parentPos.x + RADIUS_L2 * Math.cos(angle * Math.PI / 180),
                y: parentPos.y + RADIUS_L2 * Math.sin(angle * Math.PI / 180)
            };
        };

        const nextMemoryId = () => {
            let max = 0;
            window.memories.forEach(m => {
                const match = m.id.match(/^m(\d+)$/);
                if (match) max = Math.max(max, parseInt(match[1]));
            });
            return 'm' + (max + 1);
        };

        const updateDetailPanel = (data) => {
            detailPanel.querySelector('h3').textContent = data.title;
            const imgEl = detailPanel.querySelector('.detail-video img');
            if (imgEl) imgEl.src = data.thumbnail;
            const dateEl = document.getElementById('detailDateText');
            if (dateEl) dateEl.textContent = data.timestamp;
            const tagsContainer = detailPanel.querySelector('.tags-container');
            if (tagsContainer && data.emotionTags) {
                tagsContainer.innerHTML = data.emotionTags.map(tag =>
                    `<span class="tag tag-primary">${tag}</span>`
                ).join('');
            }
            const noteEl = detailPanel.querySelector('.diary-note');
            if (noteEl) noteEl.textContent = data.memo || '';
        };

        const selectNode = (el, data) => {
            selectedNodeId = data.id;
            document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
            el.classList.add('selected');
            updateDetailPanel(data);
        };

        const selectNodeById = (id) => {
            const node = treeMemories().find(m => m.id === id);
            if (!node) return;
            selectedNodeId = id;
            if (id === 'root') {
                document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
                updateDetailPanel(node);
                return;
            }
            const el = document.querySelector(`.memory-node[data-memory-id="${id}"]`);
            if (el) selectNode(el, node);
        };

        const drawRoot = () => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", ROOT_X);
            circle.setAttribute("cy", ROOT_Y);
            circle.setAttribute("r", "10");
            circle.setAttribute("fill", "var(--primary)");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "3");
            svg.appendChild(circle);
        };

        const drawBranch = (startPos, endPos) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
            const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
            path.setAttribute("d", d);
            path.setAttribute("class", "branch-line");
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "var(--secondary)");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("opacity", "0.5");
            svg.appendChild(path);
        };

        const drawNode = (mem) => {
            const pos = calcPosition(mem);
            const nodeEl = document.createElement('div');
            nodeEl.className = 'memory-node floating-node';
            nodeEl.dataset.memoryId = mem.id;
            nodeEl.style.left = `${pos.x - 40}px`;
            nodeEl.style.top = `${pos.y - 40}px`;
            nodeEl.style.animationDelay = mem.delay || '0s';
            nodeEl.innerHTML = `
                <div class="node-card">
                    <div class="node-img-wrapper">
                        <img src="${mem.thumbnail}" alt="${mem.title}">
                    </div>
                </div>
                <div class="node-info-label">
                    <p class="node-title">${mem.title}</p>
                    <p class="node-date">${mem.timestamp}</p>
                </div>
            `;
            nodeEl.addEventListener('click', () => selectNode(nodeEl, mem));
            canvas.appendChild(nodeEl);
        };

        const initCanvas = () => {
            drawRoot();
            treeMemories().filter(m => m.id !== 'root').forEach(node => {
                drawNode(node);
                const parentId = node.parentId || 'root';
                const parent = treeMemories().find(m => m.id === parentId);
                if (parent) drawBranch(calcPosition(parent), calcPosition(node));
            });
            selectNodeById('root');
        };

        const addMemoryFromPrompt = () => {
            const url = prompt('YouTube 링크를 입력하세요:\n(예: https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
            if (!url) return;
            const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
            if (!match) { alert('유효한 YouTube 링크가 아닙니다.'); return; }
            const videoId = match[1];
            const today = new Date();
            const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

            const newMemory = {
                id: nextMemoryId(),
                treeId: tree.id,
                title: prompt('이 기억의 제목은?', '새로운 기억') || '새로운 기억',
                memo: prompt('이 기억의 메모를 남겨보세요:', '') || '',
                timestamp: dateStr,
                sourceUrl: `https://www.youtube.com/embed/${videoId}`,
                sourceType: 'youtube',
                emotionTags: ['기록'],
                parentId: selectedNodeId,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                createdAt: dateStr,
                artist: '',
                source: 'YouTube',
                delay: '0.5s'
            };

            window.memories.push(newMemory);
            drawNode(newMemory);
            const effectiveParentId = newMemory.parentId || 'root';
            const parent = treeMemories().find(m => m.id === effectiveParentId);
            if (parent) drawBranch(calcPosition(parent), calcPosition(newMemory));

            const el = document.querySelector(`.memory-node[data-memory-id="${newMemory.id}"]`);
            if (el) selectNode(el, newMemory);
        };

        if (addBtn) addBtn.addEventListener('click', addMemoryFromPrompt);
        initCanvas();
        console.log('Editor ready — memories:', treeMemories().length);
    };

    // ── 인증 상태에 따라 시작 ──
    // Use onAuthStateChanged directly (not onAuthReady) to avoid race conditions
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length) {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe(); // One-shot: only need the first resolution
            if (!user) {
                window.location.href = 'login.html?redirect=editor.html';
                return;
            }
            startEditor();
        });
    } else {
        // Firebase unavailable (offline/dev) — skip guard
        startEditor();
    }
});