/**
 * Contract tests for the generic social write target model (Issue #3260).
 *
 * These tests verify that the documentation contract defined in
 * docs/product/lovebud-generic-social-write-target-contract.md
 * satisfies the structural and semantic requirements before tree-level
 * like writes can be hardened or exposed in the UI.
 *
 * Refs: #3260
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-generic-social-write-target-contract.md');

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists ──────────────────────────────────────────────────────

test('Generic social write target contract document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
});

// ─── 2. Canonical target values ──────────────────────────────────────────────

test('Canonical targetKind values are exactly memory and tree', () => {
  const doc = readDoc();
  // Must define both values
  assert.ok(doc.includes('`memory`'), 'Document must define targetKind value "memory"');
  assert.ok(doc.includes('`tree`'), 'Document must define targetKind value "tree"');

  // Must explicitly state they are the only two values
  assert.ok(
    /exactly two|two canonical|only two/i.test(doc),
    'Document must state that memory and tree are the only canonical targetKind values'
  );
});

// ─── 3. Legacy field names identified as moment-only ─────────────────────────

test('Legacy moment-only field names are explicitly identified', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('target_memory_id'),
    'Document must explicitly identify target_memory_id as a legacy moment-only field'
  );
  assert.ok(
    doc.includes('social_idempotency') && doc.includes('target_memory_id'),
    'Document must identify target_memory_id in social_idempotency as moment-only'
  );
  assert.ok(
    doc.includes('social_audit_log') && doc.includes('memory_id'),
    'Document must identify memory_id in social_audit_log as moment-only'
  );
});

// ─── 4. Prohibition on tree IDs in legacy moment fields ─────────────────────

test('Document explicitly prohibits storing tree IDs in legacy moment target fields', () => {
  const doc = readDoc();
  assert.ok(
    /prohibit/i.test(doc) && /tree.*(?:target_memory_id|memory_id)|(?:target_memory_id|memory_id).*tree/i.test(doc),
    'Document must explicitly prohibit storing tree IDs in target_memory_id or memory_id'
  );
});

// ─── 5. Additive/backfill/compatibility-window rules ─────────────────────────

test('Additive and backfill rules are present', () => {
  const doc = readDoc();
  assert.ok(
    /additive/i.test(doc),
    'Document must describe additive migration strategy'
  );
  assert.ok(
    /backfill/i.test(doc),
    'Document must describe backfill from existing moment values'
  );
});

test('Compatibility window rules are present', () => {
  const doc = readDoc();
  assert.ok(
    /compatib.*window|window.*compatib/i.test(doc),
    'Document must describe a compatibility window'
  );
  assert.ok(
    /existing.*moment.*(?:remain|retain|compatible)/i.test(doc),
    'Document must state that existing moment writers remain compatible'
  );
  assert.ok(
    /generic.*(?:only|exclusively)|future.*tree.*generic/i.test(doc),
    'Document must state that future tree writes use generic fields only'
  );
  assert.ok(
    /no.*destructive|additive.*only|not.*renamed.*not.*dropped/i.test(doc),
    'Document must prohibit destructive rename/drop in the first migration'
  );
  assert.ok(
    /NOT NULL.*relax|relax.*NOT NULL|nullable.*after|constraint.*after/i.test(doc),
    'Document must require NOT NULL relaxation only after population and verification'
  );
  assert.ok(
    /legacy.*(?:readable|remain.*read)/i.test(doc),
    'Document must state that legacy fields remain readable during the compatibility window'
  );
});

// ─── 6. Unique actor-operation-idempotency-key semantics ─────────────────────

test('Unique actor-operation-idempotency-key semantics are present', () => {
  const doc = readDoc();
  assert.ok(
    /actor.*operation.*idempotency.*key|actor_id.*operation.*idempotency_key/i.test(doc),
    'Document must define unique (actor, operation, idempotency_key) semantics'
  );
});

// ─── 7. Tree-like write contract specifics ───────────────────────────────────

test('Tree-like replay behavior is present', () => {
  const doc = readDoc();
  assert.ok(
    /replay/i.test(doc) && /same.*actor.*operation.*key.*target.*payload/i.test(doc),
    'Document must define that same actor+operation+key+target+payload returns stored result without mutation'
  );
});

test('Tree-like mismatch conflict (409) is present', () => {
  const doc = readDoc();
  assert.ok(
    /409.*IDEMPOTENCY_KEY_REUSED|IDEMPOTENCY_KEY_REUSED.*409/i.test(doc),
    'Document must define 409 IDEMPOTENCY_KEY_REUSED for same key with different target or payload'
  );
});

test('Tree-like retryable pending behavior is present', () => {
  const doc = readDoc();
  assert.ok(
    /pending.*retry|retryable.*pending|unavailable.*reservation.*retry/i.test(doc),
    'Document must define retryable error for pending or unavailable reservation'
  );
});

test('Advisory transaction lock requirement is present', () => {
  const doc = readDoc();
  assert.ok(
    /advisory.*lock|transaction.*lock|lock.*actor.*tree/i.test(doc),
    'Document must require per-actor/per-tree advisory transaction lock before read-modify-write'
  );
});

test('Nonnegative aggregate (likeCount) is present', () => {
  const doc = readDoc();
  assert.ok(
    /likeCount.*(?:cannot|must not).*negative|negative.*likeCount|GREATEST.*like_count/i.test(doc),
    'Document must enforce that likeCount cannot become negative'
  );
});

test('Active-like uniqueness per actor per tree is present', () => {
  const doc = readDoc();
  assert.ok(
    /one active like per actor.*tree|active like.*per.*actor.*tree|unique.*tree.*owner.*active/i.test(doc),
    'Document must enforce one active like per actor per tree'
  );
});

// ─── 8. Result DTO is limited ────────────────────────────────────────────────

test('Result DTO is limited to treeId, active, likeCount', () => {
  const doc = readDoc();
  // Verify treeId, active, likeCount are all listed as result DTO fields
  assert.ok(
    doc.includes('`treeId`') || doc.includes('| treeId '),
    'Document must define treeId as a result DTO field'
  );
  assert.ok(
    doc.includes('`active`') || doc.includes('| active '),
    'Document must define active as a result DTO field'
  );
  assert.ok(
    doc.includes('`likeCount`') || doc.includes('| likeCount '),
    'Document must define likeCount as a result DTO field'
  );
  assert.ok(
    /no raw auth|No raw auth|no.*token.*returned|No.*token.*returned|no.*database row|No.*database row|no.*audit record|No.*audit record|no.*idempotency key.*returned|No.*idempotency key|no.*exception.*returned|No.*exception.*returned/i.test(doc),
    'Document must prohibit returning raw auth, token, database row, audit record, key, or internal exception'
  );
});

// ─── 9. No runtime migration, deployment, UI, comments, share, #3075 ────────

test('Document does not introduce runtime migration or deployment', () => {
  const doc = readDoc();
  assert.ok(
    /documentation.*(?:only|issue performs none)|performs none.*action|does not.*migration|does not.*deploy/i.test(doc),
    'Document must state it does not include a schema migration or deploy'
  );
});

test('Document does not introduce UI, comments, share counts, or #3075', () => {
  const doc = readDoc();
  assert.ok(
    /does not.*UI|non-goal.*UI|no.*UI.*change/i.test(doc),
    'Document must state no UI change'
  );
  assert.ok(
    /does not.*comment|non-goal.*comment|no.*comment.*model|no.*comment.*write/i.test(doc),
    'Document must state no comment model or writes'
  );
  assert.ok(
    /does not.*share|non-goal.*share|no.*share.*count/i.test(doc),
    'Document must state no share counts'
  );
  assert.ok(
    /#3075|3075/i.test(doc),
    'Document must reference #3075 in its non-goals or scope'
  );
});

// ─── 10. Test does not assert feature permanently absent ──────────────────────

test('Contract test does not assert that a feature is permanently absent', () => {
  const testContent = fs.readFileSync(__filename, 'utf8');
  // Check the assertion messages (the strings after 'assert.ok' calls),
  // not the comments or the regex itself.
  // A permanence assertion would appear as an assertion message claiming
  // something "will never" exist or is "permanently" gone.
  const assertionMessages = testContent
    .split('\n')
    .filter(line => line.trim().startsWith("'") || line.includes("assert.ok"))
    .join('\n');
  const hasPermanenceInAssertion = /will never be implemented|permanently removed|never be added/i.test(assertionMessages);
  assert.ok(
    !hasPermanenceInAssertion,
    'Contract test must not assert that a feature is permanently absent'
  );
  // The test verifies documentation structure, not runtime absence
  assert.ok(
    /Document.*exist|document.*must exist/i.test(testContent),
    'Contract tests must verify document structure, not runtime feature absence'
  );
});
