'use strict';

/**
 * SOURCE_STATIC contract for inactive expected-schema candidate builder.
 * No PostgreSQL, network, Production DB, or shell beyond local CLI spawn.
 * Refs #3549, #3544, #3542, #3458
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts', 'expected-schema-candidate-core.cjs');
const CLI = path.join(ROOT, 'scripts', 'build-expected-schema-candidate.cjs');
const PROVENANCE = path.join(ROOT, 'scripts', 'migration-provenance-core.cjs');
const FINGERPRINT = path.join(ROOT, 'scripts', 'migration-catalog-fingerprint-core.cjs');
const EXPECTED_SCHEMA = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const CANONICAL = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const FIX = path.join(ROOT, 'tests', 'contracts', 'fixtures', 'migration-provenance');
const PKG = path.join(ROOT, 'package.json');
const CLASS = path.join(ROOT, 'tests', 'test-layer-classification.json');

const core = require(CORE);
const provenance = require(PROVENANCE);
const fingerprint = require(FINGERPRINT);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function sampleEvidence() {
  const contract = fingerprint.loadJson(
    path.join(ROOT, 'db', 'migration-provenance', 'catalog-metadata-contract.json')
  );
  return fingerprint.buildCatalogEvidence(
    fingerprint.loadJson(path.join(FIX, 'catalog-baseline.json')),
    contract
  );
}

function template() {
  return readJson(EXPECTED_SCHEMA);
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    env: options.env || process.env,
  });
}

const START_EXPECTED_HASH = sha256File(EXPECTED_SCHEMA);
const START_CANONICAL_HASH = sha256File(CANONICAL);

test('committed expected-schema remains ADOPTION_REQUIRED populated and hash-stable', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.ok(expected.critical_objects.length >= 1, 'critical_objects >= 1: ' + expected.critical_objects.length);
  assert.equal(expected.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
});

test('committed canonical migrations remain ADOPTION_REQUIRED populated and hash-stable', () => {
  const canonical = readJson(CANONICAL);
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
  assert.equal(
    canonical.migrations[0].path,
    'db/migrations/20260802094500_bootstrap-migration-ledger.sql'
  );
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);
});

test('package script wires candidate builder CLI', () => {
  const pkg = readJson(PKG);
  assert.equal(
    pkg.scripts['build:expected-schema-candidate'],
    'node scripts/build-expected-schema-candidate.cjs'
  );
});

test('classification registers SOURCE_STATIC candidate contract', () => {
  const classification = readJson(CLASS);
  const entry = classification.entries.find(
    (item) => item.path === 'tests/contracts/expected-schema-candidate-contract.test.cjs'
  );
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.deepEqual(entry.capabilities, []);
});

test('baseline candidate builds with fixed inactive fields', () => {
  const evidence = sampleEvidence();
  const candidate = core.buildExpectedSchemaCandidate(evidence, template());
  assert.equal(candidate.status, 'ADOPTION_REQUIRED');
  assert.notEqual(candidate.status, 'ACTIVE');
  assert.equal(candidate.format_version, '1.0');
  assert.equal(candidate.normalizer_version, '1.0');
  assert.equal(candidate.fingerprint_algorithm, 'sha256');
  assert.equal(
    candidate.metadata_contract_path,
    'db/migration-provenance/catalog-metadata-contract.json'
  );
  assert.equal(typeof candidate.adoption_rule, 'string');
  assert.ok(Array.isArray(candidate.comparison_scope));
  assert.equal(candidate.critical_objects.length, evidence.objects.length);
  assert.equal(candidate.critical_objects[0].name, 'table:public.example_tree');
  assert.match(candidate.critical_objects[0].fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('reversed object order yields exact byte equality', () => {
  const evidence = sampleEvidence();
  const reversed = {
    format_version: evidence.format_version,
    normalizer_version: evidence.normalizer_version,
    objects: [...evidence.objects].reverse(),
  };
  const a = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(evidence, template())
  );
  const b = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(reversed, template())
  );
  assert.equal(a, b);
});

test('repeated build yields exact byte equality', () => {
  const evidence = sampleEvidence();
  const a = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(evidence, template())
  );
  const b = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(evidence, template())
  );
  assert.equal(a, b);
});

test('JSON key order changes in evidence objects yield byte equality', () => {
  const evidence = sampleEvidence();
  const rekeyed = {
    objects: evidence.objects.map((item) => ({
      fingerprint: item.fingerprint,
      name: item.name,
    })),
    normalizer_version: evidence.normalizer_version,
    format_version: evidence.format_version,
  };
  const a = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(evidence, template())
  );
  const b = core.serializeExpectedSchemaCandidate(
    core.buildExpectedSchemaCandidate(rekeyed, template())
  );
  assert.equal(a, b);
});

test('CRLF/LF evidence files yield exact byte equality', () => {
  const evidence = sampleEvidence();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-esc-'));
  try {
    const lfPath = path.join(dir, 'evidence-lf.json');
    const crlfPath = path.join(dir, 'evidence-crlf.json');
    const lf = `${JSON.stringify(evidence, null, 2)}\n`;
    const crlf = lf.replace(/\n/g, '\r\n');
    fs.writeFileSync(lfPath, lf, 'utf8');
    fs.writeFileSync(crlfPath, crlf, 'utf8');

    // Pure path: parse both and serialize candidates
    const a = core.serializeExpectedSchemaCandidate(
      core.buildExpectedSchemaCandidate(JSON.parse(fs.readFileSync(lfPath, 'utf8')), template())
    );
    const b = core.serializeExpectedSchemaCandidate(
      core.buildExpectedSchemaCandidate(JSON.parse(fs.readFileSync(crlfPath, 'utf8')), template())
    );
    assert.equal(a, b);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('object ordering is canonical code-point order without localeCompare', () => {
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [
      {
        name: 'view:public.z_view',
        fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        name: 'table:public.a_table',
        fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      {
        name: 'table:public.m_table',
        fingerprint: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
    ],
  };
  const candidate = core.buildExpectedSchemaCandidate(evidence, template());
  const names = candidate.critical_objects.map((o) => o.name);
  const sorted = [...names].sort(core.compareCodePoint);
  assert.deepEqual(names, sorted);
  assert.deepEqual(names, [
    'table:public.a_table',
    'table:public.m_table',
    'view:public.z_view',
  ]);
});

test('candidate passes existing validateExpectedSchemaManifest', () => {
  const candidate = core.buildExpectedSchemaCandidate(sampleEvidence(), template());
  const result = provenance.validateExpectedSchemaManifest(candidate);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  const local = core.validateCandidateAgainstContract(candidate);
  assert.equal(local.ok, true);
});

test('same-evidence compareSchema has no schema mismatch blockers', () => {
  const evidence = sampleEvidence();
  const candidate = core.buildExpectedSchemaCandidate(evidence, template());
  const blockers = provenance.compareSchema(candidate, evidence);
  assert.deepEqual(blockers, []);
});

test('overall gate remains GATE_ADOPTION_BASELINE_REQUIRED with candidate', () => {
  const evidence = sampleEvidence();
  const candidate = core.buildExpectedSchemaCandidate(evidence, template());
  const canonical = readJson(CANONICAL);
  const result = provenance.evaluateProvenance({
    migrationManifest: canonical,
    expectedSchemaManifest: candidate,
    ledgerEvidence: null,
    catalogEvidence: evidence,
  });
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_UNAVAILABLE'));
  assert.equal(
    result.blockers.some((b) => b.startsWith('GATE_SCHEMA_FINGERPRINT_MISMATCH:')),
    false
  );
});

test('output status always ADOPTION_REQUIRED and never ACTIVE', () => {
  const candidate = core.buildExpectedSchemaCandidate(sampleEvidence(), template());
  assert.equal(candidate.status, 'ADOPTION_REQUIRED');
  assert.notEqual(candidate.status, 'ACTIVE');
  const serialized = core.serializeExpectedSchemaCandidate(candidate);
  assert.match(serialized, /"status": "ADOPTION_REQUIRED"/);
  assert.equal(serialized.includes('"status": "ACTIVE"'), false);
});

function assertFail(fn, category) {
  assert.throws(fn, (error) => {
    assert.equal(error.category, category);
    const msg = String(error.message || '');
    assert.equal(msg.includes('postgres://'), false);
    assert.equal(msg.includes('sha256:'), false);
    assert.equal(msg.includes('table:public'), false);
    return true;
  });
}

test('rejection: missing evidence shape', () => {
  assertFail(() => core.validateCandidateEvidence(null), 'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID');
  assertFail(() => core.validateCandidateEvidence({}), 'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID');
});

test('rejection: unknown top-level field', () => {
  const evidence = sampleEvidence();
  evidence.extra = true;
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: unknown object field', () => {
  const evidence = sampleEvidence();
  evidence.objects[0].owner = 'x';
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID'
  );
});

test('rejection: unsupported format_version', () => {
  const evidence = sampleEvidence();
  evidence.format_version = '9.9';
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_FORMAT_MISMATCH'
  );
});

test('rejection: unsupported normalizer_version', () => {
  const evidence = sampleEvidence();
  evidence.normalizer_version = '2.0';
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_NORMALIZER_MISMATCH'
  );
});

test('rejection: objects not array', () => {
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects: {},
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: malformed object name', () => {
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects: [
            {
              name: 'public.example_tree',
              fingerprint:
                'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          ],
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID'
  );
});

test('rejection: malformed fingerprint', () => {
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects: [
            {
              name: 'table:public.example_tree',
              fingerprint: 'not-a-fingerprint',
            },
          ],
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_OBJECT_INVALID'
  );
});

test('rejection: duplicate object name', () => {
  const fp = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects: [
            { name: 'table:public.example_tree', fingerprint: fp },
            { name: 'table:public.example_tree', fingerprint: fp },
          ],
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_OBJECT_DUPLICATE'
  );
});

test('rejection: oversized objects', () => {
  const objects = [];
  for (let i = 0; i < core.LIMITS.max_objects + 1; i += 1) {
    objects.push({
      name: `table:public.obj_${i}`,
      fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  }
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects,
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_BOUNDS_EXCEEDED'
  );
});

test('rejection: caller-supplied status', () => {
  const evidence = sampleEvidence();
  evidence.status = 'ACTIVE';
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: caller-supplied critical_objects', () => {
  const evidence = sampleEvidence();
  evidence.critical_objects = [];
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: caller activation metadata', () => {
  const evidence = sampleEvidence();
  evidence.adoption_status = 'ATTESTED';
  assertFail(
    () => core.buildExpectedSchemaCandidate(evidence, template()),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: sensitive input markers in evidence file text', () => {
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-sensitive-evidence.json')
    .replace(/\\/g, '/');
  const abs = path.join(ROOT, rel);
  try {
    fs.writeFileSync(
      abs,
      [
        '{',
        '  "format_version": "1.0",',
        '  "normalizer_version": "1.0",',
        '  "objects": [],',
        '  "comment": "postgres://user:pass@host/db"',
        '}',
      ].join('\n'),
      'utf8'
    );
    assert.throws(
      () => core.readEvidenceFile(ROOT, rel),
      (error) => {
        assert.equal(error.category, 'EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT');
        assert.equal(String(error.message).includes('postgres://'), false);
        return true;
      }
    );
  } finally {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
});

test('rejection: raw metadata rows as objects', () => {
  assertFail(
    () =>
      core.buildExpectedSchemaCandidate(
        {
          format_version: '1.0',
          normalizer_version: '1.0',
          objects: [
            {
              schema: 'public',
              object_name: 'example_tree',
              object_kind: 'TABLE',
              columns: [],
            },
          ],
        },
        template()
      ),
    'EXPECTED_SCHEMA_CANDIDATE_SENSITIVE_INPUT'
  );
});

test('rejection: absolute path for evidence', () => {
  assertFail(
    () => core.assertRepoRelativePath(ROOT, path.resolve(ROOT, 'x.json')),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: repository escape path', () => {
  assertFail(
    () => core.assertRepoRelativePath(ROOT, '../outside.json'),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('rejection: committed manifest output target', () => {
  assertFail(
    () =>
      core.assertOutputNotCommittedManifest(
        ROOT,
        'db/migration-provenance/expected-schema-manifest.json'
      ),
    'EXPECTED_SCHEMA_CANDIDATE_OUTPUT_PROHIBITED'
  );
});

test('CLI requires --evidence and succeeds with repo-relative path', () => {
  const missing = runCli([]);
  assert.notEqual(missing.status, 0);
  const failPayload = JSON.parse(missing.stdout);
  assert.equal(failPayload.decision, 'FAIL_CLOSED');
  assert.ok(failPayload.blockers.includes('EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'));

  const evidence = sampleEvidence();
  const dir = path.join(ROOT, 'tests', 'contracts', 'fixtures', 'migration-provenance');
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-candidate-evidence.json')
    .replace(/\\/g, '/');
  const abs = path.join(ROOT, rel);
  try {
    fs.writeFileSync(abs, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    const ok = runCli(['--evidence', rel]);
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    const candidate = JSON.parse(ok.stdout);
    assert.equal(candidate.status, 'ADOPTION_REQUIRED');
    assert.ok(candidate.critical_objects.length >= 1);
    assert.equal(ok.stdout.includes('FAIL_CLOSED'), false);
  } finally {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
});

test('CLI rejects absolute evidence path without leaking value', () => {
  const abs = path.join(ROOT, 'tests', 'contracts', 'fixtures', 'migration-provenance', 'catalog-baseline.json');
  const result = runCli(['--evidence', abs]);
  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.equal(result.stdout.includes(abs), false);
});

test('CLI rejects invalid JSON fail-closed', () => {
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-bad.json')
    .replace(/\\/g, '/');
  const abs = path.join(ROOT, rel);
  try {
    fs.writeFileSync(abs, '{not-json', 'utf8');
    const result = runCli(['--evidence', rel]);
    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.decision, 'FAIL_CLOSED');
    assert.ok(payload.blockers.includes('EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'));
  } finally {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
});

test('CLI rejects repository-local symlink escaping root', (t) => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-esc-outside-'));
  const outsideFileName = 'external-escape-evidence.json';
  const outsideFile = path.join(outsideDir, outsideFileName);
  const rel = path
    .join(
      'tests',
      'contracts',
      'fixtures',
      'migration-provenance',
      '_tmp-symlink-escape-evidence.json'
    )
    .replace(/\\/g, '/');
  const linkPath = path.join(ROOT, rel);
  try {
    fs.writeFileSync(outsideFile, `${JSON.stringify(sampleEvidence(), null, 2)}\n`, 'utf8');
    try {
      if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
      fs.symlinkSync(outsideFile, linkPath);
    } catch (error) {
      if (
        process.platform === 'win32' &&
        (error.code === 'EPERM' || error.code === 'EACCES')
      ) {
        t.skip('Windows symlink privilege unavailable');
        return;
      }
      throw error;
    }

    const result = runCli(['--evidence', rel]);
    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.decision, 'FAIL_CLOSED');
    assert.equal(payload.mode, 'EXPECTED_SCHEMA_CANDIDATE_BUILD');
    assert.ok(payload.blockers.includes('EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'));
    assert.equal(result.stdout.includes(outsideFile), false);
    assert.equal(result.stdout.includes(outsideDir), false);
    assert.equal(result.stdout.includes(outsideFileName), false);
    assert.equal(result.stdout.includes('critical_objects'), false);
    assert.equal(/"status"\s*:\s*"ADOPTION_REQUIRED"/.test(result.stdout), false);
  } finally {
    try {
      fs.lstatSync(linkPath);
      fs.unlinkSync(linkPath);
    } catch {
      // best-effort cleanup when link was never created or already removed
    }
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('readEvidenceFile rejects absolute path argument as relative input', () => {
  assertFail(
    () => core.readEvidenceFile(ROOT, path.resolve(ROOT, 'package.json')),
    'EXPECTED_SCHEMA_CANDIDATE_INPUT_INVALID'
  );
});

test('resolveRepoConfinedEvidencePath accepts in-repo regular file', () => {
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', 'catalog-baseline.json')
    .replace(/\\/g, '/');
  const resolved = core.resolveRepoConfinedEvidencePath(ROOT, rel);
  assert.ok(resolved.realEvidence);
  assert.equal(core.isPathOutside(resolved.realRoot, resolved.realEvidence), false);
});

test('future-safe populated template with two critical objects builds PASS', () => {
  const twoObjectTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.schema_migration_ledger',
        fingerprint: 'sha256:961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1',
      },
      {
        name: 'table:public.example_tree',
        fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  const evidence = sampleEvidence();
  const candidate = core.buildExpectedSchemaCandidate(evidence, twoObjectTemplate);
  assert.equal(candidate.status, 'ADOPTION_REQUIRED');
  assert.equal(candidate.critical_objects.length, evidence.objects.length);
  assert.ok(candidate.critical_objects.length >= 2);
});

test('candidate critical_objects are evidence-only, not copied from template', () => {
  const templateWithExtraObject = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.template_only_object',
        fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  const evidence = sampleEvidence();
  const candidate = core.buildExpectedSchemaCandidate(evidence, templateWithExtraObject);
  const evidenceNames = new Set(evidence.objects.map((o) => o.name));
  const candidateNames = new Set(candidate.critical_objects.map((o) => o.name));
  assert.equal(candidateNames.has('table:public.template_only_object'), false);
  assert.deepEqual(candidateNames, evidenceNames);
});

test('rejection: template with ACTIVE status', () => {
  const activeTemplate = {
    format_version: '1.0',
    status: 'ACTIVE',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.schema_migration_ledger',
        fingerprint: 'sha256:961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), activeTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('rejection: template with non-array critical_objects', () => {
  const badTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: 'not-an-array',
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), badTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('rejection: template with malformed object name in critical_objects', () => {
  const badTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'public.example_tree',
        fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), badTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('rejection: template with malformed fingerprint in critical_objects', () => {
  const badTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.schema_migration_ledger',
        fingerprint: 'not-a-fingerprint',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), badTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('rejection: template with unknown manifest field rejected by validator', () => {
  const badTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '2.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.schema_migration_ledger',
        fingerprint: 'sha256:961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: ['columns', 'types', 'nullability'],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), badTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('rejection: template with invalid comparison_scope', () => {
  const badTemplate = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    fingerprint_algorithm: 'sha256',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [
      {
        name: 'table:public.schema_migration_ledger',
        fingerprint: 'sha256:961d195776eaa245e4e63620a35f19a4de2dbe2f00dbd8b94faffb70ce2332d1',
      },
    ],
    adoption_rule: 'No live catalog snapshot or historical application record is committed here.',
    comparison_scope: [],
  };
  assertFail(
    () => core.buildExpectedSchemaCandidate(sampleEvidence(), badTemplate),
    'EXPECTED_SCHEMA_CANDIDATE_VALIDATION_FAILED'
  );
});

test('source negative control: no cardinality hardcode in core', () => {
  const coreSource = fs.readFileSync(CORE, 'utf8');
  assert.equal(coreSource.includes('critical_objects.length !== 0'), false);
  assert.equal(coreSource.includes('critical_objects.length !== 1'), false);
  assert.equal(coreSource.includes('critical_objects.length === 1'), false);
});

test('post-suite committed manifests still unchanged', () => {
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);
  assert.equal(readJson(EXPECTED_SCHEMA).status, 'ADOPTION_REQUIRED');
  assert.ok(readJson(EXPECTED_SCHEMA).critical_objects.length >= 1, 'critical_objects >= 1: ' + readJson(EXPECTED_SCHEMA).critical_objects.length);
  assert.equal(
    readJson(EXPECTED_SCHEMA).critical_objects[0].name,
    'table:public.schema_migration_ledger'
  );
  assert.equal(readJson(CANONICAL).status, 'ADOPTION_REQUIRED');
  assert.ok(readJson(CANONICAL).migrations.length >= 1, 'migrations >= 1: ' + readJson(CANONICAL).migrations.length);
  assert.equal(
    readJson(CANONICAL).migrations[0].id,
    '20260802094500_bootstrap-migration-ledger'
  );
});
