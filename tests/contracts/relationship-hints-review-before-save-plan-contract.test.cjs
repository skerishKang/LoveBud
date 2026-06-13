const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const PLAN_PATH = 'docs/product/lovebud-relationship-hints-review-before-save-plan.md';
const INDEX_PATH = 'docs/product/product_index.md';

test('Plan document locks refs, docs-only scope, and no-runtime-change boundary', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Refs:\s*#2454,\s*#2418/);
  assert.match(plan, /Parent:\s*#2418/);
  assert.match(plan, /Scope:\s*docs\/contracts-only planning slice/);
  assert.match(plan, /Runtime behavior change:\s*none/);
  assert.match(plan, /Database\/schema migration:\s*none/);
  assert.match(plan, /API behavior change:\s*none/);
  assert.match(plan, /Frontend UI implementation:\s*none/);
  assert.match(plan, /Scout\/live AI\/provider\/fetch\/network work:\s*none/);
  assert.match(plan, /Browse\/Search social-count changes:\s*none/);
});

test('Plan document records manual editing as source of truth', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Manual editing remains the source of truth/);
  assert.match(plan, /manual tree\/canvas editing behavior is not replaced by hints/);
  assert.match(plan, /A saved relationship requires an explicit user action/);
  assert.match(plan, /manual saved relationship remains authoritative/);
});

test('Plan document records review-before-save semantics', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /relationship hint is only a suggestion until the user explicitly accepts it/);
  assert.match(plan, /review-before-save relationship hints/);
  assert.match(plan, /show hint → user accepts → open review\/save affordance → user saves → saved relationship appears as normal edge/);
  assert.match(plan, /must not save before the user has seen and confirmed the relationship/);
  assert.match(plan, /no auto-save is allowed from hint generation or hint presentation/);
});

test('Plan document records suggested link vs saved link distinction', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Suggested links and saved links must remain separate concepts/);
  assert.match(plan, /dashed or dotted line instead of solid saved edge/);
  assert.match(plan, /lower opacity or softer color/);
  assert.match(plan, /small suggestion badge or tooltip/);
  assert.match(plan, /no saved-edge affordance until accepted/);
  assert.match(plan, /no automatic layout that hides the distinction/);
});

test('Plan document records accept and dismiss rules', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Accept means: "use this hint as a candidate relationship and let me review\/save it\."/);
  assert.match(plan, /Accept must not mean:/);
  assert.match(plan, /immediately save an edge without review/);
  assert.match(plan, /Dismiss means: "do not save this relationship\."/);
  assert.match(plan, /remove or hide the suggestion from the current hint surface/);
  assert.match(plan, /avoid creating a saved edge/);
  assert.match(plan, /avoid creating a hidden edge/);
});

test('Plan document records lifecycle and dismissed-hint boundary', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /discovered → presented → accepted or dismissed/);
  assert.match(plan, /accepted → review\/save → saved relationship/);
  assert.match(plan, /dismissed → hidden\/suppressed without creating a saved edge/);
  assert.match(plan, /`presented` hints are suggestions only/);
  assert.match(plan, /`accepted` hints are not automatically persisted until the user completes the normal review\/save boundary/);
  assert.match(plan, /`dismissed` hints must not become saved edges/);
  assert.match(plan, /Suppression state must not be confused with a saved relationship/);
});

test('Plan document records no automatic graph layout or hidden edges', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /automatic hidden edges/);
  assert.match(plan, /automatic graph layout/);
  assert.match(plan, /must not silently create or overwrite saved edges/);
  assert.match(plan, /blur the line between suggested and saved links/);
});

test('Plan document records no Scout/live AI/provider/fetch/network work in this slice', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /No live AI\/provider\/fetch\/network work is included in this planning slice/);
  assert.match(plan, /Scout\/live AI\/provider\/fetch\/network work:\s*none/);
  assert.match(plan, /default live AI\/provider\/fetch\/network work/);
  assert.match(plan, /Scout\/live provider calls/);
  assert.match(plan, /Optional Scout\/live AI slice/);
  assert.match(plan, /Scout\/auth\/rate-limit\/provider readiness gates/);
});

test('Plan document records privacy and visibility guardrails', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Relationship hints must not expose private data/);
  assert.match(plan, /private tree data must not be used to suggest public relationships/);
  assert.match(plan, /public viewer mode must not imply editor authority or write capability/);
  assert.match(plan, /safe labels such as "같은 아티스트" or "같은 소스"/);
});

test('Plan document records future slices and verification plan', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /Product\/design prototype/);
  assert.match(plan, /State machine contract/);
  assert.match(plan, /Review\/save UX/);
  assert.match(plan, /Storage\/runtime slice/);
  assert.match(plan, /Optional Scout\/live AI slice/);
  assert.match(plan, /Required validation for this PR:/);
  assert.match(plan, /contract test locks review-before-save guardrails/);
  assert.match(plan, /docs state dismissed hints are not saved/);
});

test('Plan document lists related docs and contract patterns', () => {
  const plan = read(PLAN_PATH);

  assert.match(plan, /READ_ONLY_LOVETREE_VIEWER_PLAN\.md/);
  assert.match(plan, /MOMENT_TIMELINE_REORDER_DESIGN\.md/);
  assert.match(plan, /lovebud-scout-mvp-boundary\.md/);
  assert.match(plan, /lovebud-scout-live-provider-prompt-response-contract\.md/);
  assert.match(plan, /browse-tree-social-counts-completion-audit-contract\.test\.cjs/);
  assert.match(plan, /scout-live-provider-post-mock-readiness-audit-contract\.test\.cjs/);
});

test('Product index includes the relationship hints planning document', () => {
  const index = read(INDEX_PATH);

  assert.match(index, /lovebud-relationship-hints-review-before-save-plan\.md/);
  assert.match(index, /#2454/);
  assert.match(index, /relationship hints/);
});
