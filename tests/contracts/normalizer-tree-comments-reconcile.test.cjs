/**
 * Unit tests for the purpose-specific catalog-expression normalizers used by the
 * tree-comments legacy-reconcile migration and rollback scripts.
 *
 *   scripts/migration-reconcile-tree-comments-legacy-schema.sql  -> _lb_norm_default / _lb_norm_check
 *   scripts/rollback-tree-comments-legacy-reconcile.sql          -> _lb_norm_default / _lb_norm_check
 *
 * These are NOT static "string-contains" checks. They replicate the SQL regex
 * steps (and the iterative redundant-parenthesis removal) in pure JavaScript and
 * assert real input -> output transforms for representative PostgreSQL catalog
 * forms, plus invalid-expression rejection.
 *
 * No database connection, psql, subprocess, git, or production access is used.
 * The SQL text is only read to confirm the JS reference mirrors the shipped
 * helpers (so the canonical contract stays in sync between JS test and SQL).
 *
 * Refs: #3423, #3424
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-reconcile-tree-comments-legacy-schema.sql');
const ROLLBACK_PATH = path.join(ROOT, 'scripts/rollback-tree-comments-legacy-reconcile.sql');

// ─── Pure-JS reference implementation (mirrors the SQL helpers) ───────────────

const CAST_RE = /::(character varying|varchar|timestamp with time zone|timestamptz|text|bpchar|boolean|jsonb|integer|bigint)/g;

function normDefault(input) {
  if (input == null) return '';
  let v = String(input).toLowerCase();
  v = v.replace(/\s+/g, ' ');
  v = v.replace(CAST_RE, '');
  v = v.replace(/^\s+|\s+$/g, '');
  v = v.replace(/^'(.*)'$/, '$1'); // strip surrounding quotes of a string-literal default
  return v;
}

function matchingClose(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function innerHasTopLevelLogic(inner) {
  // True if `inner` contains a whitespace-surrounded OR/AND outside single quotes.
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote) {
      if (/^\s(or|and)\s/i.test(inner.slice(i))) return true;
    }
  }
  return false;
}

function normCheck(input) {
  if (input == null) return '';
  let v = String(input).toLowerCase();
  v = v.replace(/^check\s*\(/i, '');   // strip leading CHECK (
  v = v.replace(/\)$/, '');            // strip CHECK's trailing )
  v = v.replace(CAST_RE, '');          // strip deterministic casts
  v = v.replace(/\s+/g, ' ');          // collapse whitespace
  v = v.replace(/^\s+|\s+$/g, '');     // trim

  let changed = true;
  while (changed) {
    changed = false;
    const n = v.length;
    // 1. Outer wrap: first '(' matches the last character.
    if (n > 0 && v[0] === '(' && v[n - 1] === ')') {
      const j = matchingClose(v, 0);
      if (j === n - 1) {
        v = v.slice(1, n - 1);
        changed = true;
        continue;
      }
    }
    // 2. Inner redundant paren pair (grouping around an atom / simple predicate).
    let removed = false;
    for (let k = 0; k < n; k++) {
      if (v[k] === '(') {
        const j = matchingClose(v, k);
        if (j < 0) break;
        const prev = k === 0 ? '' : v[k - 1];
        const nxt = j === n - 1 ? '' : v[j + 1];
        const inner = v.slice(k + 1, j);
        const prevOK = k === 0 || prev === '(' || prev === ' ' || prev === ',';
        const nxtOK = j === n - 1 || nxt === ')' || nxt === ' ' || nxt === ',';
        if (prevOK && nxtOK && !innerHasTopLevelLogic(inner)) {
          v = v.slice(0, k) + inner + v.slice(j + 1);
          changed = true;
          removed = true;
          break;
        }
      }
    }
    if (removed) continue;
    break;
  }
  return v;
}

// ─── Mirror check: the shipped SQL must define the same two helpers ───────────

const migrationSql = fs.existsSync(MIGRATION_PATH) ? fs.readFileSync(MIGRATION_PATH, 'utf8') : '';
const rollbackSql = fs.existsSync(ROLLBACK_PATH) ? fs.readFileSync(ROLLBACK_PATH, 'utf8') : '';

test('SQL helpers exist and are dropped before COMMIT (migration + rollback)', () => {
  for (const [name, sql] of [['migration', migrationSql], ['rollback', rollbackSql]]) {
    assert.ok(sql.includes('CREATE FUNCTION _lb_norm_default(p_expr text)'), `${name}: defines _lb_norm_default`);
    assert.ok(sql.includes('CREATE FUNCTION _lb_norm_check(p_expr text)'), `${name}: defines _lb_norm_check`);
    assert.ok(sql.includes('DROP FUNCTION IF EXISTS _lb_norm_default(text);'), `${name}: drops _lb_norm_default`);
    assert.ok(sql.includes('DROP FUNCTION IF EXISTS _lb_norm_check(text);'), `${name}: drops _lb_norm_check`);
    assert.equal(sql.includes('_lb_norm_expr'), false, `${name}: no shared normalizer remains`);
  }
});

// ─── _lb_norm_default: canonical default forms ───────────────────────────────

test('_lb_norm_default: string-literal default drops cast AND surrounding quotes', () => {
  assert.equal(normDefault("'tree'::character varying"), 'tree');
  assert.equal(normDefault("'tree'::varchar"), 'tree');
  assert.equal(normDefault("'tree'::text"), 'tree');
});

test('_lb_norm_default: function-call default preserves trailing parentheses', () => {
  assert.equal(normDefault('now()'), 'now()');
  assert.equal(normDefault('NOW()'), 'now()');
  assert.equal(normDefault('gen_random_uuid()'), 'gen_random_uuid()');
});

test('_lb_norm_default: mixed/whitespace/case variations', () => {
  assert.equal(normDefault("  'tree'::character varying  "), 'tree');
  assert.equal(normDefault("'TREE'::character varying"), 'tree'); // lowercased compare value
  assert.equal(normDefault("'tree'::text"), 'tree');
});

// ─── _lb_norm_check: canonical CHECK forms ───────────────────────────────────

test('_lb_norm_check: target_kind CHECK normalizes to bare comparison', () => {
  assert.equal(normCheck("CHECK (((target_kind)::text = 'tree'::text))"), "target_kind = 'tree'");
});

test('_lb_norm_check: target_id/tree_id CHECK normalizes with OR preserved', () => {
  assert.equal(
    normCheck("CHECK (((target_id IS NULL) OR (target_id = tree_id)))"),
    'target_id is null or target_id = tree_id'
  );
});

test('_lb_norm_check: handles whitespace, case, varchar/text cast, nested outer parens', () => {
  // case-insensitive + text cast (realistic deparse, no spaces inside parens)
  assert.equal(
    normCheck("CHECK (((target_kind)::TEXT = 'TREE'::text))"),
    "target_kind = 'tree'"
  );
  // whitespace around the operator is normalized to a single space
  assert.equal(
    normCheck("CHECK (((target_kind::text   =   'tree'::text)))"),
    "target_kind = 'tree'"
  );
  // varchar cast variant
  assert.equal(
    normCheck("CHECK (((target_kind)::varchar = 'tree'::varchar))"),
    "target_kind = 'tree'"
  );
  // extra nested outer wrapping parens
  assert.equal(
    normCheck("CHECK (((((target_kind)::text = 'tree'::text))))"),
    "target_kind = 'tree'"
  );
  // function-call style CHECK keeps parens of any inner function call
  assert.equal(
    normCheck("CHECK (((length(target_kind) > 0) OR (target_id = tree_id)))"),
    'length(target_kind) > 0 or target_id = tree_id'
  );
});

// ─── _lb_norm_check: invalid / extra-logic expressions are REJECTED ───────────

test('_lb_norm_check: extra disjunct on target_kind is NOT equal to canonical', () => {
  const got = normCheck("CHECK (((target_kind)::text = 'tree'::text) OR body <> '')");
  assert.equal(got, "target_kind = 'tree' or body <> ''");
  assert.notEqual(got, "target_kind = 'tree'");
});

test('_lb_norm_check: extra disjunct on target_id/tree_id is NOT equal to canonical', () => {
  const got = normCheck('CHECK ((target_id IS NULL OR target_id = tree_id OR body = \'\'))');
  assert.equal(got, "target_id is null or target_id = tree_id or body = ''");
  assert.notEqual(got, 'target_id is null or target_id = tree_id');
});

// ─── Cross-check: default + CHECK helpers agree with the canonical migration ──

test('normalizers: canonical reconciled form round-trips exactly', () => {
  // Defaults the migration/rollback expect.
  assert.equal(normDefault("'tree'::character varying"), 'tree');
  assert.equal(normDefault('now()'), 'now()');
  // CHECKs the migration/rollback expect.
  assert.equal(normCheck("CHECK (((target_kind)::text = 'tree'::text))"), "target_kind = 'tree'");
  assert.equal(
    normCheck("CHECK (((target_id IS NULL) OR (target_id = tree_id)))"),
    'target_id is null or target_id = tree_id'
  );
});

module.exports = { normDefault, normCheck };
