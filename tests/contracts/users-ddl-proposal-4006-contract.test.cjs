'use strict';

// Issue #4006 - CANONICAL users / app_account DDL proposal contract.
// Evidence layer: SOURCE_STATIC.
//
// Reads the PROPOSAL_ONLY SQL artifact and its governing documents and proves:
// additive-only executable surface, fork owner-user bootstrap parity
// (#4157/#4164), canonical migration stream non-interference, identity
// uniqueness shape, audit vocabulary bounds, and preflight/doc markers.
// No SQL execution, no network, no database, no provider access.
//
// Refs #4006.
// Refs #4004 - Keep OPEN.
// Refs #4157.
// Refs #4164.
// Refs #1882 - Keep OPEN.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

const SQL_REL = 'db/proposals/4006-canonical-users-auth-identity-proposal.sql';
const DOC_REL = 'docs/architecture/CANONICAL_USERS_TABLE_DDL_PROPOSAL_4006.md';
const MANIFEST_REL = 'db/migration-provenance/canonical-migrations.json';
const FORK_ADAPTER_REL = 'functions/_shared/tree-fork-direct-neon.js';
const BRIDGE_DOC_REL = 'docs/architecture/auth-principal-compatibility-bridge-4006.md';
const CLASSIFICATION_REL = 'tests/test-layer-classification.json';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').toLowerCase();
}

// Depth-aware extraction of the parenthesized column list of a CREATE TABLE
// block so nested parens (e.g. REFERENCES public.app_account(id)) survive.
function extractCreateTableColumns(sql, tableName) {
  const marker = 'CREATE TABLE IF NOT EXISTS ' + tableName + ' (';
  const start = sql.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let opened = false;
  for (let i = start + marker.length - 1; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === '(') {
      depth += 1;
      opened = true;
    } else if (ch === ')') {
      depth -= 1;
      if (opened && depth === 0) {
        const inner = sql.slice(start + marker.length, i);
        const parts = [];
        let partDepth = 0;
        let current = '';
        for (const c of inner) {
          if (c === '(') partDepth += 1;
          if (c === ')') partDepth -= 1;
          if (c === ',' && partDepth === 0) {
            parts.push(current);
            current = '';
          } else {
            current += c;
          }
        }
        parts.push(current);
        return parts
          .map((p) => p.trim())
          .filter((p) => p.length > 0 && !/^COMMENT/i.test(p));
      }
    }
  }
  return null;
}

test('1. proposal artifact exists and is classified PROPOSAL_ONLY with do-not-execute header', () => {
  const sql = read(SQL_REL);
  assert.ok(sql.includes('PROPOSAL ONLY - DO NOT EXECUTE'), 'do-not-execute header required');
  assert.ok(/RESOURCE_CLASS\s*=\s*PROPOSAL_ONLY_DOCUMENT_ARTIFACT/.test(sql), 'resource class marker required');
  assert.ok(sql.includes('#1882 - Keep OPEN'), 'keep-open guardrail ref required');
});

test('2. all four canonical objects plus compatibility view are proposed', () => {
  const sql = read(SQL_REL);
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.app_account ('), 'app_account table');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.app_auth_identity ('), 'app_auth_identity table');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.users ('), 'users table');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.auth_audit_log ('), 'auth_audit_log table');
  assert.ok(
    sql.includes('CREATE OR REPLACE VIEW public.app_authenticated_owner_resolution AS'),
    'compatibility resolution view'
  );
});

test('3. identity uniqueness and one-active-per-provider-per-account indexes', () => {
  const sql = read(SQL_REL);
  assert.ok(/\bUNIQUE \(provider, provider_subject\)/.test(sql), 'provider+subject unique constraint');
  assert.ok(
    /app_auth_identity_one_active_firebase_per_account[\s\S]*?WHERE provider = 'firebase' AND status = 'active'/.test(sql),
    'one active firebase identity per account'
  );
  assert.ok(
    /app_auth_identity_one_active_neon_per_account[\s\S]*?WHERE provider = 'neon' AND status = 'active'/.test(sql),
    'one active neon identity per account'
  );
});

test('4. users table satisfies fork owner-user bootstrap parity (#4157/#4164)', () => {
  const adapter = read(FORK_ADAPTER_REL);
  const handledMatch = adapter.match(/const handled = new Set\(\[([^\]]*)\]\)/);
  assert.ok(handledMatch, 'fork adapter handled-column set must be discoverable');
  const handled = new Set(
    handledMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, '').replace(/\\'/g, "'"))
  );
  assert.deepEqual([...handled].sort(), ['created_at', 'email', 'id', 'updated_at']);

  const sql = read(SQL_REL);
  const cols = extractCreateTableColumns(sql, 'public.users');
  assert.ok(Array.isArray(cols) && cols.length >= 5, 'users column list parsed');
  const parsed = cols.map((def) => ({
    name: def.split(/\s+/)[0],
    requiredNonNull: /\bNOT NULL\b/.test(def) && !/\bDEFAULT\b/.test(def)
  }));
  const unknownRequiredNonNull = parsed.filter((c) => !handled.has(c.name) && c.requiredNonNull);
  assert.equal(
    unknownRequiredNonNull.length,
    0,
    'no unknown required-non-null users column may exist: ' +
      unknownRequiredNonNull.map((c) => c.name).join(',')
  );
  assert.ok(parsed.some((c) => c.name === 'account_id'), 'account_id column present');
  assert.ok(/\baccount_id\s+uuid\s+NULL\b/.test(sql), 'account_id must be nullable during transition');
});

