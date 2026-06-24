(function () {
  'use strict';

  var MODE_VIEW = 'view';
  var MODE_EDIT = 'edit';
  var _mode = MODE_VIEW;
  var _listeners = [];

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

  window.LoveBudEditorInteractionMode = {
    MODE_VIEW: MODE_VIEW,
    MODE_EDIT: MODE_EDIT,
    getMode: function () {
      return _mode;
    },
    isEditMode: function () {
      return _mode === MODE_EDIT;
    },
    setMode: function (mode) {
      if (!isValidMode(mode)) {
        mode = MODE_VIEW;
      }
      if (_mode === mode) return;
      _mode = mode;
      applyBodyAttribute(_mode);
      notifyListeners(_mode);
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

  applyBodyAttribute(_mode);
})();
