(function() {
    const cards = Array.from(document.querySelectorAll('.growth-stage-card'));
    if (!cards.length || typeof fetch !== 'function') return;
    if (document.getElementById('hero-growth-video')) return;

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
