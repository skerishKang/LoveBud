(function () {
    'use strict';

    function isInteractiveTarget(target, card) {
        if (!target || typeof target.closest !== 'function') return false;
        var interactiveSelector = 'a, button, input, select, textarea, [data-share-tree-link], [data-action], [role="button"]';
        var interactiveChild = target.closest(interactiveSelector);
        return !!(interactiveChild && interactiveChild !== card);
    }

    function isActivationKey(event) {
        return !!event && (event.key === 'Enter' || event.key === ' ');
    }

    function shouldUseMobileOpen(win) {
        var targetWindow = win || window;
        return targetWindow.innerWidth < 480;
    }

    function getCardActivationAction(event, card, win) {
        if (!event || !card) return 'ignore';
        if (event.defaultPrevented) return 'ignore';
        if (event.type === 'click' && isInteractiveTarget(event.target, card)) return 'ignore';
        if (event.type === 'keydown') {
            if (!isActivationKey(event)) return 'ignore';
            if (isInteractiveTarget(event.target, card)) return 'ignore';
        }
        return shouldUseMobileOpen(win) ? 'open' : 'select';
    }

    function resolveViewerHref(tree) {
        var cardRenderer = window.LoveBudSearchCardRenderer;
        return cardRenderer && typeof cardRenderer.getTreeViewerHref === 'function'
            ? cardRenderer.getTreeViewerHref(tree)
            : '';
    }

    function patchSearchUIFactory() {
        var SearchUI = window.LoveBudSearchUI;
        if (!SearchUI || typeof SearchUI.createSearchUI !== 'function' || SearchUI.__cardEventsPatched) return;

        var originalCreateSearchUI = SearchUI.createSearchUI;
        SearchUI.createSearchUI = function (config) {
            var ui = originalCreateSearchUI(config);
            if (!ui) return ui;

            var refs = (config && config.refs) || {};
            var state = (config && config.state) || {};
            var callbacks = (config && config.callbacks) || {};
            var treeDataMap = new WeakMap();
            var boundContainers = new WeakSet();

            function bindDelegatedCardEvents(container) {
                if (!container || boundContainers.has(container)) return;
                boundContainers.add(container);

                container.addEventListener('click', function (event) {
                    var card = event.target && event.target.closest
                        ? event.target.closest('.tree-card[data-tree-id]')
                        : null;
                    if (!card || !container.contains(card)) return;

                    var action = getCardActivationAction(event, card, window);
                    if (action === 'ignore') return;

                    var tree = treeDataMap.get(card);
                    if (!tree) return;

                    if (action === 'open') {
                        var viewerHref = resolveViewerHref(tree);
                        if (viewerHref) {
                            event.preventDefault();
                            window.location.href = viewerHref;
                            return;
                        }
                    }

                    if (typeof callbacks.selectTree === 'function') {
                        callbacks.selectTree(tree, card);
                    }
                });

                container.addEventListener('keydown', function (event) {
                    var card = event.target && event.target.closest
                        ? event.target.closest('.tree-card[data-tree-id]')
                        : null;
                    if (!card || !container.contains(card)) return;

                    var action = getCardActivationAction(event, card, window);
                    if (action === 'ignore') return;

                    event.preventDefault();

                    var tree = treeDataMap.get(card);
                    if (!tree) return;

                    if (action === 'open') {
                        var viewerHref = resolveViewerHref(tree);
                        if (viewerHref) {
                            window.location.href = viewerHref;
                            return;
                        }
                    }

                    if (typeof callbacks.selectTree === 'function') {
                        callbacks.selectTree(tree, card);
                    }
                });
            }

            ui.attachCardEvents = function (listElement, trees) {
                if (!listElement) return;
                var safeTrees = Array.isArray(trees) ? trees : [];
                var cards = listElement.querySelectorAll('.tree-card');

                cards.forEach(function (card) {
                    var treeId = card.dataset.treeId;
                    var tree = safeTrees.find(function (item) { return item.id === treeId; });
                    if (!tree) return;

                    card.setAttribute('tabindex', '0');
                    card.setAttribute('role', 'button');
                    card.setAttribute('aria-pressed', tree.id === state.selectedTreeId ? 'true' : 'false');
                    treeDataMap.set(card, tree);
                });

                bindDelegatedCardEvents(listElement);

                var cardRenderer = window.LoveBudSearchCardRenderer;
                if (cardRenderer && cardRenderer.bindCardImageHandlers) {
                    cardRenderer.bindCardImageHandlers(listElement);
                }
            };

            ui.__cardEventsPatched = true;
            return ui;
        };

        SearchUI.__cardEventsPatched = true;
    }

    window.LoveBudSearchCardEvents = {
        isInteractiveTarget: isInteractiveTarget,
        isActivationKey: isActivationKey,
        shouldUseMobileOpen: shouldUseMobileOpen,
        getCardActivationAction: getCardActivationAction,
        resolveViewerHref: resolveViewerHref,
        patchSearchUIFactory: patchSearchUIFactory
    };

    patchSearchUIFactory();
})();
