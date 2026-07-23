'use strict';

/**
 * Focused SOURCE_STATIC contract test: canonical migration identity, ordering,
 * canonical path ownership, and byte-exact checksum rules (#3458, second slice).
 *
 * This test validates scripts/migration-provenance-core.cjs against synthetic
 * manifests and fixtures created in the OS temporary directory. It NEVER adds a
 * .sql file to the repository (which would trip the schema-change inventory
 * guard), NEVER connects to a database, NEVER executes SQL, and NEVER uses
 * DATABASE_URL or any secret. Every temporary fixture is removed on completion.
 *
 * It also asserts the committed canonical stream is unchanged: status remains
 * ADOPTION_REQUIRED and migrations remains empty (no activation, no entries).
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-provenance-core.cjs');
const CANONICAL_MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const CONTRACT_DOC_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-migration-identity-order-checksum-contract.md');

const core = require(CORE_PATH);

const LEDGER_FIELDS = [
  'migration_id',
  'content_checksum',
  'applied_at',
  'runner_version',
  'environment_class',
  'deployed_commit',
  'transaction_outcome'
];

// Create a throwaway canonical repository layout under the OS temp directory.
function makeTempRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-mid-'));
  fs.mkdirSync(path.join(tempRoot, 'db', 'migrations'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'db', 'migration-provenance'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, 'db', 'migration-provenance', 'ledger-contract.json'),
    JSON.stringify({ format_version: '1.0', relation_name: 'schema_migration_ledger', required_record_fields: LEDGER_FIELDS }),
    'utf8'
  );
  return tempRoot;
}

function removeTempRepo(tempRoot) {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

// Build a complete, field-valid canonical migration entry.
function entry(id, relPath, checksum, overrides = {}) {
  return {
    id,
    name: id,
    path: relPath,
    checksum,
    depends_on: [],
    risk_class: 'ADDITIVE',
    transaction_mode: 'REQUIRED',
    expected_preconditions: [],
    expected_postconditions: [],
    rollback_support: 'NONE',
    destructive_operations: [],
    owner_domain: 'platform',
    approval_reference: 'n/a',
    ...overrides
  };
}

function makeManifest(migrations, overrides = {}) {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    canonical_directory: 'db/migrations',
    ledger: {
      contract_path: 'db/migration-provenance/ledger-contract.json',
      required_record_fields: LEDGER_FIELDS
    },
    migrations,
    ...overrides
  };
}

// Write a canonical .sql fixture with explicit bytes; checksum is over those bytes.
function writeSql(tempRoot, id, bytes) {
  const relPath = `db/migrations/${id}.sql`;
  fs.writeFileSync(path.join(tempRoot, relPath), bytes);
  return { relPath, checksum: core.sha256(bytes) };
}

// Validate a single migration whose manifest checksum is computed from originalBytes
// while the file on disk holds diskBytes. Returns the error list.
function validateByteCase(originalBytes, diskBytes) {
  const tempRoot = makeTempRepo();
  try {
    const id = '20260101000000_byte-probe';
    const relPath = `db/migrations/${id}.sql`;
    fs.writeFileSync(path.join(tempRoot, relPath), diskBytes);
    const checksum = core.sha256(originalBytes);
    const manifest = makeManifest([entry(id, relPath, checksum)]);
    return core.validateMigrationManifest(manifest, tempRoot).errors;
  } finally {
    removeTempRepo(tempRoot);
  }
}

// Run evaluateProvenance with synthetic ACTIVE manifests and return ledger blockers.
function ledgerBlockers(expectedMigrations, appliedMigrations) {
  const result = core.evaluateProvenance({
    migrationManifest: { status: 'ACTIVE', migrations: expectedMigrations },
    expectedSchemaManifest: { status: 'ACTIVE', critical_objects: [] },
    ledgerEvidence: { applied_migrations: appliedMigrations },
    catalogEvidence: { objects: [] }
  });
  return result.blockers;
}

const SQL_LF = Buffer.from('CREATE TABLE probe (id text);\n', 'utf8');

describe('DB migration identity/order/checksum contract (#3458)', () => {

  describe('1. Committed canonical stream is unchanged (no activation)', () => {
    it('canonical manifest remains ADOPTION_REQUIRED with empty migrations', () => {
      const manifest = JSON.parse(fs.readFileSync(CANONICAL_MANIFEST_PATH, 'utf8'));
      assert.strictEqual(manifest.status, 'ADOPTION_REQUIRED');
      assert.deepStrictEqual(manifest.migrations, []);
    });
    it('canonical manifest declares the ID format and sha256 algorithm', () => {
      const manifest = JSON.parse(fs.readFileSync(CANONICAL_MANIFEST_PATH, 'utf8'));
      assert.match(manifest.migration_id_format, /YYYYMMDDHHMMSS_slug/);
      assert.strictEqual(manifest.checksum_algorithm, 'sha256');
      assert.strictEqual(manifest.canonical_directory, 'db/migrations');
    });
  });

  describe('2. Valid cases', () => {
    it('accepts a correct ID, canonical path, and raw-byte checksum', () => {
      const tempRoot = makeTempRepo();
      try {
        const id = '20260101000000_first';
        const { relPath, checksum } = writeSql(tempRoot, id, SQL_LF);
        const result = core.validateMigrationManifest(makeManifest([entry(id, relPath, checksum)]), tempRoot);
        assert.strictEqual(result.ok, true, result.errors.join('\n'));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
    it('accepts strictly ascending IDs', () => {
      const tempRoot = makeTempRepo();
      try {
        const a = '20260101000000_first';
        const b = '20260102000000_second';
        const fa = writeSql(tempRoot, a, SQL_LF);
        const fb = writeSql(tempRoot, b, Buffer.from('CREATE TABLE probe2 (id text);\n', 'utf8'));
        const manifest = makeManifest([entry(a, fa.relPath, fa.checksum), entry(b, fb.relPath, fb.checksum)]);
        const result = core.validateMigrationManifest(manifest, tempRoot);
        assert.strictEqual(result.ok, true, result.errors.join('\n'));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
    it('accepts ADOPTION_REQUIRED with empty migrations', () => {
      const tempRoot = makeTempRepo();
      try {
        const result = core.validateMigrationManifest(makeManifest([]), tempRoot);
        assert.strictEqual(result.ok, true, result.errors.join('\n'));
        assert.strictEqual(result.migrations.length, 0);
      } finally {
        removeTempRepo(tempRoot);
      }
    });
    it('accepts the established lowercase kebab-case slug (dash) convention', () => {
      const tempRoot = makeTempRepo();
      try {
        const id = '20260101000000_example-one';
        const { relPath, checksum } = writeSql(tempRoot, id, SQL_LF);
        const result = core.validateMigrationManifest(makeManifest([entry(id, relPath, checksum)]), tempRoot);
        assert.strictEqual(result.ok, true, result.errors.join('\n'));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
  });

  describe('3. Invalid ID cases', () => {
    function idErrors(badId) {
      const tempRoot = makeTempRepo();
      try {
        // Path is kept canonical for the (valid) basename of the file we write; the
        // manifest id is the value under test.
        const { relPath, checksum } = writeSql(tempRoot, 'placeholder', SQL_LF);
        const result = core.validateMigrationManifest(makeManifest([entry(badId, relPath, checksum)]), tempRoot);
        return result.errors;
      } finally {
        removeTempRepo(tempRoot);
      }
    }
    it('rejects a 13-digit timestamp', () => {
      assert.ok(idErrors('2026010100000_first').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects a 15-digit timestamp', () => {
      assert.ok(idErrors('202601010000000_first').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects an uppercase slug', () => {
      assert.ok(idErrors('20260101000000_First').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects a slug containing whitespace', () => {
      assert.ok(idErrors('20260101000000_fo o').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects an underscore inside the slug (established pattern is kebab-case)', () => {
      assert.ok(idErrors('20260101000000_foo_bar').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects a missing separator', () => {
      assert.ok(idErrors('20260101000000first').some((e) => e.startsWith('MIGRATION_ID_INVALID')));
    });
    it('rejects duplicate IDs', () => {
      const tempRoot = makeTempRepo();
      try {
        const id = '20260101000000_first';
        const f = writeSql(tempRoot, id, SQL_LF);
        const manifest = makeManifest([entry(id, f.relPath, f.checksum), entry(id, f.relPath, f.checksum)]);
        const result = core.validateMigrationManifest(manifest, tempRoot);
        assert.ok(result.errors.some((e) => e.startsWith('MIGRATION_ID_DUPLICATE')));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
  });

  describe('4. Invalid path cases', () => {
    function pathErrors(relPath, id) {
      const tempRoot = makeTempRepo();
      try {
        // Materialize a file at a safe canonical location so existence is not the
        // signal under test; the manifest path is the value under test.
        const safe = writeSql(tempRoot, id || '20260101000000_first', SQL_LF);
        const manifest = makeManifest([entry(id || '20260101000000_first', relPath, safe.checksum)]);
        return core.validateMigrationManifest(manifest, tempRoot).errors;
      } finally {
        removeTempRepo(tempRoot);
      }
    }
    it('rejects a path outside the canonical directory', () => {
      assert.ok(pathErrors('scripts/20260101000000_first.sql').some((e) => e.startsWith('MIGRATION_PATH_NON_CANONICAL')));
    });
    it('rejects a docs/ops canonical path', () => {
      assert.ok(pathErrors('docs/ops/20260101000000_first.sql').some((e) => e.startsWith('MIGRATION_PATH_NON_CANONICAL')));
    });
    it('rejects path traversal', () => {
      assert.ok(pathErrors('../20260101000000_first.sql').some((e) => e.startsWith('MIGRATION_PATH_NON_CANONICAL')));
    });
    it('rejects traversal that begins inside the canonical directory', () => {
      assert.ok(pathErrors('db/migrations/../../scripts/x.sql').some((e) => e.startsWith('MIGRATION_PATH_NON_CANONICAL')));
    });
    it('rejects a non-.sql extension', () => {
      assert.ok(pathErrors('db/migrations/20260101000000_first.txt').some((e) => e.startsWith('MIGRATION_PATH_NON_CANONICAL')));
    });
    it('rejects basename/ID mismatch', () => {
      assert.ok(pathErrors('db/migrations/20260101000000_other.sql', '20260101000000_first').some((e) => e.startsWith('MIGRATION_PATH_ID_MISMATCH')));
    });
    it('rejects duplicate paths', () => {
      const tempRoot = makeTempRepo();
      try {
        const a = '20260101000000_first';
        const b = '20260102000000_second';
        const fa = writeSql(tempRoot, a, SQL_LF);
        const manifest = makeManifest([entry(a, fa.relPath, fa.checksum), entry(b, fa.relPath, fa.checksum)]);
        const result = core.validateMigrationManifest(manifest, tempRoot);
        assert.ok(result.errors.some((e) => e.startsWith('MIGRATION_PATH_DUPLICATE')));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
  });

  describe('5. Ordering cases', () => {
    it('rejects out-of-order entries (timestamp reversal)', () => {
      const tempRoot = makeTempRepo();
      try {
        const older = '20260101000000_first';
        const newer = '20260102000000_second';
        const fOlder = writeSql(tempRoot, older, SQL_LF);
        const fNewer = writeSql(tempRoot, newer, Buffer.from('CREATE TABLE probe2 (id text);\n', 'utf8'));
        // Newer first, older second -> reversal.
        const manifest = makeManifest([entry(newer, fNewer.relPath, fNewer.checksum), entry(older, fOlder.relPath, fOlder.checksum)]);
        const result = core.validateMigrationManifest(manifest, tempRoot);
        assert.ok(result.errors.some((e) => e.startsWith('MIGRATION_ORDER_INVALID')));
      } finally {
        removeTempRepo(tempRoot);
      }
    });
  });

  describe('6. Checksum byte semantics (raw bytes, no normalization)', () => {
    it('accepts an exact raw-byte checksum match', () => {
      const errors = validateByteCase(SQL_LF, SQL_LF);
      assert.ok(!errors.some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')), errors.join('\n'));
    });
    it('rejects LF -> CRLF', () => {
      const crlf = Buffer.from(SQL_LF.toString('utf8').replace(/\n/g, '\r\n'), 'utf8');
      assert.ok(validateByteCase(SQL_LF, crlf).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
    it('rejects an added trailing newline', () => {
      const extra = Buffer.concat([SQL_LF, Buffer.from('\n', 'utf8')]);
      assert.ok(validateByteCase(SQL_LF, extra).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
    it('rejects an added trailing space', () => {
      const spaced = Buffer.from('CREATE TABLE probe (id text); \n', 'utf8');
      assert.ok(validateByteCase(SQL_LF, spaced).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
    it('rejects a comment-only addition', () => {
      const commented = Buffer.concat([Buffer.from('-- touched\n', 'utf8'), SQL_LF]);
      assert.ok(validateByteCase(SQL_LF, commented).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
    it('rejects an added UTF-8 BOM', () => {
      const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), SQL_LF]);
      assert.ok(validateByteCase(SQL_LF, bom).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
    it('rejects a single-byte change', () => {
      const mutated = Buffer.from(SQL_LF);
      mutated[13] = mutated[13] === 0x61 ? 0x62 : 0x61; // flip one byte
      assert.ok(validateByteCase(SQL_LF, mutated).some((e) => e.startsWith('MIGRATION_SOURCE_CHECKSUM_MISMATCH')));
    });
  });

  describe('7. Checksum format rejection', () => {
    function checksumFormatErrors(checksum) {
      const tempRoot = makeTempRepo();
      try {
        const id = '20260101000000_first';
        const { relPath } = writeSql(tempRoot, id, SQL_LF);
        const manifest = makeManifest([entry(id, relPath, checksum)]);
        return core.validateMigrationManifest(manifest, tempRoot).errors;
      } finally {
        removeTempRepo(tempRoot);
      }
    }
    const validHex = core.sha256(SQL_LF).replace(/^sha256:/, '');
    it('rejects uppercase SHA hex', () => {
      assert.ok(checksumFormatErrors(`sha256:${validHex.toUpperCase()}`).some((e) => e.startsWith('MIGRATION_CHECKSUM_INVALID')));
    });
    it('rejects a 63-character checksum', () => {
      assert.ok(checksumFormatErrors(`sha256:${validHex.slice(0, 63)}`).some((e) => e.startsWith('MIGRATION_CHECKSUM_INVALID')));
    });
    it('rejects a 65-character checksum', () => {
      assert.ok(checksumFormatErrors(`sha256:${validHex}a`).some((e) => e.startsWith('MIGRATION_CHECKSUM_INVALID')));
    });
    it('rejects a non-hex checksum', () => {
      assert.ok(checksumFormatErrors(`sha256:${'z'.repeat(64)}`).some((e) => e.startsWith('MIGRATION_CHECKSUM_INVALID')));
    });
    it('rejects a wrong algorithm declaration', () => {
      assert.ok(checksumFormatErrors(`sha1:${validHex}`).some((e) => e.startsWith('MIGRATION_CHECKSUM_INVALID')));
    });
  });

  describe('8. Ledger evidence rules (synthetic evidence, no database)', () => {
    const idA = '20260101000000_a';
    const idB = '20260102000000_b';
    const checksumA = core.sha256('body-a');
    const checksumB = core.sha256('body-b');
    const expected = [{ id: idA, checksum: checksumA }, { id: idB, checksum: checksumB }];

    it('same ID + different checksum fails closed (edited)', () => {
      const blockers = ledgerBlockers(expected, [{ id: idA, checksum: core.sha256('tampered') }, { id: idB, checksum: checksumB }]);
      assert.ok(blockers.some((b) => b.startsWith('GATE_EDITED_MIGRATION')));
    });
    it('unknown applied ID fails closed', () => {
      const blockers = ledgerBlockers(expected, [{ id: idA, checksum: checksumA }, { id: idB, checksum: checksumB }, { id: '20260103000000_zzz', checksum: core.sha256('z') }]);
      assert.ok(blockers.some((b) => b.startsWith('GATE_UNKNOWN_APPLIED_MIGRATION')));
    });
    it('missing expected ID fails closed', () => {
      const blockers = ledgerBlockers(expected, [{ id: idA, checksum: checksumA }]);
      assert.ok(blockers.some((b) => b.startsWith('GATE_MISSING_APPLIED_MIGRATION')));
    });
    it('reordered applied IDs fail closed', () => {
      const blockers = ledgerBlockers(expected, [{ id: idB, checksum: checksumB }, { id: idA, checksum: checksumA }]);
      assert.ok(blockers.some((b) => b.startsWith('GATE_REORDERED_MIGRATION')));
    });
    it('duplicate ledger record fails closed', () => {
      const blockers = ledgerBlockers(expected, [{ id: idA, checksum: checksumA }, { id: idA, checksum: checksumA }, { id: idB, checksum: checksumB }]);
      assert.ok(blockers.some((b) => b.startsWith('GATE_DUPLICATE_APPLIED_MIGRATION')));
    });
  });

  describe('9. Source-only safety boundary', () => {
    it('core has no database/network/deploy client or secret material', () => {
      const source = fs.readFileSync(CORE_PATH, 'utf8');
      assert.doesNotMatch(source, /require\(['"](?:pg|child_process|playwright|dotenv|net|http|https|node:child_process|node:net|node:http|node:https)['"]\)/i);
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /\bDATABASE_URL\b/);
      assert.doesNotMatch(source, /postgres(?:ql)?:\/\//i);
      assert.doesNotMatch(source, /-----BEGIN[A-Z ]*PRIVATE KEY-----/);
      assert.doesNotMatch(source, /spawnSync|execSync|spawn\(|exec\(/);
    });
    it('contract document states the no-mutation boundary when present', () => {
      if (!fs.existsSync(CONTRACT_DOC_PATH)) return; // doc added in this slice
      const doc = fs.readFileSync(CONTRACT_DOC_PATH, 'utf8');
      assert.match(doc, /SQL executed.*No|No SQL is executed/i);
      assert.match(doc, /Database accessed.*No|No database connection/i);
      assert.match(doc, /Production mutation.*No|No Production mutation/i);
    });
  });
});
