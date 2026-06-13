/**
 * relationship-hints-state-machine.js
 *
 * Pure relationship-hints state transition helper for the editor/canvas domain.
 * This module intentionally owns state math only: no DOM, no storage, no API,
 * no provider, no graph layout, and no saved-edge persistence.
 */

(function () {
  'use strict';

  const RELATIONSHIP_HINT_STATES = Object.freeze([
    'not_shown',
    'presented',
    'accepted_pending_save',
    'saved_relationship',
    'dismissed',
    'hidden',
    'error',
  ]);

  const RELATIONSHIP_HINT_SAVED_STATES = Object.freeze([
    'saved_relationship',
  ]);

  const RELATIONSHIP_HINT_SUGGESTION_STATES = Object.freeze([
    'not_shown',
    'presented',
    'accepted_pending_save',
    'dismissed',
    'hidden',
    'error',
  ]);

  const RELATIONSHIP_HINT_TRANSITIONS = Object.freeze([
    { from: 'not_shown', event: 'present_hint', to: 'presented', persistenceEffect: 'none' },
    { from: 'not_shown', event: 'hide_or_reset', to: 'hidden', persistenceEffect: 'none' },
    { from: 'not_shown', event: 'hide_or_reset', to: 'not_shown', persistenceEffect: 'none' },
    { from: 'presented', event: 'accept_for_review', to: 'accepted_pending_save', persistenceEffect: 'none' },
    { from: 'presented', event: 'dismiss_hint', to: 'dismissed', persistenceEffect: 'none' },
    { from: 'presented', event: 'hide_hint_surface', to: 'hidden', persistenceEffect: 'none' },
    { from: 'presented', event: 'hint_error', to: 'error', persistenceEffect: 'none' },
    { from: 'accepted_pending_save', event: 'confirm_save_relationship', to: 'saved_relationship', persistenceEffect: 'future_explicit_save_required' },
    { from: 'accepted_pending_save', event: 'back_to_review', to: 'presented', persistenceEffect: 'none' },
    { from: 'accepted_pending_save', event: 'dismiss_pending_hint', to: 'dismissed', persistenceEffect: 'none' },
    { from: 'accepted_pending_save', event: 'hide_pending_hint', to: 'hidden', persistenceEffect: 'none' },
    { from: 'accepted_pending_save', event: 'save_validation_error', to: 'error', persistenceEffect: 'none' },
    { from: 'dismissed', event: 'hide_dismissed_hint', to: 'hidden', persistenceEffect: 'none' },
    { from: 'dismissed', event: 'reset_hint_lifecycle', to: 'not_shown', persistenceEffect: 'none' },
    { from: 'dismissed', event: 'present_new_hint', to: 'presented', persistenceEffect: 'none' },
    { from: 'hidden', event: 'present_hint', to: 'presented', persistenceEffect: 'none' },
    { from: 'hidden', event: 'reset_hint_lifecycle', to: 'not_shown', persistenceEffect: 'none' },
    { from: 'error', event: 'retry_hint', to: 'presented', persistenceEffect: 'none' },
    { from: 'error', event: 'hide_after_error', to: 'hidden', persistenceEffect: 'none' },
    { from: 'saved_relationship', event: 'relationship_hint_lifecycle_complete', to: 'not_shown', persistenceEffect: 'saved_edge_remains_external' },
    { from: 'saved_relationship', event: 'relationship_hint_lifecycle_complete', to: 'hidden', persistenceEffect: 'saved_edge_remains_external' },
  ]);

  const FORBIDDEN_TRANSITIONS = Object.freeze([
    { from: 'not_shown', event: 'automatic_relationship_creation', to: 'saved_relationship' },
    { from: 'presented', event: 'automatic_save', to: 'saved_relationship' },
    { from: 'presented', event: 'dismiss_as_save', to: 'saved_relationship' },
    { from: 'presented', event: 'hide_as_save', to: 'saved_relationship' },
    { from: 'accepted_pending_save', event: 'implicit_timeout_save', to: 'saved_relationship' },
    { from: 'accepted_pending_save', event: 'close_panel_as_save', to: 'saved_relationship' },
    { from: 'dismissed', event: 'any_event', to: 'saved_relationship' },
    { from: 'hidden', event: 'any_event', to: 'saved_relationship' },
    { from: 'error', event: 'any_event', to: 'saved_relationship' },
    { from: 'saved_relationship', event: 'dismiss_or_hide_as_hint_state', to: 'dismissed' },
    { from: 'saved_relationship', event: 'dismiss_or_hide_as_hint_state', to: 'hidden' },
  ]);

  function assertState(state) {
    if (RELATIONSHIP_HINT_STATES.indexOf(state) === -1) {
      throw new Error('Unknown relationship hint state: ' + state);
    }
  }

  function normalizeInitialState(initialState) {
    const state = initialState || 'not_shown';
    assertState(state);
    return state;
  }

  function isSavedRelationshipState(state) {
    return RELATIONSHIP_HINT_SAVED_STATES.indexOf(state) !== -1;
  }

  function isSuggestionState(state) {
    return RELATIONSHIP_HINT_SUGGESTION_STATES.indexOf(state) !== -1;
  }

  function findTransition(from, event, to) {
    return RELATIONSHIP_HINT_TRANSITIONS.find(function (transition) {
      return transition.from === from && transition.event === event && transition.to === to;
    }) || null;
  }

  function getAllowedTransitions(fromState) {
    assertState(fromState);
    return RELATIONSHIP_HINT_TRANSITIONS.filter(function (transition) {
      return transition.from === fromState;
    }).map(function (transition) {
      return Object.assign({}, transition);
    });
  }

  function isAllowedTransition(fromState, event, toState) {
    assertState(fromState);
    assertState(toState);
    return Boolean(findTransition(fromState, event, toState));
  }

  function createRejectedTransition(fromState, event, reason, toState) {
    return Object.freeze({
      accepted: false,
      from: fromState,
      event: event,
      to: toState || null,
      reason: reason || 'Transition is not allowed by the relationship hints state machine contract.',
      savedRelationshipBefore: isSavedRelationshipState(fromState),
      savedRelationshipAfter: Boolean(toState && isSavedRelationshipState(toState)),
      persistenceEffect: 'none',
    });
  }

  function createTransitionResult(transition, fromState, toState, sequence, now) {
    return Object.freeze({
      accepted: true,
      from: fromState,
      event: transition.event,
      to: toState,
      transition: Object.assign({}, transition),
      savedRelationshipBefore: isSavedRelationshipState(fromState),
      savedRelationshipAfter: isSavedRelationshipState(toState),
      persistenceEffect: transition.persistenceEffect,
      sequence: sequence,
      timestamp: now,
    });
  }

  function createRelationshipHintStateMachine(options) {
    const opts = options || {};
    let currentState = normalizeInitialState(opts.initialState);
    let sequence = 0;

    function getState() {
      return currentState;
    }

    function isSavedRelationship() {
      return isSavedRelationshipState(currentState);
    }

    function isSuggestion() {
      return isSuggestionState(currentState);
    }

    function canTransition(event, transitionOptions) {
      const toState = transitionOptions && transitionOptions.to;
      if (toState) {
        assertState(toState);
      }

      const allowed = getAllowedTransitions(currentState).filter(function (transition) {
        return transition.event === event;
      });

      if (allowed.length === 0) return false;
      if (!toState) return allowed.length === 1;

      return allowed.some(function (transition) {
        return transition.to === toState;
      });
    }

    function transition(event, transitionOptions) {
      const optsForTransition = transitionOptions || {};
      const fromState = currentState;
      const requestedTo = optsForTransition.to || null;
      const now = typeof opts.now === 'function' ? opts.now() : Date.now();
      const allowed = getAllowedTransitions(fromState).filter(function (transition) {
        return transition.event === event;
      });

      if (allowed.length === 0) {
        return createRejectedTransition(fromState, event, 'No allowed transition exists for this state/event pair.', requestedTo);
      }

      const chosen = requestedTo
        ? allowed.find(function (transition) { return transition.to === requestedTo; })
        : (allowed.length === 1 ? allowed[0] : null);

      if (!chosen) {
        const allowedTargets = allowed.map(function (transition) { return transition.to; }).join(', ');
        return createRejectedTransition(
          fromState,
          event,
          'A target state is required for this event. Allowed targets: ' + allowedTargets + '.',
          requestedTo
        );
      }

      currentState = chosen.to;
      sequence += 1;
      const result = createTransitionResult(chosen, fromState, chosen.to, sequence, now);

      if (typeof opts.onTransition === 'function') {
        opts.onTransition(result);
      }

      return result;
    }

    function reset() {
      currentState = normalizeInitialState(opts.initialState);
      sequence = 0;
    }

    return Object.freeze({
      getState,
      isSavedRelationship,
      isSuggestion,
      canTransition,
      transition,
      reset,
    });
  }

  const api = Object.freeze({
    RELATIONSHIP_HINT_STATES,
    RELATIONSHIP_HINT_SAVED_STATES,
    RELATIONSHIP_HINT_SUGGESTION_STATES,
    RELATIONSHIP_HINT_TRANSITIONS,
    FORBIDDEN_TRANSITIONS,
    createRelationshipHintStateMachine,
    getAllowedTransitions,
    isAllowedTransition,
    isSavedRelationshipState,
    isSuggestionState,
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudRelationshipHintStateMachine = api;
  }
})();
