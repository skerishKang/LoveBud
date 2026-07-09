/**
 * Contract tests for the tree-level comment storage schema boundary audit (Issue #3382).
 *
 * These tests verify that docs/product/lovebud-tree-comment-storage-schema-boundary-audit.md
 * audits the storage/schema/idempotency/audit readiness for #3188 tree-level comments
 * without creating a DB migration, applying SQL, implementing runtime/API, writers,
 * client adapters, UI, or changing #3370 tree-like runtime behavior or #3075 moment-level.
 *
 * Refs: #3382, #3188, #3378, #3381, #3376, #3377, #3075, #1882
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
  'lovebud-tree-comment-storage-schema-boundary-audit.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only audit ──────────────────────────

test('tree comment storage schema boundary audit document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only storage\/schema boundary audit|documentation and contract tests only|audit/i.test(doc),
    'Document must declare source-only / audit posture'
  );
});

test('document references #3382, #3188, #3378, #3381, #3376, #3377, #3075, #1882', () => {
  const doc = readDoc();
  assert.ok(/#3382/.test(doc), 'Document must reference #3382');
  assert.ok(/#3188/.test(doc), 'Document must reference parent #3188');
  assert.ok(/#3378/.test(doc), 'Document must reference route contract #3378');
  assert.ok(/#3381/.test(doc), 'Document must reference #3381');
  assert.ok(/#3376/.test(doc), 'Document must reference audit #3376');
  assert.ok(/#3377/.test(doc), 'Document must reference #3377');
  assert.ok(/#3075/.test(doc), 'Document must reference moment boundary #3075');
  assert.ok(/#1882/.test(doc), 'Document must reference #1882');
});

// ─── 2. Dedicated tree-comment storage existence/absence ─────────────────────

test('document records dedicated tree-comment storage as ABSENT', () => {
  const doc = readDoc();
  assert.ok(
    /dedicated tree-comment storage.*ABSENT|ABSENT.*tree-comment storage|no separate `tree_comments`|no `tree_id`.*no `target_kind`/i.test(doc),
    'Document must record dedicated tree-comment storage as ABSENT'
  );
});

test('document confirms moment-comment storage is memory-target only', () => {
  const doc = readDoc();
  assert.ok(
    /memory-target only|memory_target only|`memory_id` .*FK to `memories`|memory_id UUID NOT NULL REFERENCES memories/i.test(doc),
    'Document must confirm comments.memory_id is a non-null FK to memories'
  );
});

// ─── 3. Moment storage reuse forbidden ──────────────────────────────────────

test('document forbids reusing moment-comment storage for tree comments', () => {
  const doc = readDoc();
  assert.ok(
    /FORBIDDEN|forbidden|must not.*reuse/i.test(doc),
    'Document must forbid reusing moment-comment storage'
  );
  assert.ok(
    /violate `targetScope: "tree"`|pollute moment comment/i.test(doc),
    'Document must explain why reuse violates tree scope'
  );
  assert.ok(
    /separate tree-target storage|new `tree_comments` table|generic `target_kind`\/`target_id`\/`tree_id`/i.test(doc),
    'Document must require separate tree-target storage'
  );
});

// ─── 4. Tree vs moment separation at storage layer ───────────────────────────

test('document defines tree vs moment separation at the storage layer', () => {
  const doc = readDoc();
  assert.ok(/tree_id UUID REFERENCES trees/i.test(doc) || /tree_id` \(?FK to `?trees/i.test(doc),
    'Document must define tree_id FK to trees for tree comment rows');
  assert.ok(
    /must be null|legacy memory fields.*null|target_kind='tree'/i.test(doc),
    'Document must require legacy memory fields null for tree rows'
  );
  assert.ok(
    /`target_kind='tree'`, `target_id=treeId`|target_kind = 'tree'.*target_id = treeId/i.test(doc),
    'Document must define generic target pair for tree rows'
  );
});

// ─── 5. target_kind='tree' / target_id=treeId readiness or gap ───────────────

test('document records social idempotency/audit target_kind/target_id readiness for tree', () => {
  const doc = readDoc();
  assert.ok(
    /social_idempotency.*PRESENT|social_idempotency` \| \*\*PRESENT\*\*/i.test(doc),
    'Document must record social_idempotency target_kind/target_id as PRESENT'
  );
  assert.ok(
    /social_audit_log.*PRESENT|social_audit_log` \| \*\*PRESENT\*\*/i.test(doc),
    'Document must record social_audit_log target_kind/target_id as PRESENT'
  );
  assert.ok(
    /`target_kind = 'tree'` \+ `target_id = treeId`|target_kind = 'tree'.*target_id = treeId/i.test(doc),
    'Document must state idempotency/audit support target_kind=tree + target_id=treeId'
  );
  assert.ok(
    /comments`.*MISSING|MISSING.*comment storage layer/i.test(doc),
    'Document must record comments table as MISSING generic target columns'
  );
});

// ─── 6. Migration prerequisite ───────────────────────────────────────────────

test('document defines migration prerequisite before POST route', () => {
  const doc = readDoc();
  assert.ok(
    /migration prerequisite|new migration child|dedicated tree-target comment storage/i.test(doc),
    'Document must define a migration prerequisite child'
  );
  assert.ok(
    /backward compatible|preserve existing moment `comments`|not require `memory_id`/i.test(doc),
    'Document must require backward-compatible migration that does not require memory_id'
  );
});

