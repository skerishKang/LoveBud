document.addEventListener('DOMContentLoaded', async () => {
    const State = window.LoveBudSearchState;
    const Url = window.LoveBudSearchUrl;
    const UI = window.LoveBudSearchUI;
    const Loader = window.LoveBudSearchLoader;

    const resultsList = document.getElementById('resultsList');
    const growingTreesList = document.getElementById('growingTreesList');
    const growingTreesSection = document.getElementById('growingTreesSection');
    const searchInput = document.getElementById('searchInput');
    const tagChips = document.querySelectorAll('.tag-chip');
    const previewMobileClose = document.getElementById('previewMobileClose');

    UI.syncStaticBrowseCopy();
    Url.restoreStateFromUrl();

    // Export loadPublicTrees to window for UI controls
    window.loadPublicTrees = (options) => Loader.loadPublicTrees(options, renderResults);

    function selectTree(tree, activeCard) {
        if (!tree) {
            UI.clearSelectedPreview();
            return;
        }

        State.selectedTreeId = tree.id;
        Url.updateUrlState();
        UI.markActiveCard(activeCard);
        UI.setMobilePreviewOpen(true, { scrollIntoView: true });

        Loader.hydrateSelectedTreePreview(tree, renderResults);
    }

    function attachCardEvents(listElement, trees) {
        if (!listElement || !Array.isArray(trees)) return;

        listElement.querySelectorAll('.tree-card').forEach(card => {
            card.addEventListener('click', () => {
                const treeId = card.dataset.treeId;
                const tree = trees.find(t => t.id === treeId);
                if (tree) {
                    selectTree(tree, card);
                }
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const treeId = card.dataset.treeId;
                    const tree = trees.find(t => t.id === treeId);
                    if (tree) {
                        selectTree(tree, card);
                    }
                }
            });
        });
    }

    function renderResults(resetPreviewWhenNoSelection = true) {
        if (State.loadError) {
            UI.renderLoadErrorState();
            return;
        }

        const filteredTrees = State.getFilteredTrees();

        UI.ensureBrowseControls(window.loadPublicTrees);
        UI.syncBrowseHead();

        if (window.LoveBudSearchCardRenderer) {
            window.LoveBudSearchCardRenderer.renderList(resultsList, filteredTrees, State.selectedTreeId, State.currentQuery);
        }

        if (State.apiTreesLoaded && State.selectedTreeId) {
            const stillExists = State.getSelectedTreeFromFiltered(filteredTrees);
            if (!stillExists && resetPreviewWhenNoSelection) {
                UI.clearSelectedPreview();
            } else {
                UI.syncActiveCard();
                if (window.LoveBudSearchPreviewRenderer) {
                    const hydratedTree = Loader.readPreviewCache(State.selectedTreeId) || State.allTrees.find(t => t.id === State.selectedTreeId);
                    if (hydratedTree) {
                        window.LoveBudSearchPreviewRenderer.updatePreview(hydratedTree);
                    }
                }
            }
        }

        attachCardEvents(resultsList, filteredTrees);
    }

    function renderGrowingResults() {
        if (!growingTreesSection || !growingTreesList) return;

        if (!State.growingTrees || State.growingTrees.length === 0) {
            growingTreesSection.style.display = 'none';
            return;
        }

        growingTreesSection.style.display = 'block';

        if (window.LoveBudSearchCardRenderer) {
            window.LoveBudSearchCardRenderer.renderList(growingTreesList, State.growingTrees, State.selectedTreeId, '');
        }

        attachCardEvents(growingTreesList, State.growingTrees);
    }

    // Events
    if (previewMobileClose) {
        previewMobileClose.addEventListener('click', () => {
            UI.setMobilePreviewOpen(false);
        });
    }

    document.addEventListener('click', (e) => {
        const shareBtn = e.target.closest('.share-link-btn');
        if (!shareBtn) return;
        const treeId = shareBtn.dataset.treeId;
        if (!treeId) return;

        const shareUrl = `${window.location.origin}/pages/detail.html?tree=${encodeURIComponent(treeId)}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            const icon = shareBtn.querySelector('.material-symbols-outlined');
            if (icon) {
                const originalText = icon.textContent;
                icon.textContent = 'check';
                setTimeout(() => { icon.textContent = originalText; }, 2000);
            }
            alert(UI.getSearchCopy('search.shareLinkCopied', '러브트리 링크가 복사되었습니다.', 'LoveTree link copied to clipboard.'));
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });

    const mobilePreviewMediaQuery = window.matchMedia('(max-width: 768px)');
    mobilePreviewMediaQuery.addEventListener('change', () => {
        UI.syncPreviewVisibility();
    });

    // Start load
    await Promise.all([
        window.loadPublicTrees({ resetSelection: false }),
        Loader.loadGrowingTrees(renderGrowingResults)
    ]);

    Url.restoreStateFromUrl();
    Url.applySelectedTreeFromUrl(selectTree);

    let searchInputTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            State.currentQuery = e.target.value.trim();
            if (searchInputTimer) clearTimeout(searchInputTimer);
            searchInputTimer = setTimeout(() => {
                renderResults(false);
                Url.updateUrlState();
            }, 180);
        });
    }

    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            State.currentCategory = chip.dataset.category || chip.textContent.trim();
            renderResults(false);
            Url.updateUrlState();
        });
    });

    window.addEventListener('popstate', async () => {
        const previousSort = State.currentSort;
        const previousLimit = State.currentLimit;
        Url.restoreStateFromUrl();
        if (previousSort !== State.currentSort || previousLimit !== State.currentLimit) {
            await window.loadPublicTrees({ resetSelection: true });
        } else {
            renderResults(false);
        }
        UI.syncBrowseHead();
    });
});
