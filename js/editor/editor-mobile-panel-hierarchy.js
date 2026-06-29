(function () {
  'use strict';

  var MOBILE_QUERY = '(max-width: 768px)';
  var PANEL_TOGGLE_FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function getFocusable(panel) {
    if (!panel) return [];
    return Array.prototype.slice
      .call(panel.querySelectorAll(PANEL_TOGGLE_FOCUSABLE))
      .filter(function (element) {
        return !!(
          element &&
          !element.hidden &&
          element.getAttribute('aria-hidden') !== 'true' &&
          (element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement)
        );
      });
  }

  function createCloseButton(label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-mobile-panel-close';
    button.setAttribute('data-mobile-panel-close', 'true');
    button.textContent = label;
    return button;
  }

  function ensureSidebarHeader(sidebar) {
    if (!sidebar || sidebar.querySelector('.editor-mobile-panel-sidebar-header')) return;
    var title = document.createElement('h2');
    title.className = 'editor-mobile-panel-sidebar-title';
    title.textContent = '트리 정보';

    var closeButton = createCloseButton('닫기');
    closeButton.id = 'mobileSidebarPanelCloseBtn';
    closeButton.setAttribute('aria-label', '트리 정보 닫기');

    var wrap = document.createElement('div');
    wrap.className = 'editor-mobile-panel-sidebar-header';
    wrap.appendChild(title);
    wrap.appendChild(closeButton);

    sidebar.insertBefore(wrap, sidebar.firstChild);
  }

  function ensureDetailCloseButton(detailPanel) {
    if (!detailPanel) return;
    var header = detailPanel.querySelector('.panel-header');
    if (!header || header.querySelector('[data-mobile-panel-close="true"]')) return;
    var closeButton = createCloseButton('닫기');
    closeButton.id = 'mobileDetailPanelCloseBtn';
    closeButton.setAttribute('aria-label', '선택한 순간 닫기');
    header.appendChild(closeButton);
  }

  onReady(function () {
    var mediaQuery = typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null;
    var layout = document.querySelector('.editor-layout');
    var canvasArea = document.getElementById('canvasArea');
    var sidebar = document.querySelector('.editor-layout > .sidebar');
    var detailPanel = document.getElementById('detailPanel');
    var treeToggle = document.getElementById('mobileTreePanelToggle');
    var detailToggle = document.getElementById('mobileDetailPanelToggle');
    var backdrop = document.getElementById('editorMobilePanelBackdrop');

    if (!layout || !canvasArea || !sidebar || !detailPanel || !treeToggle || !detailToggle || !backdrop) {
      return;
    }

    if (!sidebar.id) {
      sidebar.id = 'editorSidebarPanel';
    }
    treeToggle.setAttribute('aria-controls', sidebar.id);
    detailToggle.setAttribute('aria-controls', detailPanel.id);

    ensureSidebarHeader(sidebar);
    ensureDetailCloseButton(detailPanel);

    var sidebarCloseButton = document.getElementById('mobileSidebarPanelCloseBtn');
    var detailCloseButton = document.getElementById('mobileDetailPanelCloseBtn');
    var state = {
      activeKey: null,
      returnFocusEl: null,
    };
    var panels = {
      tree: {
        key: 'tree',
        element: sidebar,
        toggle: treeToggle,
        closeButton: sidebarCloseButton,
      },
      detail: {
        key: 'detail',
        element: detailPanel,
        toggle: detailToggle,
        closeButton: detailCloseButton,
      },
    };

    function isMobileViewport() {
      return !!(mediaQuery && mediaQuery.matches);
    }

    function setDetailToggleState() {
      var hasSelection = !!canvasArea.querySelector('.memory-node.selected');
      detailToggle.disabled = !hasSelection;
      detailToggle.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
      if (!hasSelection && state.activeKey === 'detail') {
        closePanel('detail', { restoreFocus: true });
      }
    }

    function getPanelRecordFromElement(element) {
      if (element === sidebar) return panels.tree;
      if (element === detailPanel) return panels.detail;
      return null;
    }

    function trapTabKey(panel, event) {
      if (event.key !== 'Tab') return;
      var focusable = getFocusable(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function applyClosedState(record) {
      record.toggle.setAttribute('aria-expanded', 'false');
      record.element.classList.remove('is-mobile-panel-open');
      record.element.setAttribute('aria-hidden', 'true');
      record.element.removeAttribute('aria-modal');
      record.element.removeAttribute('role');
      record.element.removeAttribute('tabindex');
    }

    function applyDesktopState(record) {
      record.toggle.setAttribute('aria-expanded', 'false');
      record.element.classList.remove('is-mobile-panel-open');
      record.element.setAttribute('aria-hidden', 'false');
      record.element.removeAttribute('aria-modal');
      record.element.removeAttribute('role');
      record.element.removeAttribute('tabindex');
    }

    function closePanel(key, options) {
      var record = panels[key];
      if (!record) return;
      applyClosedState(record);
      state.activeKey = null;
      layout.classList.remove('has-mobile-panel-open');
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
      if (!options || options.restoreFocus !== false) {
        var focusTarget = state.returnFocusEl || record.toggle;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus();
        }
      }
      state.returnFocusEl = null;
    }

    function openPanel(key) {
      var record = panels[key];
      if (!record || !isMobileViewport()) return;
      if (record.toggle.disabled) return;
      if (state.activeKey && state.activeKey !== key) {
        closePanel(state.activeKey, { restoreFocus: false });
      }

      state.activeKey = key;
      state.returnFocusEl = document.activeElement;
      layout.classList.add('has-mobile-panel-open');
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');

      Object.keys(panels).forEach(function (panelKey) {
        var panelRecord = panels[panelKey];
        if (panelKey === key) {
          panelRecord.toggle.setAttribute('aria-expanded', 'true');
          panelRecord.element.classList.add('is-mobile-panel-open');
          panelRecord.element.setAttribute('aria-hidden', 'false');
          panelRecord.element.setAttribute('aria-modal', 'true');
          panelRecord.element.setAttribute('role', 'dialog');
          panelRecord.element.setAttribute('tabindex', '-1');
        } else {
          applyClosedState(panelRecord);
        }
      });

      var focusable = getFocusable(record.element);
      var preferredFocus = record.closeButton || focusable[0] || record.element;
      if (preferredFocus && typeof preferredFocus.focus === 'function') {
        preferredFocus.focus();
      }
    }

    function cleanupDesktopState() {
      state.activeKey = null;
      state.returnFocusEl = null;
      layout.classList.remove('has-mobile-panel-open');
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
      Object.keys(panels).forEach(function (key) {
        applyDesktopState(panels[key]);
      });
    }

    function syncViewportState() {
      if (isMobileViewport()) {
        Object.keys(panels).forEach(function (key) {
          if (state.activeKey === key) {
            return;
          }
          applyClosedState(panels[key]);
        });
        backdrop.hidden = state.activeKey === null;
        backdrop.setAttribute('aria-hidden', state.activeKey === null ? 'true' : 'false');
        return;
      }
      cleanupDesktopState();
    }

    treeToggle.addEventListener('click', function () {
      if (state.activeKey === 'tree') {
        closePanel('tree');
        return;
      }
      openPanel('tree');
    });

    detailToggle.addEventListener('click', function () {
      if (detailToggle.disabled) return;
      if (state.activeKey === 'detail') {
        closePanel('detail');
        return;
      }
      openPanel('detail');
    });

    backdrop.addEventListener('click', function () {
      if (state.activeKey) {
        closePanel(state.activeKey);
      }
    });

    [sidebar, detailPanel].forEach(function (panel) {
      panel.addEventListener('keydown', function (event) {
        if (!isMobileViewport()) return;
        if (event.key === 'Escape') {
          var record = getPanelRecordFromElement(panel);
          if (record) {
            event.preventDefault();
            closePanel(record.key);
          }
          return;
        }
        trapTabKey(panel, event);
      });

      panel.addEventListener('click', function (event) {
        var closeTarget = event.target && event.target.closest('[data-mobile-panel-close="true"]');
        if (!closeTarget) return;
        var record = getPanelRecordFromElement(panel);
        if (record) {
          closePanel(record.key);
        }
      });
    });

    var selectionObserver = new MutationObserver(function () {
      setDetailToggleState();
    });
    selectionObserver.observe(canvasArea, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', syncViewportState);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(syncViewportState);
      }
    }

    setDetailToggleState();
    syncViewportState();
  });
})();
