(function () {
  'use strict';

  function isInteractiveTarget(target) {
    return !!(target && target.closest && target.closest('.tree-card-open-link, .tree-card-footer a, button, a[href]'));
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

    return openLink;
  }

  window.LoveBudMyTreesCardEvents = {
    isInteractiveTarget: isInteractiveTarget,
    isActivationKey: isActivationKey,
    shouldUseMobileOpen: shouldUseMobileOpen,
    getCardActivationAction: getCardActivationAction,
    stopOpenLinkPropagation: stopOpenLinkPropagation
  };
})();
