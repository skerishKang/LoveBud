/**
 * Contract tests for the tree-level social client surface contract (Issue #3356).
 *
 * These tests verify that docs/product/lovebud-tree-social-client-surface-contract.md
 * defines the future whole-tree social client/UI surface without implementing UI,
 * CSS, adapters, runtime, DB, fixtures, or tree writer activation.
 *
 * Refs: #3356, #3188, #3355, #3354, #3353, #3352, #3264, #3262, #3260, #3075, #1882
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
  'lovebud-tree-social-client-surface-contract.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only contract ────────────────────────

test('tree social client surface contract document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only|documentation and contract tests only|client\/UI surface contract/i.test(doc),
    'Document must declare source-only / client surface contract posture'
  );
});

test('document references issue #3356 and parent track #3188', () => {
  const doc = readDoc();
  assert.ok(/#3356/.test(doc), 'Document must reference #3356');
  assert.ok(/#3188/.test(doc), 'Document must reference #3188');
  assert.ok(/#3355/.test(doc), 'Document must reference parallel server track #3355');
  assert.ok(/#1882/.test(doc), 'Document must reference #1882');
});

// ─── 2. Scope separation from selected-moment #3075 ──────────────────────────

test('document separates whole-tree social from selected-moment #3075', () => {
  const doc = readDoc();
  assert.ok(/#3075/.test(doc), 'Document must reference #3075 as boundary');
  assert.ok(
    /whole-tree|tree-level|tree-scoped/i.test(doc),
    'Document must define whole-tree / tree-level scope'
  );
  assert.ok(
    /selected-moment|moment-level/i.test(doc),
    'Document must name selected-moment / moment-level scope'
  );
  assert.ok(
    /must not.*modify|#3075.*boundary|boundary.*#3075|except.*boundary/i.test(doc),
    'Document must treat #3075 as a non-modified boundary'
  );
  assert.ok(
    /treeId.*only|memoryId|target key/i.test(doc),
    'Document must distinguish target keys for tree vs moment'
  );
});

// ─── 3. Current surface inventory ────────────────────────────────────────────

test('document inventories Tree Workspace, public tree, Browse/My Trees, and moment reference', () => {
  const doc = readDoc();
  assert.ok(
    /Tree Workspace/i.test(doc),
    'Document must inventory Tree Workspace surfaces'
  );
  assert.ok(
    /public tree|public tree read/i.test(doc),
    'Document must inventory public tree display/read surface'
  );
  assert.ok(
    /Browse/i.test(doc) && /My Trees/i.test(doc),
    'Document must inventory Browse and My Trees card affordances'
  );
  assert.ok(
    /selected-moment|moment social/i.test(doc),
    'Document must reference selected-moment social only as boundary'
  );
  assert.ok(
    /header|right hub|metadata/i.test(doc),
    'Document must mention header / right hub / metadata placement candidates'
  );
});

test('document inventories actor presentation: owner, visitor, guest', () => {
  const doc = readDoc();
  assert.ok(/guest|signed-out/i.test(doc), 'Document must cover guest / signed-out');
  assert.ok(/authenticated.*visitor|visitor/i.test(doc), 'Document must cover authenticated visitor');
  assert.ok(/owner/i.test(doc), 'Document must cover owner presentation');
  assert.ok(
    /private|draft|non-public/i.test(doc),
    'Document must cover private/draft/non-public blocked presentation'
  );
});

// ─── 4. Client state contract coverage ───────────────────────────────────────

test('document defines required whole-tree client states', () => {
  const doc = readDoc();
  const requiredStateSignals = [
    [/loading/i, 'loading'],
    [/signed.?out|guest.*read-only|signed_out_guest_read_only/i, 'signed-out / guest read-only'],
    [/authenticated.?eligible|authenticated_eligible_actor/i, 'authenticated eligible actor'],
    [/optimistic.*like.*pending|optimistic_like_pending/i, 'optimistic like pending'],
    [/replay|duplicate-click|replay_duplicate_click_pending/i, 'replay/duplicate-click pending'],
    [/failure.*rollback|like_failure_rollback|rollback/i, 'failure rollback'],
    [/comments_loading|comments loading/i, 'comments loading'],
    [/comments_empty|comments empty|empty state/i, 'comments empty'],
    [/comments_error|comments error/i, 'comments error'],
    [/composer.*disabled|composer_disabled/i, 'composer disabled states'],
    [/composer.*eligible|composer_eligible/i, 'composer eligible state'],
    [/private|draft|non-public|blocked|hidden/i, 'private/draft/non-public hidden or blocked'],
  ];

  for (const [pattern, label] of requiredStateSignals) {
    assert.ok(pattern.test(doc), `Document must define client state for: ${label}`);
  }
});

// ─── 5. API dependency expectations without implementation ───────────────────

test('document defines read summary and mutation safe DTO expectations', () => {
  const doc = readDoc();
  assert.ok(
    /read summary|treeSocialSummary|likeCount/i.test(doc),
    'Document must define read summary expected shape including likeCount'
  );
  assert.ok(
    /treeLikeMutationResult|mutation.*DTO|safe DTO/i.test(doc),
    'Document must define mutation safe DTO shape'
  );
  assert.ok(
    /`active`|active: boolean|active\b/i.test(doc),
    'Document must include active like state in auth-aware summary/result'
  );
  assert.ok(
    /Idempotency-Key|idempotency key/i.test(doc),
    'Document must require Idempotency-Key for later mutations'
  );
});

test('document forbids fabricated counts, unauthenticated mutations, and raw backend errors', () => {
  const doc = readDoc();
  assert.ok(
    /no fabricated counts|never invent|fabricated counts/i.test(doc),
    'Document must forbid fabricated counts'
  );
  assert.ok(
    /no unauthenticated mutation|unauthenticated mutation calls/i.test(doc),
    'Document must forbid unauthenticated mutation calls'
  );
  assert.ok(
    /no raw backend errors|never show raw backend|raw backend errors/i.test(doc),
    'Document must forbid raw backend errors in UI'
  );
  assert.ok(
    /real zero|unavailable|authoritative `0`|fake zero/i.test(doc),
    'Document must distinguish real zero from unavailable counts'
  );
});

// ─── 6. Accessibility / focus / live-status expectations ─────────────────────

test('document defines aria/focus/live-status expectations for later UI', () => {
  const doc = readDoc();
  assert.ok(
    /aria-pressed|accessible name|accessibility/i.test(doc),
    'Document must define aria / accessible-name expectations'
  );
  assert.ok(
    /live region|live-status|live status/i.test(doc),
    'Document must define live-status expectations'
  );
  assert.ok(
    /focus/i.test(doc),
    'Document must define focus expectations'
  );
});

// ─── 7. Activation remains blocked ───────────────────────────────────────────

test('document blocks client activation until server hardening and verification', () => {
  const doc = readDoc();
  assert.ok(
    /blocked|remain blocked|does not authorize client activation/i.test(doc),
    'Document must state client activation remains blocked'
  );
  assert.ok(
    /#3355|server.*hardening|runtime hardening/i.test(doc),
    'Document must gate on server/runtime hardening'
  );
  assert.ok(
    /authenticated runtime verification|verification/i.test(doc),
    'Document must require verification before activation'
  );
  assert.ok(
    /no production client adapter|must not.*activate|client adapter issue/i.test(doc),
    'Document must state no production client adapter activation yet'
  );
});

// ─── 8. Forbidden boundaries / non-goals ─────────────────────────────────────

test('document states hard non-goals: no UI/CSS/adapter/runtime/DB/smoke/fixture/writer', () => {
  const doc = readDoc();
  const nonGoals = [
    [/not UI implementation|do \*\*not\*\* implement UI|No UI implementation/i, 'no UI implementation'],
    [/CSS|layout/i, 'no CSS/layout change'],
    [/client adapter|API call/i, 'no client adapter / API call implementation'],
    [/runtime\/server|runtime\/server behavior|Not runtime/i, 'no runtime/server behavior change'],
    [/DB migration|database migration|Not DB migration/i, 'no DB migration/apply'],
    [/production smoke|fixture/i, 'no production smoke/fixture'],
    [/tree writer|activate tree writer/i, 'no tree writer activation'],
    [/Browse|My Trees|Editor|Scout|Hermes/i, 'no active product-surface behavior changes'],
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
  assert.ok(
    /Refs #1882/i.test(doc),
    'Document must use Refs #1882 language'
  );
  assert.ok(
    /never use GitHub close keywords|Closes.*Fixes.*Resolves|close keywords/i.test(doc),
    'Document must forbid Closes/Fixes/Resolves close keywords for #1882'
  );
  assert.ok(
    !/\bCloses\s+#1882\b/i.test(doc),
    'Document must not use Closes #1882'
  );
  assert.ok(
    !/\bFixes\s+#1882\b/i.test(doc),
    'Document must not use Fixes #1882'
  );
  assert.ok(
    !/\bResolves\s+#1882\b/i.test(doc),
    'Document must not use Resolves #1882'
  );
});

test('document forbids raw/private value exposure', () => {
  const doc = readDoc();
  assert.ok(
    /raw\/private|tokens|Authorization|stack traces|private values/i.test(doc),
    'Document must forbid raw/private value exposure in UI and artifacts'
  );
});

// ─── 9. Companion artifact self-check ────────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-social-client-surface-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 10. This test file itself stays source-only ─────────────────────────────

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
  // Network calls would appear as executable fetch usage outside string literals in assertions.
  assert.ok(
    !/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self),
    'Contract test must not call fetch'
  );
});
