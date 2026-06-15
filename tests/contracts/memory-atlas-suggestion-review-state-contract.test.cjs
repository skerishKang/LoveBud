'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_PATH = path.join(ROOT, 'js/memory-atlas/memory-atlas-suggestion-review-state.js');

assert.ok(fs.existsSync(HELPER_PATH), 'helper file exists');

const helperSource = fs.readFileSync(HELPER_PATH, 'utf8');
const helper = loadHelper();

function loadHelper() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(helperSource, sandbox, { filename: 'memory-atlas-suggestion-review-state.js' });
  return sandbox.module.exports;
}

function sampleSuggestions() {
  return [
    {
      id: 's1',
      type: 'topic_match',
      sourceMemoryId: 'm1',
      targetMemoryId: 'm2',
      visibility: 'private',
      confidence: 'medium',
      reasonCode: 'topic_match',
      previewOnly: true,
      evidenceRefs: [
        { id: 'e1', memoryId: 'm1', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
        { id: 'e2', memoryId: 'm2', targetId: 'topic:uiuc', sourceType: 'topic_match', visibility: 'private' },
      ],
    },
    {
      id: 's2',
      type: 'source_match',
      sourceMemoryId: 'm1',
      targetMemoryId: 'm3',
      visibility: 'private',
      confidence: 'low',
      reasonCode: 'source_match',
      previewOnly: true,
      evidenceRefs: [
        { id: 'e3', memoryId: 'm1', targetId: 'source:youtube', sourceType: 'source_match', visibility: 'private' },
      ],
    },
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('exports expected Memory Atlas suggestion review state API', () => {
  assert.equal(typeof helper.createMemoryAtlasSuggestionReviewState, 'function');
  assert.equal(typeof helper.applyMemoryAtlasSuggestionReviewAction, 'function');
  assert.equal(typeof helper.getVisibleMemoryAtlasSuggestions, 'function');
  assert.equal(typeof helper.summarizeMemoryAtlasSuggestionReviewState, 'function');
  assert.equal(JSON.stringify(helper.REVIEW_STATES), JSON.stringify(['previewed', 'accepted', 'dismissed']));
});

test('initial state keeps suggestions as previewed without mutating input', () => {
  const suggestions = sampleSuggestions();
  const before = clone(suggestions);
  const state = helper.createMemoryAtlasSuggestionReviewState(suggestions);

  assert.equal(state.byId.s1.state, 'previewed');
  assert.equal(state.byId.s2.state, 'previewed');
  assert.equal(state.counts.total, 2);
  assert.equal(state.counts.visible, 2);
  assert.equal(state.counts.previewed, 2);
  assert.equal(JSON.stringify(state.byId.s1.suggestion.evidenceRefs), JSON.stringify(suggestions[0].evidenceRefs));
  assert.deepEqual(suggestions, before);
});

test('accepted action changes only local review state', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const accepted = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accept' });

  assert.equal(state.byId.s1.state, 'previewed');
  assert.equal(accepted.byId.s1.state, 'accepted');
  assert.equal(accepted.byId.s2.state, 'previewed');
  assert.equal(accepted.counts.accepted, 1);
  assert.equal(accepted.counts.visible, 2);

  const summary = helper.summarizeMemoryAtlasSuggestionReviewState(accepted);
  assert.equal(JSON.stringify(summary.idsByState.accepted), JSON.stringify(['s1']));
  assert.equal(JSON.stringify(summary.idsByState.previewed), JSON.stringify(['s2']));
  assert.equal(JSON.stringify(summary.idsByState.dismissed), JSON.stringify([]));
});

test('accepted does not create persisted relationship artifacts', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const accepted = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accepted' });
  const visible = helper.getVisibleMemoryAtlasSuggestions(accepted);
  const serialized = JSON.stringify({ state: accepted, visible });

  assert.equal(accepted.byId.s1.state, 'accepted');
  assert.equal(accepted.byId.s1.suggestion.previewOnly, true);
  assert.equal(visible.find((item) => item.id === 's1').reviewState, 'accepted');
  assert.doesNotMatch(serialized, /saved|persisted|published|relationshipSaved|edgeCreated/i);
});

test('dismissed action hides suggestion from visible list but keeps it recoverable', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const dismissed = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'dismiss' });
  const visibleAfterDismiss = helper.getVisibleMemoryAtlasSuggestions(dismissed);
  const recovered = helper.applyMemoryAtlasSuggestionReviewAction(dismissed, { suggestionId: 's1', type: 'previewed' });
  const visibleAfterRecover = helper.getVisibleMemoryAtlasSuggestions(recovered);

  assert.equal(dismissed.byId.s1.state, 'dismissed');
  assert.equal(JSON.stringify(visibleAfterDismiss.map((item) => item.id)), JSON.stringify(['s2']));
  assert.equal(recovered.byId.s1.state, 'previewed');
  assert.equal(JSON.stringify(visibleAfterRecover.map((item) => item.id)), JSON.stringify(['s1', 's2']));
});

test('evidenceRefs are preserved through review actions', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const accepted = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accept' });
  const dismissed = helper.applyMemoryAtlasSuggestionReviewAction(accepted, { suggestionId: 's1', type: 'dismiss' });

  assert.deepEqual(dismissed.byId.s1.suggestion.evidenceRefs, state.byId.s1.suggestion.evidenceRefs);
  assert.equal(JSON.stringify(helper.getVisibleMemoryAtlasSuggestions(state)[0].evidenceRefs), JSON.stringify(sampleSuggestions()[0].evidenceRefs));
});

