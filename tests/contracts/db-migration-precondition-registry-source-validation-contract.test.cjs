'use strict';

/**
 * Focused SOURCE_STATIC contract test: precondition registry source validation (#3659).
 *
 * Exercises scripts/migration-precondition-registry-validator-core.cjs using
 * ONLY synthetic JavaScript objects. No DB, PostgreSQL, Docker, SQL fixture,
 * network, or environment secret is used.
 *
 * Refs #3659
 * Refs #3657
 * Refs #3658
 * Refs #3652
 * Refs #3650
 * Refs #3646
 *
 * Refs #3458 — Keep OPEN.
 * Refs #3425 — Keep OPEN.
 * Refs #3435 — Keep OPEN.
 * Refs #3437 — Keep OPEN.
 * Refs #1882 — Keep OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR_PATH = path.join(REPO_ROOT, 'scripts', 'migration-precondition-registry-validator-core.cjs');

const {
  validatePreconditionRegistry,
  validateRegistryManifestBinding,
  validatePlainObjectShape,
  ALLOWED_TOP_LEVEL_KEYS,
  ALLOWED_ENTRY_KEYS,
  ALLOWED_CHECK_KEYS,
  FORBIDDEN_AUTHORITY_KEYS,
  VALID_FORMAT_VERSION,
  VALID_STATUSES
} = require(VALIDATOR_PATH);

// --- Valid fixture builders ---

function validRegistry(overrides) {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    entries: [],
    ...overrides
  };
}

function activeRegistry(entries) {
  return {
    format_version: '1.0',
    status: 'ACTIVE',
    entries: entries || [
      {
        migration_id: '20250101000000_test',
        checks: [
          {
            check_id: 'check-1',
            query_reference: 'query:check-1',
            expected: true
          }
        ]
      }
    ]
  };
}

function adopterRequiredManifest() {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    canonical_directory: 'db/migrations',
    migrations: []
  };
}

function activeManifest(migrations) {
  return {
    format_version: '1.0',
    status: 'ACTIVE',
    canonical_directory: 'db/migrations',
    migrations: migrations || [
      {
        id: '20250101000000_test',
        name: 'test migration',
        path: 'db/migrations/20250101000000_test.sql',
        checksum: 'sha256:' + 'a'.repeat(64),
        depends_on: [],
        risk_class: 'ADDITIVE',
        transaction_mode: 'REQUIRED',
        expected_preconditions: [],
        expected_postconditions: [],
        rollback_support: 'none',
        destructive_operations: [],
        owner_domain: 'db',
        approval_reference: 'issue:9999'
      }
    ]
  };
}

describe('DB precondition registry source validation contract (#3659)', () => {

  describe('1. Public surface', () => {
    it('1. validatePreconditionRegistry is a function', () => {
      assert.strictEqual(typeof validatePreconditionRegistry, 'function');
    });

    it('2. validateRegistryManifestBinding is a function', () => {
      assert.strictEqual(typeof validateRegistryManifestBinding, 'function');
    });

    it('3. ALLOWED_TOP_LEVEL_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_TOP_LEVEL_KEYS));
    });

    it('4. ALLOWED_ENTRY_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_ENTRY_KEYS));
    });

    it('5. ALLOWED_CHECK_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_CHECK_KEYS));
    });

    it('6. FORBIDDEN_AUTHORITY_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(FORBIDDEN_AUTHORITY_KEYS));
    });

    it('7. exact top-level keys are format_version, status, entries', () => {
      assert.deepStrictEqual([...ALLOWED_TOP_LEVEL_KEYS], ['format_version', 'status', 'entries']);
    });

    it('8. exact entry keys are migration_id, checks', () => {
      assert.deepStrictEqual([...ALLOWED_ENTRY_KEYS], ['migration_id', 'checks']);
    });

    it('9. exact check keys are check_id, query_reference, expected', () => {
      assert.deepStrictEqual([...ALLOWED_CHECK_KEYS], ['check_id', 'query_reference', 'expected']);
    });
  });

  describe('2. Current committed inactive registry', () => {
    it('10. ADOPTION_REQUIRED + empty entries -> ok', () => {
      const result = validatePreconditionRegistry(validRegistry());
      assert.ok(result.ok);
      assert.deepStrictEqual(result.errors, []);
    });

    it('11. ADOPTION_REQUIRED manifest + ADOPTION_REQUIRED registry -> binding ok', () => {
      const registry = validRegistry();
      const manifest = adopterRequiredManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(result.ok);
    });
  });

  describe('3. Schema validation', () => {
    it('12. format_version must be "1.0"', () => {
      const result = validatePreconditionRegistry(validRegistry({ format_version: '2.0' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('FORMAT_VERSION')));
    });

    it('13. invalid status rejected', () => {
      const result = validatePreconditionRegistry(validRegistry({ status: 'INVALID' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('STATUS')));
    });

    it('14. status must be ADOPTION_REQUIRED or ACTIVE', () => {
      let r = validatePreconditionRegistry(validRegistry({ status: 'ADOPTION_REQUIRED' }));
      assert.ok(r.ok);
      r = validatePreconditionRegistry(validRegistry({ status: 'ACTIVE', entries: [{ migration_id: 'test', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true }] }] }));
      assert.ok(r.ok);
    });

    it('15. entries must be an array', () => {
      const result = validatePreconditionRegistry(validRegistry({ entries: 'not-array' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRIES_NOT_ARRAY')));
    });

    it('16. ADOPTION_REQUIRED + non-empty entries -> FAIL', () => {
      const result = validatePreconditionRegistry(validRegistry({
        entries: [{ migration_id: 'test', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true }] }]
      }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ADOPTION_REQUIRED_NONEMPTY_ENTRIES')));
    });

    it('17. ACTIVE + empty entries -> FAIL', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: []
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ACTIVE_EMPTY_ENTRIES')));
    });
  });

  describe('4. Entry validation', () => {
    it('18. duplicate migration_id rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'dup', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true }] },
          { migration_id: 'dup', checks: [{ check_id: 'c2', query_reference: 'q:2', expected: false }] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('DUPLICATE_MIGRATION_ID')));
    });

    it('19. entry extra key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [], extra: 'bad' }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });

    it('20. entry symbol key rejected', () => {
      const entry = { migration_id: 'test', checks: [] };
      entry[Symbol('bad')] = 'value';
      const registry = {
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [entry]
      };
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });

    it('21. entry getter rejected', () => {
      const entry = Object.create({}, {
        migration_id: { get() { return 'test'; }, enumerable: true },
        checks: { value: [], enumerable: true }
      });
      const registry = {
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [entry]
      };
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });
  });

  describe('5. Check validation', () => {
    it('22. expected must be boolean', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: 'not-boolean' }] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('EXPECTED_NOT_BOOLEAN')));
    });

    it('23. duplicate check_id rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [
            { check_id: 'dup', query_reference: 'q:1', expected: true },
            { check_id: 'dup', query_reference: 'q:2', expected: false }
          ]}
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('DUPLICATE_ID')));
    });

    it('24. check extra key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true, extra: 'bad' }] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });

    it('25. check symbol key rejected', () => {
      const check = { check_id: 'c1', query_reference: 'q:1', expected: true };
      check[Symbol('bad')] = 'value';
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [check] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });

    it('26. check getter rejected', () => {
      const check = Object.create({}, {
        check_id: { get() { return 'c1'; }, enumerable: true },
        query_reference: { value: 'q:1', enumerable: true },
        expected: { value: true, enumerable: true }
      });
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [check] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });
  });

  describe('6. Forbidden authority keys', () => {
    for (const forbiddenKey of FORBIDDEN_AUTHORITY_KEYS) {
      it(`27. forbidden check key "${forbiddenKey}" rejected`, () => {
        const check = { check_id: 'c1', query_reference: 'q:1', expected: true };
        check[forbiddenKey] = 'some value';
        const result = validatePreconditionRegistry({
          format_version: '1.0',
          status: 'ACTIVE',
          entries: [
            { migration_id: 'test', checks: [check] }
          ]
        });
        assert.ok(!result.ok);
        assert.ok(result.errors.some(e => e.includes('FORBIDDEN_AUTHORITY_KEY') || e.includes('CHECK_INVALID_KEYS')));
      });
    }
  });

  describe('7. Manifest binding', () => {
    it('28. ADOPTION_REQUIRED manifest rejects ACTIVE registry', () => {
      const registry = activeRegistry();
      const manifest = adopterRequiredManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('REGISTRY_BINDING_MANIFEST_INACTIVE_REGISTRY_ACTIVE')));
    });

    it('29. ACTIVE manifest rejects ADOPTION_REQUIRED registry', () => {
      const registry = validRegistry();
      const manifest = activeManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('REGISTRY_BINDING_MANIFEST_ACTIVE_REGISTRY_NOT_ACTIVE')));
    });

    it('30. orphan registry entry rejected (ACTIVE)', () => {
      const registry = activeRegistry([
        { migration_id: 'orphan', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true }] }
      ]);
      const manifest = activeManifest([
        {
          id: '20250101000000_test',
          name: 'test migration',
          path: 'db/migrations/20250101000000_test.sql',
          checksum: 'sha256:' + 'a'.repeat(64),
          depends_on: [],
          risk_class: 'ADDITIVE',
          transaction_mode: 'REQUIRED',
          expected_preconditions: [],
          expected_postconditions: [],
          rollback_support: 'none',
          destructive_operations: [],
          owner_domain: 'db',
          approval_reference: 'issue:9999'
        }
      ]);
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ORPHAN_ENTRY')));
    });

    it('31. migration without registry entry rejected (ACTIVE)', () => {
      const registry = activeRegistry([
        { migration_id: 'unrelated_migration', checks: [{ check_id: 'c1', query_reference: 'q:1', expected: true }] }
      ]);
      const manifest = activeManifest([
        {
          id: '20250101000000_test',
          name: 'test migration',
          path: 'db/migrations/20250101000000_test.sql',
          checksum: 'sha256:' + 'a'.repeat(64),
          depends_on: [],
          risk_class: 'ADDITIVE',
          transaction_mode: 'REQUIRED',
          expected_preconditions: [],
          expected_postconditions: [],
          rollback_support: 'none',
          destructive_operations: [],
          owner_domain: 'db',
          approval_reference: 'issue:9999'
        }
      ]);
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_MISSING_ENTRY')));
    });
  });

  describe('8. Top-level key safety', () => {
    it('32. extra top-level key rejected', () => {
      const result = validatePreconditionRegistry(validRegistry({ extra: 'bad' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });

    it('33. symbol top-level key rejected', () => {
      const registry = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
      registry[Symbol('bad')] = 'value';
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });

    it('34. accessor top-level keys rejected', () => {
      const registry = Object.create({}, {
        format_version: { get() { return '1.0'; }, enumerable: true },
        status: { value: 'ADOPTION_REQUIRED', enumerable: true },
        entries: { value: [], enumerable: true }
      });
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });
  });

  describe('9. Proxy/revoked safety', () => {
    it('35. Proxy ownKeys throw -> FAIL', () => {
      const proxy = new Proxy({}, { ownKeys() { throw new Error('trap'); } });
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
    });

    it('36. Proxy getPrototypeOf throw -> FAIL', () => {
      const proxy = new Proxy({ format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] }, { getPrototypeOf() { throw new Error('trap'); } });
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
    });

    it('37. Proxy getOwnPropertyDescriptor throw -> FAIL', () => {
      const proxy = new Proxy({ format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] }, { getOwnPropertyDescriptor() { throw new Error('trap'); } });
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
    });

    it('38. revoked Proxy -> FAIL', () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
    });
  });

  describe('A. Null/undefined safety', () => {
    it('A1. null registry -> FAIL', () => {
      const result = validatePreconditionRegistry(null);
      assert.ok(!result.ok);
    });

    it('A2. undefined registry -> FAIL', () => {
      const result = validatePreconditionRegistry(undefined);
      assert.ok(!result.ok);
    });

    it('A3. array registry -> FAIL', () => {
      const result = validatePreconditionRegistry([]);
      assert.ok(!result.ok);
    });

    it('A4. string registry -> FAIL', () => {
      const result = validatePreconditionRegistry('bad');
      assert.ok(!result.ok);
    });

    it('A5. number registry -> FAIL', () => {
      const result = validatePreconditionRegistry(42);
      assert.ok(!result.ok);
    });
  });

  describe('B. Entry-level checks', () => {
    it('B1. migration_id empty string rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: '', checks: [] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('B2. checks not array rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: 'not-array' }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECKS_NOT_ARRAY')));
    });

    it('B3. entry forbidden authority key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0',
        status: 'ACTIVE',
        entries: [
          { migration_id: 'test', checks: [], sql: 'SELECT 1' }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('FORBIDDEN_AUTHORITY_KEY') || e.includes('ENTRY_INVALID_KEYS')));
    });
  });

  describe('C. validatePlainObjectShape', () => {
    it('C1. null rejected', () => {
      assert.strictEqual(validatePlainObjectShape(null, ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('C2. array rejected', () => {
      assert.strictEqual(validatePlainObjectShape([], ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('C3. custom prototype rejected', () => {
      function P() {}
      P.prototype.format_version = '1.0';
      assert.strictEqual(validatePlainObjectShape(new P(), ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('C4. symbol key rejected', () => {
      const o = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
      o[Symbol('bad')] = 'x';
      assert.strictEqual(validatePlainObjectShape(o, ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('C5. accessor rejected', () => {
      const o = Object.create({}, {
        format_version: { get() { return '1.0'; }, enumerable: true },
        status: { value: 'ADOPTION_REQUIRED', enumerable: true },
        entries: { value: [], enumerable: true }
      });
      assert.strictEqual(validatePlainObjectShape(o, ALLOWED_TOP_LEVEL_KEYS), false);
    });
  });
});
