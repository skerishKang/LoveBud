/**
 * Contract tests for the tree-target social runtime hardening boundary (Issue #3355).
 *
 * Source-level only: validates the inventory/contract document and anchors it
 * against current tree-like source surfaces. No DB, network, deploy, smoke,
 * or runtime mutation.
 *
 * Refs: #3355, #3188, #3354, #3353, #3352, #3264, #3262, #3260, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs/product/lovebud-tree-target-runtime-hardening-boundary.md'
);
const TREE_LIKES_PATH = path.join(ROOT, 'modal_compute/tree_likes.py');
const CF_TREE_LIKES_PATH = path.join(ROOT, 'functions/api/trees/[tree_id]/likes.js');
const REACTIONS_PATH = path.join(ROOT, 'modal_compute/reactions.py');
const CF_REACTIONS_PATH = path.join(ROOT, 'functions/api/memories/[id]/reactions.js');
const APP_PATH = path.join(ROOT, 'modal_compute/app.py');
const PRODUCT_GENERIC_PATH = path.join(
  ROOT,
  'docs/product/lovebud-generic-social-write-target-contract.md'
);

function read(filePath) {
  assert.ok(fs.existsSync(filePath), `Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readDoc() {
  return read(DOC_PATH);
}

// ─── Document existence and scope ────────────────────────────────────────────

test('Tree-target runtime hardening boundary document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0);
  assert.ok(doc.includes('#3355') || doc.includes('3355'));
});

test('Document is source-only inventory/contract and does not claim activation', () => {
  const doc = readDoc();
  assert.ok(/source-only|Source-only/i.test(doc));
  assert.ok(/does not activate tree writers/i.test(doc));
  assert.ok(/does not.*change runtime behavior|No runtime behavior change|do \*\*not\*\* change.*runtime/i.test(doc));
  assert.ok(/non-goals|Non-goals/i.test(doc));
});

// ─── Inventory of current surfaces ───────────────────────────────────────────

test('Document inventories Modal and Cloudflare tree-like entrypoints', () => {
  const doc = readDoc();
  assert.ok(doc.includes('modal_compute/tree_likes.py'));
  assert.ok(doc.includes('functions/api/trees/[tree_id]/likes.js') || doc.includes('trees/[tree_id]/likes'));
  assert.ok(doc.includes('/modal/private/trees/{tree_id}/likes') || doc.includes('private/trees'));
  assert.ok(/fetch_public_tree_like_count|public.*likeCount/i.test(doc));
});

test('Document capability matrix covers required inventory dimensions', () => {
  const doc = readDoc();
  const required = [
    /public read/i,
    /authenticated write/i,
    /Idempotency-Key|idempotency/i,
    /audit/i,
    /visibility/i,
    /advisory lock|concurrency lock/i,
    /replay/i,
    /error|taxonomy|observability/i,
  ];
  for (const re of required) {
    assert.ok(re.test(doc), `Document must cover inventory dimension: ${re}`);
  }
});

test('Document records current tree-like hardening gaps honestly', () => {
  const doc = readDoc();
  // Gaps must be explicit for the unhardened path
  assert.ok(/Idempotency-Key.*\*\*No\*\*|Idempotency-Key required.*\*\*No\*\*/i.test(doc) ||
    /`Idempotency-Key` required[\s\S]*?\|\s*\*\*No\*\*/i.test(doc));
  assert.ok(/Idempotency reservation|replay[\s\S]*?\*\*No\*\*/i.test(doc));
  assert.ok(/Social audit logging[\s\S]*?\*\*No\*\*/i.test(doc));
  assert.ok(/advisory lock[\s\S]*?\*\*No\*\*/i.test(doc));
  assert.ok(/Visibility checks[\s\S]*?\*\*Yes/i.test(doc));
  assert.ok(/Authenticated write route[\s\S]*?\*\*Yes/i.test(doc));
});

// ─── Future hardening contract requirements ──────────────────────────────────

test('Future contract requires Idempotency-Key and canonical tree target pair', () => {
  const doc = readDoc();
  assert.ok(/Idempotency-Key/i.test(doc));
  assert.ok(/IDEMPOTENCY_KEY_REQUIRED/.test(doc));
  assert.ok(/IDEMPOTENCY_KEY_INVALID/.test(doc));
  assert.ok(/IDEMPOTENCY_KEY_REUSED/.test(doc));
  assert.ok(doc.includes("target_kind = 'tree'") || doc.includes('target_kind = `tree`') ||
    /target_kind\s*=\s*'tree'/.test(doc));
  assert.ok(/target_id\s*=\s*<tree UUID>|target_id = <tree UUID>/.test(doc));
});

test('Future contract forbids tree IDs in legacy moment fields', () => {
  const doc = readDoc();
  assert.ok(doc.includes('target_memory_id'));
  assert.ok(doc.includes('memory_id'));
  assert.ok(/never|must \*\*never\*\*|must not|Forbidden/i.test(doc));
  assert.ok(/tree.*(?:target_memory_id|memory_id)|legacy moment/i.test(doc));
});

