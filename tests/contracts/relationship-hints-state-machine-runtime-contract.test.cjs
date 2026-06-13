const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const HELPER_PATH = path.join(ROOT, 'js/editor/relationship-hints-state-machine.js');
require(HELPER_PATH);
const helper = globalThis.LoveBudRelationshipHintStateMachine;

assert.ok(helper, 'relationship hints state machine helper must register on globalThis for ESM package compatibility');

const expectedStates = Object.freeze([
  'not_shown',
  'presented',
  'accepted_pending_save',
  'saved_relationship',
  'dismissed',
  'hidden',
  'error',
]);

const expectedSavedStates = Object.freeze([
  'saved_relationship',
]);

const expectedSuggestionStates = Object.freeze([
  'not_shown',
  'presented',
  'accepted_pending_save',
  'dismissed',
  'hidden',
  'error',
]);

const expectedTransitions = Object.freeze([
  ['not_shown', 'present_hint', 'presented'],
  ['not_shown', 'hide_or_reset', 'hidden'],
  ['not_shown', 'hide_or_reset', 'not_shown'],
  ['presented', 'accept_for_review', 'accepted_pending_save'],
  ['presented', 'dismiss_hint', 'dismissed'],
  ['presented', 'hide_hint_surface', 'hidden'],
  ['presented', 'hint_error', 'error'],
  ['accepted_pending_save', 'confirm_save_relationship', 'saved_relationship'],
  ['accepted_pending_save', 'back_to_review', 'presented'],
  ['accepted_pending_save', 'dismiss_pending_hint', 'dismissed'],
  ['accepted_pending_save', 'hide_pending_hint', 'hidden'],
  ['accepted_pending_save', 'save_validation_error', 'error'],
  ['dismissed', 'hide_dismissed_hint', 'hidden'],
  ['dismissed', 'reset_hint_lifecycle', 'not_shown'],
  ['dismissed', 'present_new_hint', 'presented'],
  ['hidden', 'present_hint', 'presented'],
  ['hidden', 'reset_hint_lifecycle', 'not_shown'],
  ['error', 'retry_hint', 'presented'],
  ['error', 'hide_after_error', 'hidden'],
  ['saved_relationship', 'relationship_hint_lifecycle_complete', 'not_shown'],
  ['saved_relationship', 'relationship_hint_lifecycle_complete', 'hidden'],
]);

const expectedForbiddenTransitions = Object.freeze([
  ['not_shown', 'automatic_relationship_creation', 'saved_relationship'],
  ['presented', 'automatic_save', 'saved_relationship'],
  ['presented', 'dismiss_as_save', 'saved_relationship'],
  ['presented', 'hide_as_save', 'saved_relationship'],
  ['accepted_pending_save', 'implicit_timeout_save', 'saved_relationship'],
  ['accepted_pending_save', 'close_panel_as_save', 'saved_relationship'],
  ['dismissed', 'any_event', 'saved_relationship'],
  ['hidden', 'any_event', 'saved_relationship'],
  ['error', 'any_event', 'saved_relationship'],
  ['saved_relationship', 'dismiss_or_hide_as_hint_state', 'dismissed'],
  ['saved_relationship', 'dismiss_or_hide_as_hint_state', 'hidden'],
]);

function transitionTuple(transition) {
  return [transition.from, transition.event, transition.to];
}

test('Relationship hints runtime helper exposes the exact state machine contract', () => {
  assert.deepEqual(helper.RELATIONSHIP_HINT_STATES, expectedStates);
  assert.deepEqual(helper.RELATIONSHIP_HINT_SAVED_STATES, expectedSavedStates);
  assert.deepEqual(helper.RELATIONSHIP_HINT_SUGGESTION_STATES, expectedSuggestionStates);
  assert.deepEqual(helper.RELATIONSHIP_HINT_TRANSITIONS.map(transitionTuple), expectedTransitions);
  assert.deepEqual(helper.FORBIDDEN_TRANSITIONS.map(transitionTuple), expectedForbiddenTransitions);
});

test('Relationship hints runtime helper keeps saved and suggestion states separate', () => {
  for (const state of expectedSuggestionStates) {
    assert.equal(helper.isSavedRelationshipState(state), false, state + ' must not be a saved relationship');
    assert.equal(helper.isSuggestionState(state), true, state + ' must be a suggestion lifecycle state');
  }

  assert.equal(helper.isSavedRelationshipState('saved_relationship'), true);
  assert.equal(helper.isSuggestionState('saved_relationship'), false);
});

