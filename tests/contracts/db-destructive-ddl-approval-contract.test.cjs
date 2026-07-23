'use strict';

/**
 * Focused SOURCE_STATIC contract test: destructive DDL classification,
 * declaration, and approval contract (#3458, third slice).
 *
 * It validates scripts/migration-provenance-core.cjs (detectDestructiveOperations
 * and validateMigrationManifest) against synthetic .sql fixtures created in the
 * OS temporary directory. It NEVER commits a .sql fixture to the repository,
 * NEVER connects to a database, NEVER executes SQL, and NEVER uses DATABASE_URL
 * or any secret. Every temporary fixture is removed on completion.
 *
 * This is a static regex contract, NOT a full PostgreSQL parser. Forms that
 * cannot be classified reliably are documented as limitations (REVIEW_REQUIRED),
 * never silently passed.
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

function makeTempRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebud-ddl-'));
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

function makeManifest(migrations) {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    canonical_directory: 'db/migrations',
    ledger: {
      contract_path: 'db/migration-provenance/ledger-contract.json',
      required_record_fields: LEDGER_FIELDS
    },
    migrations
  };
}

// Validate a single synthetic migration whose SQL body and declaration are given.
// Returns the manifest error list.
function validateDestructive(sqlBody, entryOverrides = {}) {
  const tempRoot = makeTempRepo();
  try {
    const id = '20260101000000_probe';
    const relPath = `db/migrations/${id}.sql`;
    const bytes = Buffer.from(sqlBody, 'utf8');
    fs.writeFileSync(path.join(tempRoot, relPath), bytes);
    const entry = {
      id,
      name: id,
      path: relPath,
      checksum: core.sha256(bytes),
      depends_on: [],
      risk_class: 'ADDITIVE',
      transaction_mode: 'REQUIRED',
      expected_preconditions: [],
      expected_postconditions: [],
      rollback_support: 'NONE',
      destructive_operations: [],
      owner_domain: 'platform',
      approval_reference: 'n/a',
      ...entryOverrides
    };
    return core.validateMigrationManifest(makeManifest([entry]), tempRoot).errors;
  } finally {
    removeTempRepo(tempRoot);
  }
}

function destructiveErrors(errors) {
  return errors.filter((e) => e.startsWith('MIGRATION_DESTRUCTIVE_'));
}

describe('DB destructive DDL approval contract (#3458)', () => {

  describe('1. Valid cases', () => {
    it('additive CREATE TABLE with empty destructive_operations passes', () => {
      const errors = validateDestructive('CREATE TABLE probe (id text);\n');
      assert.deepStrictEqual(destructiveErrors(errors), [], errors.join('\n'));
    });
    it('DROP TABLE + DROP_TABLE declared + real approval passes', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.deepStrictEqual(destructiveErrors(errors), [], errors.join('\n'));
    });
    it('multiple destructive operations fully declared passes', () => {
      const errors = validateDestructive('DROP TABLE probe;\nTRUNCATE other;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE', 'TRUNCATE_TABLE'],
        approval_reference: 'adr:0001'
      });
      assert.deepStrictEqual(destructiveErrors(errors), [], errors.join('\n'));
    });
  });

  describe('2. Missing declaration', () => {
    it('DROP TABLE with empty destructive_operations fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\n');
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED')), errors.join('\n'));
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_MISSING')), errors.join('\n'));
    });
    it('TRUNCATE with no declaration fails closed', () => {
      const errors = validateDestructive('TRUNCATE TABLE probe;\n');
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_UNDECLARED')), errors.join('\n'));
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_MISSING:20260101000000_probe:TRUNCATE_TABLE')), errors.join('\n'));
    });
    it('DROP COLUMN with no declaration fails closed', () => {
      const errors = validateDestructive('ALTER TABLE probe DROP COLUMN legacy;\n');
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_MISSING:20260101000000_probe:DROP_COLUMN')), errors.join('\n'));
    });
  });

  describe('3. Partial declaration', () => {
    it('DROP TABLE + DROP INDEX with only DROP_TABLE declared fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\nDROP INDEX probe_idx;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_MISSING:20260101000000_probe:DROP_INDEX')), errors.join('\n'));
    });
    it('DROP COLUMN + SET NOT NULL with only one declared fails closed', () => {
      const errors = validateDestructive('ALTER TABLE probe DROP COLUMN legacy;\nALTER TABLE probe ALTER COLUMN name SET NOT NULL;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_COLUMN'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_MISSING:20260101000000_probe:SET_NOT_NULL')), errors.join('\n'));
    });
  });

  describe('4. Invalid declaration', () => {
    it('unknown operation string fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE', 'BOGUS_OP'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_UNKNOWN:20260101000000_probe:BOGUS_OP')), errors.join('\n'));
    });
    it('duplicate operation declaration fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE', 'DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_OPERATION_DUPLICATE:20260101000000_probe:DROP_TABLE')), errors.join('\n'));
    });
    it('declared destructive operation with risk_class ADDITIVE fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'ADDITIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_RISK_REQUIRED')), errors.join('\n'));
    });
    it('risk_class DESTRUCTIVE with empty operations on additive SQL fails closed (spurious label)', () => {
      const errors = validateDestructive('CREATE TABLE probe (id text);\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: [],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS')), errors.join('\n'));
    });
    it('destructive declaration with no destructive SQL fails closed (spurious declaration)', () => {
      const errors = validateDestructive('CREATE TABLE probe (id text);\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_DECLARATION_SPURIOUS:20260101000000_probe:DROP_TABLE')), errors.join('\n'));
    });
  });

  describe('5. Approval reference policy', () => {
    const destructive = {
      risk_class: 'DESTRUCTIVE',
      destructive_operations: ['DROP_TABLE']
    };
    it('empty approval_reference fails closed', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', { ...destructive, approval_reference: '' });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_MISSING')), errors.join('\n'));
    });
    it('placeholder "n/a" is rejected', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', { ...destructive, approval_reference: 'n/a' });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER')), errors.join('\n'));
    });
    it('placeholder "todo" is rejected', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', { ...destructive, approval_reference: 'todo' });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER')), errors.join('\n'));
    });
    it('placeholder "pending" is rejected', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', { ...destructive, approval_reference: 'pending' });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER')), errors.join('\n'));
    });
    it('a real synthetic approval reference passes', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', { ...destructive, approval_reference: 'issue:3458' });
      assert.ok(!errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL')), errors.join('\n'));
    });
  });

  describe('6. Static detection vocabulary', () => {
    it('detects DROP TABLE', () => {
      assert.ok(core.detectDestructiveOperations('DROP TABLE probe;').includes('DROP_TABLE'));
    });
    it('detects TRUNCATE', () => {
      assert.ok(core.detectDestructiveOperations('TRUNCATE TABLE probe;').includes('TRUNCATE_TABLE'));
    });
    it('detects DROP COLUMN', () => {
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe DROP COLUMN legacy;').includes('DROP_COLUMN'));
    });
    it('detects ALTER COLUMN TYPE', () => {
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe ALTER COLUMN amount TYPE numeric;').includes('ALTER_COLUMN_TYPE'));
    });
    it('detects SET NOT NULL', () => {
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe ALTER COLUMN name SET NOT NULL;').includes('SET_NOT_NULL'));
    });
    it('detects DROP CONSTRAINT', () => {
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe DROP CONSTRAINT probe_pk;').includes('DROP_CONSTRAINT'));
    });
    it('detects DROP INDEX', () => {
      assert.ok(core.detectDestructiveOperations('DROP INDEX probe_idx;').includes('DROP_INDEX'));
    });
    it('detects DROP FUNCTION', () => {
      assert.ok(core.detectDestructiveOperations('DROP FUNCTION probe_fn();').includes('DROP_FUNCTION'));
    });
    it('detects DROP TRIGGER', () => {
      assert.ok(core.detectDestructiveOperations('DROP TRIGGER probe_trg ON probe;').includes('DROP_TRIGGER'));
    });
    it('detects DROP TYPE', () => {
      assert.ok(core.detectDestructiveOperations('DROP TYPE probe_type;').includes('DROP_TYPE'));
    });
    it('detects DROP POLICY', () => {
      assert.ok(core.detectDestructiveOperations('DROP POLICY probe_policy ON probe;').includes('DROP_POLICY'));
    });
    it('detects ON DELETE CASCADE and ON UPDATE CASCADE as FK cascade expansion', () => {
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES other(b) ON DELETE CASCADE;').includes('FK_CASCADE_EXPANSION'));
      assert.ok(core.detectDestructiveOperations('ALTER TABLE probe ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES other(b) ON UPDATE CASCADE;').includes('FK_CASCADE_EXPANSION'));
    });
    it('returns a sorted, de-duplicated operation list', () => {
      const detected = core.detectDestructiveOperations('DROP TABLE a;\nDROP TABLE b;\nTRUNCATE c;');
      assert.deepStrictEqual(detected, ['DROP_TABLE', 'TRUNCATE_TABLE']);
    });
  });

  describe('7. Source-only safety boundary', () => {
    it('core has no database/network/deploy client or secret material', () => {
      const source = fs.readFileSync(CORE_PATH, 'utf8');
      assert.doesNotMatch(source, /require\(['"](?:pg|child_process|playwright|dotenv|net|http|https|node:child_process|node:net|node:http|node:https)['"]\)/i);
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /\bDATABASE_URL\b/);
      assert.doesNotMatch(source, /postgres(?:ql)?:\/\//i);
      assert.doesNotMatch(source, /-----BEGIN[A-Z ]*PRIVATE KEY-----/);
      assert.doesNotMatch(source, /spawnSync|execSync|spawn\(|exec\(/);
    });
  });

  describe('8. REVIEW_REQUIRED ambiguity signals (fail closed)', () => {
    it('concatenated EXECUTE destructive SQL is REVIEW_REQUIRED', () => {
      const errors = validateDestructive("EXECUTE 'DROP ' || 'TABLE probe';\n");
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED')), errors.join('\n'));
    });
    it('DO $$ ... EXECUTE ... $$ block is REVIEW_REQUIRED', () => {
      const errors = validateDestructive("DO $$\nBEGIN\n  EXECUTE 'DROP TABLE probe';\nEND\n$$;\n");
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:20260101000000_probe:PROCEDURAL_DO_BLOCK')), errors.join('\n'));
    });
    it('LANGUAGE plpgsql body with a dynamic operation is REVIEW_REQUIRED', () => {
      const errors = validateDestructive("CREATE FUNCTION drop_it() RETURNS void AS $$\nBEGIN\n  EXECUTE 'DROP TABLE probe';\nEND\n$$ LANGUAGE plpgsql;\n");
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:20260101000000_probe:PLPGSQL_BODY')), errors.join('\n'));
    });
    it('format() building destructive SQL is REVIEW_REQUIRED', () => {
      const errors = validateDestructive("EXECUTE format('DROP TABLE %I', target_name);\n");
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:20260101000000_probe:GENERATED_DDL')), errors.join('\n'));
    });
    it('string concatenation building DROP TABLE is REVIEW_REQUIRED', () => {
      const errors = validateDestructive("EXECUTE 'DROP TABLE ' || quote_ident(target_name);\n");
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED:20260101000000_probe:GENERATED_DDL')), errors.join('\n'));
    });
    it('returns sorted, unique reason codes', () => {
      const reasons = core.detectDestructiveReviewRequiredReasons("DO $$\nBEGIN\n  EXECUTE 'DROP ' || 'TABLE t';\nEND\n$$;\n");
      assert.deepStrictEqual(reasons, [...reasons].sort());
      assert.deepStrictEqual(reasons, [...new Set(reasons)]);
      assert.ok(reasons.includes('PROCEDURAL_DO_BLOCK'));
      assert.ok(reasons.includes('DYNAMIC_EXECUTE'));
    });
    it('REVIEW_REQUIRED persists even with destructive_operations and a valid approval', () => {
      const errors = validateDestructive("DO $$\nBEGIN\n  EXECUTE 'DROP TABLE probe';\nEND\n$$;\n", {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_REVIEW_REQUIRED')), errors.join('\n'));
    });
  });

  describe('9. Non-review-required forms (no over-blocking)', () => {
    it('plain additive CREATE TABLE is not REVIEW_REQUIRED', () => {
      assert.deepStrictEqual(core.detectDestructiveReviewRequiredReasons('CREATE TABLE probe (id text);\n'), []);
    });
    it('direct DROP TABLE keeps the fixed DROP_TABLE path, not REVIEW_REQUIRED', () => {
      assert.deepStrictEqual(core.detectDestructiveReviewRequiredReasons('DROP TABLE probe;\n'), []);
      assert.ok(core.detectDestructiveOperations('DROP TABLE probe;\n').includes('DROP_TABLE'));
    });
    it('the word execute inside a normal string value is not a false positive', () => {
      assert.deepStrictEqual(core.detectDestructiveReviewRequiredReasons("INSERT INTO logs (msg) VALUES ('please execute the plan');\n"), []);
    });
    it('a SQL function without dynamic execution is not over-blocked', () => {
      assert.deepStrictEqual(core.detectDestructiveReviewRequiredReasons("CREATE FUNCTION one() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql;\n"), []);
    });
  });

  describe('10. Approval reference grammar (valid)', () => {
    it('accepts issue:<digits>', () => {
      assert.ok(core.isValidApprovalReference('issue:3458'));
    });
    it('accepts pr:<digits>', () => {
      assert.ok(core.isValidApprovalReference('pr:3633'));
    });
    it('accepts adr:<identifier>', () => {
      assert.ok(core.isValidApprovalReference('adr:0001'));
    });
    it('accepts change:<identifier>', () => {
      assert.ok(core.isValidApprovalReference('change:DB-2026-001'));
    });
    it('accepts approval:<identifier> with slash', () => {
      assert.ok(core.isValidApprovalReference('approval:arch/db-001'));
    });
  });

  describe('11. Approval reference grammar (invalid)', () => {
    it('rejects "todo later"', () => {
      assert.ok(!core.isValidApprovalReference('todo later'));
    });
    it('rejects "pending-review"', () => {
      assert.ok(!core.isValidApprovalReference('pending-review'));
    });
    it('rejects "ask-owner"', () => {
      assert.ok(!core.isValidApprovalReference('ask-owner'));
    });
    it('rejects "approval-needed"', () => {
      assert.ok(!core.isValidApprovalReference('approval-needed'));
    });
    it('rejects arbitrary "abc"', () => {
      assert.ok(!core.isValidApprovalReference('abc'));
    });
    it('rejects "issue:" (empty number)', () => {
      assert.ok(!core.isValidApprovalReference('issue:'));
    });
    it('rejects "issue:abc" (non-numeric)', () => {
      assert.ok(!core.isValidApprovalReference('issue:abc'));
    });
    it('rejects "issue:0" (not positive)', () => {
      assert.ok(!core.isValidApprovalReference('issue:0'));
    });
    it('rejects "pr:-1" (negative)', () => {
      assert.ok(!core.isValidApprovalReference('pr:-1'));
    });
    it('rejects "change:" (empty identifier)', () => {
      assert.ok(!core.isValidApprovalReference('change:'));
    });
    it('rejects a reference containing a space', () => {
      assert.ok(!core.isValidApprovalReference('approval:needs review'));
    });
    it('a non-placeholder invalid approval fails closed as INVALID in a destructive migration', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'abc'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_INVALID')), errors.join('\n'));
    });
    it('a placeholder approval stays PLACEHOLDER (not INVALID)', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: 'n/a'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_PLACEHOLDER')), errors.join('\n'));
      assert.ok(!errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_INVALID')), errors.join('\n'));
    });
  });

  describe('12. Canonical whitespace-free approval reference', () => {
    it('rejects a leading space', () => {
      assert.ok(!core.isValidApprovalReference(' issue:3458'));
    });
    it('rejects a trailing space', () => {
      assert.ok(!core.isValidApprovalReference('issue:3458 '));
    });
    it('rejects a leading tab', () => {
      assert.ok(!core.isValidApprovalReference('\tpr:3633'));
    });
    it('rejects a trailing newline', () => {
      assert.ok(!core.isValidApprovalReference('approval:arch/db-001\n'));
    });
    it('still accepts the canonical unpadded reference', () => {
      assert.ok(core.isValidApprovalReference('issue:3458'));
    });
    it('a whitespace-padded reference fails closed as INVALID in a destructive migration', () => {
      const errors = validateDestructive('DROP TABLE probe;\n', {
        risk_class: 'DESTRUCTIVE',
        destructive_operations: ['DROP_TABLE'],
        approval_reference: ' issue:3458'
      });
      assert.ok(errors.some((e) => e.startsWith('MIGRATION_DESTRUCTIVE_APPROVAL_INVALID')), errors.join('\n'));
    });
  });
});
