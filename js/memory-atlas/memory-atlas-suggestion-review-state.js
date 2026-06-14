(function attachMemoryAtlasSuggestionReviewState(root, factory) {
  const exports = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.LoveBudMemoryAtlasSuggestionReviewState = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMemoryAtlasSuggestionReviewStateModule() {
  'use strict';

  const REVIEW_STATES = Object.freeze(['previewed', 'accepted', 'dismissed']);
  const ACTION_TYPE_BY_INPUT = Object.freeze({
    preview: 'previewed',
    previewed: 'previewed',
    accept: 'accepted',
    accepted: 'accepted',
    dismiss: 'dismissed',
    dismissed: 'dismissed',
  });
  const DEFAULT_STATE = 'previewed';

  function createMemoryAtlasSuggestionReviewState(suggestions, initialState) {
    const inputSuggestions = Array.isArray(suggestions) ? suggestions : [];
    const state = {
      version: 1,
      order: [],
      byId: {},
      counts: createEmptyCounts(),
    };

    inputSuggestions.forEach((suggestion) => {
      const id = normalizeSuggestionId(suggestion);
      if (!id || state.byId[id]) return;

      const entry = {
        id,
        state: DEFAULT_STATE,
        suggestion: cloneJson(suggestion),
      };
      state.order.push(id);
      state.byId[id] = entry;
    });

    applyInitialState(state, initialState);
    refreshCounts(state);
    return state;
  }

  function applyMemoryAtlasSuggestionReviewAction(state, action) {
    const nextState = cloneState(state);
    const reviewAction = normalizeAction(action);
    if (!reviewAction || !nextState.byId[reviewAction.suggestionId]) {
      return nextState;
    }

    const entry = nextState.byId[reviewAction.suggestionId];
    if (entry.state === reviewAction.state) {
      return nextState;
    }

    entry.state = reviewAction.state;
    refreshCounts(nextState);
    return nextState;
  }

  function getVisibleMemoryAtlasSuggestions(state) {
    const safeState = normalizeStateContainer(state);
    return safeState.order
      .map((id) => safeState.byId[id])
      .filter(Boolean)
      .filter((entry) => entry.state !== 'dismissed')
      .map((entry) => withReviewState(entry.suggestion, entry.state));
  }

  function summarizeMemoryAtlasSuggestionReviewState(state) {
    const safeState = normalizeStateContainer(state);
    const groups = createEmptyGroups();
    safeState.order.forEach((id) => {
      const entry = safeState.byId[id];
      if (!entry) return;
      groups[entry.state].push(id);
    });

    return {
      version: safeState.version,
      total: safeState.order.length,
      visible: safeState.counts.visible,
      previewed: safeState.counts.previewed,
      accepted: safeState.counts.accepted,
      dismissed: safeState.counts.dismissed,
      idsByState: groups,
    };
  }

  function applyInitialState(state, initialState) {
    const actions = normalizeInitialState(initialState);
    actions.forEach((action) => {
      if (!state.byId[action.suggestionId]) return;
      state.byId[action.suggestionId].state = action.state;
    });
  }

  function normalizeInitialState(initialState) {
    if (!isPlainObject(initialState) && !Array.isArray(initialState)) return [];
    if (Array.isArray(initialState)) {
      return initialState.map(normalizeAction).filter(Boolean);
    }

    const states = isPlainObject(initialState.states) ? initialState.states : initialState.byId;
    if (isPlainObject(states)) {
      return Object.keys(states)
        .map((id) => normalizeAction({ suggestionId: id, state: states[id] }))
        .filter(Boolean);
    }

    return [];
  }

  function normalizeAction(action) {
    if (!isPlainObject(action)) return null;
    const suggestionId = normalizeSuggestionIdFromAction(action);
    const state = normalizeReviewState(action.state || action.reviewState || action.type || action.action);
    if (!suggestionId || !state) return null;
    return { suggestionId, state };
  }

  function normalizeReviewState(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const mapped = ACTION_TYPE_BY_INPUT[normalized] || normalized;
    return REVIEW_STATES.includes(mapped) ? mapped : '';
  }

  function normalizeSuggestionIdFromAction(action) {
    return normalizeSuggestionId(action.suggestion || action.suggestionId || action.id || action.targetId);
  }

  function normalizeSuggestionId(value) {
    if (value === undefined || value === null) return '';
    if (isPlainObject(value)) return normalizeSuggestionId(value.id || value.suggestionId || value.targetId);
    const text = String(value).trim();
    return text || '';
  }

  function withReviewState(suggestion, state) {
    return Object.assign({}, cloneJson(suggestion), {
      state,
      reviewState: state,
      previewOnly: true,
    });
  }

  function refreshCounts(state) {
    const counts = createEmptyCounts();
    state.order.forEach((id) => {
      const entry = state.byId[id];
      if (!entry) return;
      counts.total += 1;
      counts[entry.state] += 1;
      if (entry.state !== 'dismissed') counts.visible += 1;
    });
    state.counts = counts;
  }

  function createEmptyCounts() {
    return {
      total: 0,
      visible: 0,
      previewed: 0,
      accepted: 0,
      dismissed: 0,
    };
  }

  function createEmptyGroups() {
    return {
      previewed: [],
      accepted: [],
      dismissed: [],
    };
  }

  function cloneState(state) {
    const safeState = normalizeStateContainer(state);
    return {
      version: safeState.version,
      order: safeState.order.slice(),
      byId: Object.keys(safeState.byId).reduce((result, id) => {
        const entry = safeState.byId[id];
        result[id] = {
          id: entry.id,
          state: entry.state,
          suggestion: cloneJson(entry.suggestion),
        };
        return result;
      }, {}),
      counts: Object.assign({}, safeState.counts),
    };
  }

  function normalizeStateContainer(state) {
    if (isPlainObject(state) && isPlainObject(state.byId) && Array.isArray(state.order)) {
      return state;
    }
    return {
      version: 1,
      order: [],
      byId: {},
      counts: createEmptyCounts(),
    };
  }

  function cloneJson(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    REVIEW_STATES,
    createMemoryAtlasSuggestionReviewState,
    applyMemoryAtlasSuggestionReviewAction,
    getVisibleMemoryAtlasSuggestions,
    summarizeMemoryAtlasSuggestionReviewState,
  };
});
