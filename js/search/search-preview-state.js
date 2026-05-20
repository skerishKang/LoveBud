(function () {
    'use strict';

    function getCardContainers(refs) {
        refs = refs || {};
        return [refs.resultsList, refs.growingList].filter(Boolean);
    }

    function markActiveCard(activeCard, refs) {
        getCardContainers(refs).forEach(function (container) {
            container.querySelectorAll('.tree-card.is-active').forEach(function (card) {
                card.classList.remove('is-active');
                card.setAttribute('aria-pressed', 'false');
            });
        });

        if (activeCard) {
            activeCard.classList.add('is-active');
            activeCard.setAttribute('aria-pressed', 'true');
        }
    }

    function findActiveCard(state, refs) {
        var selectedTreeId = state && state.selectedTreeId;
        if (!selectedTreeId) return null;

        var containers = getCardContainers(refs);
        for (var i = 0; i < containers.length; i += 1) {
            var cards = containers[i].querySelectorAll('.tree-card');
            for (var j = 0; j < cards.length; j += 1) {
                if (cards[j].dataset && cards[j].dataset.treeId === selectedTreeId) {
                    return cards[j];
                }
            }
        }
        return null;
    }

    function syncActiveCard(state, refs) {
        var activeCard = findActiveCard(state, refs);
        markActiveCard(activeCard || null, refs);
        return activeCard;
    }

    function clearSelectedPreview(ctx, options) {
        ctx = ctx || {};
        options = options || {};

        var state = ctx.state || {};
        var refs = ctx.refs || {};
        var PreviewRenderer = ctx.PreviewRenderer || {};
        var ui = ctx.ui || {};
        var preserveOpenState = Boolean(options.preserveOpenState);

        state.selectedTreeId = null;
        state.currentPreviewRequestId = Number(state.currentPreviewRequestId || 0) + 1;
        markActiveCard(null, refs);

        if (PreviewRenderer && typeof PreviewRenderer.resetPreview === 'function') {
            PreviewRenderer.resetPreview();
        }

        var isMobile = typeof ui.isMobilePreviewMode === 'function' && ui.isMobilePreviewMode();
        if (!preserveOpenState && isMobile && typeof ui.setMobilePreviewOpen === 'function') {
            ui.setMobilePreviewOpen(false);
        }
    }

    function createPreviewStateController(config, ui) {
        config = config || {};
        var refs = config.refs || {};
        var state = config.state || {};
        var renderers = config.renderers || {};
        var PreviewRenderer = renderers.PreviewRenderer || {};
        var ctx = {
            refs: refs,
            state: state,
            PreviewRenderer: PreviewRenderer,
            ui: ui || {}
        };

        return {
            markActiveCard: function (activeCard) {
                return markActiveCard(activeCard, refs);
            },
            syncActiveCard: function () {
                return syncActiveCard(state, refs);
            },
            clearSelectedPreview: function (options) {
                return clearSelectedPreview(ctx, options);
            }
        };
    }

    function patchSearchUIFactory() {
        var SearchUI = window.LoveBudSearchUI;
        if (!SearchUI || typeof SearchUI.createSearchUI !== 'function' || SearchUI.__previewStatePatched) return;

        var originalCreateSearchUI = SearchUI.createSearchUI;
        SearchUI.createSearchUI = function (config) {
            var ui = originalCreateSearchUI(config);
            if (!ui) return ui;

            var controller = createPreviewStateController(config || {}, ui);
            ui.markActiveCard = controller.markActiveCard;
            ui.syncActiveCard = controller.syncActiveCard;
            ui.clearSelectedPreview = controller.clearSelectedPreview;
            ui.__previewStatePatched = true;
            return ui;
        };

        SearchUI.__previewStatePatched = true;
    }

    window.LoveBudSearchPreviewState = {
        getCardContainers: getCardContainers,
        markActiveCard: markActiveCard,
        findActiveCard: findActiveCard,
        syncActiveCard: syncActiveCard,
        clearSelectedPreview: clearSelectedPreview,
        createPreviewStateController: createPreviewStateController,
        patchSearchUIFactory: patchSearchUIFactory
    };

    patchSearchUIFactory();
})();
