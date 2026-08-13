'use strict';

/**
 * SOURCE_STATIC contract for inactive PREPARED_ONLY adoption-baseline collection plan.
 * No PostgreSQL, network, Production DB, shell beyond local CLI spawn.
 * Refs #3555, #3553, #3549, #3458
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts', 'adoption-baseline-collection-plan-core.cjs');
const CLI = path.join(ROOT, 'scripts', 'build-adoption-baseline-collection-plan.cjs');
const CONTRACT_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'adoption-baseline-collection-plan-contract.json'
);
const EXPECTED_SCHEMA = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const CANONICAL = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const PKG = path.join(ROOT, 'package.json');
const CLASS = path.join(ROOT, 'tests', 'test-layer-classification.json');
const ADAPTER_CORE = path.join(ROOT, 'scripts', 'migration-catalog-postgres-adapter-core.cjs');
const PROVENANCE = path.join(ROOT, 'scripts', 'migration-provenance-core.cjs');

const core = require(CORE);
const provenance = require(PROVENANCE);
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

const BASELINE = '79ba1085b7b7860ca4910acc39cacdb16ed63a4e';
const APPROVAL = 'issue:3555';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function assertFail(fn, category) {
  assert.throws(fn, (error) => {
    assert.equal(error.category, category);
    const msg = String(error.message || '');
    assert.equal(msg.includes('postgres://'), false);
    assert.equal(msg.includes(BASELINE), false);
    return true;
  });
}

const START_EXPECTED_HASH = sha256File(EXPECTED_SCHEMA);
const START_CANONICAL_HASH = sha256File(CANONICAL);

test('contract validates and exposes exact fixed policy fields', () => {
  assert.equal(core.validateCollectionPlanContract(contract), true);
  const trusted = core.loadTrustedCollectionPlanContract();
  assert.equal(trusted.contractDigest, core.computeExactBytesDigest(fs.readFileSync(CONTRACT_PATH)));
  assert.deepEqual(contract.fixed_field_values, {
    format_version: '1.0',
    plan_status: 'PREPARED_ONLY',
    environment_class: 'PRODUCTION',
    attestation_scope: 'PRODUCTION_READONLY',
    collection_mode: 'CATALOG_METADATA_ONLY',
    output_policy: 'SANITIZED_STDOUT_ONLY',
  });
  for (const field of [
    'format_version',
    'plan_status',
    'baseline_commit',
    'environment_class',
    'attestation_scope',
    'approval_reference',
    'collection_mode',
    'output_policy',
    'object_allowlist',
    'role_mapping_classes',
    'required_read_only_proofs',
    'expected_outputs',
    'contract_path',
    'digest_algorithm',
    'collection_plan_contract_digest',
    'object_allowlist_digest',
  ]) {
    assert.ok(contract.required_top_level_fields.includes(field), field);
  }
  assert.ok(contract.enums.plan_status.includes('PREPARED_ONLY'));
  assert.ok(contract.enums.environment_class.includes('PRODUCTION'));
  assert.ok(contract.enums.attestation_scope.includes('PRODUCTION_READONLY'));
  assert.ok(contract.enums.collection_mode.includes('CATALOG_METADATA_ONLY'));
  assert.ok(contract.enums.output_policy.includes('SANITIZED_STDOUT_ONLY'));
  assert.ok(Array.isArray(contract.reviewed_object_allowlist));
  assert.ok(contract.reviewed_object_allowlist.length >= 1);
});

test('classification and package wiring', () => {
  const classification = readJson(CLASS);
  const entry = classification.entries.find(
    (item) => item.path === 'tests/contracts/adoption-baseline-collection-plan-contract.test.cjs'
  );
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.deepEqual(entry.capabilities, []);
  const pkg = readJson(PKG);
  assert.equal(
    pkg.scripts['build:adoption-baseline-collection-plan'],
    'node scripts/build-adoption-baseline-collection-plan.cjs'
  );
});

test('builder emits fixed PREPARED_ONLY PRODUCTION plan with reviewed allowlist', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assert.equal(plan.plan_status, 'PREPARED_ONLY');
  assert.equal(plan.environment_class, 'PRODUCTION');
  assert.equal(plan.attestation_scope, 'PRODUCTION_READONLY');
  assert.equal(plan.collection_mode, 'CATALOG_METADATA_ONLY');
  assert.equal(plan.output_policy, 'SANITIZED_STDOUT_ONLY');
  assert.equal(plan.baseline_commit, BASELINE);
  assert.equal(plan.approval_reference, APPROVAL);
  assert.equal(plan.object_allowlist.length, contract.reviewed_object_allowlist.length);
  const names = plan.object_allowlist.map((o) => o.name);
  assert.deepEqual(names, [...names].sort(core.compareCodePoint));
  assert.match(plan.plan_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.object_allowlist_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.collection_plan_contract_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    plan.collection_plan_contract_digest,
    core.computeExactBytesDigest(fs.readFileSync(CONTRACT_PATH))
  );
  assert.equal(plan.contract_path, 'db/migration-provenance/adoption-baseline-collection-plan-contract.json');
  assert.equal(plan.digest_algorithm, 'sha256');
  assert.ok(plan.role_mapping_classes.includes('PUBLIC'));
  assert.ok(plan.role_mapping_classes.includes('AUTHENTICATED'));
  assert.ok(plan.required_read_only_proofs.includes('NO_CALLER_SQL'));
  assert.ok(plan.expected_outputs.includes('PREPARED_ATTESTATION_DRAFT'));
  assert.equal(plan.expected_outputs.includes('ATTESTED'), false);
});

test('deterministic serialization and digests', () => {
  const a = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const b = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assert.equal(core.serializePreparedCollectionPlan(a), core.serializePreparedCollectionPlan(b));
  assert.equal(a.plan_digest, b.plan_digest);
  assert.equal(a.object_allowlist_digest, b.object_allowlist_digest);
  assert.equal(a.collection_plan_contract_digest, b.collection_plan_contract_digest);

  const reversed = {
    ...a,
    object_allowlist: [...a.object_allowlist].reverse(),
  };
  delete reversed.plan_digest;
  const validated = core.validatePreparedCollectionPlan(reversed).plan;
  assert.equal(validated.plan_digest, a.plan_digest);
  assert.equal(validated.object_allowlist_digest, a.object_allowlist_digest);
});

test('missing/malformed baseline commit fails', () => {
  assertFail(
    () => core.buildPreparedCollectionPlan({ baselineCommit: '', approvalReference: APPROVAL }),
    'COLLECTION_PLAN_COMMIT_INVALID'
  );
  assertFail(
    () =>
      core.buildPreparedCollectionPlan({
        baselineCommit: '79ba1085b7b7860ca4910acc39cacdb16ed63a4',
        approvalReference: APPROVAL,
      }),
    'COLLECTION_PLAN_COMMIT_INVALID'
  );
  assertFail(
    () =>
      core.buildPreparedCollectionPlan({
        baselineCommit: BASELINE.toUpperCase(),
        approvalReference: APPROVAL,
      }),
    'COLLECTION_PLAN_COMMIT_INVALID'
  );
});

test('malformed and free-text approval fails', () => {
  for (const bad of ['approved', 'yes', 'owner-approved', 'ok', 'issue:', 'decision:']) {
    assertFail(
      () => core.buildPreparedCollectionPlan({ baselineCommit: BASELINE, approvalReference: bad }),
      'COLLECTION_PLAN_APPROVAL_INVALID'
    );
  }
});

test('missing or empty allowlist fails', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const missing = { ...plan };
  delete missing.object_allowlist;
  delete missing.plan_digest;
  assertFail(() => core.validatePreparedCollectionPlan(missing), 'COLLECTION_PLAN_FIELD_MISSING');

  const empty = { ...plan, object_allowlist: [] };
  delete empty.plan_digest;
  assertFail(() => core.validatePreparedCollectionPlan(empty), 'COLLECTION_PLAN_OBJECT_INVALID');
});

test('duplicate / unknown / malformed object records fail', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const base = plan.object_allowlist[0];

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [...plan.object_allowlist, { ...base }],
      }),
    'COLLECTION_PLAN_OBJECT_DUPLICATE'
  );

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [
          ...contract.reviewed_object_allowlist.slice(0, -1),
          {
            name: 'table:public.not_in_review',
            kind: 'TABLE',
            metadata_categories: base.metadata_categories,
            rationale_code: base.rationale_code,
          },
        ],
      }),
    'COLLECTION_PLAN_OBJECT_UNKNOWN'
  );

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [
          {
            name: 'public.trees',
            kind: 'TABLE',
            metadata_categories: base.metadata_categories,
            rationale_code: base.rationale_code,
          },
        ],
      }),
    'COLLECTION_PLAN_OBJECT_INVALID'
  );

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [
          {
            name: 'table:public.trees',
            kind: 'VIEW',
            metadata_categories: base.metadata_categories,
            rationale_code: 'CORE_TREE_IDENTITY',
          },
        ],
      }),
    'COLLECTION_PLAN_OBJECT_INVALID'
  );

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [
          {
            name: 'table:public.trees',
            kind: 'TABLE',
            metadata_categories: ['not_a_category'],
            rationale_code: 'CORE_TREE_IDENTITY',
          },
        ],
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist: [
          {
            name: 'table:public.trees',
            kind: 'TABLE',
            metadata_categories: base.metadata_categories,
            rationale_code: 'CORE_TREE_IDENTITY',
            owner: 'x',
          },
        ],
      }),
    'COLLECTION_PLAN_UNKNOWN_FIELD'
  );
});

test('wrong fixed status/environment/scope/mode/policy fails', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  for (const [field, value, category] of [
    ['plan_status', 'ATTESTED', 'COLLECTION_PLAN_STATUS_INVALID'],
    ['plan_status', 'ACTIVE', 'COLLECTION_PLAN_STATUS_INVALID'],
    ['plan_status', 'APPLIED', 'COLLECTION_PLAN_STATUS_INVALID'],
    ['plan_status', 'APPROVED_FOR_MUTATION', 'COLLECTION_PLAN_STATUS_INVALID'],
    ['environment_class', 'STAGING', 'COLLECTION_PLAN_ENUM_INVALID'],
    ['attestation_scope', 'DISPOSABLE_CI', 'COLLECTION_PLAN_ENUM_INVALID'],
    ['collection_mode', 'ROW_SCAN', 'COLLECTION_PLAN_ENUM_INVALID'],
    ['output_policy', 'WRITE_FILES', 'COLLECTION_PLAN_ENUM_INVALID'],
  ]) {
    const mutated = { ...plan, [field]: value };
    assertFail(() => core.validatePreparedCollectionPlan(mutated), category);
  }
});

test('raw role fields and values fail', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assertFail(
    () => core.validatePreparedCollectionPlan({ ...plan, raw_role: 'postgres' }),
    'COLLECTION_PLAN_SENSITIVE_INPUT'
  );
  assertFail(
    () => core.validatePreparedCollectionPlan({ ...plan, role_mapping_classes: ['postgres'] }),
    'COLLECTION_PLAN_ROLE_INVALID'
  );
  assertFail(
    () => core.validatePreparedCollectionPlan({ ...plan, role_mapping_classes: ['UNKNOWN_CLASS'] }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
});

test('proof and output enums are mandatory and exact', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });

  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        required_read_only_proofs: plan.required_read_only_proofs.slice(1),
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        required_read_only_proofs: [...plan.required_read_only_proofs, 'UNKNOWN_PROOF'],
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        required_read_only_proofs: [
          ...plan.required_read_only_proofs,
          plan.required_read_only_proofs[0],
        ],
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        expected_outputs: plan.expected_outputs.slice(1),
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        expected_outputs: [...plan.expected_outputs, 'ATTESTED'],
      }),
    'COLLECTION_PLAN_ENUM_INVALID'
  );
});

test('sensitive nested values and oversized inputs fail', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        approval_reference: 'decision:postgres://bad',
      }),
    'COLLECTION_PLAN_SENSITIVE_INPUT'
  );
  const huge = Array.from({ length: 100 }, (_, i) => ({
    name: `table:public.obj_${i}`,
    kind: 'TABLE',
    metadata_categories: plan.object_allowlist[0].metadata_categories,
    rationale_code: 'CORE_TREE_IDENTITY',
  }));
  assertFail(
    () => core.validatePreparedCollectionPlan({ ...plan, object_allowlist: huge }),
    'COLLECTION_PLAN_BOUNDS_EXCEEDED'
  );
});

test('path confinement and prohibited targets', () => {
  assertFail(
    () => core.assertRepoRelativePath(ROOT, path.resolve(ROOT, 'package.json')),
    'COLLECTION_PLAN_PATH_INVALID'
  );
  assertFail(
    () => core.assertRepoRelativePath(ROOT, '../outside.json'),
    'COLLECTION_PLAN_PATH_INVALID'
  );
  assertFail(
    () => core.readPreparedCollectionPlanFile(ROOT, 'db/migration-provenance'),
    'COLLECTION_PLAN_PATH_INVALID'
  );
  assertFail(
    () =>
      core.readPreparedCollectionPlanFile(
        ROOT,
        'tests/contracts/fixtures/migration-provenance/_missing-plan.json'
      ),
    'COLLECTION_PLAN_PATH_INVALID'
  );
  assertFail(
    () =>
      core.assertOutputNotProhibited(
        ROOT,
        'db/migration-provenance/expected-schema-manifest.json'
      ),
    'COLLECTION_PLAN_OUTPUT_PROHIBITED'
  );
});

test('invalid JSON file fails closed', () => {
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-plan-bad.json')
    .replace(/\\/g, '/');
  const abs = path.join(ROOT, rel);
  try {
    fs.writeFileSync(abs, '{not-json', 'utf8');
    assertFail(() => core.readPreparedCollectionPlanFile(ROOT, rel), 'COLLECTION_PLAN_INPUT_INVALID');
  } finally {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
});

test('repository-local symlink escape fails', (t) => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-plan-outside-'));
  const outsideName = 'external-plan.json';
  const outsideFile = path.join(outsideDir, outsideName);
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-plan-symlink.json')
    .replace(/\\/g, '/');
  const linkPath = path.join(ROOT, rel);
  try {
    const plan = core.buildPreparedCollectionPlan({
      baselineCommit: BASELINE,
      approvalReference: APPROVAL,
    });
    fs.writeFileSync(outsideFile, core.serializePreparedCollectionPlan(plan), 'utf8');
    try {
      fs.symlinkSync(outsideFile, linkPath);
    } catch (error) {
      if (process.platform === 'win32' && (error.code === 'EPERM' || error.code === 'EACCES')) {
        t.skip('Windows symlink privilege unavailable');
        return;
      }
      throw error;
    }
    assert.throws(
      () => core.readPreparedCollectionPlanFile(ROOT, rel),
      (error) => {
        assert.equal(error.category, 'COLLECTION_PLAN_PATH_INVALID');
        assert.equal(String(error.message).includes(outsideName), false);
        return true;
      }
    );
  } finally {
    try {
      fs.lstatSync(linkPath);
      fs.unlinkSync(linkPath);
    } catch {
      // ignore
    }
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('CLI succeeds and fails without leaking values', () => {
  const ok = runCli(['--baseline-commit', BASELINE, '--approval-reference', APPROVAL]);
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  const plan = JSON.parse(ok.stdout);
  assert.equal(plan.plan_status, 'PREPARED_ONLY');
  assert.equal(plan.environment_class, 'PRODUCTION');

  const missing = runCli(['--baseline-commit', BASELINE]);
  assert.notEqual(missing.status, 0);
  const payload = JSON.parse(missing.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.ok(payload.blockers.includes('COLLECTION_PLAN_INPUT_INVALID'));

  const badSha = runCli(['--baseline-commit', 'ABCDEF', '--approval-reference', APPROVAL]);
  assert.notEqual(badSha.status, 0);
  assert.equal(badSha.stdout.includes('ABCDEF'), false);
});

test('no DB/network/shell/env credential surface in new modules', () => {
  const coreSrc = fs.readFileSync(CORE, 'utf8');
  const cliSrc = fs.readFileSync(CLI, 'utf8');
  for (const body of [coreSrc, cliSrc]) {
    assert.doesNotMatch(body, /require\(['"](?:pg|postgres|child_process|net|tls|http|https|node:child_process|node:net|node:http|node:https)['"]\)/);
    assert.doesNotMatch(body, /\bfetch\s*\(/);
    assert.doesNotMatch(body, /\bDATABASE_URL\b/);
    assert.doesNotMatch(body, /spawnSync|execSync|exec\(|spawn\(/);
    assert.doesNotMatch(body, /writeFileSync|createWriteStream/);
    assert.doesNotMatch(body, /process\.env\.[A-Z0-9_]+/);
  }
});

test('existing disposable adapter restrictions unchanged', () => {
  const adapter = fs.readFileSync(ADAPTER_CORE, 'utf8');
  assert.match(adapter, /127\.0\.0\.1|localhost|::1/);
  assert.match(adapter, /BEGIN READ ONLY|transaction_read_only|assertNoCatalogMutation/);
  assert.match(adapter, /No DATABASE_URL|no DATABASE_URL/i);
  assert.doesNotMatch(adapter, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(adapter, /neon\.tech|cloud\.neon/);
});
test('manifests remain populated/inactive and gate keeps adoption baseline blocker', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.ok(expected.critical_objects.length >= 1, 'critical_objects >= 1: ' + expected.critical_objects.length);
  assert.equal(expected.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);

  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const result = provenance.evaluateProvenance({
    migrationManifest: canonical,
    expectedSchemaManifest: expected,
    ledgerEvidence: null,
    catalogEvidence: null,
  });
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  // Building a plan does not satisfy attestation or activate manifests.
  assert.equal(plan.plan_status, 'PREPARED_ONLY');
  assert.notEqual(plan.plan_status, 'ATTESTED');
});

test('architecture doc records phase sequence and non-claims', () => {
  const design = fs.readFileSync(
    path.join(ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md'),
    'utf8'
  );
  assert.ok(design.includes('Phase A:'));
  assert.ok(design.includes('Phase B:'));
  assert.ok(design.includes('Phase C:'));
  assert.ok(design.includes('Phase D:'));
  assert.ok(design.includes('Phase E:'));
  assert.ok(design.includes('PREPARED_ONLY'));
  assert.ok(design.includes('grants **no** target access'));
  assert.ok(design.includes('Keep #1882 OPEN.'));
  assert.doesNotMatch(design, /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i);
});

function maliciousContract(overrides) {
  return {
    ...structuredClone(contract),
    ...overrides,
    fixed_field_values: {
      ...contract.fixed_field_values,
      ...(overrides.fixed_field_values || {}),
    },
    patterns: {
      ...contract.patterns,
      ...(overrides.patterns || {}),
    },
    digest_domains: {
      ...contract.digest_domains,
      ...(overrides.digest_domains || {}),
    },
    limits: {
      ...contract.limits,
      ...(overrides.limits || {}),
    },
  };
}

function assertCanonicalPlan(plan) {
  assert.equal(plan.plan_status, 'PREPARED_ONLY');
  assert.equal(plan.environment_class, 'PRODUCTION');
  assert.equal(plan.attestation_scope, 'PRODUCTION_READONLY');
  assert.equal(plan.collection_mode, 'CATALOG_METADATA_ONLY');
  assert.equal(plan.output_policy, 'SANITIZED_STDOUT_ONLY');
  assert.equal(plan.contract_path, core.DEFAULT_CONTRACT_REL);
  assert.equal(plan.digest_algorithm, 'sha256');
  assert.deepEqual(
    plan.object_allowlist.map((o) => o.name).sort(core.compareCodePoint),
    contract.reviewed_object_allowlist.map((o) => o.name).sort(core.compareCodePoint)
  );
  assert.deepEqual([...plan.role_mapping_classes].sort(), [...core.CANONICAL_ROLE_CLASSES].sort());
  assert.deepEqual([...plan.required_read_only_proofs].sort(), [...core.CANONICAL_PROOFS].sort());
  assert.deepEqual([...plan.expected_outputs].sort(), [...core.CANONICAL_OUTPUTS].sort());
  assert.equal(
    plan.collection_plan_contract_digest,
    core.computeExactBytesDigest(fs.readFileSync(CONTRACT_PATH))
  );
}

test('adversarial second-arg contract cannot override public builder policy', () => {
  const canonical = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const cases = [
    maliciousContract({ fixed_field_values: { plan_status: 'APPLIED' } }),
    maliciousContract({ fixed_field_values: { environment_class: 'STAGING' } }),
    maliciousContract({ fixed_field_values: { attestation_scope: 'DISPOSABLE_CI' } }),
    maliciousContract({
      reviewed_object_allowlist: [
        {
          name: 'table:public.evil',
          kind: 'TABLE',
          metadata_categories: ['columns'],
          rationale_code: 'CORE_TREE_IDENTITY',
        },
      ],
      object_selection_evidence: {
        'table:public.evil': {
          repository_evidence: ['package.json'],
          why_critical: 'evil',
        },
      },
    }),
    maliciousContract({ mandatory_read_only_proofs: [] }),
    maliciousContract({ mandatory_expected_outputs: [] }),
    maliciousContract({
      mandatory_expected_outputs: [...contract.mandatory_expected_outputs, 'ATTESTED'],
    }),
    maliciousContract({
      role_mapping_classes: ['PUBLIC', 'postgres', 'DATABASE_OWNER'],
      enums: {
        ...contract.enums,
        role_mapping_class: ['PUBLIC', 'postgres', 'DATABASE_OWNER'],
      },
    }),
    maliciousContract({ prohibited_plan_statuses: [] }),
    maliciousContract({
      patterns: { baseline_commit: '.*', approval_reference: '.*' },
    }),
    maliciousContract({ sensitive_content_markers: [] }),
    maliciousContract({
      digest_domains: {
        collection_plan: 'evil:domain',
        object_allowlist: 'evil:allowlist',
      },
    }),
    maliciousContract({ limits: { max_objects: 1 } }),
    maliciousContract({
      contract_path: 'db/migration-provenance/evil-contract.json',
    }),
    maliciousContract({ digest_algorithm: 'sha1' }),
  ];

  for (const evil of cases) {
    const plan = core.buildPreparedCollectionPlan(
      { baselineCommit: BASELINE, approvalReference: APPROVAL },
      evil
    );
    assertCanonicalPlan(plan);
    assert.equal(plan.plan_digest, canonical.plan_digest);
    assert.equal(core.serializePreparedCollectionPlan(plan), core.serializePreparedCollectionPlan(canonical));
  }
});

test('public builder and validator use only canonical trusted contract', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assertCanonicalPlan(plan);
  const validated = core.validatePreparedCollectionPlan(plan).plan;
  assert.equal(validated.plan_digest, plan.plan_digest);
  const withEvil = core.validatePreparedCollectionPlan(
    plan,
    maliciousContract({ fixed_field_values: { plan_status: 'APPLIED' } })
  ).plan;
  assert.equal(withEvil.plan_digest, plan.plan_digest);
  assert.equal(withEvil.plan_status, 'PREPARED_ONLY');
});

test('exact-byte contract digest and whitespace-only difference', () => {
  const bytes = fs.readFileSync(CONTRACT_PATH);
  const exact = core.computeExactBytesDigest(bytes);
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assert.equal(plan.collection_plan_contract_digest, exact);
  const whitespaceDiff = core.computeExactBytesDigest(Buffer.concat([bytes, Buffer.from(' ')]));
  assert.notEqual(exact, whitespaceDiff);
  assert.match(exact, /^sha256:[a-f0-9]{64}$/);
});

test('modified contract digest / path / algorithm fail closed', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        collection_plan_contract_digest:
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      }),
    'COLLECTION_PLAN_CONTRACT_DIGEST_MISMATCH'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        contract_path: 'db/migration-provenance/evil-contract.json',
      }),
    'COLLECTION_PLAN_INPUT_INVALID'
  );
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        digest_algorithm: 'sha1',
      }),
    'COLLECTION_PLAN_INPUT_INVALID'
  );
});

test('plan digest binds contract path, algorithm, contract digest, allowlist digest', () => {
  const plan = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const payload = { ...plan };
  delete payload.plan_digest;
  const recomputed = core.computeCollectionPlanDigest(payload);
  assert.equal(recomputed, plan.plan_digest);

  // Changing bound fields without matching plan_digest fails.
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        contract_path: 'db/migration-provenance/evil-contract.json',
        plan_digest: plan.plan_digest,
      }),
    'COLLECTION_PLAN_INPUT_INVALID'
  );

  // Allowlist digest mismatch.
  assertFail(
    () =>
      core.validatePreparedCollectionPlan({
        ...plan,
        object_allowlist_digest:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      }),
    'COLLECTION_PLAN_DIGEST_MISMATCH'
  );

  // plan_digest must include object_allowlist_digest in its payload.
  const withoutAllowlistDigest = { ...payload };
  delete withoutAllowlistDigest.object_allowlist_digest;
  assert.notEqual(core.computeCollectionPlanDigest(withoutAllowlistDigest), plan.plan_digest);

  const withoutContractDigest = { ...payload };
  delete withoutContractDigest.collection_plan_contract_digest;
  assert.notEqual(core.computeCollectionPlanDigest(withoutContractDigest), plan.plan_digest);

  const withoutPath = { ...payload };
  delete withoutPath.contract_path;
  assert.notEqual(core.computeCollectionPlanDigest(withoutPath), plan.plan_digest);

  const withoutAlgo = { ...payload };
  delete withoutAlgo.digest_algorithm;
  assert.notEqual(core.computeCollectionPlanDigest(withoutAlgo), plan.plan_digest);
});

test('CLI and programmatic builder produce the same canonical plan', () => {
  const programmatic = core.buildPreparedCollectionPlan({
    baselineCommit: BASELINE,
    approvalReference: APPROVAL,
  });
  const ok = runCli(['--baseline-commit', BASELINE, '--approval-reference', APPROVAL]);
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.equal(ok.stdout, core.serializePreparedCollectionPlan(programmatic));
  const again = runCli(['--baseline-commit', BASELINE, '--approval-reference', APPROVAL]);
  assert.equal(again.stdout, ok.stdout);
});

test('post-suite manifests still unchanged', () => {
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);
});
