
/**
 * Contract test for Merge-First Production Verification governance (Issue #3513).
 *
 * Verifies:
 * - Canonical document exists
 * - Required sections in canonical document
 * - AGENTS.md references the new workflow
 * - Pre-merge browser verification is optional (not mandatory)
 * - Post-merge Production verification is the required final gate
 * - Dedicated revert PR is the only allowed rollback
 * - No force-push/reset rollback language
 * - 컴1/컴1-브 role separation
 * - Self-improvement restriction for 컴1-브
 * - Active documents do not contain mandatory fixed-slot/preview language
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_PATH = path.join(ROOT, 'docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');
const KILOCODE_PATH = path.join(ROOT, '.kilocode/rules/00-lovebud-global.md');

test('canonical document exists', () => {
  assert.ok(fs.existsSync(CANONICAL_PATH), 'MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md must exist');
});

const REQUIRED_SECTIONS = [
  'Merge-First Production Verification',
  'Purpose',
  'Current environment reality',
  'Standard workflow',
  'Mandatory pre-merge gates',
  'Optional pre-merge gates',
  'Post-merge Production verification',
  'Squash merge rules',
  'Rollback rules',
  'Issue management',
  'Agent role definitions',
  'Self-improvement restriction',
];

for (const section of REQUIRED_SECTIONS) {
  test('canonical document contains section: ' + section, () => {
    const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
    assert.ok(doc.includes(section), 'Required section "' + section + '" missing');
  });
}

test('canonical document states pre-merge browser verification is optional', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('not a merge blocker') || doc.includes('NON_BLOCKING') || doc.includes('OPTIONAL'),
    'Canonical document must state pre-merge browser verification is not a merge blocker'
  );
});

test('canonical document states post-merge Production verification is the final confirmation step', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('post-merge Production verification') || doc.includes('final confirmation'),
    'Canonical document must identify post-merge Production verification as the final gate'
  );
});

test('canonical document forbids force-push rollback', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('FORBIDDEN') && (doc.includes('force push') || doc.includes('git push --force')),
    'Canonical document must forbid force-push rollback'
  );
  assert.ok(
    doc.includes('dedicated revert PR') || doc.includes('revert PR'),
    'Canonical document must require dedicated revert PR for rollback'
  );
});

test('canonical document defines 컴1 role', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('컴1'), 'Canonical document must reference 컴1 role');
});

test('canonical document defines 컴1-브 role', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('컴1-브'), 'Canonical document must reference 컴1-브 role');
});

test('canonical document restricts self-improvement for 컴1-브', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('Self-improvement') || doc.includes('SKILL.md'),
    'Canonical document must restrict self-improvement for 컴1-브'
  );
});

test('AGENTS.md references the new workflow', () => {
  const agents = fs.readFileSync(AGENTS_PATH, 'utf8');
  const hasRef = agents.includes('MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW') ||
                 agents.includes('Merge-First Production Verification');
  assert.ok(hasRef, 'AGENTS.md must reference the merge-first Production verification workflow');
});

test('AGENTS.md does not contain mandatory fixed-slot-only PASS language', () => {
  const agents = fs.readFileSync(AGENTS_PATH, 'utf8');
  assert.ok(
    !agents.includes('최종 browser PASS는 실제 Cloudflare Preview URL 또는 할당된 test slot에서만 수행합니다'),
    'AGENTS.md must not contain old mandatory fixed-slot-only PASS language'
  );
});

test('AGENTS.md UI section marks browser verification as OPTIONAL', () => {
  const agents = fs.readFileSync(AGENTS_PATH, 'utf8');
  // The UI section should reference OPTIONAL status
  assert.ok(
    agents.includes('OPTIONAL') || agents.includes('optional'),
    'AGENTS.md must mark browser verification as OPTIONAL'
  );
});

test('.kilocode rules reference the new workflow', () => {
  if (!fs.existsSync(KILOCODE_PATH)) return;
  const rules = fs.readFileSync(KILOCODE_PATH, 'utf8');
  const hasRef = rules.includes('MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW') ||
                 rules.includes('Production verification') ||
                 rules.includes('OPTIONAL');
  assert.ok(hasRef, '.kilocode rules must reference the merge-first workflow');
});

test('AGENTS.md does not contain outdated mandatory merge language', () => {
  const agents = fs.readFileSync(AGENTS_PATH, 'utf8');
  const outdatedPhrases = [
    'fixed-slot PASS 없으면 merge 금지',
  ];
  for (const phrase of outdatedPhrases) {
    assert.equal(agents.includes(phrase), false, 'AGENTS.md must not contain outdated mandatory language');
  }
});

test('canonical document requires expected_head_sha fixed squash merge', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('expected_head_sha'), 'Must specify expected_head_sha');
  assert.ok(doc.includes('squash merge'), 'Must specify squash merge');
});

test('canonical document requires production verification after merge', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('lovebud.pages.dev') && doc.includes('Production'),
    'Must reference lovebud.pages.dev for post-merge verification'
  );
});

test('canonical document references existing fixed-slot docs as optional', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(
    doc.includes('TEST_PREVIEW_SLOTS') || doc.includes('FIXED_SLOT') || doc.includes('fixed slot'),
    'Canonical document must reference existing fixed-slot documents as optional'
  );
});

test('canonical document refs #3513', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('#3513'), 'Canonical document must reference issue #3513');
});

test('canonical document has version info', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('Version'), 'Canonical document must have version metadata');
  assert.ok(doc.includes('Last updated'), 'Must have last-updated date');
});
