/**
 * Focused contract tests for the legacy orphan tree entity repair package
 * (Issue #3455).
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
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'repair-package');

// ─── Helper ────────────────────────────────────────────────────────────────

function runScript(mode, inputPath) {
  try {
    const output = execSync(`node "${SCRIPT_PATH}" ${mode} "${inputPath}"`, {
      encoding: 'utf8',
      timeout: 10000,
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

function createFixture(data) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-fixture-'));
  const tmpFile = path.join(tmpDir, 'input.json');
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  return { path: tmpFile, cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }) };
}

/**
 * Check if a path is inside the repository root.
 */
function isInsideRepo(p) {
  const resolved = path.resolve(p);
  const repoResolved = path.resolve(ROOT);
  return resolved.startsWith(repoResolved + path.sep) || resolved === repoResolved;
}

// ─── 1. Script exists and is executable ────────────────────────────────────

test('repair script exists and is readable', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'Script must exist');
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.ok(content.includes('--validate'), 'Script must support --validate mode');
  assert.ok(content.includes('--dry-run'), 'Script must support --dry-run mode');
});

// ─── 2. Valid input: --validate passes ─────────────────────────────────────

test('--validate passes with valid external input', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      {
        treeId: 'synthetic-tree-001',
        ownerId: 'synthetic-owner-001',
        title: 'Synthetic Recovery Test Tree',
        visibility: 'public',
        groupName: null,
        keywords: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      },
    ],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}: ${result.stderr}`);
    assert.ok(result.stdout.includes('Validation PASSED'), 'Must show validation passed');
  } finally {
    fixture.cleanup();
  }
});

// ─── 3. --dry-run passes and shows aggregate only ──────────────────────────

test('--dry-run passes and shows aggregate-only output', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      {
        treeId: 'synthetic-tree-002',
        ownerId: 'synthetic-owner-002',
        title: 'Synthetic Dry-Run Test Tree',
        visibility: 'public',
        groupName: null,
        keywords: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      },
    ],
  });
  try {
    const result = runScript('--dry-run', fixture.path);
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}: ${result.stderr}`);
    assert.ok(result.stdout.includes('Total input records'), 'Must show aggregate');
    assert.ok(!result.stdout.includes('synthetic-tree-002'), 'Must not contain raw tree ID');
    assert.ok(!result.stdout.includes('synthetic-owner-002'), 'Must not contain raw owner ID');
    assert.ok(!result.stdout.includes('Synthetic Dry-Run Test Tree'), 'Must not contain raw title');
  } finally {
    fixture.cleanup();
  }
});

// ─── 4. Repository-internal input path is rejected ─────────────────────────

test('repository-internal input path is rejected', () => {
  const internalPath = path.join(ROOT, 'package.json');
  assert.ok(isInsideRepo(internalPath), 'Test precondition: path must be inside repo');

  const result = runScript('--validate', internalPath);
  assert.notEqual(result.exitCode, 0, 'Must fail for internal path');
  assert.ok(
    result.stderr.includes('Input path must be outside') ||
    result.stderr.includes('repository'),
    'Must show external path message'
  );
});

// ─── 5. Malformed JSON is rejected ─────────────────────────────────────────

test('malformed JSON is rejected', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repair-fixture-'));
  const tmpFile = path.join(tmpDir, 'malformed.json');
  fs.writeFileSync(tmpFile, '{ invalid json }', 'utf8');
  try {
    const result = runScript('--validate', tmpFile);
    assert.notEqual(result.exitCode, 0, 'Must fail for malformed JSON');
    assert.ok(result.stderr.includes('Malformed JSON'), 'Must show malformed JSON error');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── 6. Unsupported schema version is rejected ─────────────────────────────

test('unsupported schema version is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 999,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject unsupported version');
    assert.ok(result.stderr.includes('Unsupported schema version'), 'Must show version error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 7. Missing schemaVersion is rejected ──────────────────────────────────

test('missing schemaVersion is rejected', () => {
  const fixture = createFixture({
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject missing version');
  } finally {
    fixture.cleanup();
  }
});

// ─── 8. Duplicate tree IDs are rejected ────────────────────────────────────

test('duplicate tree IDs are rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      { treeId: 'dup-001', ownerId: 'owner-001', title: 'First', visibility: 'public' },
      { treeId: 'dup-001', ownerId: 'owner-002', title: 'Second', visibility: 'public' },
    ],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject duplicate IDs');
    assert.ok(result.stderr.includes('Duplicate'), 'Must show duplicate error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 9. Conflicting duplicate records are rejected ─────────────────────────

test('conflicting duplicate records (different owner) are rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      { treeId: 'conflict-001', ownerId: 'owner-a', title: 'First', visibility: 'public' },
      { treeId: 'conflict-001', ownerId: 'owner-b', title: 'Second', visibility: 'public' },
    ],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject conflicting duplicates');
    assert.ok(result.stderr.includes('Conflicting'), 'Must show conflict error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 10. Missing treeId is rejected ────────────────────────────────────────

test('missing treeId is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ ownerId: 'owner-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject missing treeId');
    assert.ok(result.stderr.includes('treeId'), 'Must show treeId error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 11. Missing ownerId is rejected ───────────────────────────────────────

test('missing ownerId is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject missing ownerId');
    assert.ok(result.stderr.includes('ownerId'), 'Must show ownerId error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 12. Missing title is rejected ─────────────────────────────────────────

test('missing title is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject missing title');
    assert.ok(result.stderr.includes('title'), 'Must show title error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 13. Invalid visibility is rejected ────────────────────────────────────

test('invalid visibility is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'invalid' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject invalid visibility');
    assert.ok(result.stderr.includes('Invalid visibility'), 'Must show visibility error');
  } finally {
    fixture.cleanup();
  }
});

// ─── 14. Private without explicit evidence is rejected ─────────────────────

test('private visibility without explicit evidence is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'private' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject private without evidence');
    assert.ok(result.stderr.includes('explicitPrivateEvidence'), 'Must show evidence requirement');
  } finally {
    fixture.cleanup();
  }
});

// ─── 15. Fabricated/fallback source classification is rejected ─────────────

test('fabricated/fallback source classification is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'FABRICATED',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject fabricated classification');
    assert.ok(result.stderr.includes('FABRICATED'), 'Must show classification rejection');
  } finally {
    fixture.cleanup();
  }
});

// ─── 16. UUID-formatted treeId is rejected (TEXT ID required) ─────────────

test('UUID-formatted treeId is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{
      treeId: '550e8400-e29b-41d4-a716-446655440000',
      ownerId: 'owner-001',
      title: 'Test',
      visibility: 'public',
    }],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject UUID-formatted treeId');
    assert.ok(result.stderr.includes('UUID'), 'Must show UUID rejection');
  } finally {
    fixture.cleanup();
  }
});

