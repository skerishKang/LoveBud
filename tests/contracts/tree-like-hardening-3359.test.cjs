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
