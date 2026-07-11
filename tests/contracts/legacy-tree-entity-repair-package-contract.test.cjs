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
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'prepare-legacy-tree-entity-repair.cjs');

// ─── Synthetic test values ─────────────────────────────────────────────────

const REQUIRED_PROVENANCE = 'AUTHORITATIVE_SERVER_RETURNED_FIELD';

const VALID_MAPPING = {
  schemaVersion: 1,
  sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
  records: [
    {
      treeId: 'synthetic-test-001',
      ownerId: 'synth-owner-alpha',
      title: 'Synthetic Alpha Tree',
      ownerProvenance: REQUIRED_PROVENANCE,
      titleProvenance: REQUIRED_PROVENANCE,
      visibility: 'public',
      groupName: null,
      keywords: null,
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

function runWithThreeFixtures(mappingData, preflightData, planDir, mode) {
  const f = createTwoFixtures(mappingData, preflightData);
  const planPath = path.join(planDir, 'plan.json');
  try {
    const args = `${mode} "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    return { result, cleanup: f.cleanup, planPath };
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

// ─── Provenance tests (Test 5-9) ──────────────────────────────────────────

test('missing ownerProvenance is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      ownerProvenance: undefined,
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject missing ownerProvenance');
    assert.ok(result.stderr.includes('MISSING_OWNER_PROVENANCE'), 'Must show MISSING_OWNER_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('missing titleProvenance is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      titleProvenance: undefined,
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject missing titleProvenance');
    assert.ok(result.stderr.includes('MISSING_TITLE_PROVENANCE'), 'Must show MISSING_TITLE_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('invalid ownerProvenance is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      ownerProvenance: 'SOME_OTHER_VALUE',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject invalid ownerProvenance');
    assert.ok(result.stderr.includes('INVALID_OWNER_PROVENANCE'), 'Must show INVALID_OWNER_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('invalid titleProvenance is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      titleProvenance: 'SOME_OTHER_VALUE',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject invalid titleProvenance');
    assert.ok(result.stderr.includes('INVALID_TITLE_PROVENANCE'), 'Must show INVALID_TITLE_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('partial source with missing provenance is rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    sourceClassification: 'PARTIAL_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{
      ...VALID_MAPPING.records[0],
      ownerProvenance: undefined,
      titleProvenance: REQUIRED_PROVENANCE,
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Partial source with missing provenance must be rejected');
    assert.ok(result.stderr.includes('MISSING_OWNER_PROVENANCE'), 'Must show MISSING_OWNER_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('partial source with valid provenances passes', () => {
  const mapping = {
    ...VALID_MAPPING,
    sourceClassification: 'PARTIAL_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{
      ...VALID_MAPPING.records[0],
      ownerProvenance: REQUIRED_PROVENANCE,
      titleProvenance: REQUIRED_PROVENANCE,
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.equal(result.exitCode, 0, 'Partial source with valid provenances must pass');
  } finally {
    cleanup();
  }
});

// ─── Preflight required fields (Test 11-18) ────────────────────────────────

test('missing entityExists rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      // entityExists omitted
      publicMomentCount: 4,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject missing entityExists');
    assert.ok(result.stderr.includes('MISSING_ENTITY_EXISTS'), 'Must show MISSING_ENTITY_EXISTS');
  } finally {
    cleanup();
  }
});

test('null entityExists rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: null,
      publicMomentCount: 4,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject null entityExists');
    assert.ok(result.stderr.includes('MISSING_ENTITY_EXISTS'), 'Must show MISSING_ENTITY_EXISTS');
  } finally {
    cleanup();
  }
});

test('string entityExists rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: 'true',
      publicMomentCount: 4,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject string entityExists');
    assert.ok(result.stderr.includes('INVALID_ENTITY_EXISTS_TYPE'), 'Must show INVALID_ENTITY_EXISTS_TYPE');
  } finally {
    cleanup();
  }
});

test('missing publicMomentCount rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: false,
      // publicMomentCount omitted
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject missing publicMomentCount');
    assert.ok(result.stderr.includes('MISSING_PUBLIC_MOMENT_COUNT'), 'Must show MISSING_PUBLIC_MOMENT_COUNT');
  } finally {
    cleanup();
  }
});

test('null publicMomentCount rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: false,
      publicMomentCount: null,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject null publicMomentCount');
    assert.ok(result.stderr.includes('MISSING_PUBLIC_MOMENT_COUNT'), 'Must show MISSING_PUBLIC_MOMENT_COUNT');
  } finally {
    cleanup();
  }
});

test('numeric string publicMomentCount rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: false,
      publicMomentCount: '3',
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject string moment count');
    assert.ok(result.stderr.includes('INVALID_MOMENT_COUNT'), 'Must show INVALID_MOMENT_COUNT');
  } finally {
    cleanup();
  }
});

test('fractional publicMomentCount rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: false,
      publicMomentCount: 3.5,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject fractional moment count');
    assert.ok(result.stderr.includes('INVALID_MOMENT_COUNT'), 'Must show INVALID_MOMENT_COUNT');
  } finally {
    cleanup();
  }
});

test('negative publicMomentCount rejected', () => {
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [{
      treeId: 'synthetic-test-001',
      entityExists: false,
      publicMomentCount: -1,
    }],
  };
  const { result, cleanup } = runWithTwoFixtures(VALID_MAPPING, preflight, '--dry-run');
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject negative moment count');
    assert.ok(result.stderr.includes('INVALID_MOMENT_COUNT'), 'Must show INVALID_MOMENT_COUNT');
  } finally {
    cleanup();
  }
});

// ─── Optional metadata provenance (Test 19-25) ─────────────────────────────

test('groupName without provenance rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      groupName: 'Synthetic Group',
      // no groupNameProvenance
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject groupName without provenance');
    assert.ok(result.stderr.includes('INVALID_GROUP_NAME_PROVENANCE'), 'Must show INVALID_GROUP_NAME_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('keywords without provenance rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      keywords: ['tag1', 'tag2'],
      // no keywordsProvenance
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject keywords without provenance');
    assert.ok(result.stderr.includes('INVALID_KEYWORDS_PROVENANCE'), 'Must show INVALID_KEYWORDS_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('timestamps without provenance rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
      // no provenance fields
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject timestamps without provenance');
    assert.ok(result.stderr.includes('INVALID_CREATED_AT_PROVENANCE'), 'Must show INVALID_CREATED_AT_PROVENANCE');
    assert.ok(result.stderr.includes('INVALID_UPDATED_AT_PROVENANCE'), 'Must show INVALID_UPDATED_AT_PROVENANCE');
  } finally {
    cleanup();
  }
});

test('optional authoritative metadata preserved in plan', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      groupName: 'Synthetic Group',
      groupNameProvenance: REQUIRED_PROVENANCE,
      keywords: ['tag1'],
      keywordsProvenance: REQUIRED_PROVENANCE,
      createdAt: '2025-01-01T00:00:00Z',
      createdAtProvenance: REQUIRED_PROVENANCE,
      updatedAt: '2025-01-02T00:00:00Z',
      updatedAtProvenance: REQUIRED_PROVENANCE,
    }],
  };
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-plan-md-'));
  const { result, cleanup, planPath } = runWithThreeFixtures(mapping, VALID_PREFLIGHT, planDir, '--prepare-plan');
  try {
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const record = plan.records[0];
    assert.equal(record.groupName, 'Synthetic Group', 'groupName must be preserved');
    assert.deepEqual(record.keywords, ['tag1'], 'keywords must be preserved');
    assert.equal(record.createdAt, '2025-01-01T00:00:00Z', 'createdAt must be preserved');
    assert.equal(record.updatedAt, '2025-01-02T00:00:00Z', 'updatedAt must be preserved');
  } finally {
    cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('null optional metadata remains null in plan', () => {
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-plan-null-'));
  const { result, cleanup, planPath } = runWithThreeFixtures(VALID_MAPPING, VALID_PREFLIGHT, planDir, '--prepare-plan');
  try {
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const record = plan.records[0];
    assert.equal(record.groupName, null, 'null groupName must remain null');
    assert.equal(record.keywords, null, 'null keywords must remain null');
    assert.equal(record.createdAt, null, 'null createdAt must remain null');
    assert.equal(record.updatedAt, null, 'null updatedAt must remain null');
  } finally {
    cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('createdAt/updatedAt chronology validated', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      createdAt: '2025-01-05T00:00:00Z',
      createdAtProvenance: REQUIRED_PROVENANCE,
      updatedAt: '2025-01-01T00:00:00Z',
      updatedAtProvenance: REQUIRED_PROVENANCE,
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject updatedAt before createdAt');
    assert.ok(result.stderr.includes('UPDATED_BEFORE_CREATED'), 'Must show UPDATED_BEFORE_CREATED');
  } finally {
    cleanup();
  }
});

test('public record with privateEvidenceClassification rejected', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      visibility: 'public',
      privateEvidenceClassification: 'PLUS_ENTITLEMENT_CONFIRMED',
    }],
  };
  const { result, cleanup } = runValidate(mapping);
  try {
    assert.notEqual(result.exitCode, 0, 'Must reject public record with private evidence');
    assert.ok(result.stderr.includes('CONTRADICTORY_PRIVATE_EVIDENCE_ON_PUBLIC'), 'Must show contradictory code');
  } finally {
    cleanup();
  }
});

// ─── Stale/conflicting source classification ───────────────────────────────

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

// ─── Private evidence exact allowlist ──────────────────────────────────────

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

// ─── Private without evidence classification rejected ──────────────────────

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

// ─── Exact aggregate assertions (Test 26-30) ──────────────────────────────

test('exact Browse/growing count derived from fixture', () => {
  // Fixture: 4 public records + 1 private
  // browseEligible: 2 (ids: browse-g3, browse-g5)
  // growing: 1 (id: browse-g2)
  // private: 1
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'browse-g3', ownerId: 'o1', title: 'Browse3' },
      { ...VALID_MAPPING.records[0], treeId: 'browse-g5', ownerId: 'o2', title: 'Browse5' },
      { ...VALID_MAPPING.records[0], treeId: 'browse-g2', ownerId: 'o3', title: 'Browse2' },
      { ...VALID_MAPPING.records[0], treeId: 'private-1', ownerId: 'o4', title: 'Priv1' },
      { ...VALID_MAPPING.records[0], treeId: 'private-2', ownerId: 'o5', title: 'Priv2' },
    ],
  };
  mapping.records[3].visibility = 'private';
  mapping.records[3].privateEvidenceClassification = 'PLUS_ENTITLEMENT_CONFIRMED';
  mapping.records[4].visibility = 'private';
  mapping.records[4].privateEvidenceClassification = 'PLUS_ENTITLEMENT_CONFIRMED';

  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'browse-g3', entityExists: false, publicMomentCount: 3 },
      { treeId: 'browse-g5', entityExists: false, publicMomentCount: 5 },
      { treeId: 'browse-g2', entityExists: false, publicMomentCount: 2 },
      { treeId: 'private-1', entityExists: false, publicMomentCount: 0 },
      { treeId: 'private-2', entityExists: false, publicMomentCount: 10 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    // Parse exact counts from output
    const browseMatch = result.stdout.match(/Browse-eligible records:\s+(\d+)/);
    const growingMatch = result.stdout.match(/Growing records:\s+(\d+)/);
    const privateMatch = result.stdout.match(/Explicit-private records:\s+(\d+)/);
    const totalMatch = result.stdout.match(/Valid joined records:\s+(\d+)/);

    assert.ok(browseMatch, 'Must output Browse-eligible count');
    assert.ok(growingMatch, 'Must output Growing count');
    assert.equal(parseInt(browseMatch[1], 10), 2, 'Expected 2 Browse-eligible');
    assert.equal(parseInt(growingMatch[1], 10), 1, 'Expected 1 Growing');
    assert.equal(parseInt(privateMatch[1], 10), 2, 'Expected 2 private');
    assert.equal(parseInt(totalMatch[1], 10), 5, 'Expected 5 total');

    // browseEligible + growing + private = total joined
    const be = parseInt(browseMatch[1], 10);
    const gr = parseInt(growingMatch[1], 10);
    const pr = parseInt(privateMatch[1], 10);
    const tt = parseInt(totalMatch[1], 10);
    assert.equal(be + gr + pr, tt, 'browseEligible + growing + private = total');
  } finally {
    cleanup();
  }
});

test('Browse and growing are disjoint sets', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'both-3', ownerId: 'o1', title: 'Both3' },
      { ...VALID_MAPPING.records[0], treeId: 'both-0', ownerId: 'o2', title: 'Both0' },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'both-3', entityExists: false, publicMomentCount: 3 },
      { treeId: 'both-0', entityExists: false, publicMomentCount: 0 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    const browseMatch = result.stdout.match(/Browse-eligible records:\s+(\d+)/);
    const growingMatch = result.stdout.match(/Growing records:\s+(\d+)/);
    const privateMatch = result.stdout.match(/Explicit-private records:\s+(\d+)/);

    assert.equal(parseInt(browseMatch[1], 10), 1, '1 Browse-eligible');
    assert.equal(parseInt(growingMatch[1], 10), 1, '1 Growing');
    assert.equal(parseInt(privateMatch[1], 10), 0, '0 private');
  } finally {
    cleanup();
  }
});

test('private excluded from both Browse and growing', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      {
        ...VALID_MAPPING.records[0],
        treeId: 'all-pub', ownerId: 'o1', title: 'Pub',
        visibility: 'public',
      },
      {
        ...VALID_MAPPING.records[0],
        treeId: 'all-priv', ownerId: 'o2', title: 'Priv',
        visibility: 'private',
        privateEvidenceClassification: 'PLUS_ENTITLEMENT_CONFIRMED',
      },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'all-pub', entityExists: false, publicMomentCount: 0 },
      { treeId: 'all-priv', entityExists: false, publicMomentCount: 5 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    const browseMatch = result.stdout.match(/Browse-eligible records:\s+(\d+)/);
    const growingMatch = result.stdout.match(/Growing records:\s+(\d+)/);

    assert.equal(parseInt(browseMatch[1], 10), 0, '0 Browse-eligible (private not counted even with >=3)');
    assert.equal(parseInt(growingMatch[1], 10), 1, '1 Growing (pub with 0 moments)');
  } finally {
    cleanup();
  }
});

test('0-2 publicMomentCount trees excluded from Browse-eligible', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'z-0', ownerId: 'o1', title: 'Z0' },
      { ...VALID_MAPPING.records[0], treeId: 'z-1', ownerId: 'o2', title: 'Z1' },
      { ...VALID_MAPPING.records[0], treeId: 'z-2', ownerId: 'o3', title: 'Z2' },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'z-0', entityExists: false, publicMomentCount: 0 },
      { treeId: 'z-1', entityExists: false, publicMomentCount: 1 },
      { treeId: 'z-2', entityExists: false, publicMomentCount: 2 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    const browseMatch = result.stdout.match(/Browse-eligible records:\s+(\d+)/);
    assert.equal(parseInt(browseMatch[1], 10), 0, '0 Browse-eligible for 0-2 range');
  } finally {
    cleanup();
  }
});

test('>=3 publicMomentCount trees are Browse-eligible', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [
      { ...VALID_MAPPING.records[0], treeId: 'a-3', ownerId: 'o1', title: 'A3' },
      { ...VALID_MAPPING.records[0], treeId: 'a-10', ownerId: 'o2', title: 'A10' },
    ],
  };
  const preflight = {
    ...VALID_PREFLIGHT,
    records: [
      { treeId: 'a-3', entityExists: false, publicMomentCount: 3 },
      { treeId: 'a-10', entityExists: false, publicMomentCount: 10 },
    ],
  };
  const { result, cleanup } = runWithTwoFixtures(mapping, preflight, '--dry-run');
  try {
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    const browseMatch = result.stdout.match(/Browse-eligible records:\s+(\d+)/);
    assert.equal(parseInt(browseMatch[1], 10), 2, '2 Browse-eligible for >=3');
  } finally {
    cleanup();
  }
});

// ─── Hash/output tests (Test 31-37) ────────────────────────────────────────

test('mapping hash equals exact input bytes SHA-256', () => {
  const m = createExternalFixture(VALID_MAPPING);
  const p = createExternalFixture(VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-hash-map-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const rawMapping = fs.readFileSync(m.path, 'utf8');
    const expectedHash = crypto.createHash('sha256').update(rawMapping).digest('hex');

    const args = `--prepare-plan "${m.path}" --preflight "${p.path}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');

    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.ok(plan.mappingInputSha256, 'Plan must have mappingInputSha256');
    assert.equal(plan.mappingInputSha256, expectedHash, 'mappingInputSha256 must match actual bytes SHA-256');
  } finally {
    m.cleanup();
    p.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('preflight hash equals exact input bytes SHA-256', () => {
  const m = createExternalFixture(VALID_MAPPING);
  const p = createExternalFixture(VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-hash-pf-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const rawPreflight = fs.readFileSync(p.path, 'utf8');
    const expectedHash = crypto.createHash('sha256').update(rawPreflight).digest('hex');

    const args = `--prepare-plan "${m.path}" --preflight "${p.path}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');

    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.ok(plan.preflightInputSha256, 'Plan must have preflightInputSha256');
    assert.equal(plan.preflightInputSha256, expectedHash, 'preflightInputSha256 must match actual bytes SHA-256');
  } finally {
    m.cleanup();
    p.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('existing output path is rejected', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-exist-'));
  const planPath = path.join(planDir, 'plan.json');
  // Create the file first
  fs.writeFileSync(planPath, '{}', 'utf8');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    assert.notEqual(result.exitCode, 0, 'Must reject existing output');
    assert.ok(result.stderr.includes('already exists'), 'Must show already exists message');
  } finally {
    f.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('no partial final output after forced failure', () => {
  // Write to a read-only directory that causes write failure
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const readOnlyDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-readonly-'));
  // On Windows, making a directory read-only is tricky; instead, use a path
  // that simulates a failure by writing to a nonexistent parent directory
  const badPath = path.join(readOnlyDir, 'nonexistent-subdir', 'plan.json');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${badPath}"`;
    const result = runScript(args);
    assert.notEqual(result.exitCode, 0, 'Must fail when output write fails');
    // Verify no partial .tmp file remains
    const tmpFiles = fs.readdirSync(readOnlyDir).filter(f => f.endsWith('.tmp.'));
    assert.equal(tmpFiles.length, 0, 'No temp files should remain after failure');
  } finally {
    f.cleanup();
    fs.rmSync(readOnlyDir, { recursive: true, force: true });
  }
});

test('plan preserves optional metadata', () => {
  const mapping = {
    ...VALID_MAPPING,
    records: [{
      ...VALID_MAPPING.records[0],
      groupName: 'Test Group',
      groupNameProvenance: REQUIRED_PROVENANCE,
      keywords: ['kw1', 'kw2'],
      keywordsProvenance: REQUIRED_PROVENANCE,
    }],
  };
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-meta-'));
  const { result, cleanup, planPath } = runWithThreeFixtures(mapping, VALID_PREFLIGHT, planDir, '--prepare-plan');
  try {
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const record = plan.records[0];
    assert.equal(record.groupName, 'Test Group', 'groupName preserved');
    assert.deepEqual(record.keywords, ['kw1', 'kw2'], 'keywords preserved');
    assert.ok(record.publicMomentCount !== undefined, 'publicMomentCount present');
  } finally {
    cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('plan deterministic for identical exact inputs', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir1 = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-det-1-'));
  const planDir2 = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-det-2-'));
  const planPath1 = path.join(planDir1, 'plan.json');
  const planPath2 = path.join(planDir2, 'plan.json');
  try {
    const args1 = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath1}"`;
    const r1 = runScript(args1);
    assert.equal(r1.exitCode, 0, 'First plan must pass');

    const args2 = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath2}"`;
    const r2 = runScript(args2);
    assert.equal(r2.exitCode, 0, 'Second plan must pass');

    const plan1 = fs.readFileSync(planPath1, 'utf8');
    const plan2 = fs.readFileSync(planPath2, 'utf8');
    assert.equal(plan1, plan2, 'Plans must be identical for same inputs');
  } finally {
    f.cleanup();
    fs.rmSync(planDir1, { recursive: true, force: true });
    fs.rmSync(planDir2, { recursive: true, force: true });
  }
});

// ─── CLI strict validation (Test 38-43) ────────────────────────────────────

test('unknown option rejected', () => {
  const result = runScript('--unknown-option /some/path.json');
  assert.notEqual(result.exitCode, 0, 'Must reject unknown option');
  assert.ok(result.stderr.includes('Unknown mode'), 'Must show unknown mode');
});

test('extra positional argument rejected', () => {
  const m = createExternalFixture(VALID_MAPPING);
  try {
    const result = runScript(`--validate "${m.path}" extra-arg`);
    assert.notEqual(result.exitCode, 0, 'Must reject extra positional');
    assert.ok(result.stderr.includes('Unexpected additional positional'), 'Must show positional error');
  } finally {
    m.cleanup();
  }
});

test('mode-incompatible option rejected (validate + preflight)', () => {
  const m = createExternalFixture(VALID_MAPPING);
  const p = createExternalFixture(VALID_PREFLIGHT);
  try {
    const result = runScript(`--validate "${m.path}" --preflight "${p.path}"`);
    assert.notEqual(result.exitCode, 0, 'Must reject validate with preflight');
    assert.ok(result.stderr.includes('does not accept'), 'Must show incompatible option message');
  } finally {
    m.cleanup();
    p.cleanup();
  }
});

test('mode-incompatible option rejected (dry-run + out)', () => {
  const m = createExternalFixture(VALID_MAPPING);
  const p = createExternalFixture(VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-mode-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const result = runScript(`--dry-run "${m.path}" --preflight "${p.path}" --out "${planPath}"`);
    assert.notEqual(result.exitCode, 0, 'Must reject dry-run with --out');
    assert.ok(result.stderr.includes('does not accept'), 'Must show incompatible option message');
  } finally {
    m.cleanup();
    p.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

test('duplicate option rejected', () => {
  const m = createExternalFixture(VALID_MAPPING);
  try {
    const result = runScript(`--validate "${m.path}" --validate`);
    assert.notEqual(result.exitCode, 0, 'Must reject duplicate option');
    assert.ok(result.stderr.includes('Duplicate option'), 'Must show duplicate option');
  } finally {
    m.cleanup();
  }
});

test('missing option value rejected', () => {
  const m = createExternalFixture(VALID_MAPPING);
  try {
    const result = runScript(`--validate "${m.path}" --preflight`);
    assert.notEqual(result.exitCode, 0, 'Must reject missing option value');
    assert.ok(result.stderr.includes('Missing value for'), 'Must show missing value');
  } finally {
    m.cleanup();
  }
});

test('--apply rejected before reading a nonexistent mapping', () => {
  const result = runScript('--apply /nonexistent/path.json');
  assert.notEqual(result.exitCode, 0, 'Must reject --apply');
  assert.ok(result.stderr.includes('NOT available'), 'Must show apply rejection');
  // Should not say "Cannot read" — that means it tried to read the file
  assert.ok(!result.stderr.includes('Cannot read'), 'Must reject before reading input');
});

// ─── Existing entity conflict ──────────────────────────────────────────────

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

// ─── Conflict output no raw ID ─────────────────────────────────────────────

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

// ─── --dry-run without preflight rejected ──────────────────────────────────

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

// ─── Mapping/preflight identity mismatch ───────────────────────────────────

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

// ─── Duplicate preflight identity ──────────────────────────────────────────

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

// ─── Repository-internal paths rejected ────────────────────────────────────

test('repository-internal mapping path is rejected', () => {
  const internalPath = path.join(ROOT, 'package.json');
  const result = runScript(`--validate "${internalPath}"`);
  assert.notEqual(result.exitCode, 0, 'Must fail for internal path');
  assert.ok(result.stderr.includes('outside the repository'), 'Must show external path message');
});

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

// ─── No raw values in errors ───────────────────────────────────────────────

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
    assert.ok(!result.stderr.includes('dup-id'), 'Must not contain raw treeId');
    assert.ok(!result.stderr.includes('owner-1'), 'Must not contain raw ownerId');
    assert.ok(!result.stderr.includes('owner-2'), 'Must not contain raw ownerId');
  } finally {
    cleanup();
  }
});

// ─── --prepare-plan creates external deterministic artifact ────────────────

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
    assert.ok(plan.mappingInputSha256, 'Plan must have mapping hash');
    assert.ok(plan.preflightInputSha256, 'Plan must have preflight hash');
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

// ─── Plan contains only non-existing entities ──────────────────────────────

test('plan contains only entityExists=false records', () => {
  const f = createTwoFixtures(VALID_MAPPING, VALID_PREFLIGHT);
  const planDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-plan-'));
  const planPath = path.join(planDir, 'plan.json');
  try {
    const args = `--prepare-plan "${f.mappingPath}" --preflight "${f.preflightPath}" --out "${planPath}"`;
    const result = runScript(args);
    assert.equal(result.exitCode, 0, 'Prepare-plan must pass');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.records.length, 1, 'Plan must include only non-existing records');
  } finally {
    f.cleanup();
    fs.rmSync(planDir, { recursive: true, force: true });
  }
});

// ─── No DB/network/Firebase import ─────────────────────────────────────────

test('script does not import pg, firebase-admin, or network modules', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.ok(!content.includes("require('pg'"), 'Must not import pg');
  assert.ok(!content.includes("require('firebase-admin'"), 'Must not import firebase-admin');
  assert.ok(!content.includes("require('http'"), 'Must not import http');
  assert.ok(!content.includes("require('https'"), 'Must not import https');
  assert.ok(!content.includes("require('net'"), 'Must not import net');
});

// ─── Runbook tests ────────────────────────────────────────────────────────

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

test('no Growing-section claim in runbook', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  // Must NOT contain the old Growing section claim
  assert.ok(!content.includes('appear in Growing section'), 'Must not claim Growing section exists');
  // Must contain the canonical 0-2 exclusion rule
  assert.ok(content.includes('not listed in Browse/Search'), 'Must state 0-2 excluded from Browse/Search');
});

test('no existing-skipped posture in runbook', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  assert.ok(!content.includes('existing_skipped'), 'Must not contain existing_skipped');
  assert.ok(content.includes('existing_conflicts'), 'Must include existing_conflicts');
  assert.ok(content.includes('planned_inserts'), 'Must include planned_inserts');
});

test('no automatic post-commit DELETE in runbook', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  // The runbook describes the no-automatic-delete policy. It may mention
  // DELETE FROM public.trees when explaining the policy, but must NOT
  // present it as an actionable SQL operation (separated from INSERT context
  // or as a standalone command block).
  // Check that there's no standalone DELETE command block
  const standaloneDeletePattern = /```sql\nDELETE FROM public\.trees|```\nDELETE FROM public\.trees|DELETE\s+FROM\s+public\.trees\s*;/i;
  assert.ok(!standaloneDeletePattern.test(content), 'Must not contain actionable DELETE FROM public.trees');
});

test('conceptual INSERT includes recoverable metadata columns', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  assert.ok(content.includes('group_name'), 'INSERT must include group_name');
  assert.ok(content.includes('keywords'), 'INSERT must include keywords');
  assert.ok(content.includes('created_at'), 'INSERT must include created_at');
  assert.ok(content.includes('updated_at'), 'INSERT must include updated_at');
});

// ─── No dependent-data mutation ──────────────────────────────────────────

test('script and runbook contain no dependent-data mutation operations', () => {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const runbookContent = fs.readFileSync(
    path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md'),
    'utf8'
  );

  const delPattern = /DELETE\s+FROM\s+(?!public\.trees)/i;
  assert.ok(!delPattern.test(scriptContent), 'Script must not DELETE dependent data');
  assert.ok(!delPattern.test(runbookContent), 'Runbook must not DELETE dependent data');

  assert.ok(runbookContent.includes('dependent data'),
    'Runbook must mention dependent data');
  assert.ok(runbookContent.includes('prohibited'),
    'Runbook must declare prohibition');
});
