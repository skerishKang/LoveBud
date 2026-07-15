/**
 * LoveBud Scout — reviewed-save target-tree selection model
 * Issue #3496 / parent #1882
 *
 * Pure selection projection for the Scout reviewed-save surface.
 * Converts a detached owner-tree candidate list + explicit selection/list
 * state into a stable, safe selection result.
 *
 * Never auto-selects a tree (first / only / public / recent / previous).
 * Never navigates, mutates inputs, or touches DOM/Auth/network/storage/DB.
 * Does not activate save-memory persistence (route remains gated).
 *
 * Refs #3409 #3406 #3402 #3391
 */
(function () {
  'use strict';

  var LIST_READY = 'ready';
  var LIST_EMPTY = 'empty';
  var LIST_UNAVAILABLE = 'unavailable';
  var LIST_ERROR = 'error';

  var STATUS_READY = 'ready';
  var STATUS_MISSING_SELECTION = 'missing_selection';
  var STATUS_EMPTY = 'empty';
  var STATUS_LIST_UNAVAILABLE = 'list_unavailable';
  var STATUS_LIST_ERROR = 'list_error';
  var STATUS_STALE_SELECTION = 'stale_selection';
  var STATUS_INVALID_SELECTION = 'invalid_selection';

  var VISIBILITY_PUBLIC = 'public';
  var VISIBILITY_PRIVATE = 'private';
  var VISIBILITY_UNKNOWN = 'unknown';

  var TREE_ID_KEYS = ['id', 'treeId', 'tree_id'];
  var LABEL_KEYS = ['title', 'displayLabel', 'label', 'name'];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function trimString(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.replace(/^\s+|\s+$/g, '');
    return trimmed ? trimmed : null;
  }

  /**
   * First usable non-empty trimmed string among allowlisted keys.
   * missing / null / non-string / blank → next key.
   */
  function pickFirstUsableString(source, keys) {
    if (!isPlainObject(source)) return null;
    var i;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!hasOwn(source, key)) continue;
      var usable = trimString(source[key]);
      if (usable !== null) return usable;
    }
    return null;
  }

  function normalizeVisibility(value) {
    if (value === VISIBILITY_PUBLIC) return VISIBILITY_PUBLIC;
    if (value === VISIBILITY_PRIVATE) return VISIBILITY_PRIVATE;
    return VISIBILITY_UNKNOWN;
  }

  function normalizeListStatus(raw, hasAnyCandidateArray) {
    if (raw === LIST_READY || raw === LIST_EMPTY || raw === LIST_UNAVAILABLE || raw === LIST_ERROR) {
      return raw;
    }
    // Missing/invalid listStatus: infer only when a candidates array is present.
    if (hasAnyCandidateArray === true) return LIST_READY;
    return LIST_UNAVAILABLE;
  }

  /**
   * Prototype-safe deterministic dedupe: first occurrence wins.
   * Uses Object.create(null) so keys like "toString" cannot collide.
   */
  function normalizeOptions(candidates) {
    var options = [];
    var seen = Object.create(null);
    if (!Array.isArray(candidates)) return options;

    var i;
    for (i = 0; i < candidates.length; i += 1) {
      var raw = candidates[i];
      if (!isPlainObject(raw)) continue;

      var treeId = pickFirstUsableString(raw, TREE_ID_KEYS);
      if (treeId === null) continue;
      if (Object.prototype.hasOwnProperty.call(seen, treeId)) continue;
      seen[treeId] = true;

      var label = pickFirstUsableString(raw, LABEL_KEYS);
      var visibility = hasOwn(raw, 'visibility')
        ? normalizeVisibility(raw.visibility)
        : VISIBILITY_UNKNOWN;

      options.push({
        treeId: treeId,
        label: label === null ? '' : label,
        visibility: visibility
      });
    }
    return options;
  }

  function findOptionById(options, treeId) {
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (options[i].treeId === treeId) return options[i];
    }
    return null;
  }

  function createModel(fields) {
    return {
      options: fields.options,
      selectedTreeId: fields.selectedTreeId,
      selectionValid: fields.selectionValid === true,
      canProceed: fields.canProceed === true,
      status: fields.status,
      empty: fields.empty === true,
      retryAvailable: fields.retryAvailable === true
    };
  }

  /**
   * Build a pure target-tree selection model.
   *
   * @param {object} input
   * @param {Array} [input.candidates]
   * @param {*} [input.selectedTreeId]
   * @param {string} [input.listStatus] ready | empty | unavailable | error
   * @returns {object} detached selection model
   */
  function buildTargetTreeSelectionModel(input) {
    var source = isPlainObject(input) ? input : {};
    var hasCandidatesArray = hasOwn(source, 'candidates') && Array.isArray(source.candidates);
    var listStatus = normalizeListStatus(
      hasOwn(source, 'listStatus') ? source.listStatus : undefined,
      hasCandidatesArray
    );

    // Explicit unavailable/error: never reuse selection; no options trusted.
    if (listStatus === LIST_UNAVAILABLE || listStatus === LIST_ERROR) {
      return createModel({
        options: [],
        selectedTreeId: null,
        selectionValid: false,
        canProceed: false,
        status: listStatus === LIST_ERROR ? STATUS_LIST_ERROR : STATUS_LIST_UNAVAILABLE,
        empty: false,
        retryAvailable: true
      });
    }

    if (listStatus === LIST_EMPTY) {
      return createModel({
        options: [],
        selectedTreeId: null,
        selectionValid: false,
        canProceed: false,
        status: STATUS_EMPTY,
        empty: true,
        retryAvailable: false
      });
    }

    // listStatus === ready
    var options = normalizeOptions(hasCandidatesArray ? source.candidates : null);

    if (options.length === 0) {
      return createModel({
        options: [],
        selectedTreeId: null,
        selectionValid: false,
        canProceed: false,
        status: STATUS_EMPTY,
        empty: true,
        retryAvailable: false
      });
    }

    var rawSelected = hasOwn(source, 'selectedTreeId') ? source.selectedTreeId : undefined;
    var selectedUsable = trimString(rawSelected);

    // Missing selection: never auto-select (even for a single candidate).
    if (selectedUsable === null) {
      // Distinguishes blank/non-string provided selection vs truly missing.
      var selectionProvided = hasOwn(source, 'selectedTreeId') &&
        source.selectedTreeId !== undefined &&
        source.selectedTreeId !== null;
      return createModel({
        options: options,
        selectedTreeId: null,
        selectionValid: false,
        canProceed: false,
        status: selectionProvided ? STATUS_INVALID_SELECTION : STATUS_MISSING_SELECTION,
        empty: false,
        retryAvailable: false
      });
    }

    var match = findOptionById(options, selectedUsable);
    if (!match) {
      return createModel({
        options: options,
        selectedTreeId: null,
        selectionValid: false,
        canProceed: false,
        status: STATUS_STALE_SELECTION,
        empty: false,
        retryAvailable: false
      });
    }

    return createModel({
      options: options,
      selectedTreeId: match.treeId,
      selectionValid: true,
      canProceed: true,
      status: STATUS_READY,
      empty: false,
      retryAvailable: false
    });
  }

  window.LoveBudScoutSaveMemoryTargetTreeSelectionModel = Object.freeze({
    buildTargetTreeSelectionModel: buildTargetTreeSelectionModel,
    LIST_STATUS: Object.freeze({
      READY: LIST_READY,
      EMPTY: LIST_EMPTY,
      UNAVAILABLE: LIST_UNAVAILABLE,
      ERROR: LIST_ERROR
    }),
    STATUS: Object.freeze({
      READY: STATUS_READY,
      MISSING_SELECTION: STATUS_MISSING_SELECTION,
      EMPTY: STATUS_EMPTY,
      LIST_UNAVAILABLE: STATUS_LIST_UNAVAILABLE,
      LIST_ERROR: STATUS_LIST_ERROR,
      STALE_SELECTION: STATUS_STALE_SELECTION,
      INVALID_SELECTION: STATUS_INVALID_SELECTION
    })
  });
})();
