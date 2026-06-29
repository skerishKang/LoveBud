(function () {
  'use strict';

  function isInteractiveTarget(target) {
    return !!(target && target.closest && target.closest('.tree-card-open-link, .tree-card-edit-link, button, a[href]'));
  }

  function isActivationKey(event) {
    return !!event && (event.key === 'Enter' || event.key === ' ');
  }

  function shouldUseMobileOpen(win) {
    var targetWindow = win || window;
    return targetWindow.innerWidth < 480;
  }

  function getCardActivationAction(event, win) {
    if (event && event.type === 'click' && isInteractiveTarget(event.target)) {
      return 'ignore';
    }

    if (event && event.type === 'keydown' && !isActivationKey(event)) {
      return 'ignore';
    }

    return shouldUseMobileOpen(win) ? 'open' : 'select';
  }

  function stopOpenLinkPropagation(card) {
    if (!card || typeof card.querySelector !== 'function') return null;

    var openLink = card.querySelector('.tree-card-open-link');
    if (openLink) {
      openLink.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }

    var editLink = card.querySelector('.tree-card-edit-link');
    if (editLink) {
      editLink.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }

    return openLink;
  }

  function resolveOpenHref(card, tree) {
    var openLink = card && card.querySelector ? card.querySelector('.tree-card-open-link') : null;
    if (openLink && openLink.getAttribute('href')) {
      return openLink.getAttribute('href');
    }

    var basePath = (typeof window.LoveBudPath !== 'undefined' && window.LoveBudPath.getBasePath)
      ? window.LoveBudPath.getBasePath()
      : (window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');

    var isPublicTree = tree && (tree.visibility === 'public');
    if (isPublicTree) {
      return basePath + 'view.html?treeId=' + encodeURIComponent((tree && tree.id) || '') + '&from=my-trees';
    } else {
      return basePath + 'editor?treeId=' + encodeURIComponent((tree && tree.id) || '') + '&from=my-trees';
    }
  }

  function cloneCardWithoutListeners(card) {
    if (!card || typeof card.cloneNode !== 'function') return card;
    return card.cloneNode(true);
  }

  function bindMyTreesCardImageHandlers(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('.tree-card-thumb-image').forEach(function(img) {
      if (img.dataset.imageHandlerBound === 'true') return;
      img.dataset.imageHandlerBound = 'true';

      img.addEventListener('error', function() {
        this.style.display = 'none';
        var container = this.closest('.tree-card-thumb');
        if (container) {
          var fallback = container.querySelector('[data-media-fallback]');
          if (fallback) {
            fallback.removeAttribute('hidden');
            fallback.style.display = 'flex';
          }
        }
      });
    });
  }

  function attachTreeCardEvents(card, tree, options) {
    var onSelect = options && options.onSelect;
    var openHref = resolveOpenHref(card, tree);

    card.addEventListener('click', function (event) {
      var action = getCardActivationAction(event, window);
      if (action === 'ignore') return;
      if (action === 'open') {
        window.location.href = openHref;
        return;
      }
      if (typeof onSelect === 'function') {
        onSelect(tree);
      }
    });

    card.addEventListener('keydown', function (event) {
      var action = getCardActivationAction(event, window);
      if (action === 'ignore') return;
      event.preventDefault();
      if (action === 'open') {
        window.location.href = openHref;
        return;
      }
      if (typeof onSelect === 'function') {
        onSelect(tree);
      }
    });

    stopOpenLinkPropagation(card);
    bindMyTreesCardImageHandlers(card);
    return card;
  }

  function patchBuildTreeCard(UI) {
    if (!UI || typeof UI.buildTreeCard !== 'function' || UI.__cardEventsPatched) return UI;

    var originalBuildTreeCard = UI.buildTreeCard;
    UI.buildTreeCard = function (tree, options) {
      var originalCard = originalBuildTreeCard(tree, options);
      var cleanCard = cloneCardWithoutListeners(originalCard);
      return attachTreeCardEvents(cleanCard, tree, options || {});
    };
    UI.__cardEventsPatched = true;

    return UI;
  }

  var api = {
    isInteractiveTarget: isInteractiveTarget,
    isActivationKey: isActivationKey,
    shouldUseMobileOpen: shouldUseMobileOpen,
    getCardActivationAction: getCardActivationAction,
    stopOpenLinkPropagation: stopOpenLinkPropagation,
    resolveOpenHref: resolveOpenHref,
    cloneCardWithoutListeners: cloneCardWithoutListeners,
    attachTreeCardEvents: attachTreeCardEvents,
    patchBuildTreeCard: patchBuildTreeCard,
    bindMyTreesCardImageHandlers: bindMyTreesCardImageHandlers
  };

  window.LoveBudMyTreesCardEvents = api;
  patchBuildTreeCard(window.LoveBudMyTreesUI);
  patchBuildTreeCard(window.LoveTreeMyTreesUI);
})();