test('Relationship hints runtime helper rejects forbidden saved-relationship transitions', () => {
  for (const [from, event, to] of expectedForbiddenTransitions) {
    assert.equal(
      helper.isAllowedTransition(from, event, to),
      false,
      `${from} --${event}--> ${to} must remain forbidden`
    );
  }

  assert.equal(helper.isAllowedTransition('presented', 'automatic_save', 'saved_relationship'), false);
  assert.equal(helper.isAllowedTransition('dismissed', 'any_event', 'saved_relationship'), false);
  assert.equal(helper.isAllowedTransition('hidden', 'any_event', 'saved_relationship'), false);
  assert.equal(helper.isAllowedTransition('error', 'any_event', 'saved_relationship'), false);
});

test('Relationship hints runtime helper allows only explicit save transition into saved_relationship', () => {
  const eventsIntoSaved = helper.RELATIONSHIP_HINT_TRANSITIONS
    .filter((transition) => transition.to === 'saved_relationship')
    .map((transition) => [transition.from, transition.event]);

  assert.deepEqual(eventsIntoSaved, [['accepted_pending_save', 'confirm_save_relationship']]);
  assert.equal(helper.isAllowedTransition('accepted_pending_save', 'confirm_save_relationship', 'saved_relationship'), true);
  assert.equal(helper.isAllowedTransition('accepted_pending_save', 'implicit_timeout_save', 'saved_relationship'), false);
  assert.equal(helper.isAllowedTransition('accepted_pending_save', 'close_panel_as_save', 'saved_relationship'), false);
});

test('Relationship hints runtime helper runs allowed state transitions without persistence side effects', () => {
  const transitions = [];
  let now = 1000;
  const machine = helper.createRelationshipHintStateMachine({
    now: () => now,
    onTransition: (result) => transitions.push(result),
  });

  assert.equal(machine.getState(), 'not_shown');
  assert.equal(machine.isSavedRelationship(), false);
  assert.equal(machine.isSuggestion(), true);

  assert.deepEqual(machine.transition('present_hint'), {
    accepted: true,
    from: 'not_shown',
    event: 'present_hint',
    to: 'presented',
    transition: { from: 'not_shown', event: 'present_hint', to: 'presented', persistenceEffect: 'none' },
    savedRelationshipBefore: false,
    savedRelationshipAfter: false,
    persistenceEffect: 'none',
    sequence: 1,
    timestamp: 1000,
  });

  assert.equal(machine.getState(), 'presented');
  assert.equal(machine.transition('automatic_save', { to: 'saved_relationship' }).accepted, false);
  assert.equal(machine.getState(), 'presented');

  assert.equal(machine.transition('accept_for_review').to, 'accepted_pending_save');
  assert.equal(machine.getState(), 'accepted_pending_save');
  assert.equal(machine.transition('implicit_timeout_save', { to: 'saved_relationship' }).accepted, false);
  assert.equal(machine.getState(), 'accepted_pending_save');

  const saveResult = machine.transition('confirm_save_relationship');
  assert.equal(saveResult.accepted, true);
  assert.equal(saveResult.savedRelationshipBefore, false);
  assert.equal(saveResult.savedRelationshipAfter, true);
  assert.equal(saveResult.persistenceEffect, 'future_explicit_save_required');
  assert.equal(machine.getState(), 'saved_relationship');
  assert.equal(machine.isSavedRelationship(), true);
  assert.equal(machine.isSuggestion(), false);

  assert.equal(machine.transition('relationship_hint_lifecycle_complete', { to: 'hidden' }).to, 'hidden');
  assert.equal(machine.getState(), 'hidden');

  assert.deepEqual(
    transitions.map((result) => [result.from, result.event, result.to]),
    [
      ['not_shown', 'present_hint', 'presented'],
      ['presented', 'accept_for_review', 'accepted_pending_save'],
      ['accepted_pending_save', 'confirm_save_relationship', 'saved_relationship'],
      ['saved_relationship', 'relationship_hint_lifecycle_complete', 'hidden'],
    ]
  );
});

