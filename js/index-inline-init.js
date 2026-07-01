(function() {
    const title = document.querySelector('.home-v3-title');
    const desc = document.querySelector('.home-v3-desc');
    const actions = document.querySelector('.home-v3-actions');
    if (!title || !desc || !actions || document.getElementById('home-hero-set-2')) return;

    const createI18nSpan = (className, key, fallback) => {
        const span = document.createElement('span');
        span.className = className;
        span.setAttribute('data-i18n', key);
        span.textContent = fallback;
        return span;
    };

    const createI18nParagraph = (key, fallback) => {
        const paragraph = document.createElement('p');
        paragraph.className = 'home-v3-desc';
        paragraph.setAttribute('data-i18n', key);
        paragraph.textContent = fallback;
        return paragraph;
    };

    const loop = document.createElement('div');
    loop.className = 'home-hero-loop-container';

    const set1 = document.createElement('div');
    set1.className = 'home-hero-copy-set active';
    set1.id = 'home-hero-set-1';
    set1.appendChild(title);
    set1.appendChild(desc);

    const set2 = document.createElement('div');
    set2.className = 'home-hero-copy-set';
    set2.id = 'home-hero-set-2';

    const alternateTitle = document.createElement('h1');
    alternateTitle.className = 'home-v3-title';
    alternateTitle.appendChild(createI18nSpan('soft', 'home.v3.title2.soft', '첫 순간이 하나의'));
    alternateTitle.appendChild(createI18nSpan('warm', 'home.v3.title2.warm', '러브트리로'));
    alternateTitle.appendChild(createI18nSpan('accent', 'home.v3.title2.accent', '이어져요'));

    set2.appendChild(alternateTitle);
    set2.appendChild(createI18nParagraph('home.v3.desc2', '반했던 장면과 오래 남은 마음을, 감정이 이어진 경로로 천천히 남겨 보세요.'));

    loop.appendChild(set1);
    loop.appendChild(set2);
    actions.parentNode.insertBefore(loop, actions);

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) return;

    let activeSet = 1;
    window.setInterval(function toggleHomeHeroCopy() {
        if (activeSet === 1) {
            set1.classList.remove('active');
            set2.classList.add('active');
            activeSet = 2;
        } else {
            set2.classList.remove('active');
            set1.classList.add('active');
            activeSet = 1;
        }
    }, 3500);
})();

(function() {
    const cards = Array.from(document.querySelectorAll('.growth-stage-card'));
    if (!cards.length || typeof fetch !== 'function') return;
    if (document.getElementById('hero-growth-video')) return;

    const stage = document.querySelector('.home-v3-growth-stage');
    const normalizeText = (value) => String(value || '').toLowerCase();
    const getThumbnail = (tree) => String(
        tree?.representativeThumbnail
        || tree?.representative_thumbnail
        || tree?.thumbnail
        || ''
    ).trim();
    const isBtsTree = (tree) => normalizeText(`${tree?.title || ''} ${tree?.id || ''}`).includes('bts');
    const hasSameTree = (list, tree) => list.some((item) => item && tree && item.id === tree.id);
    const selectHeroTrees = (trees) => {
        const usable = Array.isArray(trees)
            ? trees.filter((tree) => tree && getThumbnail(tree))
            : [];
        const selected = [];
        const btsTree = usable.find(isBtsTree);
        if (btsTree) selected.push(btsTree);
        usable.forEach((tree) => {
            if (selected.length >= cards.length) return;
            if (!hasSameTree(selected, tree)) selected.push(tree);
        });
        return selected.slice(0, cards.length);
    };
    const fetchTrees = (sort) => fetch(`/api/community/trees?view=summary&sort=${sort}&limit=8`, {
        headers: { Accept: 'application/json' }
    }).then((response) => {
        if (!response.ok) throw new Error(`Hero trees ${sort} failed: ${response.status}`);
        return response.json();
    });

    fetchTrees('popular')
        .catch(() => fetchTrees('latest'))
        .then(selectHeroTrees)
        .then((trees) => {
            trees.forEach((tree, index) => {
                const thumbnail = getThumbnail(tree);
                if (!thumbnail || !cards[index]) return;

                const img = new Image();
                img.onload = () => {
                    cards[index].style.setProperty('--moment-image', `url("${thumbnail.replace(/"/g, '%22')}")`);
                    cards[index].classList.add('has-hero-thumbnail');
                    if (stage) {
                        stage.classList.add('has-real-thumbnails');
                    }
                };
                img.onerror = () => {
                    // Silently fail to preserve CSS gradient fallback and avoid console clutter
                };
                img.src = thumbnail;
            });
        })
        .catch(() => {});
})();

(function() {
    const video = document.getElementById('hero-growth-video');
    if (!video) return;
    const collage = video.closest('.home-v3-collage');
    const activateVideoUI = () => {
        collage?.classList.remove('is-video-pending');
        collage?.classList.add('is-video-active');
    };
    const deactivateVideoUI = () => {
        collage?.classList.remove('is-video-pending');
        collage?.classList.remove('is-video-active');
    };
    const checkReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (checkReducedMotion()) {
        deactivateVideoUI();
        video.style.display = 'none';
        video.pause();
        return;
    }

    video.addEventListener('playing', activateVideoUI);

    video.addEventListener('error', function() {
        deactivateVideoUI();
        video.style.display = 'none';
    });

    video.play().catch(() => {
        deactivateVideoUI();
        video.style.display = 'none';
    });
})();

window.LovetreePageShell.initSharedPage({
    renderHeader: true,
    applyI18n: true
});
