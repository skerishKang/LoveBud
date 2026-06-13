const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const PLAN_PATH = 'docs/product/lovebud-relationship-hints-ux-prototype-plan.md';
const INDEX_PATH = 'docs/product/product_index.md';

test('UX prototype plan locks refs, docs-only scope, and hard no-change boundaries', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Refs:\s*#2456,\s*#2418/);
  assert.match(plan, /Depends on:\s*#2454/);
  assert.match(plan, /Parent:\s*#2418/);
  assert.match(plan, /Scope:\s*docs\/contracts-only UX prototype planning slice/);
  assert.match(plan, /Runtime behavior change:\s*none/);
  assert.match(plan, /Saved relationship behavior change:\s*none/);
  assert.match(plan, /Database\/schema migration:\s*none/);
  assert.match(plan, /API behavior change:\s*none/);
  assert.match(plan, /Frontend UI implementation:\s*none/);
  assert.match(plan, /Automatic graph layout:\s*none/);
  assert.match(plan, /Scout\/live AI\/provider\/fetch\/network work:\s*none/);
  assert.match(plan, /Browse\/Search social-count changes:\s*none/);
});

test('UX prototype plan defines a non-saving relationship hints prototype', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /relationship hints UX prototype without saving/);
  assert.match(plan, /Show relationship hints as provisional, non-persistent suggestions/);
  assert.match(plan, /prototype hints are temporary presentation data only/);
  assert.match(plan, /suggested links are not saved relationships/);
  assert.match(plan, /dismissing a suggested link does not create a saved edge/);
  assert.match(plan, /The first UX prototype may use mock\/stub data only/);
  assert.match(plan, /must not write to DB, call API, or persist relationship hints/);
});

test('UX prototype plan defines suggested-link visual language', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Suggested links must be impossible to mistake for saved relationships/);
  assert.match(plan, /dashed or dotted line/);
  assert.match(plan, /lower opacity or softer color/);
  assert.match(plan, /small suggestion badge/);
  assert.match(plan, /tooltip or caption/);
  assert.match(plan, /no saved-edge affordance until a future accept\/save flow exists/);
  assert.match(plan, /no drag\/drop handle on suggested links/);
  assert.match(plan, /no automatic layout that hides the distinction/);
});

test('UX prototype plan defines future accept and dismiss affordance placement', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Future Accept \/ Dismiss Affordance Placement/);
  assert.match(plan, /Primary hint panel/);
  assert.match(plan, /One row\/card per relationship hint/);
  assert.match(plan, /Future controls appear on the hint card, not directly on the canvas line/);
  assert.match(plan, /`살펴보기` \/ `연결 검토`/);
  assert.match(plan, /`닫기` \/ `제외`/);
  assert.match(plan, /Canvas line preview/);
  assert.match(plan, /Accept should open a review\/save affordance, not save immediately/);
  assert.match(plan, /Dismiss should hide\/remove the suggestion without creating a hidden edge/);
});

test('UX prototype plan defines empty, loading, disabled, and error states', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Empty \| No hints are available/);
  assert.match(plan, /Loading \| Future data source may be preparing hints/);
  assert.match(plan, /Disabled \| No selection, editor mode unavailable, or prototype unavailable/);
  assert.match(plan, /Error \| Prototype hint preparation failed/);
  assert.match(plan, /No hints after dismiss/);
  assert.match(plan, /Do not create a saved edge/);
  assert.match(plan, /do not block manual editing/);
  assert.match(plan, /keep manual editing available/);
});

test('UX prototype plan preserves manual editing as source of truth', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Manual Editing Source of Truth/);
  assert.match(plan, /existing manual tree\/canvas editing remains the source of truth/);
  assert.match(plan, /hints must not silently create, overwrite, or reorder saved relationships/);
  assert.match(plan, /the saved relationship remains authoritative/);
  assert.match(plan, /users must be able to continue editing manually even when hints are unavailable/);
  assert.match(plan, /hint errors must not clear existing user edits/);
});

test('UX prototype plan records privacy, visibility, and accessibility guardrails', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Privacy and Visibility Guardrails/);
  assert.match(plan, /no private nodes, private memories, owner identifiers, or hidden tree structure/);
  assert.match(plan, /public viewer mode must not imply editor authority or write capability/);
  assert.match(plan, /safe labels such as `같은 아티스트`, `같은 소스`, `비슷한 순간`/);
  assert.match(plan, /Accessibility Requirements for Future Prototype/);
  assert.match(plan, /keyboard-accessible accept\/dismiss controls/);
  assert.match(plan, /visible focus states/);
  assert.match(plan, /screen-reader labels that say the link is a suggestion, not saved/);
  assert.match(plan, /avoid color-only distinction/);
});

test('UX prototype plan locks no Scout/live AI/provider/fetch/network work', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /This slice must not call Scout, live AI, external providers, or network services/);
  assert.match(plan, /Allowed in future planning:/);
  assert.match(plan, /deterministic local rules after privacy review/);
  assert.match(plan, /mock\/stub prototype data/);
  assert.match(plan, /Prohibited for this slice:/);
  assert.match(plan, /Scout\/live provider calls/);
  assert.match(plan, /default live AI\/provider\/fetch\/network work/);
  assert.match(plan, /network dependency for prototype hints/);
  assert.match(plan, /relationship scoring outside a future contract/);
});

test('UX prototype plan records future slices and verification plan', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /UX prototype runtime slice/);
  assert.match(plan, /State machine contract/);
  assert.match(plan, /Accept\/dismiss UX slice/);
  assert.match(plan, /Review\/save UX slice/);
  assert.match(plan, /Storage\/runtime slice/);
  assert.match(plan, /Optional Scout\/live AI slice/);
  assert.match(plan, /Required validation for this PR:/);
  assert.match(plan, /contract test locks no-save, no-runtime, no-live-provider boundaries/);
  assert.match(plan, /docs define suggested-link visual language/);
  assert.match(plan, /docs define future accept\/dismiss affordance placement/);
});

test('UX prototype plan lists related docs and contract patterns', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /#2456/);
  assert.match(plan, /#2454/);
  assert.match(plan, /#2418/);
  assert.match(plan, /lovebud-relationship-hints-review-before-save-plan\.md/);
  assert.match(plan, /READ_ONLY_LOVETREE_VIEWER_PLAN\.md/);
  assert.match(plan, /MOMENT_TIMELINE_REORDER_DESIGN\.md/);
  assert.match(plan, /lovebud-scout-mvp-boundary\.md/);
  assert.match(plan, /relationship-hints-review-before-save-plan-contract\.test\.cjs/);
  assert.match(plan, /browse-tree-social-counts-completion-audit-contract\.test\.cjs/);
});

test('Product index includes the relationship hints UX prototype planning document', () => {
  const index = read(INDEX_PATH);

  assert.match(index, /lovebud-relationship-hints-ux-prototype-plan\.md/);
  assert.match(index, /#2456/);
  assert.match(index, /relationship hints/);
});