test('Future contract requires per-actor/per-tree lock, replay DTO, and public-only visibility', () => {
  const doc = readDoc();
  assert.ok(/per-actor\/per-tree|per-actor.*per-tree/i.test(doc));
  assert.ok(/advisory lock/i.test(doc));
  assert.ok(/replay/i.test(doc));
  assert.ok(/safe DTO|Authoritative safe DTO/i.test(doc));
  assert.ok(doc.includes('treeId') && doc.includes('active') && doc.includes('likeCount'));
  assert.ok(/404/.test(doc));
  assert.ok(/public/i.test(doc));
  assert.ok(/private|non-public|draft/i.test(doc));
});

test('Future contract covers guest non-mutation and no noisy 401 loops', () => {
  const doc = readDoc();
  assert.ok(/guest/i.test(doc));
  assert.ok(/401/.test(doc));
  assert.ok(/noisy 401|401 loops|401 storms/i.test(doc));
  assert.ok(/must not mutate|do not mutate|non-mutating/i.test(doc));
});

test('Future contract keeps moment #3075 boundary and tree comments out of first child', () => {
  const doc = readDoc();
  assert.ok(doc.includes('#3075'));
  assert.ok(/moment/i.test(doc));
  assert.ok(/tree-level comments|Tree-level comments/i.test(doc));
  assert.ok(/out of scope/i.test(doc));
});

test('Document states Cloudflare must forward Idempotency-Key for tree mutations later', () => {
  const doc = readDoc();
  assert.ok(/forward `Idempotency-Key`|forwards `Idempotency-Key`|forward Idempotency-Key/i.test(doc));
});

// ─── Non-goals and gate chain ────────────────────────────────────────────────

test('Document non-goals exclude DB apply, deploy, smoke, UI, and tree writer activation', () => {
  const doc = readDoc();
  assert.ok(/non-goals/i.test(doc));
  assert.ok(/do \*\*not\*\* deploy|Do \*\*not\*\* deploy|no Modal or Cloudflare deploy/i.test(doc) ||
    /Do \*\*not\*\* deploy Modal or Cloudflare/i.test(doc));
  assert.ok(/migration/i.test(doc));
  assert.ok(/smoke/i.test(doc));
  assert.ok(/fixture/i.test(doc));
  assert.ok(/UI|client/i.test(doc));
  assert.ok(/activate tree writers/i.test(doc));
  assert.ok(/Browse/i.test(doc) && /My Trees/i.test(doc));
  assert.ok(/Editor/i.test(doc) && /Scout/i.test(doc) && /Hermes/i.test(doc));
});

test('Document places runtime hardening after Gate B in implementation order', () => {
  const doc = readDoc();
  assert.ok(/Gate B/i.test(doc));
  assert.ok(/Migration B/i.test(doc));
  assert.ok(/runtime hardening/i.test(doc));
  assert.ok(/UI activation/i.test(doc));
});

// ─── Source anchors: inventory remains true against current tree ─────────────

test('Current tree_likes.py hardens toggle with idempotency/audit/lock and public visibility', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(src.includes('require_public_tree_for_like'));
  assert.ok(src.includes('def toggle_tree_like'));
  assert.ok(src.includes('GREATEST(like_count - 1, 0)') || src.includes('GREATEST(like_count - 1,0)'));
  assert.ok(src.includes('reserve_and_verify_idempotency_target'));
  assert.ok(src.includes('record_audit_target'));
  assert.ok(src.includes('pg_advisory_xact_lock'));
  assert.ok(src.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(src.includes('Idempotency-Key') || src.includes('idempotency_key'));
});

test('Current Cloudflare tree likes proxy requires auth and forwards Idempotency-Key', () => {
  const src = read(CF_TREE_LIKES_PATH);
  assert.ok(src.includes('hasAuthorizationHeader') || src.includes('Authorization'));
  assert.ok(src.includes('/modal/private/trees/'));
  assert.ok(src.includes('Idempotency-Key'));
  assert.ok(src.includes("headers['Idempotency-Key'] = idempotencyKey"));
});

test('Moment reaction path remains the hardened reference (lock + idempotency + CF key)', () => {
  const reactions = read(REACTIONS_PATH);
  const cf = read(CF_REACTIONS_PATH);
  assert.ok(reactions.includes('reserve_and_verify_idempotency'));
  assert.ok(reactions.includes('pg_advisory_xact_lock'));
  assert.ok(cf.includes('Idempotency-Key'));
});

test('Modal app still exposes private tree like GET/POST routes', () => {
  const app = read(APP_PATH);
  assert.ok(app.includes('/modal/private/trees/{tree_id}/likes'));
  assert.ok(app.includes('toggle_tree_like'));
  assert.ok(app.includes('fetch_tree_like_summary'));
  assert.ok(app.includes('fetch_public_tree_like_count'));
});

test('Generic social write target contract still forbids tree IDs in legacy moment fields', () => {
  const doc = read(PRODUCT_GENERIC_PATH);
  assert.ok(/prohibit/i.test(doc));
  assert.ok(doc.includes('target_memory_id'));
  assert.ok(doc.includes("target_kind = 'tree'") || doc.includes('target_kind'));
});

// ─── Privacy hygiene in the new document ─────────────────────────────────────

test('Hardening boundary document does not embed connection strings or bearer tokens', () => {
  const doc = readDoc();
  assert.equal(/postgresql:\/\//i.test(doc), false);
  assert.equal(/Bearer\s+[A-Za-z0-9._-]+/i.test(doc), false);
  assert.equal(/eyJ[A-Za-z0-9_-]{10,}/.test(doc), false);
});
