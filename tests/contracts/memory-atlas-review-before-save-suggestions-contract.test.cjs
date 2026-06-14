const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sectionBetween(markdown, heading) {
  const headingPattern = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
  const nextHeading = /^## .+$/m;
  const match = headingPattern.exec(markdown);
  assert.ok(match, `Missing section: ${heading}`);
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = nextHeading.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

const DOC_PATH = 'docs/product/lovebud-memory-atlas-review-before-save-suggestions.md';
const TEST_PATH = 'tests/contracts/memory-atlas-review-before-save-suggestions-contract.test.cjs';

test('Document exists and anchors Issue #2503 with required refs', () => {
  const doc = read(DOC_PATH);

  assert.match(doc, /^# Memory Atlas Review-Before-Save Suggestions Plan$/m);
  assert.match(doc, /^Issue: #2503$/m);
  for (const issue of ['#2489', '#2492', '#2494', '#2496', '#2499', '#2501', '#2418', '#1882']) {
    assert.match(doc, new RegExp(issue));
  }
  assert.match(doc, /Scope:\s*docs\/contracts-only planning slice/);
  assert.match(doc, /Runtime behavior change:\s*none/);
  assert.match(doc, /Database\/schema migration:\s*none/);
  assert.match(doc, /API behavior change:\s*none/);
});

test('Document locks suggestion states and saved-state boundary', () => {
  const doc = read(DOC_PATH);

  for (const state of ['candidate', 'previewed', 'dismissed', 'accepted', 'saved']) {
    assert.match(doc, new RegExp('`' + state + '`'));
  }
  assert.match(doc, /candidate, previewed, dismissed, and accepted are not equivalent to saved\./);
  assert.match(doc, /A suggestion is not a saved relationship\./);
  assert.match(doc, /A previewed relationship is not a saved relationship\./);
  assert.match(doc, /Only explicit user action can turn a reviewed suggestion into future saved state\./);
});

test('Document locks suggestion types without persisting edge types', () => {
  const doc = read(DOC_PATH);

  const types = [
    'topic_match',
    'source_match',
    'emotion_match',
    'time_match',
    'tree_context',
    'manual_link_candidate',
    'contrasts_with_candidate',
    'follows_from_candidate',
  ];

  for (const type of types) {
    assert.match(doc, new RegExp('`' + type + '`'));
  }
  assert.match(doc, /These types are suggestion types, not persisted edge types\./);
});

test('Document requires evidence references before suggestions are shown as fact', () => {
  const doc = read(DOC_PATH);

  assert.match(doc, /Every relationship suggestion must include evidence references\./);
  assert.match(doc, /No suggestion should be shown as fact without evidence\./);
  for (const evidence of [
    'source memory id',
    'target memory id or target node id',
    'supporting node id',
    'evidence id from the projection helper',
    'visibility scope',
    'confidence',
    'review status',
  ]) {
    assert.match(doc, new RegExp(evidence));
  }
});

test('Document requires strictest visibility inheritance', () => {
  const doc = read(DOC_PATH);

  assert.match(doc, /Suggestions inherit the strictest visibility of supporting evidence\./);
  assert.match(doc, /A suggestion is public only when every supporting evidence item is public\./);
  assert.match(doc, /Private or non-public evidence makes the suggestion private or non-public\./);
  assert.match(doc, /The public viewer must not receive a suggestion that depends on private evidence\./);
});

test('Document defines review-before-save flow', () => {
  const doc = read(DOC_PATH);

  assert.match(doc, /Show suggestion as preview-only\./);
  assert.match(doc, /Explain why it appears using evidence references\./);
  assert.match(doc, /Label the suggestion state\./);
  assert.match(doc, /Let the user accept or dismiss in a future UI slice\./);
  assert.match(doc, /Do not save a relationship until a future explicit save\/confirm action exists\./);
  assert.match(doc, /If dismissed, do not silently re-show without a defined policy\./);
});

test('Document includes suggested copy and forbidden copy guardrails', () => {
  const doc = read(DOC_PATH);
  const forbiddenCopy = sectionBetween(doc, 'Forbidden copy');

  for (const copy of [
    'Suggested connection',
    'Preview only — this relationship is not saved.',
    'Based on existing memory evidence.',
    'Review before saving.',
    'Accept suggestion',
    'Dismiss suggestion',
  ]) {
    assert.match(doc, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const copy of [
    'Saved relationship',
    'AI confirmed',
    'Published graph',
    'Public wiki link',
    'Auto-saved connection',
  ]) {
    assert.match(forbiddenCopy, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Document labels AI-derived suggestions as interpretation, not fact', () => {
  const doc = read(DOC_PATH);
  const allowed = sectionBetween(doc, 'AI interpretation guardrail');

  assert.match(doc, /AI-derived suggestions must be labeled as interpretation, not fact\./);
  assert.match(doc, /AI-derived suggestions are interpretation, not fact\./);

  for (const copy of [
    'LoveBud may suggest this connection because...',
    'This looks related based on existing memory evidence.',
    'Review before saving.',
    'AI confirmed this relationship.',
    'This is definitely connected.',
    'This relationship has been saved.',
  ]) {
    assert.match(doc, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(allowed, /Allowed framing:/);
  assert.match(allowed, /Forbidden framing:/);
});

test('Document leaves dismissal persistence as a future policy placeholder', () => {
  const doc = read(DOC_PATH);
  const dismissal = sectionBetween(doc, 'Dismissal policy placeholder');

  assert.match(doc, /Dismissal persistence is not implemented here\./);
  for (const policy of [
    'local-only or account-level dismissal',
    'scope: tree, memory, pair, type, or another explicit boundary',
    'when a dismissed suggestion can reappear',
    'visibility behavior for private and public viewers',
  ]) {
    assert.match(dismissal, new RegExp(policy));
  }
  assert.match(dismissal, /It must not create hidden saved edges or silently alter the saved graph\./);
});

test('Document locks non-goals and keeps #2418/#1882 open', () => {
  const doc = read(DOC_PATH);
  const nonGoals = sectionBetween(doc, 'Non-goals');

  for (const nonGoal of [
    'No DB migration.',
    'No production schema change.',
    'No persistence implementation.',
    'No editor UI implementation.',
    'No Browse/Search behavior change.',
    'No Scout/provider/live/AI integration.',
    'No automatic relationship save.',
    'No automatic wiki page publication.',
    'No public graph feature.',
    'No hidden graph edges.',
    'Do not close #2418 from this issue.',
    'Do not close #1882 from this issue.',
  ]) {
    assert.match(nonGoals, new RegExp(nonGoal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Document contains no implementation leakage', () => {
  const doc = read(DOC_PATH);
  const testSource = read(TEST_PATH);
  const implementationLeakage = [
    'fetch(',
    'XMLHttpRequest',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'CREATE TABLE',
    'ALTER TABLE',
    'saveRelationship(',
    'createRelationship(',
    'provider.fetch',
    'ScoutLive',
  ];

  for (const leakage of implementationLeakage) {
    assert.doesNotMatch(doc, new RegExp(leakage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const leakageInTestSource = testSource
    .replace(/`[^`]*`/g, '')
    .replace(/'([^'\\]|\\.)*'/g, '')
    .replace(/"([^"\\]|\\.)*"/g, '');

  for (const leakage of implementationLeakage) {
    assert.doesNotMatch(leakageInTestSource, new RegExp(leakage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
