/**
 * Contract tests for the tree-level comment runtime/API prerequisites audit (Issue #3376).
 *
 * These tests verify that docs/product/lovebud-tree-comment-runtime-api-prerequisites-audit.md
 * audits the runtime/API prerequisites for #3188 tree-level comments without implementing
 * UI, CSS, adapters, runtime, DB, fixtures, or tree writer activation, and without changing
 * #3370 tree-like runtime behavior or #3075 moment-level comments.
 *
 * Refs: #3376, #3188, #3372, #3374, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs',
  'product',
  'lovebud-tree-comment-runtime-api-prerequisites-audit.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only audit ──────────────────────────

test('tree comment runtime/api prerequisites audit document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only audit|documentation and contract tests only|audit/i.test(doc),
    'Document must declare source-only / audit posture'
  );
});

test('document references #3376, #3188, #3372, #3374, #3075, #1882', () => {
  const doc = readDoc();
  assert.ok(/#3376/.test(doc), 'Document must reference #3376');
  assert.ok(/#3188/.test(doc), 'Document must reference parent #3188');
  assert.ok(/#3372/.test(doc), 'Document must reference surface contract #3372');
  assert.ok(/#3374/.test(doc), 'Document must reference merged contract PR #3374');
  assert.ok(/#3075/.test(doc), 'Document must reference moment boundary #3075');
  assert.ok(/#1882/.test(doc), 'Document must reference #1882');
});

// ─── 2. Scope separation from #3075 ──────────────────────────────────────────

test('document separates tree-level (treeId) from moment-level ((treeId, memoryId)) comments', () => {
  const doc = readDoc();
  assert.ok(
    /treeId`|tree-level|tree-scoped|whole-tree/i.test(doc),
    'Document must define treeId / tree-level scope'
  );
  assert.ok(
    /\(treeId, memoryId\)|moment-level|moment-target|memory-target/i.test(doc),
    'Document must name moment-level / memory-target scope'
  );
  assert.ok(
    /must not.*reuse|reuse is dangerous|forbidden|never reuse/i.test(doc),
    'Document must forbid reusing moment routes/adapters for tree comments'
  );
});

// ─── 3. Endpoint existence audit findings ───────────────────────────────────

test('document records ABSENT tree-level comment read/list endpoint', () => {
  const doc = readDoc();
  assert.ok(
    /read\/list endpoint.*ABSENT|ABSENT.*read\/list|no.*`comments\.js`|no.*GET \/api\/trees\/:treeId\/comments/i.test(doc),
    'Document must record tree comment read endpoint as ABSENT'
  );
});

test('document records ABSENT tree-level comment create/write endpoint', () => {
  const doc = readDoc();
  assert.ok(
    /create\/write endpoint.*ABSENT|ABSENT.*create\/write|no.*createTreeComment|no tree comment write route/i.test(doc),
    'Document must record tree comment create endpoint as ABSENT'
  );
});

test('document records moment comment route/adapter reuse as dangerous', () => {
  const doc = readDoc();
  assert.ok(
    /REUSE IS DANGEROUS|reuse is dangerous/i.test(doc),
    'Document must label moment route reuse as dangerous'
  );
  assert.ok(
    /createComment|fetchComments|fetchPublicMomentComments/i.test(doc),
    'Document must name the moment-only adapters that must not be reused'
  );
  assert.ok(
    /targetScope: "tree"|separate tree-target endpoints/i.test(doc),
    'Document must require separate tree-target endpoints'
  );
});

// ─── 4. Safe tree comment DTO + targetScope ──────────────────────────────────

test('document defines safe tree comment DTO with targetScope: "tree"', () => {
  const doc = readDoc();
  assert.ok(
    /treeCommentSummary|treeCommentListItem|treeCommentMutationResult/i.test(doc),
    'Document must define tree comment DTO shapes'
  );
  assert.ok(
    /targetScope: "tree"/i.test(doc),
    'Document must require targetScope: "tree" in tree comment DTO'
  );
  assert.ok(
    /authorDisplayLabel/i.test(doc),
    'Document must require safe authorDisplayLabel (no raw IDs)'
  );
});

// ─── 5. Visibility / guest / auth gating ────────────────────────────────────

test('document defines public vs private/draft/non-public visibility boundary', () => {
  const doc = readDoc();
  assert.ok(/public tree/i.test(doc), 'Document must cover public tree');
  assert.ok(
    /private.*draft.*non-public|private\/draft\/non-public|not public\/comment-eligible/i.test(doc),
    'Document must cover private/draft/non-public blocked presentation'
  );
  assert.ok(/hidden\/blocked/i.test(doc), 'Document must hide/block non-public tree comment surface');
});

test('document defines guest read-only and authenticated eligible write gating', () => {
  const doc = readDoc();
  assert.ok(/guest.*read-only|signed-out/i.test(doc), 'Document must cover guest read-only');
  assert.ok(
    /authenticated eligible|authenticated_eligible/i.test(doc),
    'Document must cover authenticated eligible write gating'
  );
  assert.ok(
    /401 Authorization required|Authorization required/i.test(doc),
    'Document must require 401 safe auth gate for write'
  );
});

// ─── 6. Idempotency + rate-limit prerequisites ──────────────────────────────

test('document requires idempotency for future tree comment create', () => {
  const doc = readDoc();
  assert.ok(/Idempotency-Key/i.test(doc), 'Document must require Idempotency-Key for create');
  assert.ok(
    /IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_KEY_INVALID/i.test(doc),
    'Document must reference safe idempotency error codes'
  );
});

test('document requires rate-limit prerequisite for future tree-scoped writes', () => {
  const doc = readDoc();
  assert.ok(
    /rate-limit/i.test(doc),
    'Document must require a tree-scoped rate-limit prerequisite'
  );
  assert.ok(
    /no.*rate-limit exists yet|no tree-scoped comment rate-limit/i.test(doc),
    'Document must record that tree comment rate-limit does not exist yet'
  );
});

// ─── 7. Safe error copy + no raw/private exposure ───────────────────────────

test('document requires safe error copy and forbids raw backend output', () => {
  const doc = readDoc();
  assert.ok(/safe error/i.test(doc), 'Document must require safe error copy');
  assert.ok(
    /no raw backend errors|raw backend errors|raw Modal stack traces|raw DB rows/i.test(doc),
    'Document must forbid raw backend output in UI'
  );
  assert.ok(
    /x-lovebud-route-status|x-lovebud-request-id/i.test(doc),
    'Document must reference sanitized transport metadata only'
  );
});

test('document forbids raw/private value exposure', () => {
  const doc = readDoc();
  assert.ok(
    /raw\/private|tokens|Authorization|API base URLs|dashboard URLs|DB rows|request\/response bodies/i.test(doc),
    'Document must forbid raw/private value exposure in docs/tests/examples'
  );
});

// ─── 8. #3370 tree-like runtime unchanged ───────────────────────────────────

test('document declares #3370 tree-like runtime unchanged and pattern-only', () => {
  const doc = readDoc();
  assert.ok(/#3370/.test(doc), 'Document must reference #3370');
  assert.ok(
    /#3370 tree-like runtime behavior is unchanged|unchanged.*#3370|does not.*modify `likes\.js`/i.test(doc),
    'Document must state #3370 tree-like runtime behavior is unchanged'
  );
  assert.ok(
    /pattern to mirror|mirroring #3370|mirror/i.test(doc),
    'Document must treat #3370 likes.js as the pattern to mirror only'
  );
});

// ─── 9. Activation-gated follow-up child sequence ───────────────────────────

test('document defines follow-up child sequence before activation', () => {
  const doc = readDoc();
  assert.ok(
    /follow-up child issue sequence|Follow-up child issue sequence/i.test(doc),
    'Document must define a follow-up child sequence'
  );
  assert.ok(
    /runtime hardening|client adapter|UI implementation/i.test(doc),
    'Document must name runtime hardening, client adapter, and UI implementation children'
  );
  assert.ok(
    /this #3376 audit satisfies none/i.test(doc),
    'Document must state this audit alone does not satisfy activation steps'
  );
});

// ─── 10. Forbidden boundaries / non-goals ───────────────────────────────────

test('document states hard non-goals: no UI/CSS/adapter/runtime/DB/smoke/fixture/writer/#3370/#3075', () => {
  const doc = readDoc();
  const nonGoals = [
    [/do \*\*not\*\* implement UI|not UI implementation/i, 'no UI implementation'],
    [/CSS|layout/i, 'no CSS/layout change'],
    [/client adapter|API call/i, 'no client adapter / API call implementation'],
    [/runtime\/server|runtime\/server behavior/i, 'no runtime/server behavior change'],
    [/DB migration|database migration/i, 'no DB migration/apply'],
    [/production smoke|fixture/i, 'no production smoke/fixture'],
    [/tree writer|activate tree writer/i, 'no tree writer activation'],
    [/Browse|My Trees|Editor|Scout/i, 'no active product-surface behavior changes'],
    [/#3370/i, 'no #3370 tree-like runtime change'],
    [/#3075/i, 'no #3075 moment-level change beyond boundary'],
  ];

  for (const [pattern, label] of nonGoals) {
    assert.ok(pattern.test(doc), `Document must state non-goal: ${label}`);
  }
});

test('document forbids closing #3188, #3075, or #1882 and requires Refs-only for #1882', () => {
  const doc = readDoc();
  assert.ok(
    /do \*\*not\*\* close #3188|#3188.*#3075.*#1882|not close #3188/i.test(doc),
    'Document must forbid closing parent issues'
  );
  assert.ok(/Refs #1882/i.test(doc), 'Document must use Refs #1882 language');
  assert.ok(
    /never use GitHub close keywords|Closes.*Fixes.*Resolves|close keywords/i.test(doc),
    'Document must forbid Closes/Fixes/Resolves close keywords'
  );
  assert.ok(!/\bCloses\s+#1882\b/i.test(doc), 'Document must not use Closes #1882');
  assert.ok(!/\bFixes\s+#1882\b/i.test(doc), 'Document must not use Fixes #1882');
  assert.ok(!/\bResolves\s+#1882\b/i.test(doc), 'Document must not use Resolves #1882');
  assert.ok(!/\bCloses\s+#3188\b/i.test(doc), 'Document must not use Closes #3188');
  assert.ok(!/\bCloses\s+#3075\b/i.test(doc), 'Document must not use Closes #3075');
});

// ─── 11. Companion artifact self-check ──────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comment-runtime-api-prerequisites-audit-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 12. This test file itself stays source-only ────────────────────────────

test('this contract suite does not import runtime adapters or network clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(
    !/require\(['"][^'"]*postgres-client/i.test(self),
    'Contract test must not require postgres-client'
  );
  assert.ok(
    !/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self),
    'Contract test must not import axios'
  );
  assert.ok(
    !/require\(['"]playwright['"]\)|require\(['"]puppeteer['"]\)/i.test(self),
    'Contract test must not import browser automation clients'
  );
  assert.ok(
    !/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self),
    'Contract test must not call fetch'
  );
});
