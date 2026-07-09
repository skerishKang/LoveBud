/**
 * Focused runtime-hardening contract tests for the tree-like write path (Issue #3359).
 *
 * Source-level only: verifies the hardened Modal tree-like writer, the generic
 * idempotency reservation, the per-actor/per-tree advisory lock, the safe DTO,
 * the Cloudflare proxy Idempotency-Key forwarding, and the legacy-field
 * isolation guarantees. No DB, network, deploy, or runtime mutation.
 *
 * Refs: #3359, #3355, #3356, #3354, #3353, #3352, #3264, #3262, #3260, #3188,
 * #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const TREE_LIKES_PATH = path.join(ROOT, 'modal_compute/tree_likes.py');
const IDEMPOTENCY_PATH = path.join(ROOT, 'modal_compute/social_idempotency.py');
const AUDIT_PATH = path.join(ROOT, 'modal_compute/social_write_audit.py');
const SOCIAL_ERRORS_PATH = path.join(ROOT, 'modal_compute/social_errors.py');
const APP_PATH = path.join(ROOT, 'modal_compute/app.py');
const CF_TREE_LIKES_PATH = path.join(ROOT, 'functions/api/trees/[tree_id]/likes.js');

function read(filePath) {
  assert.ok(fs.existsSync(filePath), `Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

// ─── Modal tree-like writer requires and validates Idempotency-Key ────────────

test('Tree-like writer validates Idempotency-Key before any visibility/DB lookup', () => {
  const src = read(TREE_LIKES_PATH);
  const start = src.indexOf('def toggle_tree_like(');
  const nextDef = src.indexOf('\ndef ', start + 10);
  const block = nextDef === -1 ? src.slice(start) : src.slice(start, nextDef);
  const missingIdx = block.indexOf('if not idempotency_key:');
  const formatIdx = block.indexOf('validate_idempotency_key_format(idempotency_key)');
  const visibilityIdx = block.indexOf('require_public_tree_for_like(safe_tree_id)');
  assert.ok(missingIdx > 0, 'missing-key check must be present');
  assert.ok(formatIdx > missingIdx, 'format validation must follow missing-key check');
  assert.ok(
    missingIdx < visibilityIdx && formatIdx < visibilityIdx,
    'idempotency key validation must precede the public-tree visibility lookup'
  );
});

test('Tree-like writer requires Idempotency-Key (missing -> safe typed error)', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(src.includes('def toggle_tree_like('), 'toggle_tree_like must exist');
  assert.ok(
    /if not idempotency_key:[\s\S]*?IDEMPOTENCY_KEY_REQUIRED/.test(src),
    'toggle_tree_like must raise IDEMPOTENCY_KEY_REQUIRED when key is missing'
  );
  assert.ok(src.includes('"IDEMPOTENCY_KEY_REQUIRED"') || src.includes("'IDEMPOTENCY_KEY_REQUIRED'"));
});

test('Tree-like writer validates Idempotency-Key format (malformed -> safe typed error)', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(
    src.includes('validate_idempotency_key_format(idempotency_key)'),
    'toggle_tree_like must validate key format'
  );
  const errors = read(SOCIAL_ERRORS_PATH);
  assert.ok(errors.includes('IDEMPOTENCY_KEY_INVALID'), 'safe error taxonomy includes IDEMPOTENCY_KEY_INVALID');
});

test('Tree-like writer rejects key reuse with safe conflict (409 IDEMPOTENCY_KEY_REUSED)', () => {
  const idem = read(IDEMPOTENCY_PATH);
  assert.ok(
    idem.includes('IDEMPOTENCY_KEY_REUSED'),
    'generic idempotency resolver must raise IDEMPOTENCY_KEY_REUSED on target/payload mismatch'
  );
  assert.ok(/status_code=409/.test(idem), 'key reuse conflict must use 409');
});

// ─── Replay-safe idempotency semantics (generic target pair) ──────────────────

test('Tree-like writer uses generic idempotency reservation with target_kind=tree', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(
    src.includes('reserve_and_verify_idempotency_target('),
    'toggle_tree_like must call generic idempotency reservation'
  );
  const m = src.match(/reserve_and_verify_idempotency_target\([\s\S]*?\)/);
  assert.ok(m, 'reserve_and_verify_idempotency_target call must be present');
  assert.ok(
    /"tree"|'tree'/.test(m[0]),
    'tree target must pass target_kind = "tree"'
  );
  assert.ok(
    m[0].includes('safe_tree_id'),
    'tree target must pass target_id = tree UUID'
  );
});

test('Idempotency reservation stores canonical generic target pair columns', () => {
  const idem = read(IDEMPOTENCY_PATH);
  assert.ok(idem.includes('def reserve_and_verify_idempotency_target('));
  const fn = idem.slice(idem.indexOf('def reserve_and_verify_idempotency_target('));
  assert.ok(fn.includes('target_kind'), 'INSERT must set target_kind');
  assert.ok(fn.includes('target_id'), 'INSERT must set target_id');
  assert.ok(
    /INSERT INTO social_idempotency[\s\S]*?target_kind[\s\S]*?target_id/.test(fn),
    'social_idempotency INSERT must include generic target columns'
  );
  assert.ok(
    fn.includes('target_memory_id'),
    'reservation must accept optional legacy target_memory_id (left NULL for tree)'
  );
});

test('Replay returns stored authoritative DTO without a second toggle', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(
    /if replay is not None and replay\.get\("replay"\)/.test(src),
    'toggle_tree_like must branch on replay'
  );
  assert.ok(
    /stored_payload is not None and isinstance\(stored_payload, dict\)[\s\S]*?return stored_payload/.test(src),
    'replay must return the stored safe DTO'
  );
  const idem = read(IDEMPOTENCY_PATH);
  assert.ok(idem.includes('"replay"'), 'reservation must signal replay');
  assert.ok(idem.includes('resultPayload'), 'reservation replay must carry stored payload');
});

test('Replay audit is recorded with request key hash, never raw key', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(src.includes('record_audit_target('), 'must record audit for tree target');
  assert.ok(
    /tree\.like\.toggle\.replay/.test(src),
    'replay must record tree.like.toggle.replay action'
  );
  const audit = read(AUDIT_PATH);
  assert.ok(audit.includes('def record_audit_target('), 'generic audit helper must exist');
  assert.ok(audit.includes('request_key_hash'), 'audit must store key hash only');
  assert.ok(src.includes('_compute_key_hash(idempotency_key)'), 'audit must use key hash not raw key');
});

// ─── Tree IDs must never be written into legacy moment fields ─────────────────

test('Tree-like writer never writes tree IDs into legacy moment fields', () => {
  const src = read(TREE_LIKES_PATH);
  assert.equal(
    src.includes('target_memory_id'),
    false,
    'tree_likes.py must not reference legacy target_memory_id'
  );
  assert.equal(
    src.includes('memory_id'),
    false,
    'tree_likes.py must not write into legacy memory_id'
  );
  const audit = read(AUDIT_PATH);
  const targetFn = audit.slice(audit.indexOf('def record_audit_target('));
  assert.ok(
    /NULL/.test(targetFn.split('VALUES')[1] || ''),
    'tree audit INSERT must leave memory_id NULL'
  );
});

// ─── Per-actor/per-tree advisory lock ─────────────────────────────────────────

test('Tree-like writer uses per-actor/per-tree transaction advisory lock', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(
    src.includes('_tree_like_advisory_lock('),
    'must define per-actor/per-tree advisory lock helper'
  );
  assert.ok(
    src.includes('pg_advisory_xact_lock'),
    'toggle_tree_like must acquire the advisory lock'
  );
  assert.ok(
    /_tree_like_advisory_lock\(owner_id, safe_tree_id\)/.test(src),
    'lock must be keyed on actor + tree'
  );
});

// ─── Minimal safe DTO ──────────────────────────────────────────────────────────

test('Tree-like toggle returns minimal safe DTO (treeId/active/likeCount only)', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(src.includes('"treeId"'), 'DTO must include treeId');
  assert.ok(src.includes('"active"'), 'DTO must include active');
  assert.ok(src.includes('"likeCount"'), 'DTO must include likeCount');
  assert.equal(
    /"ownerId"|"memoryId"|"createdAt"/.test(src),
    false,
    'DTO must not leak owner/memory/timestamp fields'
  );
});

// ─── Visibility / existence-leak prevention on writes ──────────────────────────

test('Tree-like writer hides missing/private trees as not found (no existence leak)', () => {
  const src = read(TREE_LIKES_PATH);
  assert.ok(
    src.includes('require_public_tree_for_like'),
    'toggle_tree_like must gate on public tree'
  );
  assert.ok(
    /HTTPException\(status_code=404, detail="Tree not found"\)/.test(src),
    'non-public tree must fail closed as 404'
  );
});

test('Tree-like writer does not mutate without idempotency reservation in the same transaction', () => {
  const src = read(TREE_LIKES_PATH);
  // reservation + mutation + audit must share one connection/transaction
  assert.ok(src.includes('conn.commit()'), 'must commit transaction');
  assert.ok(src.includes('conn.rollback()'), 'must rollback on failure');
  const block = src.slice(src.indexOf('def toggle_tree_like('));
  const reserveIdx = block.indexOf('reserve_and_verify_idempotency_target(');
  const mutateIdx = block.indexOf('INSERT INTO tree_likes');
  const commitIdx = block.lastIndexOf('conn.commit()');
  assert.ok(reserveIdx > 0 && mutateIdx > reserveIdx && commitIdx > mutateIdx,
    'reservation must precede mutation; commit must follow both within one transaction');
});

// ─── Cloudflare proxy forwards Idempotency-Key unchanged ──────────────────────

test('Cloudflare tree-likes proxy forwards Idempotency-Key unchanged on POST', () => {
  const cf = read(CF_TREE_LIKES_PATH);
  assert.ok(cf.includes("headers.get('Idempotency-Key')"), 'proxy must read Idempotency-Key');
  assert.ok(
    cf.includes("headers['Idempotency-Key'] = idempotencyKey"),
    'proxy must forward Idempotency-Key header unchanged'
  );
  assert.ok(cf.includes('KEY_PATTERN'), 'proxy must validate key format');
  assert.ok(cf.includes('IDEMPOTENCY_KEY_REQUIRED'), 'proxy must reject missing key');
  assert.ok(cf.includes('IDEMPOTENCY_KEY_INVALID'), 'proxy must reject invalid key');
});

test('Cloudflare tree-likes proxy only requires Idempotency-Key for mutations', () => {
  const cf = read(CF_TREE_LIKES_PATH);
  assert.ok(
    /if \(method === 'POST'\)[\s\S]*?Idempotency-Key/.test(cf),
    'Idempotency-Key requirement must apply to POST mutations only'
  );
  assert.ok(cf.includes('Authorization required'), 'proxy still gates auth');
});

// ─── Modal route wiring ───────────────────────────────────────────────────────

test('Modal app POST tree like route reads Idempotency-Key header', () => {
  const app = read(APP_PATH);
  assert.ok(
    app.includes('x_idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")'),
    'post_tree_like must read Idempotency-Key header'
  );
  assert.ok(
    /return toggle_tree_like\(tree_id, user\["uid"\], idempotency_key=x_idempotency_key\)/.test(app),
    'post_tree_like must forward idempotency_key to writer'
  );
});

// ─── Privacy hygiene ──────────────────────────────────────────────────────────

test('Tree-like hardening sources embed no connection strings or bearer tokens', () => {
  for (const p of [TREE_LIKES_PATH, IDEMPOTENCY_PATH, AUDIT_PATH, CF_TREE_LIKES_PATH]) {
    const src = read(p);
    assert.equal(/postgresql:\/\//i.test(src), false, `${p} must not embed connection strings`);
    assert.equal(/Bearer\s+[A-Za-z0-9._-]+/i.test(src), false, `${p} must not embed bearer tokens`);
    assert.equal(/eyJ[A-Za-z0-9_-]{10,}/.test(src), false, `${p} must not embed JWTs`);
  }
});

// ─── #3366 regression: SELECT-first replay in generic idempotency resolver ────
//
// Live runtime verification (#3361, check 5) found that same-key replay
// applied a second toggle because reserve_and_verify_idempotency_target
// relied on INSERT ... ON CONFLICT ... RETURNING to detect replay.
// When the DB unique constraint on (actor_id, operation, idempotency_key)
// is absent (live runtime), the INSERT always succeeds as a fresh pending
// row and every call is treated as a new reservation — no replay.
//
// The fix adds a SELECT-first lookup that queries the existing reservation
// before any INSERT, making replay robust regardless of schema state.
//
// These tests verify the SELECT-first pattern statically from source.
// Dynamic Python-level regression tests are in
// tests/contracts/test_tree_like_idempotency.py (#3366 suite).

const IDEM_PATH = path.join(ROOT, 'modal_compute/social_idempotency.py');

test('#3366 regression: resolver has SELECT-first _read_existing_idempotency_target', () => {
  const idem = read(IDEM_PATH);
  assert.ok(
    idem.includes('def _read_existing_idempotency_target('),
    'must define SELECT-first lookup helper'
  );
  assert.ok(
    idem.includes('SELECT target_kind, target_id, target_memory_id, result_id'),
    'SELECT must return generic target columns and reservation state'
  );
});

test('#3366 regression: reserve_and_verify_idempotency_target calls SELECT first', () => {
  const idem = read(IDEM_PATH);
  const fn = idem.slice(idem.indexOf('def reserve_and_verify_idempotency_target('));
  const after = fn.slice(fn.indexOf('fingerprint = _compute_fingerprint(body)'));
  assert.ok(
    after.includes('existing = _read_existing_idempotency_target('),
    'must call SELECT-first lookup after computing fingerprint'
  );
  assert.ok(
    before( after.indexOf('INSERT INTO social_idempotency'),
            after.indexOf('def _') ),
    'resolver must INSERT only after SELECT returns no row'
  );
  function before(insertIdx, endIdx) {
    const insertBlock = insertIdx === -1 ? after.slice(0, endIdx) : after.slice(0, insertIdx);
    return insertBlock.indexOf('existing = _read_existing_idempotency_target(') !== -1;
  }
});

test('#3366 regression: SELECT-first path returns stored DTO on completed/replayed state', () => {
  const src = read(IDEM_PATH);
  assert.ok(
    /stored_state in \("completed", "replayed"\)/.test(src),
    'SELECT-first must return stored DTO when state is completed or replayed'
  );
  assert.ok(
    src.includes('"replay": True'),
    'SELECT-first must flag replay as True in the returned dict'
  );
  assert.ok(
    /"resultPayload": payload/.test(src),
    'SELECT-first must include stored payload in replay return'
  );
});

test('#3366 regression: INSERT ON CONFLICT has RETURNING clause for conflict detection', () => {
  const idem = read(IDEM_PATH);
  const fn = idem.slice(idem.indexOf('def reserve_and_verify_idempotency_target('));
  const insertFn = fn.slice(fn.indexOf('INSERT INTO social_idempotency'));
  assert.ok(
    insertFn.includes('RETURNING'),
    'INSERT must have RETURNING to capture existing row on conflict'
  );
  const afterInsert = idem.slice(idem.indexOf('row = cur.fetchone()'));
  assert.ok(
    afterInsert.includes('stored_result_id == result_id and stored_state == "pending"'),
    'conflict fallback must distinguish new INSERT from conflict via result_id match'
  );
  assert.ok(
    afterInsert.includes('"replay": True'),
    'conflict fallback must return replay DTO when stored state is completed/replayed'
  );
  assert.ok(
    afterInsert.includes('IDEMPOTENCY_KEY_REUSED'),
    'conflict fallback must raise IDEMPOTENCY_KEY_REUSED on target/fingerprint mismatch'
  );
  assert.ok(
    afterInsert.includes('SOCIAL_WRITE_UNAVAILABLE'),
    'conflict fallback must raise SOCIAL_WRITE_UNAVAILABLE on pending/failed'
  );
});

// ─── #3369 client tree-level like: DTO shape, Idempotency-Key, guest guard ──

const TREE_LIKE_CLIENT_PATH = path.join(ROOT, 'js/viewer/public-viewer-tree-like.js');

test('#3369 client: tree-like control module exists with createTreeLikeControl', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    src.includes('createTreeLikeControl'),
    'module must export createTreeLikeControl function'
  );
  assert.ok(
    src.includes('LoveBudTreeLikeControl'),
    'module must register LoveBudTreeLikeControl namespace'
  );
});

test('#3369 client: XHR mutation sends Idempotency-Key header', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    src.includes("setRequestHeader('Idempotency-Key'"),
    'mutation must set Idempotency-Key header'
  );
  assert.ok(
    src.includes("setRequestHeader('Authorization'"),
    'mutation must set Authorization header'
  );
  assert.ok(
    src.includes("setRequestHeader('Accept', 'application/json')"),
    'mutation must set Accept header'
  );
});

test('#3369 client: authoritative DTO shape is treeId/active/likeCount', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    /typeof dto\.treeId === 'string' && typeof dto\.active === 'boolean' && typeof dto\.likeCount === 'number'/.test(src),
    'DTO validation must require treeId (string), active (boolean), likeCount (number)'
  );
});

test('#3369 client: guest/unauthenticated users get disabled button, no mutation', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    src.includes('btn.disabled = true'),
    'control must disable button for guests'
  );
  assert.ok(
    src.includes('if (inFlight || isGuest) return;'),
    'handleClick must early-return for guests'
  );
});

test('#3369 client: pending click guard prevents duplicate keys', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    src.includes('if (inFlight || isGuest) return;'),
    'handleClick must suppress duplicate calls when pending'
  );
});

test('#3369 client: optimistic rollback on failure', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.ok(
    src.includes('rollback(prevActive, prevCount)'),
    'on failure must rollback to previous state'
  );
});

test('#3369 client: no raw backend error in UI', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  // xhr.responseText is used for safe DTO parse — that's OK.
  // What must NOT appear: raw error/exceptions in visible UI output.
  assert.equal(
    src.includes('error.message'), false,
    'client must not expose error.message in UI'
  );
  assert.equal(
    src.includes('error.stack'), false,
    'client must not expose error.stack in UI'
  );
  // Toast messages must be safe product strings, not raw error bodies.
  const toastCalls = src.match(/showToast\(/g);
  const toastMessages = toastCalls ? toastCalls.length : 0;
  assert.ok(toastMessages >= 4, 'client must show safe product error toasts');
});

test('#3369: moment-level #3075 behavior unchanged — no moment card references', () => {
  const src = read(TREE_LIKE_CLIENT_PATH);
  assert.equal(
    src.includes('momentReactionsCard'), false,
    'tree-like control must not reference moment reactions card'
  );
  assert.equal(
    src.includes('momentReactionLikeButton'), false,
    'tree-like control must not reference moment reaction button'
  );
});