test('Relationship hints runtime helper handles multi-target transitions explicitly', () => {
  const machine = helper.createRelationshipHintStateMachine();

  const rejected = machine.transition('hide_or_reset');
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason.includes('A target state is required'), true);
  assert.equal(machine.getState(), 'not_shown');

  assert.equal(machine.transition('hide_or_reset', { to: 'hidden' }).accepted, true);
  assert.equal(machine.getState(), 'hidden');

  assert.equal(machine.transition('present_hint').to, 'presented');
  const rejectedComplete = machine.transition('relationship_hint_lifecycle_complete');
  assert.equal(rejectedComplete.accepted, false);
  assert.equal(machine.getState(), 'presented');
});

test('Relationship hints runtime helper requires explicit targets for ambiguous canTransition calls', () => {
  const hiddenOrReset = helper.createRelationshipHintStateMachine({
    initialState: 'not_shown',
  });

  assert.equal(hiddenOrReset.canTransition('hide_or_reset'), false);
  assert.equal(hiddenOrReset.canTransition('hide_or_reset', { to: 'hidden' }), true);
  assert.equal(hiddenOrReset.canTransition('hide_or_reset', { to: 'not_shown' }), true);

  const completed = helper.createRelationshipHintStateMachine({
    initialState: 'saved_relationship',
  });

  assert.equal(completed.canTransition('relationship_hint_lifecycle_complete'), false);
  assert.equal(completed.canTransition('relationship_hint_lifecycle_complete', { to: 'hidden' }), true);
  assert.equal(completed.canTransition('relationship_hint_lifecycle_complete', { to: 'not_shown' }), true);
});

test('Relationship hints runtime helper keeps non-saved transitions non-persistent', () => {
  const machine = helper.createRelationshipHintStateMachine();

  assert.equal(machine.transition('present_hint').persistenceEffect, 'none');
  assert.equal(machine.transition('accept_for_review').persistenceEffect, 'none');
  assert.equal(machine.transition('dismiss_pending_hint').persistenceEffect, 'none');
  assert.equal(machine.transition('hide_dismissed_hint').persistenceEffect, 'none');
  assert.equal(machine.transition('reset_hint_lifecycle').persistenceEffect, 'none');
  assert.equal(machine.transition('present_hint').persistenceEffect, 'none');
  assert.equal(machine.transition('hint_error').persistenceEffect, 'none');
  assert.equal(machine.transition('retry_hint').persistenceEffect, 'none');
  assert.equal(machine.transition('hint_error').persistenceEffect, 'none');
  assert.equal(machine.transition('hide_after_error').persistenceEffect, 'none');

  assert.equal(machine.getState(), 'hidden');
  assert.equal(machine.isSavedRelationship(), false);
});

test('Relationship hints runtime helper is pure and has no UI, storage, API, provider, or network wiring', () => {
  const helperCode = fs.readFileSync(HELPER_PATH, 'utf8');
  const forbiddenRuntimeWiring = [
    'document.',
    'localStorage',
    'sessionStorage',
    'fetch(',
    'XMLHttpRequest',
    'querySelector',
    'getElementById',
    'innerHTML',
    'appendChild',
    'addEventListener',
    'removeEventListener',
    'Scout',
    'live provider',
    'pages/editor.html',
  ];

  for (const forbidden of forbiddenRuntimeWiring) {
    assert.equal(helperCode.includes(forbidden), false, `helper must not include ${forbidden}`);
  }

  assert.equal(typeof helper.createRelationshipHintStateMachine, 'function');
  assert.equal(Object.keys(helper).includes('window'), false);
});

test('Relationship hints runtime helper exposes allowed transitions by state', () => {
  const presentedTransitions = helper.getAllowedTransitions('presented').map(transitionTuple);
  assert.deepEqual(presentedTransitions, [
    ['presented', 'accept_for_review', 'accepted_pending_save'],
    ['presented', 'dismiss_hint', 'dismissed'],
    ['presented', 'hide_hint_surface', 'hidden'],
    ['presented', 'hint_error', 'error'],
  ]);

  assert.equal(helper.isAllowedTransition('presented', 'accept_for_review', 'accepted_pending_save'), true);
  assert.equal(helper.isAllowedTransition('presented', 'dismiss_hint', 'accepted_pending_save'), false);
});

test('Relationship hints runtime helper validates unknown states', () => {
  assert.throws(() => helper.getAllowedTransitions('unknown_state'), /Unknown relationship hint state/);
  assert.throws(() => helper.isAllowedTransition('unknown_state', 'present_hint', 'presented'), /Unknown relationship hint state/);
  assert.throws(() => helper.createRelationshipHintStateMachine({ initialState: 'unknown_state' }), /Unknown relationship hint state/);
});
