document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvasArea');
    const svg = document.getElementById('canvasSvg');
    const detailPanel = document.getElementById('detailPanel');
    const addBtn = document.getElementById('addMemoryBtn');

    // ── 단일 상태 기준: window.memories ──
    // 로컬 사본 없이 전역 배열만 참조.
    // push는 window.memories에만 하고, 조회는 treeMemories()로 필터링.
    const tree = getTrees()[0];
    if (!tree) {
        console.warn('Tree data not found. Editor cannot initialize.');
        return;
    }
    let selectedNodeId = 'root';

    const treeMemories = () => window.memories.filter(m => m.treeId === tree.id);

    // ── 배치 상수 ──
    const ROOT_X = 400, ROOT_Y = 300;
    const RADIUS_L1 = 250;  // root → 자식 반경
    const RADIUS_L2 = 150;  // 자식 → 손자 반경

    // 초기 노드 고정 각도 (도 단위, 12시방향 = -90)
    const FIXED_ANGLES = {
        v1: -60, v2: -130, v3: 10,
        m2: 130, m3: -170, m4: 70
    };

    // parentId 기준 위치 계산
    const calcPosition = (mem, visited = new Set()) => {
        if (mem.id === 'root') return { x: ROOT_X, y: ROOT_Y };
        // 순환 참조 방지: 이미 방문한 노드면 root 위치 fallback
        if (visited.has(mem.id)) return { x: ROOT_X, y: ROOT_Y };
        visited.add(mem.id);

        const parentId = mem.parentId || 'root';
        // 자기 자신을 부모로 참조하면 root fallback
        if (parentId === mem.id) return { x: ROOT_X, y: ROOT_Y };

        const siblings = treeMemories().filter(m => m.parentId === parentId && m.id !== 'root');
        const idx = siblings.indexOf(mem);
        const count = siblings.length;

        if (parentId === 'root') {
            let angle;
            if (FIXED_ANGLES[mem.id] !== undefined) {
                angle = FIXED_ANGLES[mem.id];
            } else {
                angle = count > 0 ? (idx / count) * 360 - 90 : -90;
            }
            return {
                x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
            };
        }

        const parent = window.memories.find(m => m.id === parentId);
        // 부모를 찾지 못하면 root fallback
        if (!parent) return { x: ROOT_X, y: ROOT_Y };
        const parentPos = calcPosition(parent, visited);
        const angle = count > 0 ? ((idx + 0.5) / count) * 360 : 0;
        return {
            x: parentPos.x + RADIUS_L2 * Math.cos(angle * Math.PI / 180),
            y: parentPos.y + RADIUS_L2 * Math.sin(angle * Math.PI / 180)
        };
    };

    // ── 안정적 ID 생성: m-prefix 숫자 최대값 + 1 ──
    const nextMemoryId = () => {
        let max = 0;
        window.memories.forEach(m => {
            const match = m.id.match(/^m(\d+)$/);
            if (match) max = Math.max(max, parseInt(match[1]));
        });
        return 'm' + (max + 1);
    };

    // ── 패널 갱신 ──
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

    // ── 노드 선택 ──
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

    // ── 그리기 ──
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

    // ── 초기화 ──
    const initCanvas = () => {
        drawRoot();

        treeMemories().filter(m => m.id !== 'root').forEach(node => {
            drawNode(node);
            const parentId = node.parentId || 'root';
            const parent = treeMemories().find(m => m.id === parentId);
            const startPos = parent ? calcPosition(parent) : { x: ROOT_X, y: ROOT_Y };
            drawBranch(startPos, calcPosition(node));
        });

        selectNodeById('root');
    };

    // ── 새 메모리 추가 ──
    const addMemoryFromPrompt = () => {
        const url = prompt('YouTube 링크를 입력하세요:\n(예: https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
        if (!url) return;

        const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!match) { alert('유효한 YouTube 링크가 아닙니다.'); return; }
        const videoId = match[1];

        // selectedNodeId 유효성 보정: 존재하지 않거나 비정상이면 root로
        let parentId = selectedNodeId;
        if (!parentId || (!treeMemories().find(m => m.id === parentId) && parentId !== 'root')) {
            parentId = 'root';
        }

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
            parentId: parentId,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            createdAt: dateStr,
            artist: '',
            source: 'YouTube',
            delay: '0.5s'
        };

        // 단일 push: window.memories만
        window.memories.push(newMemory);

        // 캔버스에 노드 + branch 추가
        drawNode(newMemory);
        const effectiveParentId = newMemory.parentId || 'root';
        const parent = treeMemories().find(m => m.id === effectiveParentId);
        const startPos = parent ? calcPosition(parent) : { x: ROOT_X, y: ROOT_Y };
        drawBranch(startPos, calcPosition(newMemory));

        // 새 노드 선택
        const el = document.querySelector(`.memory-node[data-memory-id="${newMemory.id}"]`);
        if (el) selectNode(el, newMemory);
    };

    // ── 이벤트 ──
    if (addBtn) addBtn.addEventListener('click', addMemoryFromPrompt);

    initCanvas();
});