test('unknown suggestion id action is safe no-op', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const after = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 'missing', type: 'dismiss' });

  assert.deepEqual(after, state);
  assert.equal(JSON.stringify(helper.getVisibleMemoryAtlasSuggestions(after).map((item) => item.id)), JSON.stringify(['s1', 's2']));
});

test('duplicate action is deterministic', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const once = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's2', type: 'accept' });
  const twice = helper.applyMemoryAtlasSuggestionReviewAction(once, { suggestionId: 's2', type: 'accepted' });
  const third = helper.applyMemoryAtlasSuggestionReviewAction(twice, { suggestionId: 's2', type: 'accept' });

  assert.equal(JSON.stringify(twice), JSON.stringify(once));
  assert.equal(JSON.stringify(third), JSON.stringify(once));
  assert.equal(helper.summarizeMemoryAtlasSuggestionReviewState(third).accepted, 1);
});

test('forbidden states are never emitted', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions(), {
    states: {
      s1: 'saved',
      s2: 'persisted',
    },
  });
  const rejected = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', state: 'published' });
  const visible = helper.getVisibleMemoryAtlasSuggestions(rejected);
  const summary = helper.summarizeMemoryAtlasSuggestionReviewState(rejected);
  const serialized = JSON.stringify({ state: rejected, visible, summary });

  assert.equal(state.byId.s1.state, 'previewed');
  assert.equal(state.byId.s2.state, 'previewed');
  assert.equal(JSON.stringify(visible.map((item) => item.id)), JSON.stringify(['s1', 's2']));
  assert.deepEqual(Object.keys(summary).filter((key) => ['saved', 'persisted', 'published'].includes(key)), []);
  assert.doesNotMatch(serialized, /saved|persisted|published/i);
});

test('state is JSON-serializable plain data', () => {
  const state = helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions());
  const accepted = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accept' });
  const roundTripped = JSON.parse(JSON.stringify(accepted));

  assert.equal(roundTripped.byId.s1.state, 'accepted');
  assert.equal(JSON.stringify(roundTripped.byId.s1.suggestion.evidenceRefs[0]), JSON.stringify(state.byId.s1.suggestion.evidenceRefs[0]));
});

test('rehydrate from previous full state preserves accepted/dismissed decisions', () => {
  const suggestions = sampleSuggestions();
  const state = helper.createMemoryAtlasSuggestionReviewState(suggestions);
  const afterAccept = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accept' });
  const afterDismiss = helper.applyMemoryAtlasSuggestionReviewAction(afterAccept, { suggestionId: 's2', type: 'dismiss' });

  const rehydrated = helper.createMemoryAtlasSuggestionReviewState(suggestions, afterDismiss);
  const visible = helper.getVisibleMemoryAtlasSuggestions(rehydrated);

  assert.equal(rehydrated.byId.s1.state, 'accepted', 'accepted preserved');
  assert.equal(rehydrated.byId.s2.state, 'dismissed', 'dismissed preserved');
  assert.equal(JSON.stringify(visible.map((item) => item.id)), JSON.stringify(['s1']));
  assert.equal(helper.summarizeMemoryAtlasSuggestionReviewState(rehydrated).accepted, 1);
  assert.equal(helper.summarizeMemoryAtlasSuggestionReviewState(rehydrated).dismissed, 1);
});

test('rehydrate from string-only initialState still works', () => {
  const suggestions = sampleSuggestions();
  const state = helper.createMemoryAtlasSuggestionReviewState(suggestions, { states: { s1: 'accepted', s2: 'dismissed' } });

  assert.equal(state.byId.s1.state, 'accepted');
  assert.equal(state.byId.s2.state, 'dismissed');

  const visible = helper.getVisibleMemoryAtlasSuggestions(state);
  assert.equal(JSON.stringify(visible.map((item) => item.id)), JSON.stringify(['s1']));
});

test('rehydrate with unknown object shape falls back to previewed', () => {
  const suggestions = sampleSuggestions();
  const state = helper.createMemoryAtlasSuggestionReviewState(suggestions, { byId: { s1: { unknown: true }, s2: { reviewState: 'accepted' } } });

  assert.equal(state.byId.s1.state, 'previewed', 'unknown shape falls back');
  assert.equal(state.byId.s2.state, 'accepted', 'reviewState extracted from object');
});

test('rehydrate does not mutate original suggestions or initialState', () => {
  const suggestions = sampleSuggestions();
  const state = helper.createMemoryAtlasSuggestionReviewState(suggestions);
  const after = helper.applyMemoryAtlasSuggestionReviewAction(state, { suggestionId: 's1', type: 'accept' });
  const beforeSuggestions = clone(suggestions);
  const beforeState = clone(after);

  helper.createMemoryAtlasSuggestionReviewState(sampleSuggestions(), after);

  assert.deepEqual(suggestions, beforeSuggestions, 'original suggestions not mutated');
  assert.equal(JSON.stringify(after), JSON.stringify(beforeState), 'previous state not mutated');
});

test('helper source stays pure and avoids persistence, network, provider, and publication markers', () => {
  assert.doesNotMatch(helperSource, /localStorage/);
  assert.doesNotMatch(helperSource, /sessionStorage/);
  assert.doesNotMatch(helperSource, /indexedDB/);
  assert.doesNotMatch(helperSource, /fetch\s*\(/);
  assert.doesNotMatch(helperSource, /XMLHttpRequest/);
  assert.doesNotMatch(helperSource, /WebSocket/);
  assert.doesNotMatch(helperSource, /Scout/);
  assert.doesNotMatch(helperSource, /provider/i);
  assert.doesNotMatch(helperSource, /api/i);
  assert.doesNotMatch(helperSource, /DB migration|schema|Browse|Search|redesign/i);
  assert.doesNotMatch(helperSource, /#2418|#1882|closed|completed/i);
});