test('5. binding invariant for future users evolution is stated verbatim', () => {
  const flat = collapse(read(SQL_REL));
  assert.ok(
    flat.includes('no new column may be added to public.users as not null'),
    'invariant sentence required'
  );
  assert.ok(flat.includes('without a default'), 'default escape-hatch wording required');
});

test('6. executable surface is additive-only', () => {
  const nonComment = stripCommentLines(read(SQL_REL)).split('\n');
  const forbidden = /^\s*(DROP|TRUNCATE|DELETE|UPDATE|ALTER|GRANT|REVOKE|INSERT)\b/i;
  const offenders = nonComment.filter((line) => forbidden.test(line));
  assert.deepEqual(offenders, [], 'proposal must contain zero executable mutation statements');
});

test('7. email can never become a linking or ownership key', () => {
  const raw = read(SQL_REL);
  assert.ok(raw.includes('Never a linking or ownership key'), 'metadata-only comment required');
  const nonComment = stripCommentLines(raw);
  assert.doesNotMatch(nonComment, /\bUNIQUE\b[^\n]*email_normalized/i, 'no unique constraint on email');
  assert.doesNotMatch(nonComment, /\bREFERENCES\b[^\n]*email_normalized/i, 'no FK on email');
});

test('8. audit action vocabulary is bounded and includes link lifecycle events', () => {
  const sql = read(SQL_REL);
  for (const action of ['link_created', 'link_revoked', 'account_disabled', 'account_merged', 'recovery_used']) {
    assert.ok(sql.includes("'" + action + "'"), 'audit action ' + action + ' declared');
  }
  const checkRegion = sql.slice(sql.indexOf("action            text NOT NULL CHECK"));
  const regionEnd = checkRegion.indexOf(')');
  const actionsBlock = collapse(checkRegion.slice(0, regionEnd));
  assert.ok(actionsBlock.includes("'link_created'"), 'action CHECK block parsed');
});

test('9. canonical migration stream remains untouched by this proposal', () => {
  const manifestText = read(MANIFEST_REL);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'canonical stream stays inactive');
  assert.equal(manifest.migrations.length, 2, 'exactly two catalogued migrations remain');
  assert.deepEqual(
    manifest.migrations.map((m) => m.id),
    ['20260802094500_bootstrap-migration-ledger', '20260812213000_add-tree-appreciation-orders']
  );
  assert.ok(!manifestText.includes('app_account'), 'manifest must not reference proposal objects');
  assert.ok(!manifestText.includes('proposals/'), 'manifest must not reference proposal artifacts');
});

test('10. governing document carries preflight block and adoption sequence', () => {
  const doc = read(DOC_REL);
  assert.ok(doc.includes(SQL_REL), 'doc references the exact proposal artifact path');
  assert.ok(doc.includes('PARENT_4004_READ = YES'), 'preflight parent read marker');
  assert.ok(doc.includes('LOVETREE_152_READ = YES'), 'preflight lovetree read marker');
  assert.ok(doc.includes('AUTH_4006_READ = YES'), 'preflight auth read marker');
  assert.ok(doc.includes('CURRENT_REMOTE_FRESH = YES'), 'preflight fresh remote marker');
  assert.ok(doc.includes('ARCHITECTURE_CONSISTENCY_GATE = PASS'), 'gate verdict marker');
  assert.ok(doc.includes('## 5. Adoption sequence'), 'adoption sequence section');
  assert.ok(doc.includes('## 6. Rollback posture'), 'rollback posture section');
});

test('11. view name matches the bridge document prototype boundary', () => {
  const bridge = read(BRIDGE_DOC_REL);
  assert.ok(bridge.includes('public.app_authenticated_owner_resolution'), 'bridge doc names the same view');
});

test('12. this contract is registered SOURCE_STATIC with no capabilities', () => {
  const classification = JSON.parse(read(CLASSIFICATION_REL));
  const selfRel = 'tests/contracts/' + path.basename(__filename);
  const entry = classification.entries.find((e) => e.path === selfRel);
  assert.ok(entry, 'classification entry must exist for this contract test');
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.deepEqual(entry.capabilities, []);
});

test('13. proposal artifact is registered in the #3458 schema-change inventory', () => {
  const inventory = JSON.parse(read('docs/architecture/db-schema-change-inventory.json'));
  const entry = inventory.entries.find((e) => e.path === SQL_REL);
  assert.ok(entry, 'proposal SQL must be registered in db-schema-change-inventory.json');
  assert.equal(entry.canonical_status, 'UNCLEAR_REQUIRES_DECISION', 'adoption decision stays open');
  assert.equal(entry.destructive, false);
  assert.equal(entry.production_capable, false);
  assert.ok(
    /PROPOSAL_ONLY_DOCUMENT_ARTIFACT/.test(entry.notes),
    'inventory notes must carry the do-not-execute classification'
  );
});
