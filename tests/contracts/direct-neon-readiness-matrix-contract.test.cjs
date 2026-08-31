'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MATRIX_PATH = path.resolve(REPO_ROOT, 'docs', 'architecture', 'direct-neon-readiness-matrix-4311.json');
const CONTRACT_DOC_PATH = path.resolve(
  REPO_ROOT,
  'docs',
  'architecture',
  'DIRECT_NEON_EPHEMERAL_PRODUCTION_DIAGNOSTIC_ACTIVATION_CONTRACT_4311.md'
);

const MATRIX = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));

const REQUIRED_ROUTE_FIELDS = [
  'id', 'route', 'method', 'family', 'source_refs', 'source_state', 'runtime_gate',
  'required_objects', 'credential_boundary', 'source_parity', 'privilege_state',
  'live_provider_state', 'checked_in_gate', 'live_gate_state', 'ephemeral_diagnostic_support',
  'diagnostic_execution_authorized', 'production_live', 'disposition_4239',
  'last_exact_head_evidence', 'modal_retained_by_design', 'rollback_authority', 'next_action',
];

const NULLABLE_FIELDS = new Set(['source_helper', 'runtime_gate', 'privilege_block_reason']);
const SHARED_CORE_HELPERS = new Set([
  'functions/_shared/direct-neon-browse-summary-core.js',
  'functions/_shared/direct-neon-browse-transport.js',
]);

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collectSourceGateVars() {
  const found = new Set();
  for (const file of walkJs(path.resolve(REPO_ROOT, 'functions'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bLB_[A-Z0-9_]+_RUNTIME\b/g)) found.add(m[0]);
  }
  return found;
}

function collectDirectNeonHelpers() {
  const dir = path.resolve(REPO_ROOT, 'functions', '_shared');
  return fs.readdirSync(dir)
    .filter((n) => /neon.*\.js$/.test(n))
    .map((n) => `functions/_shared/${n}`)
    .filter((p) => !SHARED_CORE_HELPERS.has(p));
}

function collectCheckedInGates() {
  const text = fs.readFileSync(path.resolve(REPO_ROOT, 'wrangler.toml'), 'utf8');
  const section = text.split(/^\[env\.production\.vars\]\s*$/m)[1] || '';
  const gates = new Set();
  for (const m of section.matchAll(/^(LB_[A-Z0-9_]+_RUNTIME)\s*=\s*"direct_neon"\s*$/gm)) gates.add(m[1]);
  return gates;
}

