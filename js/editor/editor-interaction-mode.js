(function () {
  'use strict';

  var MODE_VIEW = 'view';
  var MODE_EDIT = 'edit';
  var _mode = MODE_VIEW;
  var _listeners = [];
  var _syncingFromHistory = false;
  var _historyBound = false;

  function isValidMode(mode) {
    return mode === MODE_VIEW || mode === MODE_EDIT;
  }

  function applyBodyAttribute(mode) {
    if (!document.body) return;
    document.body.setAttribute('data-editor-interaction-mode', mode);
  }

  function notifyListeners(mode) {
    var listeners = _listeners.slice();
    listeners.forEach(function (fn) {
      if (typeof fn === 'function') {
        try { fn(mode); } catch (err) { console.error('[editor-mode] listener error', err); }
      }
    });
  }

  function readModeFromUrl() {
    try {
      if (typeof window === 'undefined' || !window.URLSearchParams) return null;
      var params = new URLSearchParams(window.location.search || '');
      return params.get('mode') === MODE_EDIT ? MODE_EDIT : MODE_VIEW;
    } catch (e) {
      return null;
    }
  }

  function syncUrlMode(mode, options) {
    if (_syncingFromHistory) return;
    if (typeof window === 'undefined' || !window.history || !window.URL) return;
    try {
      var url = new URL(window.location.href);
      if (mode === MODE_EDIT) {
        url.searchParams.set('mode', MODE_EDIT);
      } else {
        url.searchParams.delete('mode');
      }
      var next = url.pathname + url.search + url.hash;
      var current = window.location.pathname + window.location.search + window.location.hash;
      if (next === current) return;
      var state = Object.assign({}, window.history.state || {}, { lovebudEditorMode: mode });
      if (options && options.replace) {
        window.history.replaceState(state, '', next);
      } else {
        window.history.pushState(state, '', next);
      }
    } catch (e) {
      /* ignore URL sync failures */
    }
  }

  function bindHistory() {
    if (_historyBound || typeof window === 'undefined' || !window.addEventListener) return;
    _historyBound = true;
    window.addEventListener('popstate', function () {
      var next = readModeFromUrl() || MODE_VIEW;
      if (next === _mode) return;
      _syncingFromHistory = true;
      try {
        _mode = next;
        applyBodyAttribute(_mode);
        notifyListeners(_mode);
      } finally {
        _syncingFromHistory = false;
      }
    });
  }

  window.LoveBudEditorInteractionMode = {
    MODE_VIEW: MODE_VIEW,
    MODE_EDIT: MODE_EDIT,
    getMode: function () {
      return _mode;
    },
    isEditMode: function () {
      return _mode === MODE_EDIT;
    },
    setMode: function (mode, options) {
      if (!isValidMode(mode)) {
        mode = MODE_VIEW;
      }
      var opts = options || {};
      var changed = _mode !== mode;
      if (!changed && opts.forceUrlSync !== true) {
        return;
      }
      if (changed) {
        _mode = mode;
        applyBodyAttribute(_mode);
      }
      if (opts.syncUrl !== false) {
        syncUrlMode(_mode, { replace: opts.replace === true });
      }
      if (changed) {
        notifyListeners(_mode);
      }
    },
    subscribe: function (listener) {
      if (typeof listener !== 'function') return function () {};
      _listeners.push(listener);
      return function unsubscribe() {
        var idx = _listeners.indexOf(listener);
        if (idx >= 0) _listeners.splice(idx, 1);
      };
    }
  };

  bindHistory();
  applyBodyAttribute(_mode);
})();
