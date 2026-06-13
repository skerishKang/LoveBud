const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const PLAN_PATH = 'docs/product/lovebud-relationship-hints-state-machine-contract.md';
const INDEX_PATH = 'docs/product/product_index.md';

test('State machine contract locks refs, docs-only scope, and hard no-change boundaries', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Refs:\s*#2458,\s*#2418/);
  assert.match(plan, /Depends on:\s*#2454,\s*#2456/);
  assert.match(plan, /Parent:\s*#2418/);
  assert.match(plan, /Scope:\s*docs\/contracts-only state machine slice/);
  assert.match(plan, /Runtime behavior change:\s*none/);
  assert.match(plan, /Saved relationship behavior change:\s*none/);
  assert.match(plan, /Database\/schema migration:\s*none/);
  assert.match(plan, /API behavior change:\s*none/);
  assert.match(plan, /Frontend UI implementation:\s*none/);
  assert.match(plan, /Automatic graph layout:\s*none/);
  assert.match(plan, /Scout\/live AI\/provider\/fetch\/network work:\s*none/);
  assert.match(plan, /Browse\/Search social-count changes:\s*none/);
});

test('State machine contract locks exact relationship hint states', () => {
  const plan = read(PLAN_PATH);

  const expectedStates = [
    'not_shown',
    'presented',
    'accepted_pending_save',
    'saved_relationship',
    'dismissed',
    'hidden',
    'error',
  ];

  const stateTableMatch = plan.match(
    /\| State \| Meaning \| Saved relationship\? \|\n\| --- \| --- \| --- \|\n(?<rows>(?:\| `[^`]+` \| .+ \| (?:Yes|No) \|\n)+)/
  );

  assert.ok(stateTableMatch, 'Expected state table to be present');

  const actualStates = Array.from(
    stateTableMatch.groups.rows.matchAll(/\| `([^`]+)` \|/g),
    (match) => match[1]
  );

  assert.deepEqual(actualStates, expectedStates);
});

test('State machine contract locks suggestion states as non-saved relationships', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /`presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are \*\*not saved relationships\*\*/);
  assert.match(plan, /Suggestion lifecycle states/);
  assert.match(plan, /`not_shown`/);
  assert.match(plan, /`presented`/);
  assert.match(plan, /`accepted_pending_save`/);
  assert.match(plan, /`dismissed`/);
  assert.match(plan, /`hidden`/);
  assert.match(plan, /`error`/);
  assert.match(plan, /They must not be treated as saved edges, persisted relationships, graph data, or user-authored relationship intent/);
});

test('State machine contract locks allowed transitions', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /\| `not_shown` \| `present_hint` \| `presented` \|/);
  assert.match(plan, /\| `presented` \| `accept_for_review` \| `accepted_pending_save` \|/);
  assert.match(plan, /\| `presented` \| `dismiss_hint` \| `dismissed` \|/);
  assert.match(plan, /\| `presented` \| `hide_hint_surface` \| `hidden` \|/);
  assert.match(plan, /\| `presented` \| `hint_error` \| `error` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| `confirm_save_relationship` \| `saved_relationship` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| `back_to_review` \| `presented` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| `dismiss_pending_hint` \| `dismissed` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| `hide_pending_hint` \| `hidden` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| `save_validation_error` \| `error` \|/);
  assert.match(plan, /\| `dismissed` \| `hide_dismissed_hint` \| `hidden` \|/);
  assert.match(plan, /\| `dismissed` \| `reset_hint_lifecycle` \| `not_shown` \|/);
  assert.match(plan, /\| `dismissed` \| `present_new_hint` \| `presented` \|/);
  assert.match(plan, /\| `hidden` \| `present_hint` \| `presented` \|/);
  assert.match(plan, /\| `hidden` \| `reset_hint_lifecycle` \| `not_shown` \|/);
  assert.match(plan, /\| `error` \| `retry_hint` \| `presented` \|/);
  assert.match(plan, /\| `error` \| `hide_after_error` \| `hidden` \|/);
  assert.match(plan, /\| `saved_relationship` \| `relationship_hint_lifecycle_complete` \| `not_shown` \/ `hidden` \|/);
});

test('State machine contract locks forbidden transitions', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Forbidden Transitions/);
  assert.match(plan, /\| `not_shown` \| automatic relationship creation \| `saved_relationship` \|/);
  assert.match(plan, /\| `presented` \| automatic save \| `saved_relationship` \|/);
  assert.match(plan, /\| `presented` \| dismiss-as-save \| `saved_relationship` \|/);
  assert.match(plan, /\| `presented` \| hide-as-save \| `saved_relationship` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| implicit timeout save \| `saved_relationship` \|/);
  assert.match(plan, /\| `accepted_pending_save` \| close-panel-as-save \| `saved_relationship` \|/);
  assert.match(plan, /\| `dismissed` \| any event \| `saved_relationship` \|/);
  assert.match(plan, /\| `hidden` \| any event \| `saved_relationship` \|/);
  assert.match(plan, /\| `error` \| any event \| `saved_relationship` \|/);
  assert.match(plan, /\| `saved_relationship` \| dismiss\/hide \| `dismissed` \/ `hidden` as hint state \|/);
});

test('State machine contract locks explicit save/confirm boundary', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /`accepted_pending_save` means:/);
  assert.match(plan, /the user has reviewed or accepted a suggestion for possible saving/);
  assert.match(plan, /the relationship is still \*\*not saved\*\*/);
  assert.match(plan, /no edge is persisted/);
  assert.match(plan, /no graph layout changes are committed/);
  assert.match(plan, /A relationship may become `saved_relationship` only through a future explicit transition such as `confirm_save_relationship`/);
  assert.match(plan, /That future transition must require a clear user action/);
});

test('State machine contract locks dismiss, hidden, and error semantics', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /### `dismissed`/);
  assert.match(plan, /No saved edge is created/);
  assert.match(plan, /No hidden edge is created/);
  assert.match(plan, /No suppression state may be confused with a saved relationship/);
  assert.match(plan, /### `hidden`/);
  assert.match(plan, /Hidden is a presentation state, not a saved edge/);
  assert.match(plan, /Hiding `accepted_pending_save` must not save/);
  assert.match(plan, /Hiding `presented` must not save/);
  assert.match(plan, /Hiding `error` must not save/);
  assert.match(plan, /### `error`/);
  assert.match(plan, /Error must not create saved relationships/);
  assert.match(plan, /Error must not clear manual edits/);
  assert.match(plan, /Manual editing remains available/);
});

test('State machine contract locks persistence boundary', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /This state machine contract does \*\*not\*\* authorize persistence/);
  assert.match(plan, /`not_shown`, `presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are non-persistent suggestion states/);
  assert.match(plan, /`saved_relationship` is the only saved state/);
  assert.match(plan, /Persistence requires a later storage\/runtime slice after this contract is accepted/);
  assert.match(plan, /This slice must not add DB schema, migrations, API endpoints, or saved-edge implementation/);
});

test('State machine contract locks runtime implementation boundary', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /This slice is docs\/contracts-only/);
  assert.match(plan, /It must not:/);
  assert.match(plan, /implement runtime UI/);
  assert.match(plan, /create saved relationship edges/);
  assert.match(plan, /add DB schema or migrations/);
  assert.match(plan, /add API endpoints/);
  assert.match(plan, /run automatic graph layout/);
  assert.match(plan, /call Scout, live AI, external providers, or network services/);
  assert.match(plan, /change Browse\/Search social-count behavior/);
});