// ─── 7. Visibility / auth / idempotency / rate-limit / moderation / deletion / ownership ──

test('document defines visibility/auth/idempotency/rate-limit/moderation/deletion/ownership prerequisites', () => {
  const doc = readDoc();
  assert.ok(/public-tree read boundary|validate \*\*tree\*\* publicity/i.test(doc), 'Document must cover public-tree read boundary');
  assert.ok(/authenticated eligible write/i.test(doc), 'Document must cover authenticated eligible write gate');
  assert.ok(/Idempotency.*READY|reuse `social_idempotency`/i.test(doc), 'Document must cover idempotency readiness');
  assert.ok(/Rate-limit.*ABSENT|rate-limit boundary still a separate/i.test(doc), 'Document must record rate-limit as ABSENT');
  assert.ok(/[Mm]oderation/i.test(doc), 'Document must cover moderation prerequisite');
  assert.ok(/[Dd]eletion/i.test(doc), 'Document must cover deletion prerequisite');
  assert.ok(/[Oo]wnership|owner_id/i.test(doc), 'Document must cover ownership prerequisite');
});

// ─── 8. Safe DTO / export implication ────────────────────────────────────────

test('document defines safe DTO / export shape implications', () => {
  const doc = readDoc();
  assert.ok(/treeCommentListItem/i.test(doc), 'Document must reference treeCommentListItem DTO');
  assert.ok(/authorDisplayLabel/i.test(doc), 'Document must require safe authorDisplayLabel (no raw IDs)');
  assert.ok(
    /never export raw `owner_id`|no raw account identifier/i.test(doc),
    'Document must forbid exporting raw owner_id to public DTO'
  );
});

// ─── 9. Raw/private exposure boundary ────────────────────────────────────────

test('document forbids raw/private exposure across schema docs/SQL/tests/PR/logs', () => {
  const doc = readDoc();
  assert.ok(
    /schema docs.*no row dumps|SQL examples.*illustrative only|tests.*no real secrets/i.test(doc),
    'Document must cover raw/private exposure per artifact type'
  );
  assert.ok(
    /raw\/private|tokens|API base URLs|dashboard URLs|DB rows|request\/response bodies|screenshots/i.test(doc),
    'Document must forbid raw/private value exposure'
  );
});

// ─── 10. #3370 pattern-only and unchanged ────────────────────────────────────

test('document declares #3370 tree-like runtime unchanged and pattern/evidence only', () => {
  const doc = readDoc();
  assert.ok(/#3370/.test(doc), 'Document must reference #3370');
  assert.ok(
    /#3370 tree-like runtime behavior is unchanged|unchanged.*#3370|does not.*modify `likes\.js`/i.test(doc),
    'Document must state #3370 tree-like runtime behavior is unchanged'
  );
  assert.ok(
    /evidence that tree-kind generic-target writes already work/i.test(doc),
    'Document must treat #3370 as evidence of tree-kind generic writes'
  );
});

// ─── 11. Follow-up child sequence ────────────────────────────────────────────

test('document defines follow-up child sequence before activation', () => {
  const doc = readDoc();
  assert.ok(/DB\/schema child/i.test(doc), 'Document must name DB/schema child');
  assert.ok(/Writer \(Modal\) child/i.test(doc), 'Document must name writer child');
  assert.ok(/Cloudflare route child/i.test(doc), 'Document must name Cloudflare route child');
  assert.ok(/client adapter child/i.test(doc), 'Document must name client adapter child');
  assert.ok(/UI child/i.test(doc), 'Document must name UI child');
  assert.ok(/non-prod verification child/i.test(doc), 'Document must name non-prod verification child');
  assert.ok(
    /this #3382 audit satisfies none/i.test(doc),
    'Document must state this audit alone does not satisfy implementation steps'
  );
});

// ─── 12. Forbidden boundaries / non-goals ────────────────────────────────────

test('document states hard non-goals: no DB migration/apply/SQL/runtime/UI/CSS/Scout/#3370/#3075', () => {
  const doc = readDoc();
  const nonGoals = [
    [/do \*\*not\*\* create a DB migration|not a DB migration/i, 'no DB migration creation'],
    [/do \*\*not\*\* apply a DB migration|not apply a DB migration|execute any SQL/i, 'no DB migration apply / no SQL execution'],
    [/not runtime\/API route implementation|do \*\*not\*\* implement runtime\/API/i, 'no runtime/API route'],
    [/do \*\*not\*\* implement writer|not writer\/reader\/client adapter/i, 'no writer/adapter'],
    [/not UI implementation|do \*\*not\*\* implement UI/i, 'no UI implementation'],
    [/CSS|layout/i, 'no CSS/layout change'],
    [/Modal|Cloudflare|Firebase|production change/i, 'no Modal/Cloudflare/Firebase/production change'],
    [/Scout/i, 'no Scout change'],
    [/#3370/i, 'no #3370 tree-like runtime change'],
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

// ─── 13. Companion artifact self-check ───────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comment-storage-schema-boundary-audit-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 14. This test file itself stays source-only ─────────────────────────────

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