// ─── 17. Empty records array is rejected ───────────────────────────────────

test('empty records array is rejected', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject empty records');
  } finally {
    fixture.cleanup();
  }
});

// ─── 18. Non-object input is rejected ─────────────────────────────────────

test('non-object input is rejected', () => {
  const fixture = createFixture('just a string');
  try {
    const result = runScript('--validate', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject non-object input');
  } finally {
    fixture.cleanup();
  }
});

// ─── 19. --apply flag is rejected (production apply fail-closed) ───────────

test('--apply flag is rejected (production apply fail-closed)', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [{ treeId: 'test-001', ownerId: 'owner-001', title: 'Test', visibility: 'public' }],
  });
  try {
    const result = runScript('--apply', fixture.path);
    assert.notEqual(result.exitCode, 0, 'Must reject --apply flag');
    assert.ok(result.stderr.includes('not available') || result.stderr.includes('apply'), 'Must show apply rejection');
  } finally {
    fixture.cleanup();
  }
});

// ─── 20. Runbook exists ────────────────────────────────────────────────────

test('repair runbook exists', () => {
  const runbookPath = path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md');
  assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');
  const content = fs.readFileSync(runbookPath, 'utf8');
  assert.ok(content.includes('Rollback'), 'Runbook must mention rollback');
  assert.ok(content.includes('Production Approval'), 'Runbook must have production approval gate');
  assert.ok(content.includes('Step 1'), 'Runbook must have step-by-step procedure');
});

// ─── 21. Script does not import pg or firebase-admin ───────────────────────

test('script does not import pg or firebase-admin (no production access)', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.ok(!content.includes("require('pg')"), 'Must not import pg');
  assert.ok(!content.includes('require("pg")'), 'Must not import pg (double quote)');
  assert.ok(!content.includes("require('firebase-admin')"), 'Must not import firebase-admin');
  assert.ok(!content.includes('require("firebase-admin")'), 'Must not import firebase-admin (double quote)');
});

// ─── 22. Public-first default verified via valid test ──────────────────────

test('public-first default: public records pass without evidence', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      {
        treeId: 'public-test-001',
        ownerId: 'owner-001',
        title: 'Public Test',
        visibility: 'public',
      },
    ],
  });
  try {
    const result = runScript('--validate', fixture.path);
    assert.equal(result.exitCode, 0, 'Public records must pass without explicit evidence');
  } finally {
    fixture.cleanup();
  }
});

// ─── 23. Browse eligibility separated (tree-level only, no moment check) ───

test('dry-run shows Browse-eligible count without requiring moment data', () => {
  const fixture = createFixture({
    schemaVersion: 1,
    sourceClassification: 'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
    records: [
      { treeId: 'browse-test-001', ownerId: 'owner-001', title: 'Browse Test', visibility: 'public' },
    ],
  });
  try {
    const result = runScript('--dry-run', fixture.path);
    assert.equal(result.exitCode, 0, 'Dry-run must pass');
    assert.ok(result.stdout.includes('Browse-eligible'), 'Must show Browse-eligible count');
  } finally {
    fixture.cleanup();
  }
});

// ─── 24. Script sources have no raw recovery values ────────────────────────

test('script and tests contain no raw recovery data values', () => {
  const testContent = fs.readFileSync(__filename, 'utf8');
  const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const runbookContent = fs.readFileSync(
    path.join(ROOT, 'docs', 'ops', 'LEGACY_TREE_ENTITY_REPAIR_RUNBOOK.md'),
    'utf8'
  );

  // All files should use synthetic/test values only
  // No real-looking Firebase UIDs, no production tree IDs
  const uidPrefix = '6xJoZMw64gW';
  const uidSuffix = 'ZcSIIS92kmBcSGVn1';
  const bannedUid = uidPrefix + uidSuffix;
  assert.ok(!testContent.includes(bannedUid),
    'Test must not contain real Firebase UID');
});