test('State machine contract records privacy, visibility, and accessibility guardrails', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Privacy and Visibility Guardrails/);
  assert.match(plan, /Private nodes, private memories, owner identifiers, or hidden tree structure must not appear/);
  assert.match(plan, /safe labels such as `같은 아티스트`, `같은 소스`, `비슷한 순간`/);
  assert.match(plan, /Accessibility Requirements for Future Runtime/);
  assert.match(plan, /keyboard-accessible accept, save\/confirm, dismiss, and hide controls/);
  assert.match(plan, /visible focus states/);
  assert.match(plan, /screen-reader labels that distinguish suggestions from saved relationships/);
  assert.match(plan, /sufficient color contrast/);
  assert.match(plan, /non-color-only distinction/);
});

test('State machine contract locks no Scout/live AI/provider/fetch/network work', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /This state machine contract is provider-agnostic and must not depend on Scout or live AI/);
  assert.match(plan, /Allowed future sources, only after separate readiness gates:/);
  assert.match(plan, /deterministic local rules/);
  assert.match(plan, /mock\/stub prototype data/);
  assert.match(plan, /Scout\/live AI suggestions after auth, rate-limit, provider, and privacy readiness/);
  assert.match(plan, /Prohibited for this slice:/);
  assert.match(plan, /Scout\/live provider calls/);
  assert.match(plan, /default live AI\/provider\/fetch\/network work/);
  assert.match(plan, /network dependency for hint state transitions/);
  assert.match(plan, /relationship scoring outside a future contract/);
});

test('State machine contract records future slices and verification plan', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Recommended Future Slices/);
  assert.match(plan, /Runtime state machine implementation/);
  assert.match(plan, /Accept\/dismiss UX slice/);
  assert.match(plan, /Review\/save UX slice/);
  assert.match(plan, /Storage\/runtime slice/);
  assert.match(plan, /Optional Scout\/live AI slice/);
  assert.match(plan, /Required validation for this PR:/);
  assert.match(plan, /contract test locks the exact state list/);
  assert.match(plan, /contract test locks that `presented`, `accepted_pending_save`, `dismissed`, `hidden`, and `error` are not saved relationships/);
  assert.match(plan, /contract test locks that `saved_relationship` requires explicit save\/confirm/);
  assert.match(plan, /contract test locks forbidden transitions/);
});

test('State machine contract lists related docs and contract patterns', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /#2458/);
  assert.match(plan, /#2456/);
  assert.match(plan, /#2454/);
  assert.match(plan, /#2418/);
  assert.match(plan, /lovebud-relationship-hints-review-before-save-plan\.md/);
  assert.match(plan, /lovebud-relationship-hints-ux-prototype-plan\.md/);
  assert.match(plan, /READ_ONLY_LOVETREE_VIEWER_PLAN\.md/);
  assert.match(plan, /MOMENT_TIMELINE_REORDER_DESIGN\.md/);
  assert.match(plan, /lovebud-scout-mvp-boundary\.md/);
  assert.match(plan, /relationship-hints-review-before-save-plan-contract\.test\.cjs/);
  assert.match(plan, /relationship-hints-ux-prototype-plan-contract\.test\.cjs/);
  assert.match(plan, /browse-tree-social-counts-completion-audit-contract\.test\.cjs/);
});

test('Product index includes the relationship hints state machine contract', () => {
  const index = read(INDEX_PATH);

  assert.match(index, /lovebud-relationship-hints-state-machine-contract\.md/);
  assert.match(index, /#2458/);
  assert.match(index, /relationship hints/);
});