describe('#4311 direct-neon readiness matrix contract', () => {
  it('authority block is present and freshness-bound', () => {
    assert.equal(MATRIX.format_version, '1.0');
    assert.equal(MATRIX.authority.issue, 4311);
    assert.match(MATRIX.authority.as_of_main_sha, /^[a-f0-9]{40}$/);
    assert.ok(MATRIX.authority.staleness_rule.includes('INVALIDATED') || MATRIX.authority.staleness_rule.length > 40);
  });

  it('activation contract document exists', () => {
    assert.ok(fs.existsSync(CONTRACT_DOC_PATH));
  });

  it('every route carries all required fields exactly once and unique ids', () => {
    const ids = new Set();
    for (const route of MATRIX.routes) {
      for (const field of REQUIRED_ROUTE_FIELDS) {
        assert.ok(Object.prototype.hasOwnProperty.call(route, field), `${route.id}: missing ${field}`);
        if (!NULLABLE_FIELDS.has(field)) {
          assert.notEqual(route[field], null, `${route.id}: ${field} must not be null`);
          if (typeof route[field] === 'string') assert.ok(route[field].trim().length > 0, `${route.id}: empty ${field}`);
        }
      }
      assert.ok(!ids.has(route.id), `duplicate route id ${route.id}`);
      ids.add(route.id);
    }
  });

  it('all state values are members of the declared vocabulary', () => {
    const vocab = MATRIX.classification_vocabulary;
    const checks = [
      ['source_state', vocab.source_state],
      ['source_parity', vocab.source_parity],
      ['privilege_state', vocab.privilege_state],
      ['live_provider_state', vocab.live_provider_state],
      ['checked_in_gate', vocab.checked_in_gate],
      ['live_gate_state', vocab.live_gate_state],
      ['ephemeral_diagnostic_support', vocab.ephemeral_diagnostic_support],
      ['diagnostic_execution_authorized', vocab.diagnostic_execution_authorized],
      ['production_live', vocab.production_live],
      ['disposition_4239', vocab.disposition_4239],
    ];
    for (const route of MATRIX.routes) {
      for (const [field, allowed] of checks) {
        assert.ok(allowed.includes(route[field]), `${route.id}: ${field}=${route[field]} not in vocabulary`);
      }
      assert.ok(['READ', 'WRITE'].includes(route.family), `${route.id}: bad family`);
      assert.ok(['modal_runtime', 'direct_neon_runtime'].includes(route.credential_boundary), `${route.id}: bad credential boundary`);
    }
  });

  it('modal-retained classification is explicit, never inferred', () => {
    for (const route of MATRIX.routes) {
      assert.equal(typeof route.modal_retained_by_design, 'boolean', `${route.id}: modal_retained_by_design must be boolean`);
      if (route.modal_retained_by_design) {
        assert.equal(route.source_state, 'KEEP_MODAL_BY_DESIGN', `${route.id}: retained routes must say so in source_state`);
      }
      if (route.source_state === 'KEEP_MODAL_BY_DESIGN') {
        assert.equal(route.modal_retained_by_design, true, `${route.id}: inconsistent retention flags`);
      }
    }
  });

  it('no stale diagnostic authority is inherited into the matrix', () => {
    for (const route of MATRIX.routes) {
      assert.notEqual(
        route.diagnostic_execution_authorized,
        'AUTHORIZED_ONE_SESSION_AT_CITED_SHA',
        `${route.id}: live one-session authority must never be checked into main; use the ephemeral activation lifecycle`
      );
    }
  });

  it('declared source helpers exist on disk', () => {
    for (const route of MATRIX.routes) {
      const declared = [route.source_helper, ...(route.shared_core || [])].filter(Boolean);
      for (const helper of declared) {
        assert.ok(fs.existsSync(path.resolve(REPO_ROOT, helper)), `${route.id}: missing helper ${helper}`);
      }
    }
  });

  it('matrix covers every neon helper source file exactly once', () => {
    const covered = new Map();
    for (const route of MATRIX.routes) {
      const declared = [route.source_helper, ...(route.shared_core || [])].filter(Boolean);
      for (const helper of declared) {
        assert.ok(!covered.has(helper), `${helper} classified by both ${covered.get(helper)} and ${route.id}`);
        covered.set(helper, route.id);
      }
    }
    for (const helper of collectDirectNeonHelpers()) {
      assert.ok(covered.has(helper), `${helper} exists on main but has no matrix entry`);
    }
  });

  it('matrix covers every LB_*_RUNTIME gate variable exactly once', () => {
    const seen = new Map();
    for (const route of MATRIX.routes) {
      if (!route.runtime_gate) continue;
      assert.ok(!seen.has(route.runtime_gate), `${route.runtime_gate} declared by both ${seen.get(route.runtime_gate)} and ${route.id}`);
      seen.set(route.runtime_gate, route.id);
    }
    const sourceGates = collectSourceGateVars();
    for (const gate of sourceGates) assert.ok(seen.has(gate), `${gate} referenced in functions/ but absent from matrix`);
    for (const gate of seen.keys()) assert.ok(sourceGates.has(gate), `${gate} in matrix but absent from functions/`);
  });

  it('checked-in Production gate flags match wrangler.toml exactly', () => {
    const wranglerGates = collectCheckedInGates();
    const matrixGates = new Set(
      MATRIX.routes.filter((r) => r.checked_in_gate === 'CHECKED_IN_PRODUCTION_GATE').map((r) => r.runtime_gate)
    );
    for (const gate of wranglerGates) assert.ok(matrixGates.has(gate), `${gate} checked in wrangler but not flagged in matrix`);
    for (const gate of matrixGates) assert.ok(wranglerGates.has(gate), `${gate} flagged in matrix but not checked in wrangler`);
  });

  it('required DB objects use bounded operation vocabulary', () => {
    const OPS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    for (const route of MATRIX.routes) {
      for (const [table, ops] of Object.entries(route.required_objects)) {
        assert.match(table, /^[a-z][a-z0-9_]*$/, `${route.id}: bad table ${table}`);
        assert.ok(Array.isArray(ops) && ops.length > 0, `${route.id}: ${table} needs operations`);
        for (const op of ops) assert.ok(OPS.has(op), `${route.id}: bad op ${op} on ${table}`);
      }
      if (route.source_state === 'SOURCE_READY' && !route.modal_retained_by_design) {
        assert.ok(Object.keys(route.required_objects).length > 0, `${route.id}: SOURCE_READY route must declare required objects`);
      }
    }
  });

  it('every route carries exact-head evidence and next action', () => {
    for (const route of MATRIX.routes) {
      assert.ok(route.last_exact_head_evidence.ref.length > 0, `${route.id}: evidence ref required`);
      assert.match(route.last_exact_head_evidence.main_sha, /^[a-f0-9]{40}$/, `${route.id}: evidence main_sha must be a full SHA`);
      assert.ok(route.next_action.length > 0, `${route.id}: next_action required`);
      assert.ok(Array.isArray(route.source_refs) && route.source_refs.length > 0, `${route.id}: source_refs required`);
    }
  });
});
