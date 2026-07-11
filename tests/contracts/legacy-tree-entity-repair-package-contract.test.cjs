/**
 * Focused contract tests for the corrected legacy orphan tree entity repair
 * package (Issue #3455 / PR #3456).
 *
 * These tests verify the prepare-legacy-tree-entity-repair.cjs script behavior
 * without connecting to Production or using real recovery data.
 *
 * Refs #3455, #3437, #3435, #3441, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'prepare-legacy-tree-entity-repair.cjs');

// ─── Synthetic test values ─────────────────────────────────────────────────

const VALID_MAPPING = {
  schemaVersion: 1,
  sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
  records: [
    {
      treeId: 'synthetic-test-001',
      ownerId: 'synth-owner-alpha',
      title: 'Synthetic Alpha Tree',
      ownerProvenance: 'AUTHORITATIVE_SERVER_RETURNED_FIELD',
      titleProvenance: 'AUTHORITATIVE_SERVER_RETURNED_FIELD',
      visibility: 'public',
      groupName: null,
      keywords: [],
      createdAt: null,
      updatedAt: null,
    },
  ],
};

const VALID_PREFLIGHT = {
  schemaVersion: 1,
  sourceClassification: 'PRODUCTION_READ_ONLY_PREFLIGHT',
  records: [
    {
      treeId: 'synthetic-test-001',
      entityExists: false,
      publicMomentCount: 4,
    },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function runScript(argsStr) {
  try {
    const output = execSync(`node "${SCRIPT_PATH}" ${argsStr}`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
    };
  }
}

function createExternalFixture(data) {
  const tmpDir = fs.mkdtempSync(
    path.join(require('os').tmpdir(), 'repair-pkg-')
  );
  const tmpFile = path.join(tmpDir, 'input.json');
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  return {
    path: tmpFile,
    dir: tmpDir,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

function runValidate(mappingData) {
  const m = createExternalFixture(mappingData);
  try {
    return { result: runScript(`--validate "${m.path}"`), cleanup: m.cleanup };
  } catch (e) {
    m.cleanup();
    throw e;
  }
}

// Helper that properly cleans up both fixtures
function createTwoFixtures(mappingData, preflightData) {
  const m = createExternalFixture(mappingData);
  const p = createExternalFixture(preflightData);
  return {
    mappingPath: m.path,
    preflightPath: p.path,
    mappingDir: m.dir,
    preflightDir: p.dir,
    cleanup: () => { m.cleanup(); p.cleanup(); },
  };
}

function runWithTwoFixtures(mappingData, preflightData, mode) {
  const f = createTwoFixtures(mappingData, preflightData);
  try {
    const args = `${mode} "${f.mappingPath}" --preflight "${f.preflightPath}"`;
    const result = runScript(args);
    return { result, cleanup: f.cleanup };
  } catch (e) {
    f.cleanup();
    throw e;
  }
}

// ─── Test 1: Script exists ─────────────────────────────────────────────────

test('repair script exists and is readable', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'Script must exist');
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.ok(content.includes('--validate'), 'Must support --validate');
  assert.ok(content.includes('--dry-run'), 'Must support --dry-run');
  assert.ok(content.includes('--prepare-plan'), 'Must support --prepare-plan');
});

// ─── Test 2: --validate passes ─────────────────────────────────────────────

test('--validate passes with valid external mapping', () => {
  const { result, cleanup } = runValidate(VALID_MAPPING);
  try {
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
    assert.ok(result.stdout.includes('PASSED'), 'Must show validation passed');
  } finally {
    cleanup();
  }
});

// ─── Test 3: --dry-run with preflight passes ──────────────────────────────

test('--dry-run with valid mapping and preflight passes', () => {
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
    assert.ok(result.stdout.includes('Browse-eligible'), 'Must show Browse-eligible count');
    assert.ok(result.stdout.includes('Growing'), 'Must show Growing count');
    assert.ok(result.stdout.includes('Existing-row'), 'Must show existing-row count');
    assert.ok(result.stdout.includes('Planned inserts'), 'Must show planned inserts');
  } finally {
    cleanup();
  }
});

// ─── Test 4: UUID-shaped TEXT treeId accepted and preserved ────────────────

test('UUID-shaped TEXT treeId is accepted and preserved exactly', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      treeId: '550e8400-e29b-41d4-a716-446655440000',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.equal(result.exitCode, 0, 'UUID-shaped TEXT must be accepted');
  } finally {
    cleanup();
  }
});

// ─── Test 5: Whitespace-only treeId is rejected ────────────────────────────

test('whitespace-only treeId is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      treeId: '   ',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject blank treeId');
    assert.ok(result.stderr.includes('BLANK_TREE_ID'), 'Must show blank code');
  } finally {
    cleanup();
  }
});

// ─── Test 6: Unknown source classification rejected ────────────────────────

test('unknown source classification is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    sourceClassification: 'UNKNOWN_SOURCE_TYPE',
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject unknown source');
    assert.ok(result.stderr.includes('UNKNOWN_SOURCE_CLASSIFICATION'), 'Must show unknown code');
  } finally {
    cleanup();
  }
});

// ─── Test 7: Stale/conflicting source classification rejected ──────────────

test('stale/conflicting source classification is rejected', () => {
  const rejected = [
    'STALE_OR_CONFLICTING_BROWSER_RECOVERY_SOURCE',
    'NO_BROWSER_RECOVERY_DATA_FOUND',
    'BLOCKED_PRIVATE_BROWSER_ACCESS',
    'FABRICATED',
    'FALLBACK',
  ];
  for (const cls of rejected) {
    const mapping = { ...VALID_MAPPING, sourceClassification: cls };
    const { result, cleanup } = runValidate(mapping);
    try {
      assert.notEqual(result.exitCode, 0, `Must reject ${cls}`);
      assert.ok(result.stderr.includes('REJECTED_SOURCE_CLASSIFICATION'), 'Must show rejected code');
    } finally {
      cleanup();
    }
  }
});

// ─── Test 8: Partial source with provenance required ───────────────────────

test('partial source record must have provenances', () => {
  const mapping = {
    ...VALID_MAPPING,
    sourceClassification: 'PARTIAL_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{
      ...VALID_MAPPING.records[0],
      ownerProvenance: 'AUTHORITATIVE_SERVER_RETURNED_FIELD',
      titleProvenance: 'AUTHORITATIVE_SERVER_RETURNED_FIELD',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.equal(result.exitCode, 0, 'Partial source with provenances must pass');
  } finally {
    cleanup();
  }
});

// ─── Test 9: Private evidence exact allowlist ──────────────────────────────

test('private evidence classification allowlist enforced', () => {
  // Valid private evidence
  for (const evidence of ['PLUS_ENTITLEMENT_CONFIRMED', 'GRANDFATHERED_PRIVATE_CONFIRMED']) {
    const mapping = {
      ...VALID_MAPPING,
      records: [{
        ...VALID_MAPPING.records[0],
        visibility: 'private',
        privateEvidenceClassification: evidence,
      }],
    };
    const { result, cleanup } = runValidate(mapping);
    try {
      assert.equal(result.exitCode, 0, `${evidence} must be accepted`);
    } finally {
      cleanup();
    }
  }

  // Invalid private evidence
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      visibility: 'private',
      privateEvidenceClassification: 'boolean_true',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Free-text private evidence must be rejected');
    assert.ok(result.stderr.includes('INVALID_PRIVATE_EVIDENCE'), 'Must show invalid code');
  } finally {
    cleanup();
  }
});

// ─── Test 10: Private without evidence classification rejected ─────────────

test('private visibility missing privateEvidenceClassification is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      visibility: 'private',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject private without evidence');
    assert.ok(result.stderr.includes('MISSING_PRIVATE_EVIDENCE'), 'Must show missing code');
  } finally {
    cleanup();
  }
});

// ─── Test 11: --dry-run without preflight rejected ─────────────────────────

test('--dry-run without preflight is rejected', () => {
  const m = createExternalFixture(VALID_MAPPING);
  try {
    const result = runScript(`--dry-run "${m.path}"`);
    assert.notEqual(result.exitCode, 0, 'Must reject dry-run without preflight');
    assert.ok(result.stderr.includes('--preflight'), 'Must mention --preflight');
  } finally {
    m.cleanup();
  }
});

// ─── Test 12: Mapping/preflight identity mismatch rejected ─────────────────

test('mapping/preflight identity set mismatch is rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'different-id',
      entityExists: false,
      publicMomentCount: 0,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject identity mismatch');
    assert.ok(result.stderr.includes('UNMATCHED_PREFLIGHT_ENTITY') ||
      result.stderr.includes('MAPPING_ID_MISSING'), 'Must show mismatch code');
  } finally {
    cleanup();
  }
});

// ─── Test 13: Duplicate preflight identity rejected ────────────────────────

test('duplicate preflight identity is rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'synthetic-test-001', entityExists: false, publicMomentCount: 4 },
      { treeId: 'synthetic-test-001', entityExists: false, publicMomentCount: 2 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject duplicate preflight ID');
    assert.ok(result.stderr.includes('DUPLICATE_PREFLIGHT_ENTITY'), 'Must show duplicate code');
  } finally {
    cleanup();
  }
});

// ─── Test 14: Negative publicMomentCount rejected ──────────────────────────

test('negative publicMomentCount is rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      ...VALID_PREFLIGHT.records[0],
      publicMomentCount: -1,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject negative moment count');
    assert.ok(result.stderr.includes('INVALID_MOMENT_COUNT'), 'Must show invalid count code');
  } finally {
    cleanup();
  }
});

// ─── Test 15: Existing entity conflict rejected ────────────────────────────

test('existing entity conflict (entityExists=true) exits non-zero', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      ...VALID_PREFLIGHT.records[0],
      entityExists: true,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject existing entity');
    assert.ok(result.stderr.includes('Existing-row'), 'Must show existing row count');
  } finally {
    cleanup();
  }
});

// ─── Test 16: Conflict output contains count but no raw ID ─────────────────

test('conflict output contains count but no raw treeId', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      ...VALID_PREFLIGHT.records[0],
      entityExists: true,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject existing entity');
    assert.ok(!result.stdout.includes('synthetic-test-001'), 'Must not contain raw treeId');
    assert.ok(!result.stderr.includes('synthetic-test-001'), 'Must not contain raw treeId in stderr');
  } finally {
    cleanup();
  }
});

// ─── Test 17: >=3 exact Browse-eligible count ──────────────────────────────

test('Browse-eligible count uses >=3 publicMomentCount threshold', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'browse-good-1', ownerId: 'o1', title: 'Good' },
      { ...VALID_MAPPING.records[0], treeId: 'browse-good-2', ownerId: 'o2', title: 'Good2' },
      { ...VALID_MAPPING.records[0], treeId: 'browse-bad-1', ownerId: 'o3', title: 'Bad' },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'browse-good-1', entityExists: false, publicMomentCount: 3 },
      { treeId: 'browse-good-2', entityExists: false, publicMomentCount: 5 },
      { treeId: 'browse-bad-1', entityExists: false, publicMomentCount: 2 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    // Browse-eligible: 2 (good-1 has 3, good-2 has 5)
    assert.ok(result.stdout.includes('Browse-eligible'), 'Must show Browse-eligible');
  } finally {
    cleanup();
  }
});

// ─── Test 18: 0-2 exact growing count ─────────────────────────────────────

test('Growing count uses 0-2 publicMomentCount range', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'grow-1', ownerId: 'o1', title: 'G1' },
      { ...VALID_MAPPING.records[0], treeId: 'grow-2', ownerId: 'o2', title: 'G2' },
      { ...VALID_MAPPING.records[0], treeId: 'grow-3', ownerId: 'o3', title: 'G3' },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'grow-1', entityExists: false, publicMomentCount: 0 },
      { treeId: 'grow-2', entityExists: false, publicMomentCount: 2 },
      { treeId: 'grow-3', entityExists: false, publicMomentCount: 10 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    assert.ok(result.stdout.includes('Growing'), 'Must show Growing count');
  } finally {
    cleanup();
  }
});

// ─── Test 19: Public/private separation ────────────────────────────────────

test('private records excluded from Browse/growing counts', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      {
        ...VALID_MAPPING.records[0],
        treeId: 'pub-1', ownerId: 'o1', title: 'Pub',
        visibility: 'public',
      },
      {
        ...VALID_MAPPING.records[0],
        treeId: 'priv-1', ownerId: 'o2', title: 'Priv',
        visibility: 'private',
        privateEvidenceClassification: 'PLUS_ENTITLEMENT_CONFIRMED',
      },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'pub-1', entityExists: false, publicMomentCount: 5 },
      { treeId: 'priv-1', entityExists: false, publicMomentCount: 0 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run with mixed visibility must pass');
    assert.ok(result.stdout.includes('Explicit-private'), 'Must show private count');
  } finally {
    cleanup();
  }
});

// ─── Test 20: Repository-internal mapping rejected ─────────────────────────

test('repository-internal mapping path is rejected', () => {
  const internalPath = path.join(ROOT, 'package.json');
  const result = runScript(`--validate "${internalPath}"`);
  assert.notEqual(result.exitCode, 0, 'Must fail for internal path');
  assert.ok(result.stderr.includes('outside the repository'), 'Must show external path message');
});

// ─── Test 21: Repository-internal preflight rejected ───────────────────────

test('repository-internal preflight path is rejected', () => {
  const m = createExternalFixture(VALID_MAPPING);
  try {
    const internalPreflight = path.join(ROOT, 'package.json');
    const result = runScript(`--dry-run "${m.path}" --preflight "${internalPreflight}"`);
    assert.notEqual(result.exitCode, 0, 'Must reject internal preflight');
    assert.ok(result.stderr.includes('outside the repository'), 'Must show external message');
  } finally {
    m.cleanup();
  }
});

// ─── Test 22: Repository-internal output rejected ──────────────────────────

test('repository-internal output path for --prepare-plan is rejected', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  try {
    const internalOut = path.join(ROOT, 'plan.json');
    const result = runScript(`--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${internalOut}"`);
    assert.notEqual(result.exitCode, 0, 'Must reject internal output');
    assert.ok(result.stderr.includes('outside the repository'), 'Must show external message');
  } finally {
    f.cleanup();
  }
});

// ─── Test 23: Duplicate/conflict errors expose no raw values ───────────────

test('duplicate and conflict errors expose index+code only, no raw values', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'dup-id', ownerId: 'owner-1' },
      { ...VALID_MAPPING.records[0], treeId: 'dup-id', ownerId: 'owner-2' },
    ],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject duplicates');
    assert.ok(result.stderr.includes('DUPLICATE_TREE_ID'), 'Must show duplicate code');
    assert.ok(result.stderr.includes('CONFLICTING_OWNER_MAPPING'), 'Must show conflict code');
    // No raw values should appear
    assert.ok(!result.stderr.includes('dup-id'), 'Must not contain raw treeId');
    assert.ok(!result.stderr.includes('owner-1'), 'Must not contain raw ownerId');
    assert.ok(!result.stderr.includes('owner-2'), 'Must not contain raw ownerId');
  } finally {
    cleanup();
  }
});

// ─── Test 24: --apply rejected before input read ──────────────────────────

test('--apply is rejected before any input is read', () => {
  const result = runScript('--apply /nonexistent/path.json');
  assert.notEqual(result.exitCode, 0, 'Must reject --apply');
  assert.ok(result.stderr.includes('NOT available'), 'Must show apply rejection');
  // Should not say "Cannot read" — that means it tried to read the file
  assert.ok(!result.stderr.includes('Cannot read'), 'Must reject before reading input');
});

// ─── Test 25: --prepare-plan creates external deterministic artifact ───────

test('--prepare-plan creates external deterministic plan JSON', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-plan-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    assert.ok(fs.existsSync(planPath), 'Plan file must be created');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.schemaVersion, 1, 'Plan must have schemaVersion');
    assert.ok(plan.mappingArtifactSha256, 'Plan must have mapping hash');
    assert.ok(plan.preflightArtifactSha256, 'Plan must have preflight hash');
    assert.ok(plan.createdByPackageVersion, 'Plan must have package version');
    assert.equal(plan.recordCount, 1, 'Plan must have 1 record');
    assert.ok(Array.isArray(plan.records), 'Plan must have records array');
    assert.equal(plan.records.length, 1, 'Plan must have 1 record');
    assert.ok(result.stdout.includes('Plan SHA-256'), 'Must output plan hash');
  } finally {
    f.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

// ─── Test 26: Plan hash produced ──────────────────────────────────────────

test('prepare-plan outputs SHA-256 hash', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-hash-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    assert.ok(result.stdout.includes('SHA-256'), 'Must include SHA-256 in output');
  } finally {
    f.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

// ─── Test 27: Plan contains no existing entity ─────────────────────────────

test('plan contains only entityExists=false records', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-plan-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    // Our preflight has entityExists=false, so record should be included
    assert.equal(plan.records.length, 1, 'Plan must include only non-existing records');
  } finally {
    f.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

// ─── Test 28: No DB/network/Firebase import ────────────────────────────────

test('script does not import pg, firebase-admin, or network modules', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.ok(!content.includes("require('pg'"), 'Must not import pg');
  assert.ok(!content.includes("require('firebase-admin'"), 'Must not import firebase-admin');
  assert.ok(!content.includes("require('http'"), 'Must not import http');
  assert.ok(!content.includes("require('https'"), 'Must not import https');
  assert.ok(!content.includes("require('net'"), 'Must not import net');
});

// ─── Test 29: Runbook has pre-commit rollback and prohibits auto DELETE ────

test('runbook has pre-commit rollback and prohibits automatic post-commit DELETE', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  assert.ok(content.includes('ROLLBACK'), 'Runbook must mention rollback');
  assert.ok(content.includes('No automatic'), 'Runbook must prohibit auto DELETE');
  assert.ok(content.includes('Production Approval'), 'Runbook must have production approval gate');
  assert.ok(content.includes('Step 1'), 'Runbook must have step-by-step procedure');
  assert.ok(content.includes('SEPARATE_COMPENSATING_ACTION'), 'Runbook must document compensating action');
});

// ─── Test 30: No dependent-data mutation ──────────────────────────────────

test('script and runbook contain no dependent-data mutation operations', () => {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const runbookContent = fs.readFileSync(
    path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md'),
    'utf8'
  );

  // Must not contain DELETE operations for dependent data
  // INSERT is OK for public.trees only
  const delPattern = /DELETE\s+FROM\s+(?!public\.trees)/i;
  assert.ok(!delPattern.test(scriptContent), 'Script must not DELETE dependent data');
  assert.ok(!delPattern.test(runbookContent), 'Runbook must not DELETE dependent data');

  // Must contain explicit prohibition
  assert.ok(runbookContent.includes('dependent data'),
    'Runbook must mention dependent data');
  assert.ok(runbookContent.includes('prohibited'),
    'Runbook must declare prohibition');
});
