/**
 * Contract tests for the tree-level comment API/writer boundary audit (Issue #3393).
 *
 * These tests verify that docs/product/lovebud-tree-comments-api-writer-boundary-audit.md
 * audits the future tree comment API/write/read boundary without implementing routes,
 * writers, readers, client adapters, UI, or changing the #3388 schema artifact, #3370
 * tree-like runtime, or #3075 moment-level behavior.
 *
 * Refs: #3393, #3188, #3388, #3392, #3382, #3385, #3075, #1882
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
  'lovebud-tree-comments-api-writer-boundary-audit.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only audit ──────────────────────────

test('tree comment API/writer boundary audit document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only API\/writer boundary audit|documentation and contract tests only|audit/i.test(doc),
    'Document must declare source-only / audit posture'
  );
});

test('document references #3393, #3188, #3388, #3392, #3382, #3385, #3075, #1882', () => {
  const doc = readDoc();
  assert.ok(/#3393/.test(doc), 'Document must reference #3393');
  assert.ok(/#3188/.test(doc), 'Document must reference parent #3188');
  assert.ok(/#3388/.test(doc), 'Document must reference schema foundation #3388');
  assert.ok(/#3392/.test(doc), 'Document must reference #3392');
  assert.ok(/#3382/.test(doc), 'Document must reference storage audit #3382');
  assert.ok(/#3385/.test(doc), 'Document must reference #3385');
  assert.ok(/#3075/.test(doc), 'Document must reference moment boundary #3075');
  assert.ok(/#1882/.test(doc), 'Document must reference #1882');
});

// ─── 2. Future route location candidates ─────────────────────────────────────

test('document defines future tree-comment API route location candidates', () => {
  const doc = readDoc();
  assert.ok(
    /POST \/api\/trees\/:treeId\/comments/i.test(doc),
    'Document must define POST /api/trees/:treeId/comments'
  );
  assert.ok(
    /GET \/api\/trees\/:treeId\/comments/i.test(doc),
    'Document must define GET /api/trees/:treeId/comments'
  );
  assert.ok(
    /dedicated tree-target|target_kind = 'tree'/i.test(doc),
    'Document must require dedicated tree-target routes'
  );
});

// ─── 3. Helper reuse / avoid inventory ──────────────────────────────────────

test('document inventories helper reuse vs avoid for tree comments', () => {
  const doc = readDoc();
  assert.ok(/REUSE/i.test(doc), 'Document must mark reusable helpers');
  assert.ok(/AVOID/i.test(doc), 'Document must mark helpers to avoid');
  assert.ok(
    /tree_likes\.py/.test(doc),
    'Document must reference tree_likes.py as the writer pattern to mirror'
  );
  assert.ok(
    /reserve_and_verify_idempotency_target/i.test(doc),
    'Document must reference the generic target idempotency helper for reuse'
  );
  assert.ok(
    /record_audit_target/i.test(doc),
    'Document must reference the generic target audit helper for reuse'
  );
  assert.ok(
    /comments\.py/.test(doc) && /memory-target/i.test(doc),
    'Document must flag modal_compute/comments.py as memory-target (avoid)'
  );
  assert.ok(
    /createComment|fetchComments|fetchPublicMomentComments/i.test(doc),
    'Document must flag moment client adapters as avoid'
  );
});

// ─── 4. Future write target ─────────────────────────────────────────────────

test('document defines tree-comment write target separated from moment', () => {
  const doc = readDoc();
  assert.ok(/tree_comments\.tree_id/i.test(doc), 'Document must reference tree_comments.tree_id');
  assert.ok(/target_kind = 'tree'/i.test(doc), 'Document must require target_kind = tree');
  assert.ok(/target_id = treeId/i.test(doc), 'Document must require target_id = treeId');
  assert.ok(/no `memory_id`|never populate.*memory/i.test(doc), 'Document must forbid memory_id on tree comments');
});

// ─── 5. Future read behavior ────────────────────────────────────────────────

test('document defines read behavior limited to the requested public tree', () => {
  const doc = readDoc();
  assert.ok(/tree_comments\.tree_id = :treeId/i.test(doc), 'Document must scope list to the requested tree_id');
  assert.ok(/visibility = 'public'|public/i.test(doc), 'Document must require public tree visibility for read');
  assert.ok(
    /never.*another tree|hidden\/blocked|non-public/i.test(doc),
    'Document must forbid leaking other trees comments / non-public lists'
  );
});

// ─── 6. Write prerequisites ─────────────────────────────────────────────────

test('document defines write prerequisites: auth/visibility/ownership/moderation/deletion/rate-limit/idempotency/audit', () => {
  const doc = readDoc();
  assert.ok(/[Aa]uth/i.test(doc), 'Document must cover auth prerequisite');
  assert.ok(/public visibility|visibility/i.test(doc), 'Document must cover public visibility prerequisite');
  assert.ok(/[Oo]wnership|non-owner/i.test(doc), 'Document must cover ownership/non-owner participation');
  assert.ok(/[Mm]oderation/i.test(doc), 'Document must cover moderation prerequisite');
  assert.ok(/[Dd]eletion/i.test(doc), 'Document must cover deletion prerequisite');
  assert.ok(/rate-limit|rate_limit/i.test(doc), 'Document must cover rate-limit prerequisite');
  assert.ok(/idempotency|Idempotency-Key/i.test(doc), 'Document must cover idempotency prerequisite');
  assert.ok(/audit/i.test(doc), 'Document must cover audit logging prerequisite');
});

// ─── 7. Safe error boundary ─────────────────────────────────────────────────

test('document defines safe error boundary with no raw backend/auth/provider details', () => {
  const doc = readDoc();
  assert.ok(/safe error/i.test(doc), 'Document must require safe error boundary');
  assert.ok(
    /never.*raw backend|never stored\/exposed|NEVER stored/i.test(doc),
    'Document must forbid raw backend details'
  );
  assert.ok(
    /comment body|Firebase token|Authorization header|raw exception|stack trace|request\/response payload/i.test(doc),
    'Document must list never-stored values (body/token/header/exception/payload)'
  );
  assert.ok(/request_key_hash|SHA-256/i.test(doc), 'Document must store SHA-256 of idempotency key, not raw key');
});

// ─── 8. Separation from #3075 moment-comment route/composer ──────────────────

test('document separates tree comments from #3075 moment-comment route/composer', () => {
  const doc = readDoc();
  assert.ok(/#3075/.test(doc), 'Document must reference #3075');
  assert.ok(
    /\/memories\/\[memory_id\]\/comments\.js|memory-target only/i.test(doc),
    'Document must reference the moment comment route as memory-target only'
  );
  assert.ok(
    /must not be reused for tree comments|not be reused/i.test(doc),
    'Document must forbid reusing moment route/writer/adapters for tree comments'
  );
});

// ─── 9. Future child split ──────────────────────────────────────────────────

test('document defines future child split: route/write, read, UI, moderation/deletion, non-prod verify', () => {
  const doc = readDoc();
  assert.ok(/Route\/write helper child/i.test(doc), 'Document must name route/write helper child');
  assert.ok(/Read\/list helper child/i.test(doc), 'Document must name read/list helper child');
  assert.ok(/UI surface child/i.test(doc), 'Document must name UI surface child');
  assert.ok(/Moderation\/deletion child/i.test(doc), 'Document must name moderation/deletion child');
  assert.ok(/Non-prod verification child/i.test(doc), 'Document must name non-prod verification child');
  assert.ok(
    /this #3393 audit satisfies none/i.test(doc),
    'Document must state this audit alone does not satisfy implementation steps'
  );
});

// ─── 10. Forbidden boundaries / non-goals ───────────────────────────────────

test('document states hard non-goals: no route/writer/reader/adapter/UI/SQL/schema/Scout/#3075', () => {
  const doc = readDoc();
  const nonGoals = [
    [/not API route implementation|do \*\*not\*\* implement API routes/i, 'no API route implementation'],
    [/not writer\/reader\/storage helper/i, 'no writer/reader/storage helper'],
    [/not client adapter|do \*\*not\*\* implement client adapters/i, 'no client adapter/UI'],
    [/not execute SQL|do \*\*not\*\* execute SQL/i, 'no SQL execution'],
    [/do \*\*not\*\* change the #3388 schema artifact|not a change to the #3388 schema/i, 'no #3388 schema change'],
    [/Cloudflare config|Firebase|provider wiring/i, 'no Cloudflare/Firebase/provider change'],
    [/no production smoke|do \*\*not\*\* run production smoke/i, 'no production smoke'],
    [/Scout \/ #1882/i, 'no Scout/#1882 implementation change'],
    [/#3075/i, 'no #3075 moment-level change beyond boundary'],
  ];

  for (const [pattern, label] of nonGoals) {
    assert.ok(pattern.test(doc), `Document must state non-goal: ${label}`);
  }
});

test('document forbids closing #3188/#3075/#1882 and requires Refs-only for #1882', () => {
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
  assert.ok(!/\bCloses\s+#3188\b/i.test(doc), 'Document must not use Closes #3188');
  assert.ok(!/\bFixes\s+#3188\b/i.test(doc), 'Document must not use Fixes #3188');
  assert.ok(!/\bResolves\s+#3188\b/i.test(doc), 'Document must not use Resolves #3188');
  assert.ok(!/\bCloses\s+#3075\b/i.test(doc), 'Document must not use Closes #3075');
  assert.ok(!/\bCloses\s+#1882\b/i.test(doc), 'Document must not use Closes #1882');
  assert.ok(!/\bFixes\s+#1882\b/i.test(doc), 'Document must not use Fixes #1882');
  assert.ok(!/\bResolves\s+#1882\b/i.test(doc), 'Document must not use Resolves #1882');
});

// ─── 11. Companion artifact self-check ───────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comments-api-writer-boundary-audit-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 12. This test file itself stays source-only ─────────────────────────────

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"][^'"]*postgres-client/i.test(self), 'Contract test must not require postgres-client');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(
    !/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self),
    'Contract test must not call fetch'
  );
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});
