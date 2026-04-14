document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const svg = document.getElementById('organic-svg');
    const detailPanel = document.getElementById('detailPanel');

    // Sample Memory Data (based on mockup)
    const memories = [
        {
            id: 'root',
            x: 400,
            y: 300,
            type: 'root'
        },
        {
            id: 'm1',
            x: 650,
            y: 150,
            title: '2023 서울 콘서트',
            date: '05.21 - 강렬한 순간',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC1sD0mb4hZlWtWDWB_FO94T7c9tCgX7MLHnvMHq0s2hcBlkj5OB6ItTBvUzDJ2j4GbkUSsNKi5ApwcgNFELEuruPtunZBTT1BsDStb9dsYSFtAGcyDnaQ7-nFODuXGWBp56rn54R09xwcbGa6gr0a9wSpy2cZDZNhTHo7TIoe_lPBDhoiv0NdGH4DwnCz2dBiHFqe46SRtuy1DOekxB85atyTLStp2MIjJCcLYBe34wfdlSKvPdSBT2F2hZ-w07ihSzyWFYxFIPeY',
            delay: '1s'
        },
        {
            id: 'm2',
            x: 150,
            y: 400,
            title: '첫 입덕 숏폼',
            date: '04.12 - 호기심 개시',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBAZCNgT8x1SqpOUkJ96DWvXw_P65NfLHGuKe6_QdYtFjZJo-3MCKSnhn3b73TOOVjMJ_7xOBRmntRLv0e3YxwgnCHzJ9t9L3K8y30vcDLQDz8hxvk4vMrJ3laFT8hEUcI8GO2JJnfxWpvUd1PtbVIfjXoODP5iwSA_wFpeK7VOMwlRr1kIdl-nTUMsHwVjPkdkfAXWU71tj-UtBLZI0bnoedhDMq4SYG95Ba0aTvbxGGBJN_r6KRDNQUGXpCrPKtlznC55JUQbB8',
            delay: '0.5s'
        },
        {
            id: 'm3',
            x: 700,
            y: 550,
            title: '퇴근길 실물 영접',
            date: '06.05 - 떨림의 시간',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrWsB6Evx4iHGNNg4ZRTIYZytQJoo7k_ifxzzU28H6M7Nob_nZ58BkkMyBcP1UzHLLcO0iUWaGRjzd2h_YBVNWKfAJ6oqlr-2gq-cLtE_SJ0YCAa2atrnsCOWR6iY_HfM3W6-JzLBlxHPW_d3WRldC5ZybuguIkCbTkAa1f761Az61ByQpII4m0KNUSXin8BJZLJJ_UWXyEsF4T8-HY89o7FQAJeddQ7U4UfIYOsIMGh7rVoiZbXBa9SODOGrb77KnqjevmMT8VMQ',
            delay: '2s'
        },
        {
            id: 'm4',
            x: 900,
            y: 200,
            title: '공식 굿즈 도착',
            date: '07.01 - 소유의 기쁨',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvRZCwwiIkdklz1NO2MXzO4-uK6kxx_PB3z92JqbOFy5Ar-nknhmjinNrJ50YV_IpoVcN8ElcO9XaPnlOhrKlWRAIAT6IyU-i_QqTRKw-ZPWRQ30PYEyBhD_J_FnhsXL9T9_gngDVKltWsGSyDVSz-sOIxriMYhinCysQp9JwfCz4ZKywPTrU4FZ94lHWaH2Prr2RS1jSah1_4Ovmu9mPQ6vn23cxzt_Va6rcTvqi4nr9Epi7VCw78efNXh8ptqAXwElj2VzKmPnQ',
            delay: '3s'
        }
    ];

    // Initialize Canvas
    const initCanvas = () => {
        // Draw Root
        const root = memories.find(m => m.type === 'root');
        drawRoot(root);

        // Draw Nodes and Branches
        memories.filter(m => m.type !== 'root').forEach(node => {
            drawNode(node);
            drawBranch(root, node);
        });
    };

    const drawRoot = (root) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", root.x);
        circle.setAttribute("cy", root.y);
        circle.setAttribute("r", "6");
        circle.setAttribute("fill", "var(--secondary)");
        svg.appendChild(circle);
    };

    const drawBranch = (start, end) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const cp1x = start.x + (end.x - start.x) / 2;
        const cp1y = start.y;
        const d = `M ${start.x},${start.y} Q ${cp1x},${start.y} ${end.x},${end.y}`;
        
        path.setAttribute("d", d);
        path.setAttribute("class", "branch-line");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "var(--secondary)");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("opacity", "0.5");
        svg.appendChild(path);
    };

    const drawNode = (node) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'memory-node floating-node';
        nodeEl.style.left = `${node.x - 40}px`;
        nodeEl.style.top = `${node.y - 40}px`;
        nodeEl.style.animationDelay = node.delay;
        
        nodeEl.innerHTML = `
            <div class="node-card">
                <div class="node-img-wrapper">
                    <img src="${node.img}" alt="${node.title}">
                </div>
            </div>
            <div class="node-info-label">
                <p class="node-title">${node.title}</p>
                <p class="node-date">${node.date}</p>
            </div>
        `;

        nodeEl.addEventListener('click', () => selectNode(nodeEl, node));
        canvas.appendChild(nodeEl);
    };

    const selectNode = (el, data) => {
        // Deselect others
        document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
        el.classList.add('selected');

        // Update Detail Panel
        const panel = document.getElementById('detailPanel');
        panel.querySelector('h3').textContent = 'Memory Detail';
        panel.querySelector('.detail-video img').src = data.img;
        panel.querySelector('.detail-info-group p').textContent = data.date;
        
        // Update tags (simplified)
        const tagsContainer = panel.querySelector('.tags-container');
        tagsContainer.innerHTML = `
            <span class="tag tag-primary">강렬한 (Intense)</span>
            <span class="tag tag-secondary">환희 (Euphoria)</span>
            <span class="tag tag-neutral">여운 (Lingering)</span>
        `;
        
        // Update diary note with node specific text (adding to data first)
        const content = data.title === '2023 서울 콘서트' 
            ? '"마지막 앙코르 곡이 울려 퍼질 때, 그 순간의 공기와 팬들의 함성 소리가 아직도 생생해. 세상에 우리만 있는 것 같은 그런 기분."'
            : `"${data.title}의 기억. 이 순간의 감정은 무엇과도 바꿀 수 없는 소중한 보물입니다. 당신의 사랑이 피어나는 현장."`;
            
        panel.querySelector('.diary-note').textContent = content;

        console.log('Selected:', data.title);
    };

    initCanvas();
    console.log('Editor Canvas Initialized');
});
