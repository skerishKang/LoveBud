(function() {
  'use strict';

  function createEditorStartupContext(options) {
    var opts = options || {};
    var createEditorDomRefs = opts.createEditorDomRefs;
    var locationRef = opts.locationRef || window.location;
    var URLSearchParamsRef = opts.URLSearchParamsRef || window.URLSearchParams;

    if (typeof createEditorDomRefs !== 'function') {
      throw new TypeError('createEditorDomRefs must be a function');
    }

    var refs = createEditorDomRefs();
    var search = locationRef && typeof locationRef.search === 'string'
      ? locationRef.search
      : '';
    var params = new URLSearchParamsRef(search);
    var urlTreeId = params.get('treeId');
    var canEdit = params.get('readonly') !== '1';
    var mode = params.get('mode') || '';
    var memoryId = params.get('memoryId') || '';

    return {
      canvas: refs && refs.canvas,
      svg: refs && refs.svg,
      detailPanel: refs && refs.detailPanel,
      addBtn: refs && refs.addBtn,
      urlTreeId: urlTreeId,
      canEdit: canEdit,
      mode: mode,
      memoryId: memoryId
    };
  }

  window.LoveBudEditorStartupContext = Object.freeze({
    createEditorStartupContext: createEditorStartupContext
  });
})();
