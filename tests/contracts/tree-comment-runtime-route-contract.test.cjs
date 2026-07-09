/**
 * Contract tests for the tree-level comment runtime route contract (Issue #3378).
 *
 * These tests verify that docs/product/lovebud-tree-comment-runtime-route-contract.md
 * defines the dedicated tree-target comment read/create route contract without
 * implementing runtime/API, client adapters, UI, DB migrations, or tree writer
 * activation, and without changing #3370 tree-like runtime behavior or #3075
 * moment-level comments.
 *
 * Refs: #3378, #3188, #3376, #3377, #3372, #3374, #3075, #1882
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
  'lovebud-tree-comment-runtime-route-contract.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only route contract ──────────────────

test('tree comment runtime route contract document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only route contract|documentation and contract tests only|route contract/i.test(doc),
    'Document must declare source-only / route contract posture'
  );
});

test('document references #3378, #3188, #3376, #3377, #3372, #3374, #3075, #1882', () => {
  const doc = readDoc();
  assert.ok(/#3378/.test(doc), 'Document must reference #3378');
  assert.ok(/#3188/.test(doc), 'Document must reference parent #3188');
  assert.ok(/#3376/.test(doc), 'Document must reference audit #3376');
  assert.ok(/#3377/.test(doc), 'Document must reference base refresh #3377');
  assert.ok(/#3372/.test(doc), 'Document must reference surface contract #3372');
  assert.ok(/#3374/.test(doc), 'Document must reference merged contract PR #3374');
  assert.ok(/#3075/.test(doc), 'Document must reference moment boundary #3075');
  assert.ok(/#1882/.test(doc), 'Document must reference #1882');
});

// ─── 2. Dedicated tree-target routes ─────────────────────────────────────────

test('document defines dedicated tree-target read and create routes', () => {
  const doc = readDoc();
  assert.ok(
    /GET.*\/api\/trees\/:treeId\/comments|`GET` \| `\/api\/trees\/:treeId\/comments`/i.test(doc),
    'Document must define GET /api/trees/:treeId/comments'
  );
  assert.ok(
    /POST.*\/api\/trees\/:treeId\/comments|`POST` \| `\/api\/trees\/:treeId\/comments`/i.test(doc),
    'Document must define POST /api/trees/:treeId/comments'
  );
  assert.ok(
    /treeId` only|treeId only/i.test(doc),
    'Document must require treeId-only targeting (no memoryId segment)'
  );
});

// ─── 3. targetScope: "tree" and separation from #3075 ────────────────────────

test('document requires targetScope: "tree" and separates from #3075 moment comments', () => {
  const doc = readDoc();
  assert.ok(/targetScope: "tree"/i.test(doc), 'Document must require targetScope: "tree"');
  assert.ok(
    /\(treeId, memoryId\)|moment-level|moment-target/i.test(doc),
    'Document must name moment-level (treeId, memoryId) scope'
  );
  assert.ok(
    /must not.*reuse|reuse is forbidden|forbidden/i.test(doc),
    'Document must forbid mixing tree and moment scopes'
  );
});

// ─── 4. Moment route/adapter reuse forbidden ─────────────────────────────────

test('document forbids reusing moment routes/adapters for tree comments', () => {
  const doc = readDoc();
  assert.ok(
    /`\/memories\/:memoryId\/comments`|memories\/:memoryId\/comments/i.test(doc),
    'Document must name forbidden moment create route'
  );
  assert.ok(
    /\/api\/trees\/:treeId\/memories\/:memoryId\/comments|trees\/:treeId\/memories\/:memoryId\/comments/i.test(doc),
    'Document must name forbidden moment read route'
  );
  assert.ok(/fetchComments/i.test(doc), 'Document must name forbidden fetchComments');
  assert.ok(/fetchPublicMomentComments/i.test(doc), 'Document must name forbidden fetchPublicMomentComments');
  assert.ok(/createComment/i.test(doc), 'Document must name forbidden createComment');
  assert.ok(
    /separate tree-target endpoints|fetchTreeComments|createTreeComment/i.test(doc),
    'Document must require separate tree-target endpoints/adapters'
  );
});

// ─── 5. Visibility / guest / auth gating ─────────────────────────────────────

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
  assert.ok(
    /no unauthorized mutation loops|401 mutation loops/i.test(doc),
    'Document must forbid unauthorized mutation loops'
  );
});

// ─── 6. Idempotency + rate-limit prerequisites ───────────────────────────────

test('document requires idempotency-key for create', () => {
  const doc = readDoc();
  assert.ok(/Idempotency-Key/i.test(doc), 'Document must require Idempotency-Key for create');
  assert.ok(
    /IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_KEY_INVALID/i.test(doc),
    'Document must reference safe idempotency error codes'
  );
  assert.ok(
    /forwarded unchanged|forwarded unchanged to/i.test(doc),
    'Document must require forwarding the key unchanged to upstream'
  );
});

test('document requires tree-scoped rate-limit prerequisite', () => {
  const doc = readDoc();
  assert.ok(/rate-limit/i.test(doc), 'Document must require a tree-scoped rate-limit prerequisite');
  assert.ok(
    /no.*rate-limit exists|no tree-scoped comment rate-limit/i.test(doc),
    'Document must record that tree comment rate-limit does not exist yet'
  );
});

// ─── 7. Safe DTO + error + no raw/private exposure ───────────────────────────

test('document defines safe tree comment DTO shapes', () => {
  const doc = readDoc();
  assert.ok(/treeCommentSummary/i.test(doc), 'Document must define treeCommentSummary');
  assert.ok(/treeCommentListItem/i.test(doc), 'Document must define treeCommentListItem');
  assert.ok(/treeCommentMutationResult/i.test(doc), 'Document must define treeCommentMutationResult');
  assert.ok(/authorDisplayLabel/i.test(doc), 'Document must require safe authorDisplayLabel');
});

test('document defines safe error mapping and forbids raw/private output', () => {
  const doc = readDoc();
  assert.ok(/safe error/i.test(doc), 'Document must require safe error mapping');
  assert.ok(
    /no raw backend errors|raw backend errors/i.test(doc),
    'Document must forbid raw backend errors in UI'
  );
  assert.ok(
    /raw\/private|tokens|cookies|Authorization headers|API base URLs|dashboard URLs|DB rows|request\/response bodies|screenshots/i.test(doc),
    'Document must forbid raw/private value exposure'
  );
});

// ─── 8. #3370 pattern-only and unchanged ─────────────────────────────────────

test('document declares #3370 tree-like runtime pattern-only and unchanged', () => {
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

// ─── 9. Future implementation handoff ────────────────────────────────────────

test('document defines implementation handoff child sequence', () => {
  const doc = readDoc();
  assert.ok(
    /runtime route child/i.test(doc),
    'Document must name runtime route implementation child'
  );
  assert.ok(/DB\/schema child|DB\/schema/i.test(doc), 'Document must name DB/schema child if needed');
  assert.ok(/client adapter child/i.test(doc), 'Document must name client adapter child');
  assert.ok(/UI child/i.test(doc), 'Document must name UI child');
  assert.ok(/non-prod verification child|non-prod verification/i.test(doc), 'Document must name non-prod verification child');
  assert.ok(
    /this #3378 contract satisfies none/i.test(doc),
    'Document must state this contract alone does not satisfy implementation steps'
  );
});

// ─── 10. Forbidden boundaries / non-goals ────────────────────────────────────

test('document states hard non-goals: no runtime/API/UI/CSS/DB/Scout/#3370/#3075', () => {
  const doc = readDoc();
  const nonGoals = [
    [/runtime\/API implementation|not runtime\/API implementation|not create `functions\/api/i, 'no runtime/API implementation'],
    [/not client adapter|client adapter or API call/i, 'no client adapter'],
    [/not UI implementation|do \*\*not\*\* implement UI/i, 'no UI implementation'],
    [/CSS|layout/i, 'no CSS/layout change'],
    [/DB schema|DB migrations|not apply DB migrations/i, 'no DB schema/migration'],
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

// ─── 11. Companion artifact self-check ───────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comment-runtime-route-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 12. This test file itself stays source-only ─────────────────────────────

test('this contract suite does not import runtime adapters or network/browser clients', () => {
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
