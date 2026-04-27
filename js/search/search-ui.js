window.LoveBudSearchUI = {
    showLoading(show) {
        const loading = document.getElementById('searchLoading');
        if (loading) loading.classList.toggle('hidden', !show);
    },

    showError(message) {
        const error = document.getElementById('searchError');
        if (error) {
            error.textContent = message;
            error.classList.toggle('hidden', !message);
        }
    },

    showNoResults(show) {
        const noResults = document.getElementById('noResults');
        if (noResults) noResults.classList.toggle('hidden', !show);
    },

    syncControlsFromState() {
        const State = window.LoveBudSearchState;
        const sortButtons = document.querySelectorAll('[data-browse-sort]');
        sortButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.browseSort === State.currentSort);
        });

        const limitButtons = document.querySelectorAll('[data-browse-limit]');
        limitButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.browseLimit, 10) === State.currentLimit);
        });
    },

    setPreviewMobileState(active) {
        const previewPanel = document.getElementById('searchPreviewPanel');
        const overlay = document.getElementById('previewOverlay');
        const body = document.body;

        if (previewPanel) previewPanel.classList.toggle('active', active);
        if (overlay) overlay.classList.toggle('active', active);

        // Prevent body scroll on mobile when preview is open
        if (window.innerWidth <= 1024) {
            body.style.overflow = active ? 'hidden' : '';
        }
    },

    updateLanguageLabels() {
        if (typeof window.applyI18n === 'function') {
            window.applyI18n();
        }

        const locale = (typeof window.getCurrentLocale === 'function') ? window.getCurrentLocale() : 'ko';
        const labels = {
            ko: {
                total: '전체',
                latest: '최신순',
                popular: '인기순',
                limit10: '10개씩',
                limit30: '30개씩',
                limit60: '60개씩'
            },
            en: {
                total: 'All',
                latest: 'Latest',
                popular: 'Popular',
                limit10: '10 items',
                limit30: '30 items',
                limit60: '60 items'
            }
        };

        const currentLabels = labels[locale] || labels.ko;

        // Update tag chips text if "All"
        document.querySelectorAll('.tag-chip').forEach(chip => {
            if (chip.dataset.category === '전체') {
                chip.textContent = currentLabels.total;
            }
        });

        // Update sort buttons text if needed
        document.querySelectorAll('[data-browse-sort]').forEach(btn => {
            const sort = btn.dataset.browseSort;
            if (sort === 'latest') btn.textContent = currentLabels.latest;
            if (sort === 'popular') btn.textContent = currentLabels.popular;
        });

        // Update limit buttons text if needed
        document.querySelectorAll('[data-browse-limit]').forEach(btn => {
            const limit = btn.dataset.browseLimit;
            if (limit === '10') btn.textContent = currentLabels.limit10;
            if (limit === '30') btn.textContent = currentLabels.limit30;
            if (limit === '60') btn.textContent = currentLabels.limit60;
        });
    },

    clearPreviewContent() {
        const container = document.getElementById('previewContent');
        if (container) container.innerHTML = '';

        const placeholder = document.getElementById('previewPlaceholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const empty = document.getElementById('previewEmpty');
        if (empty) empty.classList.add('hidden');
    },

    showPreviewLoading() {
        const placeholder = document.getElementById('previewPlaceholder');
        if (placeholder) placeholder.classList.add('hidden');

        const empty = document.getElementById('previewEmpty');
        if (empty) empty.classList.add('hidden');

        const container = document.getElementById('previewContent');
        if (container) {
            container.innerHTML = `
                <div class="preview-loading-state">
                    <div class="loading-spinner"></div>
                    <p data-i18n="search.preview.loading">준비 중...</p>
                </div>
            `;
        }
    },

    renderPreviewContent(tree, treeData) {
        const container = document.getElementById('previewContent');
        if (!container) return;

        const placeholder = document.getElementById('previewPlaceholder');
        if (placeholder) placeholder.classList.add('hidden');

        const empty = document.getElementById('previewEmpty');
        if (empty) empty.classList.add('hidden');

        if (!tree || !treeData) {
            container.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }

        // Use established renderer for preview panel hydration
        if (window.LoveBudSearchPreviewRenderer && typeof window.LoveBudSearchPreviewRenderer.renderPreview === 'function') {
            window.LoveBudSearchPreviewRenderer.renderPreview(container, tree, treeData);
        } else {
            console.warn('LoveBudSearchPreviewRenderer not found, using basic fallback');
            container.innerHTML = `<h3>${tree.title || 'Untitled Tree'}</h3>`;
        }
    },

    renderResults(trees, resultsList, onCardClick) {
        if (!resultsList) return;
        resultsList.innerHTML = '';

        if (!trees || trees.length === 0) {
            this.showNoResults(true);
            return;
        }

        this.showNoResults(false);

        trees.forEach(tree => {
            const card = document.createElement('div');
            card.className = 'tree-card';
            card.dataset.treeId = tree.id;

            // Use established card renderer
            if (window.LoveBudSearchCardRenderer && typeof window.LoveBudSearchCardRenderer.renderCard === 'function') {
                window.LoveBudSearchCardRenderer.renderCard(card, tree);
            } else {
                card.innerHTML = `<div class="tree-card-title">${tree.title}</div>`;
            }

            card.addEventListener('click', (e) => {
                if (typeof onCardClick === 'function') {
                    onCardClick(tree, card, e);
                }
            });

            resultsList.appendChild(card);
        });
    },

    renderGrowingResults(trees, growingList, onCardClick) {
        if (!growingList) return;
        growingList.innerHTML = '';

        if (!trees || trees.length === 0) {
            const growingSection = document.getElementById('growingTreesSection');
            if (growingSection) growingSection.classList.add('hidden');
            return;
        }

        const growingSection = document.getElementById('growingTreesSection');
        if (growingSection) growingSection.classList.remove('hidden');

        trees.forEach(tree => {
            const card = document.createElement('div');
            card.className = 'tree-card growing';
            card.dataset.treeId = tree.id;

            if (window.LoveBudSearchCardRenderer && typeof window.LoveBudSearchCardRenderer.renderCard === 'function') {
                window.LoveBudSearchCardRenderer.renderCard(card, tree);
            } else {
                card.innerHTML = `<div class="tree-card-title">${tree.title}</div>`;
            }

            card.addEventListener('click', (e) => {
                if (typeof onCardClick === 'function') {
                    onCardClick(tree, card, e);
                }
            });

            growingList.appendChild(card);
        });
    }
};
