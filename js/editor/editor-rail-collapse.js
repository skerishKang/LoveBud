/**
 * #3585 Independent desktop rail collapse / restore.
 * Mobile keeps editor-mobile-panel-hierarchy.js ownership.
 */
(function () {
  'use strict';

  var DESKTOP_QUERY = '(min-width: 1025px)';
  var leftCollapsed = false;
  var rightCollapsed = false;

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function t(key, fallback) {
    try {
      if (typeof window.t === 'function') {
        var value = window.t(key);
        if (value && value !== key) return value;
      }
      if (window.i18nEditor && window.i18nEditor[key]) {
        var lang = (document.documentElement.lang || 'ko').toLowerCase().startsWith('en')
          ? 'en'
          : 'ko';
        var entry = window.i18nEditor[key];
        if (entry && (entry[lang] || entry.ko || entry.en)) {
          return entry[lang] || entry.ko || entry.en;
        }
      }
    } catch (_) {
      /* ignore */
    }
    return fallback;
  }

  function isDesktop() {
    return typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;
  }

  function applyI18n(button, key, fallback) {
    if (!button) return;
    var label = t(key, fallback);
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    var textEl = button.querySelector('.editor-rail-collapse-label, .editor-rail-restore-label');
    if (textEl && textEl.hasAttribute('data-i18n')) {
      textEl.textContent = t(textEl.getAttribute('data-i18n'), textEl.textContent || label);
    }
  }

  function setInert(el, inert) {
    if (!el) return;
    if (inert) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  function dispatchGeometryChange() {
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (_) {
      /* ignore */
    }
    try {
      if (window.LoveBudEditorCanvasViewport && typeof window.LoveBudEditorCanvasViewport.requestLayout === 'function') {
        window.LoveBudEditorCanvasViewport.requestLayout();
      }
    } catch (_) {
      /* ignore */
    }
  }

  onReady(function () {
    var layout = document.querySelector('.editor-layout');
    var sidebar = document.querySelector('.editor-layout > .sidebar');
    var detailPanel = document.getElementById('detailPanel');
    var canvasArea = document.getElementById('canvasArea');
    if (!layout || !sidebar || !detailPanel || !canvasArea) return;

    if (!sidebar.id) sidebar.id = 'editorSidebarPanel';

    var leftHide = document.getElementById('editorLeftRailCollapseBtn');
    var rightHide = document.getElementById('editorRightRailCollapseBtn');

    // Restore controls live on the canvas edge so both remain reachable when rails are closed.
    var host = document.getElementById('editorRailRestoreHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'editorRailRestoreHost';
      host.className = 'editor-rail-restore-host';
      host.setAttribute('data-editor-rail-restore-host', 'true');
      canvasArea.appendChild(host);
    }

    var leftRestore = document.getElementById('editorLeftRailRestoreBtn');
    if (!leftRestore) {
      leftRestore = document.createElement('button');
      leftRestore.type = 'button';
      leftRestore.id = 'editorLeftRailRestoreBtn';
      leftRestore.className = 'editor-rail-restore is-left';
      leftRestore.setAttribute('data-editor-rail-restore', 'left');
      leftRestore.setAttribute('aria-controls', sidebar.id);
      leftRestore.innerHTML =
        '<span class="material-symbols-outlined" aria-hidden="true">left_panel_open</span>' +
        '<span class="editor-rail-restore-label" data-i18n="editor_rail_show_tree_short">열기</span>';
      host.appendChild(leftRestore);
    }

    var rightRestore = document.getElementById('editorRightRailRestoreBtn');
    if (!rightRestore) {
      rightRestore = document.createElement('button');
      rightRestore.type = 'button';
      rightRestore.id = 'editorRightRailRestoreBtn';
      rightRestore.className = 'editor-rail-restore is-right';
      rightRestore.setAttribute('data-editor-rail-restore', 'right');
      rightRestore.setAttribute('aria-controls', detailPanel.id);
      rightRestore.innerHTML =
        '<span class="material-symbols-outlined" aria-hidden="true">right_panel_open</span>' +
        '<span class="editor-rail-restore-label" data-i18n="editor_rail_show_moment_short">열기</span>';
      host.appendChild(rightRestore);
    }

    function refreshCopy() {
      applyI18n(leftHide, 'editor_rail_hide_tree', '트리 패널 숨기기');
      applyI18n(rightHide, 'editor_rail_hide_moment', '순간 패널 숨기기');
      applyI18n(leftRestore, 'editor_rail_show_tree', '트리 패널 열기');
      applyI18n(rightRestore, 'editor_rail_show_moment', '순간 패널 열기');
      var leftShort = leftHide && leftHide.querySelector('[data-i18n="editor_rail_hide_tree_short"]');
      var rightShort = rightHide && rightHide.querySelector('[data-i18n="editor_rail_hide_moment_short"]');
      var leftRestoreShort = leftRestore.querySelector('[data-i18n="editor_rail_show_tree_short"]');
      var rightRestoreShort = rightRestore.querySelector('[data-i18n="editor_rail_show_moment_short"]');
      if (leftShort) leftShort.textContent = t('editor_rail_hide_tree_short', '숨기기');
      if (rightShort) rightShort.textContent = t('editor_rail_hide_moment_short', '숨기기');
      if (leftRestoreShort) leftRestoreShort.textContent = t('editor_rail_show_tree_short', '열기');
      if (rightRestoreShort) rightRestoreShort.textContent = t('editor_rail_show_moment_short', '열기');
    }

    function applyState() {
      var desktop = isDesktop();
      if (!desktop) {
        leftCollapsed = false;
        rightCollapsed = false;
      }

      layout.setAttribute('data-left-rail-collapsed', leftCollapsed ? 'true' : 'false');
      layout.setAttribute('data-right-rail-collapsed', rightCollapsed ? 'true' : 'false');
      layout.setAttribute(
        'data-editor-rail-state',
        leftCollapsed && rightCollapsed
          ? 'both-hidden'
          : leftCollapsed
            ? 'left-hidden'
            : rightCollapsed
              ? 'right-hidden'
              : 'both-open'
      );

      setInert(sidebar, desktop && leftCollapsed);
      setInert(detailPanel, desktop && rightCollapsed);

      if (leftHide) {
        leftHide.setAttribute('aria-expanded', leftCollapsed ? 'false' : 'true');
        leftHide.hidden = !desktop || leftCollapsed;
      }
      if (rightHide) {
        rightHide.setAttribute('aria-expanded', rightCollapsed ? 'false' : 'true');
        rightHide.hidden = !desktop || rightCollapsed;
      }

      leftRestore.hidden = !desktop || !leftCollapsed;
      rightRestore.hidden = !desktop || !rightCollapsed;
      leftRestore.setAttribute('aria-expanded', leftCollapsed ? 'false' : 'true');
      rightRestore.setAttribute('aria-expanded', rightCollapsed ? 'false' : 'true');

      dispatchGeometryChange();
    }

    function setLeftCollapsed(next) {
      if (!isDesktop()) return;
      leftCollapsed = !!next;
      applyState();
    }

    function setRightCollapsed(next) {
      if (!isDesktop()) return;
      rightCollapsed = !!next;
      applyState();
    }

    if (leftHide) {
      leftHide.addEventListener('click', function () {
        setLeftCollapsed(true);
      });
    }
    if (rightHide) {
      rightHide.addEventListener('click', function () {
        setRightCollapsed(true);
      });
    }
    leftRestore.addEventListener('click', function () {
      setLeftCollapsed(false);
    });
    rightRestore.addEventListener('click', function () {
      setRightCollapsed(false);
    });

    var media = typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY) : null;
    function onViewportChange() {
      applyState();
    }
    if (media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onViewportChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onViewportChange);
      }
    }

    document.addEventListener('lovebud:languagechange', refreshCopy);
    document.addEventListener('i18n:changed', refreshCopy);

    window.LoveBudEditorRailCollapse = {
      isLeftCollapsed: function () {
        return leftCollapsed;
      },
      isRightCollapsed: function () {
        return rightCollapsed;
      },
      setLeftCollapsed: setLeftCollapsed,
      setRightCollapsed: setRightCollapsed,
      getState: function () {
        return {
          leftCollapsed: leftCollapsed,
          rightCollapsed: rightCollapsed,
          desktop: isDesktop(),
        };
      },
      apply: applyState,
    };

    refreshCopy();
    applyState();
  });
})();
